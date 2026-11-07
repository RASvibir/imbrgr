import { describe, expect, it } from "vitest";
import { isVideoStyleId, resolveSequenceVideoStyleId } from "./resolve-video-style";

describe("resolveSequenceVideoStyleId", () => {
  it("prefers a valid sequence VIDEO_STYLES id over the kit", () => {
    expect(resolveSequenceVideoStyleId("cinematic", "cyberpunk")).toBe("cinematic");
  });

  it("does not let image STYLES kit ids overwrite a sequence video style", () => {
    expect(resolveSequenceVideoStyleId("macro", "photo")).toBe("macro");
    expect(resolveSequenceVideoStyleId("retro", "ember")).toBe("retro");
  });

  it("falls back to kit only when kit id is a VIDEO_STYLES id", () => {
    expect(resolveSequenceVideoStyleId(null, "cyberpunk")).toBe("cyberpunk");
    expect(resolveSequenceVideoStyleId("", "anime")).toBe("anime");
  });

  it("ignores image STYLES kit ids when sequence has no video style", () => {
    expect(resolveSequenceVideoStyleId(null, "photo")).toBeNull();
    expect(resolveSequenceVideoStyleId(null, "ember")).toBeNull();
    expect(resolveSequenceVideoStyleId(null, "sketch")).toBeNull();
  });

  it("ignores invalid sequence style ids and still accepts a valid kit video style", () => {
    expect(resolveSequenceVideoStyleId("photo", "cinematic")).toBe("cinematic");
    expect(resolveSequenceVideoStyleId("ember", "sketch")).toBeNull();
  });
});

describe("isVideoStyleId", () => {
  it("recognizes VIDEO_STYLES only", () => {
    expect(isVideoStyleId("cinematic")).toBe(true);
    expect(isVideoStyleId("photo")).toBe(false);
  });
});
