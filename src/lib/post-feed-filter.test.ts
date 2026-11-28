import { describe, expect, it } from "vitest";
import { filterPostsWithVisibleMedia, postHasVisibleMedia } from "@/lib/post-feed-filter";

describe("filterPostsWithVisibleMedia", () => {
  it("drops posts with no media in the card slice", () => {
    const items = [
      { id: "a", media: [{ shortId: "m1" }] },
      { id: "b", media: [] },
    ];
    expect(filterPostsWithVisibleMedia(items)).toHaveLength(1);
    expect(filterPostsWithVisibleMedia(items)[0].id).toBe("a");
  });

  it("treats both image and video media rows as visible post media", () => {
    expect(postHasVisibleMedia([])).toBe(false);
    expect(postHasVisibleMedia([{ mimeType: "image/jpeg" }])).toBe(true);
    expect(postHasVisibleMedia([{ mimeType: "video/mp4" }])).toBe(true);
    expect(postHasVisibleMedia([{ mimeType: "video/webm" }])).toBe(true);
  });
});
