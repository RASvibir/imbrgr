import { describe, expect, it } from "vitest";
import { videoExportFormat } from "@/lib/video-export-format";

describe("videoExportFormat", () => {
  it("uses mp4 for Safari-style recordings", () => {
    expect(videoExportFormat("video/mp4")).toEqual({ mime: "video/mp4", ext: "mp4", label: "MP4" });
    expect(videoExportFormat("video/mp4;codecs=avc1")).toMatchObject({ ext: "mp4" });
    expect(videoExportFormat(" VIDEO/MP4 ")).toMatchObject({ ext: "mp4" });
  });

  it("uses webm for Chromium/Firefox recordings", () => {
    expect(videoExportFormat("video/webm")).toEqual({ mime: "video/webm", ext: "webm", label: "WebM" });
    expect(videoExportFormat("video/webm;codecs=vp9")).toMatchObject({ ext: "webm" });
  });

  it("falls back to webm when the type is missing or unknown", () => {
    expect(videoExportFormat("")).toMatchObject({ ext: "webm" });
    expect(videoExportFormat(undefined)).toMatchObject({ ext: "webm" });
    expect(videoExportFormat("application/octet-stream")).toMatchObject({ ext: "webm" });
  });
});
