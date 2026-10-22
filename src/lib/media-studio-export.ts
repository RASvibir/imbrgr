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
  videoAudio: boolean;
  signal: AbortSignal;
};

export type ExportResult = { blob: Blob; mime: string; warnings: string[] };

type Rect = { x: number; y: number; width: number; height: number };

type GifTrack = { frames: ImageBitmap[]; starts: number[]; totalSec: number };

type LoadedVisuals = {
  videos: Map<string, HTMLVideoElement>;
  images: Map<string, HTMLImageElement>;
  gifs: Map<string, GifTrack>;
  warnings: string[];
  dispose: () => void;
};

const MAX_GIF_FRAMES = 300;

async function decodeGif(url: string): Promise<GifTrack | null> {
  const Decoder = (globalThis as { ImageDecoder?: new (init: { data: ArrayBuffer; type: string }) => ImageDecoderLike }).ImageDecoder;
  if (!Decoder) return null;
  try {
    const data = await (await fetch(url)).arrayBuffer();
    const decoder = new Decoder({ data, type: "image/gif" });
    await decoder.tracks.ready;
    const count = Math.min(decoder.tracks.selectedTrack?.frameCount ?? 0, MAX_GIF_FRAMES);
    if (count < 2) return null;
    const frames: ImageBitmap[] = [];
    const starts: number[] = [];
    let t = 0;
    for (let i = 0; i < count; i++) {
      const { image } = await decoder.decode({ frameIndex: i });
      starts.push(t);
      t += Math.max(0.02, (image.duration ?? 100000) / 1_000_000);
      frames.push(await createImageBitmap(image));
      image.close();
    }
    decoder.close();
    return { frames, starts, totalSec: t };
  } catch {
    return null;
  }
}

type ImageDecoderLike = {
  tracks: { ready: Promise<unknown>; selectedTrack?: { frameCount: number } | null };
  decode: (opts: { frameIndex: number }) => Promise<{ image: VideoFrame }>;
  close: () => void;
};

function gifFrameAt(track: GifTrack, elapsedSec: number): ImageBitmap {
  const t = elapsedSec % track.totalSec;
  let idx = 0;
  for (let i = 0; i < track.starts.length; i++) {
    if (track.starts[i] <= t) idx = i;
    else break;
  }
  return track.frames[idx];
}

export function pickRecorderMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4",
  ];
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
  const gifs = new Map<string, GifTrack>();
  const warnings: string[] = [];

  for (const asset of visual) {
    if (asset.kind === "gif") {
      const track = await decodeGif(asset.url);
      if (track) {
        gifs.set(asset.id, track);
        continue;
      }
      if (!warnings.includes("GIF")) {
        warnings.push("GIF");
      }
    }
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
    gifs.forEach((g) => g.frames.forEach((f) => f.close()));
  };

  return { videos, images, gifs, warnings, dispose };
}

type AudioMix = {
  stream: MediaStream;
  start: () => void;
  dispose: () => void;
  warnings: string[];
};

async function buildAudioMix(
  audioCtx: AudioContext,
  assets: ExportAsset[],
  loaded: LoadedVisuals,
  videoAudio: boolean,
): Promise<AudioMix | null> {
  const dest = audioCtx.createMediaStreamDestination();
  const warnings: string[] = [];
  const clips: { buffer: AudioBuffer; asset: ExportAsset }[] = [];

  for (const asset of assets.filter((a) => a.kind === "audio")) {
    try {
      const data = await (await fetch(asset.url)).arrayBuffer();
      clips.push({ buffer: await audioCtx.decodeAudioData(data), asset });
    } catch {
      warnings.push("An audio clip could not be decoded and was left out of the export.");
    }
  }

  const videoNodes: MediaElementAudioSourceNode[] = [];
  if (videoAudio) {
    loaded.videos.forEach((video) => {
      try {
        video.muted = false;
        const node = audioCtx.createMediaElementSource(video);
        node.connect(dest);
        videoNodes.push(node);
      } catch {
        warnings.push("Audio from a video clip could not be captured.");
      }
    });
  }

  if (clips.length === 0 && videoNodes.length === 0) return warnings.length ? { stream: dest.stream, start: () => undefined, dispose: () => undefined, warnings } : null;

  const sources: AudioBufferSourceNode[] = [];
  return {
    stream: dest.stream,
    warnings,
    start: () => {
      const at = audioCtx.currentTime + 0.05;
      for (const { buffer, asset } of clips) {
        const src = audioCtx.createBufferSource();
        src.buffer = buffer;
        src.connect(dest);
        const offset = Math.min(asset.startSec, Math.max(0, buffer.duration - 0.01));
        src.start(at, offset, Math.max(0.05, asset.endSec - asset.startSec));
        sources.push(src);
      }
    },
    dispose: () => {
      sources.forEach((src) => {
        try {
          src.stop();
        } catch {
          // already stopped
        }
      });
      videoNodes.forEach((node) => node.disconnect());
    },
  };
}

function drawVisuals(
  ctx: CanvasRenderingContext2D,
  visual: ExportAsset[],
  rects: Rect[],
  loaded: LoadedVisuals,
  opts: ExportOptions,
  elapsedSec: number,
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
    } else if (asset.kind === "gif" && loaded.gifs.has(asset.id)) {
      const frame = gifFrameAt(loaded.gifs.get(asset.id)!, elapsedSec);
      drawCover(ctx, frame, frame.width, frame.height, rect, opts.fit);
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

  const audioCtx = typeof AudioContext !== "undefined" ? new AudioContext() : null;
  void audioCtx?.resume();

  const pluginManager = new VideoPluginManager({ performanceMode: opts.ecoFilter ? "active" : "eco" });
  if (opts.ecoFilter) await pluginManager.registerPlugin(ecoRenderPlugin);

  const loaded = await loadVisuals(visual);
  const mix = audioCtx ? await buildAudioMix(audioCtx, opts.assets, loaded, opts.videoAudio) : null;
  const stream = new MediaStream([
    ...canvas.captureStream(24).getVideoTracks(),
    ...(mix?.stream.getAudioTracks() ?? []),
  ]);
  const recorder = new MediaRecorder(stream, { mimeType: mime });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  const finished = new Promise<ExportResult | null>((resolve) => {
    recorder.onstop = () => {
      mix?.dispose();
      loaded.dispose();
      void audioCtx?.close();
      void pluginManager.unloadPlugin(ecoRenderPlugin.metadata.id);
      const warnings = [
        ...loaded.warnings.map(
          () => "Animated GIF export needs a Chromium-based browser; GIFs were exported as a still frame.",
        ),
        ...(mix?.warnings ?? []),
      ];
      resolve(
        opts.signal.aborted ? null : { blob: new Blob(chunks, { type: mime.split(";")[0] }), mime, warnings },
      );
    };
  });

  const totalDuration = Math.max(...opts.assets.map((a) => a.endSec - a.startSec), 2);
  const started = performance.now();
  recorder.start();
  mix?.start();

  const drawFrame = async () => {
    const elapsedSec = (performance.now() - started) / 1000;
    if (opts.signal.aborted || elapsedSec > totalDuration) {
      if (recorder.state !== "inactive") recorder.stop();
      return;
    }

    ctx.fillStyle = opts.bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawVisuals(ctx, visual, rects, loaded, opts, elapsedSec);

    if (opts.ecoFilter) {
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      ctx.putImageData(await pluginManager.processFrame(frame), 0, 0);
    }

    requestAnimationFrame(() => void drawFrame());
  };

  void drawFrame();
  return finished;
}
