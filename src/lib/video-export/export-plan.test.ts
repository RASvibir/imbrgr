import { describe, expect, it } from "vitest";
import type { AudioClip, VisualClip } from "@/lib/video-timeline/timeline-types";
import {
  chooseEncodePlan,
  clipSourceTimeSec,
  collectAudioSegments,
  exportDimensions,
  frameTimeSec,
  planAudioChunks,
  placeSegmentInChunk,
  totalFrameCount,
  type EncoderCapabilities,
} from "./export-plan";

const ALL: EncoderCapabilities = { avc: true, vp9: true, vp8: true, aac: true, opus: true };

function video(over: Partial<VisualClip> = {}): VisualClip {
  return {
    id: "v1",
    trackId: "t",
    assetId: "a",
    url: "blob:v",
    name: "v.mp4",
    kind: "video",
    startSec: 2,
    endSec: 6,
    sourceStartSec: 1,
    sourceDurationSec: 10,
    ...over,
  };
}

function audio(over: Partial<AudioClip> = {}): AudioClip {
  return { id: "a1", trackId: "t", url: "blob:a", name: "a.mp3", startSec: 0, endSec: 8, volume: 0.5, ...over };
}

describe("exportDimensions", () => {
  it("returns even dimensions for every aspect ratio", () => {
    for (const a of ["16:9", "9:16", "1:1"] as const) {
      const { width, height } = exportDimensions(a);
      expect(width % 2).toBe(0);
      expect(height % 2).toBe(0);
    }
    expect(exportDimensions("9:16")).toEqual({ width: 720, height: 1280 });
  });
});

describe("frame math", () => {
  it("counts frames without float drift", () => {
    expect(totalFrameCount(2, 30)).toBe(60);
    expect(totalFrameCount(0.1, 30)).toBe(3);
    expect(totalFrameCount(0, 30)).toBe(1);
    expect(totalFrameCount(Number.NaN, 30)).toBe(1);
  });

  it("derives frame time from the index", () => {
    expect(frameTimeSec(15, 30)).toBe(0.5);
  });

  it("maps timeline time to source time and clamps it", () => {
    const clip = video();
    expect(clipSourceTimeSec(clip, 2)).toBe(1);
    expect(clipSourceTimeSec(clip, 4.5)).toBe(3.5);
    expect(clipSourceTimeSec(clip, 100)).toBe(10);
    expect(clipSourceTimeSec(clip, -50)).toBe(0);
  });
});

describe("chooseEncodePlan", () => {
  it("prefers MP4 with AAC", () => {
    const plan = chooseEncodePlan(ALL, true);
    expect(plan).toMatchObject({ container: "mp4", videoCodec: "avc", audioCodec: "aac", ext: "mp4" });
  });

  it("falls back to WebM VP9 with Opus when AVC is missing", () => {
    const plan = chooseEncodePlan({ ...ALL, avc: false }, true);
    expect(plan).toMatchObject({ container: "webm", videoCodec: "vp9", audioCodec: "opus", mime: "video/webm" });
  });

  it("falls back to VP8 when VP9 is missing too", () => {
    const plan = chooseEncodePlan({ ...ALL, avc: false, vp9: false }, false);
    expect(plan).toMatchObject({ videoCodec: "vp8", audioCodec: null, droppedAudio: false });
  });

  it("skips a container whose audio codec is unavailable", () => {
    const plan = chooseEncodePlan({ ...ALL, aac: false }, true);
    expect(plan).toMatchObject({ container: "webm", audioCodec: "opus" });
  });

  it("drops audio instead of failing when no audio encoder exists", () => {
    const plan = chooseEncodePlan({ ...ALL, aac: false, opus: false }, true);
    expect(plan).toMatchObject({ container: "mp4", audioCodec: null, droppedAudio: true });
  });

  it("returns null with no video encoder", () => {
    expect(chooseEncodePlan({ ...ALL, avc: false, vp9: false, vp8: false }, false)).toBeNull();
  });

  it("does not flag dropped audio when the project has none", () => {
    expect(chooseEncodePlan({ ...ALL, aac: false, opus: false }, false)?.droppedAudio).toBe(false);
  });
});

describe("collectAudioSegments", () => {
  it("includes audio clips and video clip audio", () => {
    const segs = collectAudioSegments([video()], [audio()], { includeVideoAudio: true });
    expect(segs).toHaveLength(2);
    expect(segs[0]).toMatchObject({ url: "blob:a", volume: 0.5, sourceStartSec: 0 });
    expect(segs[1]).toMatchObject({ url: "blob:v", startSec: 2, endSec: 6, sourceStartSec: 1, volume: 1 });
  });

  it("skips muted, silent, empty and image clips", () => {
    const segs = collectAudioSegments(
      [video({ kind: "image" }), video({ id: "v2", startSec: 3, endSec: 3 })],
      [audio({ muted: true }), audio({ id: "a2", volume: 0 }), audio({ id: "a3", startSec: 4, endSec: 4 })],
      { includeVideoAudio: true },
    );
    expect(segs).toEqual([]);
  });

  it("clamps volume and honours includeVideoAudio=false", () => {
    const segs = collectAudioSegments([video()], [audio({ volume: 3 })], { includeVideoAudio: false });
    expect(segs).toHaveLength(1);
    expect(segs[0].volume).toBe(1);
  });

  it("uses the clip's source offset when present", () => {
    const segs = collectAudioSegments([], [audio({ sourceStartSec: 12 })], { includeVideoAudio: false });
    expect(segs[0].sourceStartSec).toBe(12);
  });
});

describe("planAudioChunks", () => {
  it("covers the whole duration exactly", () => {
    const chunks = planAudioChunks(12.3, 48000, 5);
    const total = chunks.reduce((n, c) => n + c.frames, 0);
    expect(total).toBe(Math.round(12.3 * 48000));
    expect(chunks).toHaveLength(3);
    expect(chunks[1].startFrame).toBe(240000);
  });

  it("makes one chunk for short projects", () => {
    expect(planAudioChunks(2, 48000, 5)).toHaveLength(1);
  });
});

describe("placeSegmentInChunk", () => {
  const seg = { url: "u", startSec: 3, endSec: 9, sourceStartSec: 2, volume: 1 };

  it("returns null when the segment is outside the chunk", () => {
    expect(placeSegmentInChunk(seg, 10, 15)).toBeNull();
    expect(placeSegmentInChunk(seg, 0, 3)).toBeNull();
  });

  it("starts mid-chunk and offsets into the source", () => {
    expect(placeSegmentInChunk(seg, 0, 5)).toEqual({ segment: seg, whenSec: 3, offsetSec: 2, durationSec: 2 });
  });

  it("continues a segment that began in an earlier chunk", () => {
    expect(placeSegmentInChunk(seg, 5, 10)).toEqual({ segment: seg, whenSec: 0, offsetSec: 4, durationSec: 4 });
  });
});
