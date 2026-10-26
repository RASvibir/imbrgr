import type { AudioClip, VisualClip } from "@/lib/video-timeline/timeline-types";

export type ExportAspectRatio = "16:9" | "9:16" | "1:1";

export const EXPORT_FPS = 30;
export const EXPORT_SAMPLE_RATE = 48000;
export const AUDIO_CHUNK_SEC = 5;

export function exportDimensions(aspect: ExportAspectRatio): { width: number; height: number } {
  if (aspect === "9:16") return { width: 720, height: 1280 };
  if (aspect === "1:1") return { width: 1080, height: 1080 };
  return { width: 1280, height: 720 };
}

export function totalFrameCount(durationSec: number, fps: number): number {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return 1;
  return Math.max(1, Math.ceil(durationSec * fps - 1e-9));
}

export function frameTimeSec(frameIndex: number, fps: number): number {
  return frameIndex / fps;
}

export function clipSourceTimeSec(clip: VisualClip, timelineSec: number): number {
  const raw = clip.sourceStartSec + (timelineSec - clip.startSec);
  const max = clip.sourceDurationSec > 0 ? clip.sourceDurationSec : Number.POSITIVE_INFINITY;
  return Math.min(Math.max(0, raw), max);
}

export type EncoderCapabilities = {
  avc: boolean;
  vp9: boolean;
  vp8: boolean;
  aac: boolean;
  opus: boolean;
};

export type EncodePlan = {
  container: "mp4" | "webm";
  videoCodec: "avc" | "vp9" | "vp8";
  audioCodec: "aac" | "opus" | null;
  mime: "video/mp4" | "video/webm";
  ext: "mp4" | "webm";
  droppedAudio: boolean;
};

const CANDIDATES: ReadonlyArray<{
  container: EncodePlan["container"];
  videoCodec: EncodePlan["videoCodec"];
  audioCodec: "aac" | "opus";
}> = [
  { container: "mp4", videoCodec: "avc", audioCodec: "aac" },
  { container: "webm", videoCodec: "vp9", audioCodec: "opus" },
  { container: "webm", videoCodec: "vp8", audioCodec: "opus" },
];

function toPlan(
  c: (typeof CANDIDATES)[number],
  withAudio: boolean,
  droppedAudio: boolean,
): EncodePlan {
  return {
    container: c.container,
    videoCodec: c.videoCodec,
    audioCodec: withAudio ? c.audioCodec : null,
    mime: c.container === "mp4" ? "video/mp4" : "video/webm",
    ext: c.container,
    droppedAudio,
  };
}

export function chooseEncodePlan(caps: EncoderCapabilities, hasAudio: boolean): EncodePlan | null {
  for (const c of CANDIDATES) {
    if (!caps[c.videoCodec]) continue;
    if (!hasAudio) return toPlan(c, false, false);
    if (caps[c.audioCodec]) return toPlan(c, true, false);
  }
  for (const c of CANDIDATES) {
    if (caps[c.videoCodec]) return toPlan(c, false, hasAudio);
  }
  return null;
}

export type AudioSegment = {
  url: string;
  startSec: number;
  endSec: number;
  sourceStartSec: number;
  volume: number;
};

export function collectAudioSegments(
  visualClips: VisualClip[],
  audioClips: AudioClip[],
  options: { includeVideoAudio: boolean },
): AudioSegment[] {
  const out: AudioSegment[] = [];
  for (const a of audioClips) {
    if (a.muted || !(a.endSec > a.startSec)) continue;
    const volume = Math.min(1, Math.max(0, a.volume));
    if (volume === 0) continue;
    out.push({
      url: a.url,
      startSec: a.startSec,
      endSec: a.endSec,
      sourceStartSec: a.sourceStartSec ?? 0,
      volume,
    });
  }
  if (options.includeVideoAudio) {
    for (const c of visualClips) {
      if (c.kind !== "video" || !(c.endSec > c.startSec)) continue;
      out.push({
        url: c.url,
        startSec: c.startSec,
        endSec: c.endSec,
        sourceStartSec: c.sourceStartSec,
        volume: 1,
      });
    }
  }
  return out;
}

export type AudioChunk = { index: number; startFrame: number; frames: number };

export function planAudioChunks(
  durationSec: number,
  sampleRate: number = EXPORT_SAMPLE_RATE,
  chunkSec: number = AUDIO_CHUNK_SEC,
): AudioChunk[] {
  const totalFrames = Math.max(1, Math.round(durationSec * sampleRate));
  const perChunk = Math.max(1, Math.round(chunkSec * sampleRate));
  const chunks: AudioChunk[] = [];
  for (let start = 0, i = 0; start < totalFrames; start += perChunk, i++) {
    chunks.push({ index: i, startFrame: start, frames: Math.min(perChunk, totalFrames - start) });
  }
  return chunks;
}

export type ChunkPlacement = {
  segment: AudioSegment;
  whenSec: number;
  offsetSec: number;
  durationSec: number;
};

export function placeSegmentInChunk(
  segment: AudioSegment,
  chunkStartSec: number,
  chunkEndSec: number,
): ChunkPlacement | null {
  const from = Math.max(segment.startSec, chunkStartSec);
  const to = Math.min(segment.endSec, chunkEndSec);
  if (!(to > from)) return null;
  return {
    segment,
    whenSec: from - chunkStartSec,
    offsetSec: segment.sourceStartSec + (from - segment.startSec),
    durationSec: to - from,
  };
}
