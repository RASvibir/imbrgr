import { describe, expect, it } from "vitest";
import { filterPostsWithVisibleMedia } from "@/lib/post-feed-filter";

describe("filterPostsWithVisibleMedia", () => {
  it("drops posts with no media in the card slice", () => {
    const items = [
      { id: "a", media: [{ shortId: "m1" }] },
      { id: "b", media: [] },
    ];
    expect(filterPostsWithVisibleMedia(items)).toHaveLength(1);
    expect(filterPostsWithVisibleMedia(items)[0].id).toBe("a");
  });
});
