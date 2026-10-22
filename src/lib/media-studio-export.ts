import { computeFrameRects, type MediaStudioLayout } from "@/lib/media-studio-layout";
import { VideoPluginManager } from "@/lib/video-plugins/plugin-manager";
import { ecoRenderPlugin } from "@/lib/video-plugins/eco-render-plugin";

export type ExportAssetKind = "image" | "gif" | "video" | "audio";

export type ExportAsset = {
  id: string;
  url: string;
  kind: ExportAssetKind;
  startSec: number;
  endSec: number;
};

export type ExportOptions = {
  assets: ExportAsset[];
  layout: MediaStudioLayout;
  rows: number;
  columns: number;
  spacing: number;
  bgColor: string;
  fit: "contain" | "cover";
  canvasWidth: number;
  canvasHeight: number;
  transitionSec: number;
  ecoFilter: boolean;
  signal: AbortSignal;
};

export type ExportResult = { blob: Blob; mime: string };

type Rect = { x: number; y: number; width: number; height: number };

type LoadedVisuals = {
  videos: Map<string, HTMLVideoElement>;
  images: Map<string, HTMLImageElement>;
  dispose: () => void;
};

export function pickRecorderMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
}

export function drawCover(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sw: number,
  sh: number,
  rect: Rect,
  fit: "contain" | "cover",
) {
  if (!sw || !sh) return;
  if (fit === "contain") {
    const ratio = Math.min(rect.width / sw, rect.height / sh);
    const w = Math.max(1, Math.floor(sw * ratio));
    const h = Math.max(1, Math.floor(sh * ratio));
    ctx.drawImage(source, rect.x + Math.floor((rect.width - w) / 2), rect.y + Math.floor((rect.height - h) / 2), w, h);
    return;
  }
  const ratio = Math.max(rect.width / sw, rect.height / sh);
  const cw = rect.width / ratio;
  const ch = rect.height / ratio;
  ctx.drawImage(source, (sw - cw) / 2, (sh - ch) / 2, cw, ch, rect.x, rect.y, rect.width, rect.height);
}

async function loadVisuals(visual: ExportAsset[]): Promise<LoadedVisuals> {
  const videos = new Map<string, HTMLVideoElement>();
  const images = new Map<string, HTMLImageElement>();

  for (const asset of visual) {
    if (asset.kind === "video") {
      const v = document.createElement("video");
      v.muted = true;
      v.playsInline = true;
      v.loop = true;
      v.src = asset.url;
      await new Promise<void>((resolve) => {
        v.onloadedmetadata = () => resolve();
        v.onerror = () => resolve();
      });
      v.currentTime = asset.startSec;
      void v.play().catch(() => undefined);
      videos.set(asset.id, v);
    } else {
      const img = new Image();
      img.src = asset.url;
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      });
      images.set(asset.id, img);
    }
  }

  const dispose = () => {
    videos.forEach((v) => {
      v.pause();
      v.removeAttribute("src");
      v.load();
    });
  };

  return { videos, images, dispose };
}

function drawVisuals(
  ctx: CanvasRenderingContext2D,
  visual: ExportAsset[],
  rects: Rect[],
  loaded: LoadedVisuals,
  opts: ExportOptions,
) {
  for (let i = 0; i < visual.length; i++) {
    const asset = visual[i];
    const rect = rects[i];
    if (!rect) continue;
    ctx.globalAlpha = opts.layout === "overlay" ? Math.max(0.2, 1 - (i * opts.transitionSec) / 3) : 1;

    if (asset.kind === "video") {
      const video = loaded.videos.get(asset.id);
      if (!video) continue;
      if (video.currentTime < asset.startSec || video.currentTime > asset.endSec) {
        video.currentTime = asset.startSec;
      }
      drawCover(ctx, video, video.videoWidth, video.videoHeight, rect, opts.fit);
    } else {
      const img = loaded.images.get(asset.id);
      if (img) drawCover(ctx, img, img.width, img.height, rect, opts.fit);
    }
  }
  ctx.globalAlpha = 1;
}

export async function exportMedia(opts: ExportOptions): Promise<ExportResult | null> {
  const visual = opts.assets.filter((a) => a.kind !== "audio");
  if (visual.length === 0) throw new Error("Add at least one image, GIF, or video before exporting.");

  const mime = pickRecorderMime();
  if (!mime) throw new Error("This browser cannot record video from the editor. Try a Chromium-based browser.");

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(320, opts.canvasWidth);
  canvas.height = Math.max(240, opts.canvasHeight);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas export is not available in this browser.");

  const rects = computeFrameRects({
    layout: opts.layout,
    count: visual.length,
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    spacing: opts.spacing,
    rows: opts.rows,
    columns: opts.columns,
  });

  const pluginManager = new VideoPluginManager({ performanceMode: opts.ecoFilter ? "active" : "eco" });
  if (opts.ecoFilter) await pluginManager.registerPlugin(ecoRenderPlugin);

  const loaded = await loadVisuals(visual);
  const recorder = new MediaRecorder(canvas.captureStream(24), { mimeType: mime });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  const finished = new Promise<ExportResult | null>((resolve) => {
    recorder.onstop = () => {
      loaded.dispose();
      void pluginManager.unloadPlugin(ecoRenderPlugin.metadata.id);
      resolve(opts.signal.aborted ? null : { blob: new Blob(chunks, { type: mime.split(";")[0] }), mime });
    };
  });

  const totalDuration = Math.max(...visual.map((a) => a.endSec - a.startSec), 2);
  const started = performance.now();
  recorder.start();

  const drawFrame = async () => {
    const elapsedSec = (performance.now() - started) / 1000;
    if (opts.signal.aborted || elapsedSec > totalDuration) {
      if (recorder.state !== "inactive") recorder.stop();
      return;
    }

    ctx.fillStyle = opts.bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawVisuals(ctx, visual, rects, loaded, opts);

    if (opts.ecoFilter) {
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      ctx.putImageData(await pluginManager.processFrame(frame), 0, 0);
    }

    requestAnimationFrame(() => void drawFrame());
  };

  void drawFrame();
  return finished;
}
