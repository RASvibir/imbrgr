import { describe, expect, it } from "vitest";
import { renderTimelineFrame, type ClipSourceProvider, type RenderScene } from "./render-frame";
import type { VisualClip } from "@/lib/video-timeline/timeline-types";

type Draw = { source: unknown; alpha: number };

function fakeCtx() {
  const draws: Draw[] = [];
  const ctx = {
    globalAlpha: 1,
    fillStyle: "",
    fillRect: () => undefined,
    save: () => undefined,
    restore: () => undefined,
    translate: () => undefined,
    scale: () => undefined,
    rotate: () => undefined,
    drawImage(source: unknown) {
      draws.push({ source, alpha: ctx.globalAlpha });
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, draws };
}

function clip(id: string, startSec: number, endSec: number, over: Partial<VisualClip> = {}): VisualClip {
  return {
    id,
    trackId: "v1",
    assetId: id,
    url: id,
    name: id,
    kind: "video",
    startSec,
    endSec,
    sourceStartSec: 0,
    sourceDurationSec: endSec - startSec,
    ...over,
  };
}

const getSource: ClipSourceProvider = async (c) => ({
  source: c.id as unknown as CanvasImageSource,
  width: 100,
  height: 100,
});

function scene(clips: VisualClip[]): RenderScene {
  return { width: 100, height: 100, bgColor: "#000", visualClips: clips, textOverlays: [] };
}

describe("renderTimelineFrame transitions", () => {
  const a = clip("a", 0, 4);
  const b = clip("b", 4, 8, { transition: "dissolve", transitionDurationSec: 0.25 });

  it("draws the previous clip opaque beneath a fading-in clip during a dissolve", async () => {
    const { ctx, draws } = fakeCtx();
    await renderTimelineFrame(ctx, scene([a, b]), 4.1, getSource);
    expect(draws).toHaveLength(2);
    expect(draws[0]).toEqual({ source: "a", alpha: 1 });
    expect(draws[1].source).toBe("b");
    expect(draws[1].alpha).toBeCloseTo(0.4);
  });

  it("draws one opaque layer after the window", async () => {
    const { ctx, draws } = fakeCtx();
    await renderTimelineFrame(ctx, scene([a, b]), 5, getSource);
    expect(draws).toEqual([{ source: "b", alpha: 1 }]);
  });

  it("draws one opaque layer when the first clip dissolves with nothing before it", async () => {
    const { ctx, draws } = fakeCtx();
    const first = clip("f", 0, 4, { transition: "dissolve", transitionDurationSec: 0.5 });
    await renderTimelineFrame(ctx, scene([first]), 0.1, getSource);
    expect(draws).toEqual([{ source: "f", alpha: 1 }]);
  });

  it("fades a fade clip in without an underlay", async () => {
    const { ctx, draws } = fakeCtx();
    const f = clip("f", 4, 8, { transition: "fade", transitionDurationSec: 0.5 });
    await renderTimelineFrame(ctx, scene([a, f]), 4.25, getSource);
    expect(draws).toHaveLength(1);
    expect(draws[0].alpha).toBeCloseTo(0.5);
  });

  it("asks the source provider for the underlay's final frame", async () => {
    const asked: Array<[string, number]> = [];
    const spy: ClipSourceProvider = async (c, t) => {
      asked.push([c.id, t]);
      return { source: c.id as unknown as CanvasImageSource, width: 100, height: 100 };
    };
    const { ctx } = fakeCtx();
    await renderTimelineFrame(ctx, scene([a, b]), 4.1, spy);
    expect(asked[0][0]).toBe("a");
    expect(asked[0][1]).toBeCloseTo(3.96);
    expect(asked[1]).toEqual(["b", 4.1]);
  });
});
