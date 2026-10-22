"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { btnPrimary, btnSecondary } from "@/lib/ui/button-classes";
import { computeFrameRects, normalizeClipRange, type MediaStudioLayout } from "@/lib/media-studio-layout";
import { exportMedia } from "@/lib/media-studio-export";

type AssetKind = "image" | "gif" | "video" | "audio";

type MediaAsset = {
  id: string;
  file: File;
  url: string;
  kind: AssetKind;
  durationSec: number;
  startSec: number;
  endSec: number;
};

const LAYOUTS: { id: MediaStudioLayout; label: string }[] = [
  { id: "side-by-side", label: "Side by side" },
  { id: "stacked", label: "Stacked" },
  { id: "grid", label: "Grid" },
  { id: "overlay", label: "Overlay" },
  { id: "pip", label: "Picture in picture" },
  { id: "collage", label: "GIF collage" },
];

function toKind(file: File): AssetKind | null {
  if (file.type.startsWith("image/")) return file.type === "image/gif" ? "gif" : "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return null;
}

async function readDurationSec(file: File, kind: AssetKind): Promise<number> {
  if (kind === "image" || kind === "gif") return 2.5;
  if (kind === "audio") return 6;
  return await new Promise<number>((resolve) => {
    const el = document.createElement("video");
    const blobUrl = URL.createObjectURL(file);
    const done = (value: number) => {
      el.removeAttribute("src");
      el.load();
      URL.revokeObjectURL(blobUrl);
      resolve(value);
    };
    el.preload = "metadata";
    el.muted = true;
    el.onloadedmetadata = () =>
      done(Number.isFinite(el.duration) && el.duration > 0 ? Math.min(el.duration, 120) : 6);
    el.onerror = () => done(6);
    el.src = blobUrl;
  });
}

export function MediaCreationSuite() {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [layout, setLayout] = useState<MediaStudioLayout>("grid");
  const [rows, setRows] = useState(2);
  const [columns, setColumns] = useState(2);
  const [spacing, setSpacing] = useState(12);
  const [bgColor, setBgColor] = useState("#111111");
  const [fit, setFit] = useState<"contain" | "cover">("cover");
  const [canvasWidth, setCanvasWidth] = useState(1280);
  const [canvasHeight, setCanvasHeight] = useState(720);
  const [transitionSec, setTransitionSec] = useState(0.3);
  const [ecoFilter, setEcoFilter] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const assetsRef = useRef<MediaAsset[]>([]);
  const exportUrlRef = useRef<string | null>(null);

  useEffect(() => {
    assetsRef.current = assets;
    exportUrlRef.current = exportUrl;
  }, [assets, exportUrl]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      assetsRef.current.forEach((a) => URL.revokeObjectURL(a.url));
      if (exportUrlRef.current) URL.revokeObjectURL(exportUrlRef.current);
    },
    [],
  );

  const visualAssets = useMemo(() => assets.filter((a) => a.kind !== "audio"), [assets]);
  const audioAssets = useMemo(() => assets.filter((a) => a.kind === "audio"), [assets]);
  const selected = assets.find((a) => a.id === selectedId) ?? null;

  const rects = useMemo(
    () =>
      computeFrameRects({
        layout,
        count: visualAssets.length,
        canvasWidth,
        canvasHeight,
        spacing,
        rows,
        columns,
      }),
    [layout, visualAssets.length, canvasWidth, canvasHeight, spacing, rows, columns],
  );

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError("");
    const next: MediaAsset[] = [];
    for (const file of Array.from(files)) {
      const kind = toKind(file);
      if (!kind) {
        setError(`Unsupported file type: ${file.type || file.name}`);
        continue;
      }
      const maxBytes = kind === "video" ? 100 * 1024 * 1024 : 20 * 1024 * 1024;
      if (file.size > maxBytes) {
        setError(`${file.name} is too large for browser editing.`);
        continue;
      }
      const durationSec = await readDurationSec(file, kind);
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      next.push({
        id,
        file,
        url: URL.createObjectURL(file),
        kind,
        durationSec,
        startSec: 0,
        endSec: durationSec,
      });
    }
    if (next.length > 0) {
      setAssets((prev) => [...prev, ...next]);
      setSelectedId(next[0].id);
      setStatus(`Imported ${next.length} asset${next.length === 1 ? "" : "s"}.`);
    }
  };

  const removeAsset = (id: string) => {
    setAssets((prev) => {
      const hit = prev.find((a) => a.id === id);
      if (hit) URL.revokeObjectURL(hit.url);
      return prev.filter((a) => a.id !== id);
    });
    if (selectedId === id) setSelectedId(null);
  };

  const moveAsset = (id: string, dir: -1 | 1) => {
    setAssets((prev) => {
      const index = prev.findIndex((a) => a.id === id);
      if (index < 0) return prev;
      const nextIndex = index + dir;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const cp = [...prev];
      const [item] = cp.splice(index, 1);
      cp.splice(nextIndex, 0, item);
      return cp;
    });
  };

  const updateSelectedRange = (patch: Partial<Pick<MediaAsset, "startSec" | "endSec" | "durationSec">>) => {
    if (!selected) return;
    setAssets((prev) =>
      prev.map((asset) => {
        if (asset.id !== selected.id) return asset;
        const duration = patch.durationSec ?? asset.durationSec;
        const start = patch.startSec ?? asset.startSec;
        const end = patch.endSec ?? asset.endSec;
        const normalized = normalizeClipRange(duration, start, end);
        return { ...asset, ...normalized };
      }),
    );
  };

  const exportWebm = async () => {
    setError("");
    setStatus("");
    if (visualAssets.length === 0) {
      setError("Add at least one image, GIF, or video before exporting.");
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setExporting(true);
    try {
      const result = await exportMedia({
        assets: assets.map(({ id, url, kind, startSec, endSec }) => ({ id, url, kind, startSec, endSec })),
        layout,
        rows,
        columns,
        spacing,
        bgColor,
        fit,
        canvasWidth,
        canvasHeight,
        transitionSec,
        ecoFilter,
        signal: controller.signal,
      });
      if (!result) {
        setStatus("Export canceled.");
        return;
      }
      setExportUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(result.blob);
      });
      const notes = [...result.warnings];
      if (audioAssets.length > 0) {
        notes.push("Audio tracks are imported for preview only and are not yet baked into browser exports.");
      }
      setStatus(["Export complete.", ...notes].join(" "));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setExporting(false);
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  return (
    <section className="mt-6 space-y-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4">
      <header>
        <h2 className="text-xl font-semibold">Media lab</h2>
        <p className="text-sm text-[var(--text-muted)]">
          Smooth local editing for image/video mashups: timeline-style ordering, trims, collage layouts, overlays, and private in-browser export.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="rounded-lg border border-dashed border-[var(--border-strong)] p-4 text-sm">
          Import images, GIFs, videos, or audio
          <input type="file" accept="image/*,video/*,audio/*" multiple className="mt-2 block w-full" onChange={(e) => void onFiles(e.target.files)} />
        </label>
        <div className="rounded-lg border p-4 text-sm text-[var(--text-muted)]">
          <p>Privacy first: files stay local in your browser while editing.</p>
          <p className="mt-1">Exports as WebM. Animated GIFs are preserved in Chromium-based browsers.</p>
        </div>
      </div>

      {assets.length > 0 ? (
        <ul className="space-y-2" aria-label="Imported assets">
          {assets.map((asset, index) => (
            <li key={asset.id} className={`rounded-lg border p-3 ${selectedId === asset.id ? "border-[var(--accent-primary)]" : "border-[var(--border-subtle)]"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button type="button" className="text-left text-sm font-medium" onClick={() => setSelectedId(asset.id)}>
                  {index + 1}. {asset.file.name} <span className="text-[var(--text-muted)]">({asset.kind})</span>
                </button>
                <div className="flex gap-2">
                  <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => moveAsset(asset.id, -1)}>↑</button>
                  <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => moveAsset(asset.id, 1)}>↓</button>
                  <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => removeAsset(asset.id)}>Remove</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {selected ? (
        <div className="grid gap-4 rounded-xl border border-[var(--border-subtle)] p-4 md:grid-cols-2">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Selected preview</h3>
            {selected.kind === "video" ? <video src={selected.url} controls className="max-h-64 w-full rounded-lg bg-black" /> : null}
            {selected.kind === "audio" ? <audio src={selected.url} controls className="w-full" /> : null}
            {selected.kind === "image" || selected.kind === "gif" ? <img src={selected.url} alt={selected.file.name} className="max-h-64 w-full rounded-lg object-contain" /> : null}
          </div>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Trim & timing</h3>
            <label className="block text-sm">
              Clip length (seconds)
              <input type="number" min={0.1} step={0.1} value={selected.durationSec} onChange={(e) => updateSelectedRange({ durationSec: Number(e.target.value) })} className="mt-1 w-full rounded border px-2 py-1" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm">
                Start
                <input type="number" min={0} step={0.1} value={selected.startSec} onChange={(e) => updateSelectedRange({ startSec: Number(e.target.value) })} className="mt-1 w-full rounded border px-2 py-1" />
              </label>
              <label className="text-sm">
                End
                <input type="number" min={0.1} step={0.1} value={selected.endSec} onChange={(e) => updateSelectedRange({ endSec: Number(e.target.value) })} className="mt-1 w-full rounded border px-2 py-1" />
              </label>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-sm">Layout
          <select value={layout} onChange={(e) => setLayout(e.target.value as MediaStudioLayout)} className="mt-1 w-full rounded border px-2 py-2">
            {LAYOUTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <label className="text-sm">Rows
          <input type="number" min={1} value={rows} onChange={(e) => setRows(Number(e.target.value))} className="mt-1 w-full rounded border px-2 py-2" />
        </label>
        <label className="text-sm">Columns
          <input type="number" min={1} value={columns} onChange={(e) => setColumns(Number(e.target.value))} className="mt-1 w-full rounded border px-2 py-2" />
        </label>
        <label className="text-sm">Spacing
          <input type="number" min={0} value={spacing} onChange={(e) => setSpacing(Number(e.target.value))} className="mt-1 w-full rounded border px-2 py-2" />
        </label>
        <label className="text-sm">Background
          <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="mt-1 h-10 w-full rounded border" />
        </label>
        <label className="text-sm">Fit
          <select value={fit} onChange={(e) => setFit(e.target.value as "contain" | "cover")} className="mt-1 w-full rounded border px-2 py-2">
            <option value="cover">Cover</option>
            <option value="contain">Contain</option>
          </select>
        </label>
        <label className="text-sm">Width
          <input type="number" min={320} value={canvasWidth} onChange={(e) => setCanvasWidth(Number(e.target.value))} className="mt-1 w-full rounded border px-2 py-2" />
        </label>
        <label className="text-sm">Height
          <input type="number" min={240} value={canvasHeight} onChange={(e) => setCanvasHeight(Number(e.target.value))} className="mt-1 w-full rounded border px-2 py-2" />
        </label>
        <label className="text-sm">Overlay transition
          <input type="number" min={0} step={0.1} value={transitionSec} onChange={(e) => setTransitionSec(Number(e.target.value))} className="mt-1 w-full rounded border px-2 py-2" />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={ecoFilter} onChange={(e) => setEcoFilter(e.target.checked)} />
          Eco preview filter (pacNcap-style)
        </label>
      </div>

      <div className="rounded-xl border bg-black p-2" style={{ maxWidth: 720 }}>
        <div
          className="relative overflow-hidden rounded"
          style={{
            width: "100%",
            aspectRatio: `${canvasWidth} / ${canvasHeight}`,
            background: bgColor,
          }}
        >
          {visualAssets.map((asset, i) => {
            const rect = rects[i];
            if (!rect) return null;
            const style = {
              position: "absolute" as const,
              left: `${(rect.x / canvasWidth) * 100}%`,
              top: `${(rect.y / canvasHeight) * 100}%`,
              width: `${(rect.width / canvasWidth) * 100}%`,
              height: `${(rect.height / canvasHeight) * 100}%`,
              objectFit: fit,
              zIndex: rect.zIndex,
              filter: ecoFilter ? "grayscale(100%)" : "none",
            };
            if (asset.kind === "video") return <video key={asset.id} src={asset.url} muted loop autoPlay playsInline style={style} />;
            return <img key={asset.id} src={asset.url} alt={asset.file.name} style={style} />;
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnPrimary} disabled={exporting} onClick={() => void exportWebm()}>
          {exporting ? "Exporting…" : "Export WebM"}
        </button>
        <button type="button" className={btnSecondary} onClick={() => setError("GIF export is not reliable in this browser build. Use WebM export above as the supported fallback.")}>
          Export GIF (fallback notice)
        </button>
        {exporting ? (
          <button type="button" className={btnSecondary} onClick={() => abortRef.current?.abort()}>
            Cancel export
          </button>
        ) : null}
      </div>

      {exportUrl ? (
        <div className="space-y-2 rounded-lg border border-[var(--border-subtle)] p-3">
          <video src={exportUrl} controls className="max-h-72 w-full rounded bg-black" />
          <a href={exportUrl} download="imbrgr-media-lab.webm" className="text-sm text-[var(--accent-primary)] underline underline-offset-2">
            Download exported WebM
          </a>
        </div>
      ) : null}

      {status ? <p className="text-sm text-[var(--accent-primary)]">{status}</p> : null}
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
    </section>
  );
}
