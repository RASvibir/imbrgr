import { ALL_FORMATS, BlobSource, CanvasSink, Input } from "mediabunny";
import type { VisualClip } from "@/lib/video-timeline/timeline-types";
import { clipSourceTimeSec } from "@/lib/video-export/export-plan";
import type { DrawableSource } from "@/lib/video-export/render-frame";

export class UndecodableClipError extends Error {
  constructor(public readonly clipName: string) {
    super(`This browser can't decode "${clipName}".`);
    this.name = "UndecodableClipError";
  }
}

export type ClipSources = {
  get: (clip: VisualClip, timelineSec: number) => Promise<DrawableSource | null>;
  dispose: () => void;
};

type VideoEntry = {
  input: Input;
  sink: CanvasSink;
  firstTimestamp: number;
};

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
    return img;
  } catch {
    return null;
  }
}

async function openVideo(clip: VisualClip, width: number, height: number): Promise<VideoEntry> {
  const res = await fetch(clip.url);
  const blob = await res.blob();
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track || !(await track.canDecode())) throw new UndecodableClipError(clip.name);
    const sink = new CanvasSink(track, { width, height, fit: "cover", poolSize: 2 });
    const firstTimestamp = await track.getFirstTimestamp();
    return { input, sink, firstTimestamp };
  } catch (err) {
    input.dispose();
    throw err;
  }
}

export async function createClipSources(
  clips: VisualClip[],
  width: number,
  height: number,
): Promise<ClipSources> {
  const images = new Map<string, HTMLImageElement | null>();
  const videos = new Map<string, VideoEntry>();

  try {
    for (const clip of clips) {
      if (clip.kind === "video") {
        videos.set(clip.id, await openVideo(clip, width, height));
      } else {
        images.set(clip.id, await loadImage(clip.url));
      }
    }
  } catch (err) {
    for (const v of videos.values()) v.input.dispose();
    throw err;
  }

  return {
    async get(clip, timelineSec) {
      if (clip.kind === "video") {
        const entry = videos.get(clip.id);
        if (!entry) return null;
        const t = Math.max(entry.firstTimestamp, clipSourceTimeSec(clip, timelineSec));
        const frame = await entry.sink.getCanvas(t);
        if (!frame) return null;
        return { source: frame.canvas, width: frame.canvas.width, height: frame.canvas.height };
      }
      const img = images.get(clip.id);
      if (!img) return null;
      return { source: img, width: img.naturalWidth, height: img.naturalHeight };
    },
    dispose() {
      for (const v of videos.values()) v.input.dispose();
      videos.clear();
      images.clear();
    },
  };
}
