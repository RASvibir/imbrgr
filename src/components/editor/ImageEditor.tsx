"use client";

import { useCallback, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

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

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("export failed"))), "image/jpeg", 0.92);
  });
}

function applyFilter(ctx: CanvasRenderingContext2D, w: number, h: number, filter: string) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (filter === "mono") {
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i] = d[i + 1] = d[i + 2] = g;
    } else if (filter === "ember") {
      d[i] = Math.min(255, d[i] * 1.1 + 20);
      d[i + 1] *= 0.92;
      d[i + 2] *= 0.85;
    } else if (filter === "vivid") {
      d[i] = Math.min(255, d[i] * 1.15);
      d[i + 1] = Math.min(255, d[i + 1] * 1.1);
      d[i + 2] = Math.min(255, d[i + 2] * 1.1);
    }
  }
  ctx.putImageData(img, 0, 0);
}

export function ImageEditor({ imageSrc, aspectPreset, studioMode, onExport, onCancel }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [aspect, setAspect] = useState<number | undefined>(aspectPreset);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [exposure, setExposure] = useState(100);
  const [filter, setFilter] = useState("none");
  const [flipH, setFlipH] = useState(false);
  const [overlayText, setOverlayText] = useState("");
  const [history, setHistory] = useState<string[]>([imageSrc]);
  const [histIdx, setHistIdx] = useState(0);
  const [compare, setCompare] = useState(false);
  const [outWidth, setOutWidth] = useState<number | "">("");
  const cropArea = useRef<Area | null>(null);
  const drawCanvas = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);

  const src = history[histIdx] ?? imageSrc;

  const onCropComplete = useCallback((_: Area, area: Area) => {
    cropArea.current = area;
  }, []);

  async function renderExport(): Promise<Blob> {
    const image = await createImageBitmap(await (await fetch(src)).blob());
    const area = cropArea.current ?? { x: 0, y: 0, width: image.width, height: image.height };
    const canvas = document.createElement("canvas");
    const targetW = studioMode && outWidth ? Math.min(4096, Math.max(64, outWidth)) : area.width;
    const scale = studioMode && outWidth ? targetW / area.width : 1;
    canvas.width = Math.round(area.width * scale);
    canvas.height = Math.round(area.height * scale);
    const ctx = canvas.getContext("2d")!;
    const exp = exposure / 100;
    ctx.filter = `brightness(${brightness * exp}%) contrast(${contrast}%) saturate(${saturation}%)`;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(flipH ? -1 : 1, 1);
    ctx.drawImage(
      image,
      area.x,
      area.y,
      area.width,
      area.height,
      -canvas.width / 2,
      -canvas.height / 2,
      canvas.width,
      canvas.height,
    );
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    applyFilter(ctx, canvas.width, canvas.height, filter);

    if (drawCanvas.current) {
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

    return canvasToBlob(canvas);
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
      setHistory((h) => [...h.slice(0, histIdx + 1), url]);
      setHistIdx((i) => i + 1);
      if (drawCanvas.current) {
        const ctx = drawCanvas.current.getContext("2d");
        ctx?.clearRect(0, 0, drawCanvas.current.width, drawCanvas.current.height);
      }
    });
  }

  const profileMode = aspectPreset != null;
  const compareSrc = compare ? imageSrc : src;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80 p-4">
      <div className="relative mx-auto h-[50vh] w-full max-w-3xl overflow-hidden rounded-xl bg-[var(--surface-raised)]">
        <Cropper
          image={compareSrc}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={aspect}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onRotationChange={setRotation}
          onCropComplete={onCropComplete}
        />
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
      </div>
      <div className="mx-auto mt-4 grid w-full max-w-3xl gap-3 text-sm text-[var(--text-primary)]">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`rounded px-2 py-1 ${filter === f.id ? "bg-[var(--accent-primary)]" : "border"}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
          {!profileMode ? (
            <>
              <button type="button" className="rounded border px-2 py-1" onClick={() => setAspect(1)}>1:1</button>
              <button type="button" className="rounded border px-2 py-1" onClick={() => setAspect(16 / 9)}>16:9</button>
              <button type="button" className="rounded border px-2 py-1" onClick={() => setAspect(undefined)}>Free</button>
            </>
          ) : null}
          <button type="button" className="rounded border px-2 py-1" onClick={() => setRotation((r) => r + 90)}>Rotate</button>
          <button type="button" className="rounded border px-2 py-1" onClick={() => setFlipH((f) => !f)}>Flip</button>
          <button type="button" className="rounded border px-2 py-1" onClick={snapshotHistory}>Apply snapshot</button>
          {!profileMode ? (
            <button
              type="button"
              className={`rounded border px-2 py-1 ${compare ? "bg-[var(--accent-primary)]" : ""}`}
              onPointerDown={() => setCompare(true)}
              onPointerUp={() => setCompare(false)}
              onPointerLeave={() => setCompare(false)}
            >
              Hold compare
            </button>
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
        <label className="flex items-center gap-2">Brightness
          <input type="range" min={50} max={150} value={brightness} onChange={(e) => setBrightness(+e.target.value)} />
        </label>
        <label className="flex items-center gap-2">Contrast
          <input type="range" min={50} max={150} value={contrast} onChange={(e) => setContrast(+e.target.value)} />
        </label>
        <label className="flex items-center gap-2">Saturation
          <input type="range" min={0} max={200} value={saturation} onChange={(e) => setSaturation(+e.target.value)} />
        </label>
        <label className="flex items-center gap-2">Exposure
          <input type="range" min={50} max={150} value={exposure} onChange={(e) => setExposure(+e.target.value)} />
        </label>
        <input
          value={overlayText}
          onChange={(e) => setOverlayText(e.target.value)}
          placeholder="Text overlay (optional)"
          className="rounded border px-2 py-1"
        />
        <p className="text-xs text-[var(--text-muted)]">Draw on the image with your pointer (ember stroke).</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded border px-3 py-1" disabled={histIdx <= 0} onClick={() => setHistIdx((i) => i - 1)}>Undo</button>
          <button type="button" className="rounded border px-3 py-1" disabled={histIdx >= history.length - 1} onClick={() => setHistIdx((i) => i + 1)}>Redo</button>
          <button type="button" className="rounded border px-3 py-1" onClick={onCancel}>Cancel</button>
          {profileMode || studioMode ? (
            <button
              type="button"
              className="rounded bg-[var(--accent-primary)] px-3 py-1 font-semibold text-[var(--on-accent)]"
              onClick={async () => onExport(await renderExport(), studioMode ? "version" : "replace")}
            >
              {studioMode ? "Save to studio" : "Save"}
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
