"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import {
  DEFAULT_IMAGE_EDIT_STATE,
  type ImageEditState,
  canvasToJpegBlob,
  loadImageBitmapFromUrl,
  renderEditedImageCanvas,
} from "@/lib/image-editor-render";

type Props = {
  imageSrc: string;
  aspectPreset?: number;
  studioMode?: boolean;
  onExport: (blob: Blob, mode: "replace" | "version") => void;
  onCancel: () => void;
};

const FILTERS = [
  { id: "none", label: "Original" },
  { id: "ember", label: "Ember" },
  { id: "mono", label: "Mono" },
  { id: "vivid", label: "Vivid" },
];

function cloneState(s: ImageEditState): ImageEditState {
  return { ...s };
}

export function ImageEditor({ imageSrc, aspectPreset, studioMode, onExport, onCancel }: Props) {
  const [workingSrc, setWorkingSrc] = useState(imageSrc);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState<number | undefined>(aspectPreset);
  const [overlayText, setOverlayText] = useState("");
  const [history, setHistory] = useState<ImageEditState[]>([cloneState(DEFAULT_IMAGE_EDIT_STATE)]);
  const [histIdx, setHistIdx] = useState(0);
  const [sliderDraft, setSliderDraft] = useState<Partial<ImageEditState> | null>(null);
  const [compare, setCompare] = useState(false);
  const [outWidth, setOutWidth] = useState<number | "">("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewRev, setPreviewRev] = useState(0);
  const cropArea = useRef<Area | null>(null);
  const drawCanvas = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const previewUrlRef = useRef<string | null>(null);
  const editStateRef = useRef<ImageEditState>(DEFAULT_IMAGE_EDIT_STATE);

  useEffect(() => {
    setWorkingSrc(imageSrc);
    setHistory([cloneState(DEFAULT_IMAGE_EDIT_STATE)]);
    setHistIdx(0);
    setSliderDraft(null);
  }, [imageSrc]);

  const committed = history[histIdx] ?? DEFAULT_IMAGE_EDIT_STATE;
  const editState: ImageEditState = { ...committed, ...sliderDraft };
  editStateRef.current = editState;
  const editStateKey = JSON.stringify(editState);

  const commitEdit = useCallback(
    (next: ImageEditState) => {
      setSliderDraft(null);
      setHistory((h) => [...h.slice(0, histIdx + 1), cloneState(next)]);
      setHistIdx((i) => i + 1);
    },
    [histIdx],
  );

  const patchEdit = useCallback((patch: Partial<ImageEditState>) => {
    commitEdit({ ...editState, ...patch });
  }, [commitEdit, editState]);

  const onCropComplete = useCallback((_: Area, area: Area) => {
    cropArea.current = area;
  }, []);

  useEffect(() => {
    let cancelled = false;
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
          const blob = await canvasToJpegBlob(canvas);
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
          previewUrlRef.current = url;
          setPreviewUrl(url);
          setPreviewRev((r) => r + 1);
        } catch {
          /* preview is best-effort */
        }
      })();
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [workingSrc, editStateKey]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  async function renderExport(): Promise<Blob> {
    const image = await loadImageBitmapFromUrl(workingSrc);
    const area = cropArea.current ?? { x: 0, y: 0, width: image.width, height: image.height };
    const canvas = await renderEditedImageCanvas(
      image,
      area,
      editState,
      studioMode && outWidth ? outWidth : undefined,
    );
    const ctx = canvas.getContext("2d")!;

    if (drawCanvas.current && !profileMode) {
      ctx.drawImage(drawCanvas.current, 0, 0, canvas.width, canvas.height);
    }

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

  function startDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    const c = drawCanvas.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const rect = c.getBoundingClientRect();
    ctx.strokeStyle = "#ff6b2c";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  }

  function moveDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const c = drawCanvas.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const rect = c.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  }

  function endDraw() {
    drawing.current = false;
  }

  function snapshotHistory() {
    void renderExport().then((blob) => {
      const url = URL.createObjectURL(blob);
      setWorkingSrc(url);
      setHistory([cloneState(DEFAULT_IMAGE_EDIT_STATE)]);
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

  const profileMode = aspectPreset != null;
  const cropperImage = compare ? workingSrc : previewUrl ?? workingSrc;
  const canUndo = histIdx > 0;
  const canRedo = histIdx < history.length - 1;

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col overflow-y-auto bg-black/80 p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
      style={{ touchAction: "manipulation" }}
      data-testid="image-editor"
    >
      <div
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
        {!profileMode ? (
          <canvas
            ref={drawCanvas}
            className="pointer-events-auto absolute inset-0 h-full w-full opacity-90"
            width={800}
            height={600}
            onPointerDown={startDraw}
            onPointerMove={moveDraw}
            onPointerUp={endDraw}
            onPointerLeave={endDraw}
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
          <button
            type="button"
            className="tap-target shrink-0 rounded border px-3 py-2 text-sm"
            onClick={() => patchEdit({ rotation: editState.rotation + 90 })}
          >
            Rotate
          </button>
          <button
            type="button"
            className="tap-target shrink-0 rounded border px-3 py-2 text-sm"
            onClick={() => patchEdit({ flipH: !editState.flipH })}
          >
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
        {studioMode ? (
          <label className="flex items-center gap-2 text-sm">
            Output width (px, optional)
            <input
              type="number"
              min={64}
              max={4096}
              value={outWidth}
              onChange={(e) => setOutWidth(e.target.value ? +e.target.value : "")}
              className="w-28 rounded border px-2 py-1"
            />
          </label>
        ) : null}
        <label className="flex items-center gap-2">
          Brightness
          <input
            type="range"
            min={50}
            max={150}
            value={editState.brightness}
            onChange={(e) => setSliderDraft((d) => ({ ...d, brightness: +e.target.value }))}
            onPointerUp={commitSlider}
          />
        </label>
        <label className="flex items-center gap-2">
          Contrast
          <input
            type="range"
            min={50}
            max={150}
            value={editState.contrast}
            onChange={(e) => setSliderDraft((d) => ({ ...d, contrast: +e.target.value }))}
            onPointerUp={commitSlider}
          />
        </label>
        <label className="flex items-center gap-2">
          Saturation
          <input
            type="range"
            min={0}
            max={200}
            value={editState.saturation}
            onChange={(e) => setSliderDraft((d) => ({ ...d, saturation: +e.target.value }))}
            onPointerUp={commitSlider}
          />
        </label>
        <label className="flex items-center gap-2">
          Exposure
          <input
            type="range"
            min={50}
            max={150}
            value={editState.exposure}
            onChange={(e) => setSliderDraft((d) => ({ ...d, exposure: +e.target.value }))}
            onPointerUp={commitSlider}
          />
        </label>
        {!profileMode ? (
          <>
            <input
              value={overlayText}
              onChange={(e) => setOverlayText(e.target.value)}
              placeholder="Text overlay (optional)"
              className="rounded border px-2 py-1"
            />
            <p className="text-xs text-[var(--text-muted)]">Draw on the image with your pointer (ember stroke).</p>
          </>
        ) : (
          <p className="text-xs text-[var(--text-muted)]">Drag to reposition, pinch or scroll to zoom, then pick a look and save.</p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            data-testid="image-editor-undo"
            className="tap-target rounded border px-4 py-2 text-sm disabled:opacity-40"
            disabled={!canUndo}
            onClick={() => {
              setSliderDraft(null);
              setHistIdx((i) => Math.max(0, i - 1));
            }}
          >
            Undo
          </button>
          <button
            type="button"
            data-testid="image-editor-redo"
            className="tap-target rounded border px-4 py-2 text-sm disabled:opacity-40"
            disabled={!canRedo}
            onClick={() => {
              setSliderDraft(null);
              setHistIdx((i) => Math.min(history.length - 1, i + 1));
            }}
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
