"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import {
  AUTO_ENHANCE_EDIT,
  DEFAULT_IMAGE_EDIT_STATE,
  SLIDER_DEFAULTS,
  type ImageEditState,
  type SliderKey,
  canvasToJpegBlob,
  loadImageBitmapFromUrl,
  renderEditedImageCanvas,
} from "@/lib/image-editor-render";
import {
  DRAW_COLOR_SWATCHES,
  readStoredDrawColor,
  restoreDrawCanvas,
  snapshotDrawCanvas,
  storeDrawColor,
} from "@/lib/image-editor-draw";
import {
  cloneEditState,
  initialEditorHistory,
  type EditorHistoryEntry,
} from "@/lib/image-editor-history";

type Props = {
  imageSrc: string;
  aspectPreset?: number;
  studioMode?: boolean;
  onExport: (blob: Blob, mode: "replace" | "version") => void;
  onCancel: () => void;
};

type EditorTool = "move" | "draw" | "eraser" | "smooth" | "spot";

const FILTERS = [
  { id: "none", label: "Original" },
  { id: "ember", label: "Ember" },
  { id: "mono", label: "Mono" },
  { id: "vivid", label: "Vivid" },
];

const SLIDERS: { key: SliderKey; label: string; min: number; max: number }[] = [
  { key: "brightness", label: "Brightness", min: 50, max: 150 },
  { key: "contrast", label: "Contrast", min: 50, max: 150 },
  { key: "saturation", label: "Saturation", min: 0, max: 200 },
  { key: "exposure", label: "Exposure", min: 50, max: 150 },
  { key: "warmth", label: "Warmth", min: 50, max: 150 },
];

const TOUCH_SLIDERS: { key: "vignette" | "sharpen" | "smooth"; label: string }[] = [
  { key: "vignette", label: "Vignette" },
  { key: "sharpen", label: "Sharpen" },
  { key: "smooth", label: "Soft blur" },
];

export function ImageEditor({ imageSrc, aspectPreset, studioMode, onExport, onCancel }: Props) {
  const profileMode = aspectPreset != null;
  const allowDraw = !profileMode;

  const [workingSrc, setWorkingSrc] = useState(imageSrc);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState<number | undefined>(aspectPreset);
  const [overlayText, setOverlayText] = useState("");
  const [history, setHistory] = useState<EditorHistoryEntry[]>(initialEditorHistory);
  const [histIdx, setHistIdx] = useState(0);
  const [sliderDraft, setSliderDraft] = useState<Partial<ImageEditState> | null>(null);
  const [compare, setCompare] = useState(false);
  const [outWidth, setOutWidth] = useState<number | "">("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewRev, setPreviewRev] = useState(0);
  const [tool, setTool] = useState<EditorTool>("move");
  const [drawColor, setDrawColor] = useState(readStoredDrawColor);
  const [brushSize, setBrushSize] = useState(8);
  const [drawRev, setDrawRev] = useState(0);
  const cropArea = useRef<Area | null>(null);
  const drawCanvas = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const drawing = useRef(false);
  const previewUrlRef = useRef<string | null>(null);
  const editStateRef = useRef<ImageEditState>(DEFAULT_IMAGE_EDIT_STATE);
  const previewGen = useRef(0);
  const historyRef = useRef(history);
  historyRef.current = history;
  const histIdxRef = useRef(histIdx);
  histIdxRef.current = histIdx;
  const toolRef = useRef<EditorTool>(tool);
  toolRef.current = tool;

  useEffect(() => {
    setWorkingSrc(imageSrc);
    setHistory(initialEditorHistory());
    setHistIdx(0);
    setSliderDraft(null);
    setTool("move");
  }, [imageSrc]);

  const committed = history[histIdx]?.edit ?? DEFAULT_IMAGE_EDIT_STATE;
  const editState: ImageEditState = { ...committed, ...sliderDraft };
  editStateRef.current = editState;
  const editStateKey = JSON.stringify(editState);

  const pushHistory = useCallback((nextEdit: ImageEditState, drawDataUrl: string | null) => {
    setSliderDraft(null);
    const idx = histIdxRef.current;
    setHistory((h) => [
      ...h.slice(0, idx + 1),
      { edit: cloneEditState(nextEdit), drawDataUrl },
    ]);
    setHistIdx((i) => {
      const next = i + 1;
      histIdxRef.current = next;
      return next;
    });
  }, []);

  const commitEdit = useCallback(
    (next: ImageEditState) => {
      pushHistory(next, snapshotDrawCanvas(drawCanvas.current));
    },
    [pushHistory],
  );

  const patchEdit = useCallback(
    (patch: Partial<ImageEditState>) => {
      commitEdit({ ...editStateRef.current, ...patch });
    },
    [commitEdit],
  );

  const onCropComplete = useCallback((_: Area, area: Area) => {
    cropArea.current = area;
  }, []);

  const compositeDraw = useCallback((canvas: HTMLCanvasElement) => {
    const overlay = drawCanvas.current;
    if (!overlay || !allowDraw) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(overlay, 0, 0, canvas.width, canvas.height);
  }, [allowDraw]);

  useEffect(() => {
    let cancelled = false;
    const gen = ++previewGen.current;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const image = await loadImageBitmapFromUrl(workingSrc);
          const previewState: ImageEditState = { ...editState, rotation: 0 };
          const canvas = await renderEditedImageCanvas(
            image,
            { x: 0, y: 0, width: image.width, height: image.height },
            previewState,
          );
          compositeDraw(canvas);
          const blob = await canvasToJpegBlob(canvas);
          if (cancelled || gen !== previewGen.current) return;
          const url = URL.createObjectURL(blob);
          if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
          previewUrlRef.current = url;
          setPreviewUrl(url);
          setPreviewRev((r) => r + 1);
        } catch {
          /* preview is best-effort */
        }
      })();
    }, 70);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [workingSrc, editStateKey, drawRev, compositeDraw]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  function applyHistoryIndex(n: number) {
    setSliderDraft(null);
    histIdxRef.current = n;
    setHistIdx(n);
    restoreDrawCanvas(drawCanvas.current, historyRef.current[n]?.drawDataUrl ?? null, () => {
      setDrawRev((r) => r + 1);
    });
  }

  async function renderExport(): Promise<Blob> {
    const image = await loadImageBitmapFromUrl(workingSrc);
    const area = cropArea.current ?? { x: 0, y: 0, width: image.width, height: image.height };
    const canvas = await renderEditedImageCanvas(
      image,
      area,
      editState,
      studioMode && outWidth ? outWidth : undefined,
    );
    compositeDraw(canvas);
    const ctx = canvas.getContext("2d")!;

    if (overlayText.trim()) {
      ctx.font = "bold 24px system-ui,sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 3;
      const x = canvas.width * 0.05;
      const y = canvas.height * 0.92;
      ctx.strokeText(overlayText, x, y);
      ctx.fillText(overlayText, x, y);
    }

    return canvasToJpegBlob(canvas);
  }

  function stampErase(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0,0,0,1)";
    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function configureStroke(ctx: CanvasRenderingContext2D) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = brushSize;
    if (toolRef.current === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.filter = "none";
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else if (toolRef.current === "smooth") {
      ctx.globalCompositeOperation = "source-over";
      ctx.filter = `blur(${Math.max(2, brushSize / 2)}px)`;
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.filter = "none";
      ctx.strokeStyle = drawColor;
    }
  }

  function pointerPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = drawCanvas.current!;
    const rect = c.getBoundingClientRect();
    const sx = c.width / rect.width;
    const sy = c.height / rect.height;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  }

  function applySpotAt(clientX: number, clientY: number) {
    const root = overlayRef.current;
    if (!root) return;
    const img = root.querySelector("img");
    if (!img) return;
    const rect = img.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const nx = (clientX - rect.left) / rect.width;
    const ny = (clientY - rect.top) / rect.height;
    if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return;
    patchEdit({ spotFixes: [...editStateRef.current.spotFixes, { nx, ny }] });
  }

  function startDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    const activeTool = toolRef.current;
    if (activeTool === "move") return;
    if (activeTool === "spot") {
      applySpotAt(e.clientX, e.clientY);
      return;
    }
    drawing.current = true;
    const c = drawCanvas.current;
    if (!c) return;
    c.setPointerCapture(e.pointerId);
    const ctx = c.getContext("2d")!;
    const { x, y } = pointerPos(e);
    if (activeTool === "eraser") {
      stampErase(ctx, x, y);
      setDrawRev((r) => r + 1);
    } else {
      configureStroke(ctx);
    }
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function moveDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    const activeTool = toolRef.current;
    if (!drawing.current || activeTool === "spot" || activeTool === "move") return;
    const c = drawCanvas.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const { x, y } = pointerPos(e);
    if (activeTool === "eraser") {
      stampErase(ctx, x, y);
    } else {
      configureStroke(ctx);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
    setDrawRev((r) => r + 1);
  }

  function endDraw(e?: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    drawing.current = false;
    if (e && drawCanvas.current?.hasPointerCapture(e.pointerId)) {
      drawCanvas.current.releasePointerCapture(e.pointerId);
    }
    const activeTool = toolRef.current;
    if (activeTool === "draw" || activeTool === "eraser" || activeTool === "smooth") {
      pushHistory(editStateRef.current, snapshotDrawCanvas(drawCanvas.current));
      setDrawRev((r) => r + 1);
    }
  }

  function snapshotHistory() {
    void renderExport().then((blob) => {
      const url = URL.createObjectURL(blob);
      setWorkingSrc(url);
      setHistory(initialEditorHistory());
      setHistIdx(0);
      setSliderDraft(null);
      if (drawCanvas.current) {
        const ctx = drawCanvas.current.getContext("2d");
        ctx?.clearRect(0, 0, drawCanvas.current.width, drawCanvas.current.height);
      }
    });
  }

  function commitSlider() {
    commitEdit({ ...editStateRef.current });
  }

  function resetSlider(key: SliderKey) {
    const next = { ...editStateRef.current, [key]: SLIDER_DEFAULTS[key] };
    commitEdit(next);
  }

  function resetAllSliders() {
    commitEdit({
      ...editStateRef.current,
      brightness: 100,
      contrast: 100,
      saturation: 100,
      exposure: 100,
      warmth: 100,
      vignette: 0,
      sharpen: 0,
      smooth: 0,
    });
  }

  function pickColor(color: string) {
    setDrawColor(color);
    storeDrawColor(color);
    setTool("draw");
  }

  const cropperImage = compare ? workingSrc : previewUrl ?? workingSrc;
  const canUndo = histIdx > 0;
  const canRedo = histIdx < history.length - 1;
  const overlayInteractive = allowDraw && tool !== "move";

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col overflow-y-auto bg-black/80 p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
      style={{ touchAction: "manipulation" }}
      data-testid="image-editor"
      data-active-tool={tool}
    >
      <div
        ref={overlayRef}
        className="relative mx-auto h-[min(45dvh,420px)] w-full max-w-3xl shrink-0 overflow-hidden rounded-xl bg-[var(--surface-raised)] touch-pan-x touch-pan-y"
        data-testid="image-editor-cropper"
        data-preview-rev={previewRev}
      >
        <Cropper
          image={cropperImage}
          crop={crop}
          zoom={zoom}
          rotation={editState.rotation}
          aspect={aspect}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
        />
        {profileMode && tool === "spot" ? (
          <div
            className="absolute inset-0 z-10 cursor-crosshair"
            data-testid="image-editor-spot-overlay"
            onPointerDown={(e) => applySpotAt(e.clientX, e.clientY)}
          />
        ) : null}
        {allowDraw ? (
          <canvas
            ref={drawCanvas}
            data-testid="image-editor-draw-canvas"
            className={`absolute inset-0 z-10 h-full w-full ${overlayInteractive ? "pointer-events-auto cursor-crosshair" : "pointer-events-none"}`}
            width={800}
            height={600}
            onPointerDown={startDraw}
            onPointerMove={moveDraw}
            onPointerUp={(e) => endDraw(e)}
            onPointerCancel={(e) => endDraw(e)}
          />
        ) : null}
      </div>
      <div className="mx-auto mt-4 grid w-full max-w-3xl gap-3 pb-4 text-base text-[var(--text-primary)]">
        <div className="chip-scroll">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              data-testid={`image-editor-filter-${f.id}`}
              className={`tap-target shrink-0 rounded px-3 py-2 text-sm ${editState.filter === f.id ? "bg-[var(--accent-primary)]" : "border"}`}
              onClick={() => patchEdit({ filter: f.id })}
            >
              {f.label}
            </button>
          ))}
          {!profileMode ? (
            <>
              <button type="button" className="tap-target shrink-0 rounded border px-3 py-2 text-sm" onClick={() => setAspect(1)}>1:1</button>
              <button type="button" className="tap-target shrink-0 rounded border px-3 py-2 text-sm" onClick={() => setAspect(16 / 9)}>16:9</button>
              <button type="button" className="tap-target shrink-0 rounded border px-3 py-2 text-sm" onClick={() => setAspect(undefined)}>Free</button>
            </>
          ) : null}
          <button type="button" className="tap-target shrink-0 rounded border px-3 py-2 text-sm" onClick={() => patchEdit({ rotation: editState.rotation + 90 })}>
            Rotate
          </button>
          <button type="button" className="tap-target shrink-0 rounded border px-3 py-2 text-sm" onClick={() => patchEdit({ flipH: !editState.flipH })}>
            Flip
          </button>
          {!profileMode ? (
            <>
              <button type="button" className="tap-target shrink-0 rounded border px-3 py-2 text-sm" onClick={snapshotHistory}>Apply snapshot</button>
              <button
                type="button"
                className={`rounded border px-2 py-1 ${compare ? "bg-[var(--accent-primary)]" : ""}`}
                onPointerDown={() => setCompare(true)}
                onPointerUp={() => setCompare(false)}
                onPointerLeave={() => setCompare(false)}
              >
                Hold compare
              </button>
            </>
          ) : null}
        </div>

        <section className="rounded-lg border border-[var(--border-subtle)] p-3" data-testid="image-editor-adjust">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Adjust</h3>
            <button
              type="button"
              data-testid="image-editor-reset-all"
              className="tap-target rounded border px-2 py-1 text-xs"
              onClick={resetAllSliders}
            >
              Reset all
            </button>
          </div>
          {SLIDERS.map((s) => (
            <label key={s.key} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="w-24 shrink-0">{s.label}</span>
              <input
                type="range"
                data-testid={`image-editor-slider-${s.key}`}
                min={s.min}
                max={s.max}
                value={editState[s.key]}
                onChange={(e) => setSliderDraft((d) => ({ ...d, [s.key]: +e.target.value }))}
                onPointerUp={commitSlider}
                onTouchEnd={commitSlider}
                className="min-w-0 flex-1"
              />
              <button
                type="button"
                className="tap-target rounded border px-2 py-0.5 text-xs"
                aria-label={`Reset ${s.label}`}
                onClick={() => resetSlider(s.key)}
              >
                Reset
              </button>
            </label>
          ))}
        </section>

        <section className="rounded-lg border border-[var(--border-subtle)] p-3" data-testid="image-editor-touchup">
          <h3 className="mb-2 text-sm font-semibold">Touch up</h3>
          <div className="chip-scroll mb-2">
            <button
              type="button"
              data-testid="image-editor-touchup-auto"
              className="tap-target shrink-0 rounded border px-3 py-2 text-sm"
              onClick={() => patchEdit({ ...AUTO_ENHANCE_EDIT })}
            >
              Auto-enhance
            </button>
            <button
              type="button"
              data-testid="image-editor-tool-smooth"
              className={`tap-target shrink-0 rounded px-3 py-2 text-sm ${tool === "smooth" ? "bg-[var(--accent-primary)]" : "border"} ${!allowDraw ? "hidden" : ""}`}
              onClick={() => setTool(tool === "smooth" ? "move" : "smooth")}
            >
              Smooth brush
            </button>
            <button
              type="button"
              data-testid="image-editor-tool-spot"
              className={`tap-target shrink-0 rounded px-3 py-2 text-sm ${tool === "spot" ? "bg-[var(--accent-primary)]" : "border"}`}
              onClick={() => setTool(tool === "spot" ? "move" : "spot")}
            >
              Spot fix
            </button>
          </div>
          {TOUCH_SLIDERS.map((s) => (
            <label key={s.key} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="w-24 shrink-0">{s.label}</span>
              <input
                type="range"
                data-testid={`image-editor-touch-${s.key}`}
                min={0}
                max={100}
                value={editState[s.key]}
                onChange={(e) => setSliderDraft((d) => ({ ...d, [s.key]: +e.target.value }))}
                onPointerUp={commitSlider}
                onTouchEnd={commitSlider}
                className="min-w-0 flex-1"
              />
              <button
                type="button"
                className="tap-target rounded border px-2 py-0.5 text-xs"
                onClick={() => commitEdit({ ...editStateRef.current, [s.key]: 0 })}
              >
                Reset
              </button>
            </label>
          ))}
          <label className="flex flex-wrap items-center gap-2 text-sm">
            <span className="w-24 shrink-0">Spot size</span>
            <input
              type="range"
              data-testid="image-editor-spot-size"
              min={8}
              max={100}
              value={editState.spotSize}
              onChange={(e) => setSliderDraft((d) => ({ ...d, spotSize: +e.target.value }))}
              onPointerUp={commitSlider}
              onTouchEnd={commitSlider}
              className="min-w-0 flex-1"
            />
          </label>
          {tool === "spot" ? (
            <p className="mt-1 text-xs text-[var(--text-muted)]">Tap a blemish on the photo to soften it.</p>
          ) : null}
        </section>

        {allowDraw ? (
          <section className="rounded-lg border border-[var(--border-subtle)] p-3" data-testid="image-editor-draw">
            <h3 className="mb-2 text-sm font-semibold">Draw</h3>
            <div className="chip-scroll mb-2">
              {DRAW_COLOR_SWATCHES.map((sw) => (
                <button
                  key={sw.id}
                  type="button"
                  data-testid={`image-editor-draw-color-${sw.id}`}
                  title={sw.label}
                  className={`tap-target h-9 w-9 shrink-0 rounded-full border-2 ${drawColor === sw.color ? "border-[var(--accent-primary)]" : "border-transparent"}`}
                  style={{ backgroundColor: sw.color }}
                  onClick={() => pickColor(sw.color)}
                />
              ))}
              <label className="tap-target flex shrink-0 items-center gap-1 rounded border px-2 py-1 text-xs">
                Custom
                <input
                  type="color"
                  data-testid="image-editor-draw-color-custom"
                  value={drawColor}
                  onChange={(e) => pickColor(e.target.value)}
                  className="h-8 w-10 cursor-pointer border-0 bg-transparent p-0"
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm">
              Brush size
              <input
                type="range"
                data-testid="image-editor-brush-size"
                min={2}
                max={32}
                value={brushSize}
                onChange={(e) => setBrushSize(+e.target.value)}
                className="flex-1"
              />
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                data-testid="image-editor-tool-draw"
                className={`tap-target rounded px-3 py-2 text-sm ${tool === "draw" ? "bg-[var(--accent-primary)]" : "border"}`}
                onClick={() => setTool(tool === "draw" ? "move" : "draw")}
              >
                Pen
              </button>
              <button
                type="button"
                data-testid="image-editor-tool-eraser"
                className={`tap-target rounded px-3 py-2 text-sm ${tool === "eraser" ? "bg-[var(--accent-primary)]" : "border"}`}
                onClick={() => setTool("eraser")}
              >
                Eraser
              </button>
              <button
                type="button"
                className={`tap-target rounded px-3 py-2 text-sm ${tool === "move" ? "bg-[var(--accent-primary)]" : "border"}`}
                onClick={() => setTool("move")}
              >
                Move & crop
              </button>
            </div>
          </section>
        ) : (
          <p className="text-xs text-[var(--text-muted)]">Drag to reposition, pinch or scroll to zoom, then pick a look and save.</p>
        )}

        {!profileMode ? (
          <input
            value={overlayText}
            onChange={(e) => setOverlayText(e.target.value)}
            placeholder="Text overlay (optional)"
            className="rounded border px-2 py-1"
          />
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            data-testid="image-editor-undo"
            className="tap-target rounded border px-4 py-2 text-sm disabled:opacity-40"
            disabled={!canUndo}
            onClick={() => applyHistoryIndex(Math.max(0, histIdx - 1))}
          >
            Undo
          </button>
          <button
            type="button"
            data-testid="image-editor-redo"
            className="tap-target rounded border px-4 py-2 text-sm disabled:opacity-40"
            disabled={!canRedo}
            onClick={() => applyHistoryIndex(Math.min(history.length - 1, histIdx + 1))}
          >
            Redo
          </button>
          <button type="button" className="tap-target rounded border px-4 py-2 text-sm" onClick={onCancel}>Cancel</button>
          {profileMode || studioMode ? (
            <button
              type="button"
              data-testid="image-editor-save"
              className="tap-target rounded bg-[var(--accent-primary)] px-4 py-2 text-sm font-semibold text-[var(--on-accent)]"
              onClick={async () => onExport(await renderExport(), studioMode ? "version" : "replace")}
            >
              {studioMode ? "Save to studio" : "Save photo"}
            </button>
          ) : (
            <>
              <button
                type="button"
                className="rounded bg-[var(--accent-primary)] px-3 py-1 font-semibold text-[var(--on-accent)]"
                onClick={async () => onExport(await renderExport(), "version")}
              >
                Save new version
              </button>
              <button
                type="button"
                className="rounded border border-[var(--accent-primary)] px-3 py-1"
                onClick={async () => onExport(await renderExport(), "replace")}
              >
                Replace original
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
