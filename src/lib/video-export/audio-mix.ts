import {
  EXPORT_SAMPLE_RATE,
  planAudioChunks,
  placeSegmentInChunk,
  type AudioSegment,
} from "@/lib/video-export/export-plan";

export type MixResult = {
  chunks: AsyncGenerator<AudioBuffer, void, unknown>;
  skipped: number;
};

async function decodeAll(
  segments: AudioSegment[],
  sampleRate: number,
): Promise<{ buffers: Map<string, AudioBuffer>; skipped: number }> {
  const buffers = new Map<string, AudioBuffer>();
  const failed = new Set<string>();
  const decoder = new OfflineAudioContext(2, 1, sampleRate);
  for (const seg of segments) {
    if (buffers.has(seg.url) || failed.has(seg.url)) continue;
    try {
      const res = await fetch(seg.url);
      const data = await res.arrayBuffer();
      buffers.set(seg.url, await decoder.decodeAudioData(data));
    } catch {
      failed.add(seg.url);
    }
  }
  const skipped = segments.filter((s) => failed.has(s.url)).length;
  return { buffers, skipped };
}

export async function mixAudio(
  segments: AudioSegment[],
  durationSec: number,
  sampleRate: number = EXPORT_SAMPLE_RATE,
): Promise<MixResult> {
  const { buffers, skipped } = await decodeAll(segments, sampleRate);
  const usable = segments.filter((s) => buffers.has(s.url));
  const plan = planAudioChunks(durationSec, sampleRate);

  async function* render(): AsyncGenerator<AudioBuffer, void, unknown> {
    for (const chunk of plan) {
      const startSec = chunk.startFrame / sampleRate;
      const endSec = (chunk.startFrame + chunk.frames) / sampleRate;
      const ctx = new OfflineAudioContext(2, chunk.frames, sampleRate);
      for (const seg of usable) {
        const placed = placeSegmentInChunk(seg, startSec, endSec);
        if (!placed) continue;
        const src = ctx.createBufferSource();
        src.buffer = buffers.get(seg.url) ?? null;
        const gain = ctx.createGain();
        gain.gain.value = seg.volume;
        src.connect(gain).connect(ctx.destination);
        src.start(placed.whenSec, placed.offsetSec, placed.durationSec);
      }
      yield await ctx.startRendering();
    }
  }

  return { chunks: render(), skipped };
}
