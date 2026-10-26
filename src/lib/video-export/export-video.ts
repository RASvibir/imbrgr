import {
  AudioBufferSource,
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  WebMOutputFormat,
  canEncodeAudio,
  canEncodeVideo,
} from "mediabunny";
import type { AudioClip, TextOverlay, VisualClip } from "@/lib/video-timeline/timeline-types";
import type { VideoPluginManager } from "@/lib/video-plugins/plugin-manager";
import { mixAudio } from "@/lib/video-export/audio-mix";
import { createClipSources } from "@/lib/video-export/clip-sources";
import {
  EXPORT_FPS,
  EXPORT_SAMPLE_RATE,
  chooseEncodePlan,
  collectAudioSegments,
  exportDimensions,
  frameTimeSec,
  totalFrameCount,
  type EncodePlan,
  type EncoderCapabilities,
  type ExportAspectRatio,
} from "@/lib/video-export/export-plan";
import { renderTimelineFrame } from "@/lib/video-export/render-frame";

export class ExportUnsupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExportUnsupportedError";
  }
}

export type ExportTimelineOptions = {
  visualClips: VisualClip[];
  audioClips: AudioClip[];
  textOverlays: TextOverlay[];
  aspectRatio: ExportAspectRatio;
  bgColor: string;
  durationSec: number;
  pluginManager: VideoPluginManager;
  pluginsActive: boolean;
  fps?: number;
  includeVideoAudio?: boolean;
  signal?: AbortSignal;
  onProgress?: (percent: number) => void;
};

export type ExportResult = {
  blob: Blob;
  mime: EncodePlan["mime"];
  ext: EncodePlan["ext"];
  videoCodec: EncodePlan["videoCodec"];
  audioCodec: EncodePlan["audioCodec"];
  droppedAudio: boolean;
  skippedAudioSegments: number;
};

const YIELD_EVERY_FRAMES = 6;
const AUDIO_LOOKAHEAD_SEC = 2;

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Export canceled", "AbortError");
}

function nextTask(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function probeCapabilities(width: number, height: number, fps: number): Promise<EncoderCapabilities> {
  const video = { width, height, frameRate: fps, quality: QUALITY_HIGH } as const;
  const audio = { numberOfChannels: 2, sampleRate: EXPORT_SAMPLE_RATE, quality: QUALITY_HIGH } as const;
  const [avc, vp9, vp8, aac, opus] = await Promise.all([
    canEncodeVideo("avc", video),
    canEncodeVideo("vp9", video),
    canEncodeVideo("vp8", video),
    canEncodeAudio("aac", audio),
    canEncodeAudio("opus", audio),
  ]);
  return { avc, vp9, vp8, aac, opus };
}

export async function exportTimelineVideo(opts: ExportTimelineOptions): Promise<ExportResult> {
  if (typeof VideoEncoder === "undefined" || typeof OfflineAudioContext === "undefined") {
    throw new ExportUnsupportedError("WebCodecs is not available in this browser.");
  }

  const fps = opts.fps ?? EXPORT_FPS;
  const { width, height } = exportDimensions(opts.aspectRatio);
  const segments = collectAudioSegments(opts.visualClips, opts.audioClips, {
    includeVideoAudio: opts.includeVideoAudio ?? true,
  });

  const caps = await probeCapabilities(width, height, fps);
  const plan = chooseEncodePlan(caps, segments.length > 0);
  if (!plan) throw new ExportUnsupportedError("No supported video encoder in this browser.");

  throwIfAborted(opts.signal);
  const sources = await createClipSources(opts.visualClips, width, height);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", opts.pluginsActive ? { willReadFrequently: true } : undefined);
  if (!ctx) {
    sources.dispose();
    throw new ExportUnsupportedError("Could not create a rendering canvas.");
  }

  const output = new Output({
    format: plan.container === "mp4" ? new Mp4OutputFormat({ fastStart: "in-memory" }) : new WebMOutputFormat(),
    target: new BufferTarget(),
  });

  const videoSource = new CanvasSource(canvas, {
    codec: plan.videoCodec,
    bitrate: QUALITY_HIGH,
    keyFrameInterval: 2,
  });
  output.addVideoTrack(videoSource, { frameRate: fps });

  const audioSource = plan.audioCodec
    ? new AudioBufferSource({ codec: plan.audioCodec, bitrate: QUALITY_HIGH })
    : null;
  if (audioSource) output.addAudioTrack(audioSource);

  const scene = {
    width,
    height,
    bgColor: opts.bgColor,
    visualClips: opts.visualClips,
    textOverlays: opts.textOverlays,
  };

  let skippedAudioSegments = 0;
  let finalized = false;

  try {
    const mix = audioSource ? await mixAudio(segments, opts.durationSec, EXPORT_SAMPLE_RATE) : null;
    skippedAudioSegments = mix?.skipped ?? 0;

    await output.start();

    const total = totalFrameCount(opts.durationSec, fps);
    let audioAddedSec = 0;
    let audioDone = !mix;

    const pumpAudio = async (untilSec: number) => {
      while (mix && audioSource && !audioDone && audioAddedSec < untilSec) {
        const next = await mix.chunks.next();
        if (next.done) {
          audioDone = true;
          break;
        }
        await audioSource.add(next.value);
        audioAddedSec += next.value.duration;
      }
    };

    for (let i = 0; i < total; i++) {
      throwIfAborted(opts.signal);
      const t = frameTimeSec(i, fps);

      await renderTimelineFrame(ctx, scene, t, sources.get);

      if (opts.pluginsActive) {
        opts.pluginManager.setFrameContext(t, i);
        const raw = ctx.getImageData(0, 0, width, height);
        ctx.putImageData(await opts.pluginManager.processFrame(raw), 0, 0);
      }

      await videoSource.add(t, 1 / fps);
      await pumpAudio(t + AUDIO_LOOKAHEAD_SEC);

      if (i % YIELD_EVERY_FRAMES === 0) {
        opts.onProgress?.(Math.min(99, Math.floor((i / total) * 100)));
        await nextTask();
      }
    }

    await pumpAudio(Number.POSITIVE_INFINITY);
    throwIfAborted(opts.signal);
    await output.finalize();
    finalized = true;
    opts.onProgress?.(100);

    const buffer = output.target.buffer;
    if (!buffer) throw new Error("Export produced no data.");

    return {
      blob: new Blob([buffer], { type: plan.mime }),
      mime: plan.mime,
      ext: plan.ext,
      videoCodec: plan.videoCodec,
      audioCodec: plan.audioCodec,
      droppedAudio: plan.droppedAudio,
      skippedAudioSegments,
    };
  } catch (err) {
    if (!finalized) await output.cancel().catch(() => undefined);
    throw err;
  } finally {
    sources.dispose();
  }
}
