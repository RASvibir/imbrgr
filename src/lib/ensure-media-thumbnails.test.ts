import { describe, expect, it } from "vitest";
import { warmFeedThumbnails } from "@/lib/ensure-media-thumbnails";

describe("warmFeedThumbnails", () => {
  it("does not throw outside a Next.js request scope", () => {
    expect(() =>
      warmFeedThumbnails([
        { media: [{ id: "media-1", mimeType: "image/png", thumbMdKey: null }] },
      ]),
    ).not.toThrow();
  });
});
