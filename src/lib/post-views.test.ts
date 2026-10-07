import { describe, expect, it } from "vitest";
import { shouldSkipOwnerView } from "@/lib/post-views";

describe("shouldSkipOwnerView", () => {
  const actorUser = { userId: "u1", voterKey: "u:u1", ipHash: "x" };
  const actorAnon = { userId: null, voterKey: "a:vid", ipHash: "x" };

  it("skips signed-in post owner", () => {
    expect(
      shouldSkipOwnerView(
        { id: "p1", userId: "u1", visibility: "PUBLIC", viewCount: 0, spiceScore: 0, media: [] },
        actorUser,
      ),
    ).toBe(true);
  });

  it("does not skip other signed-in viewers", () => {
    expect(
      shouldSkipOwnerView(
        { id: "p1", userId: "u2", visibility: "PUBLIC", viewCount: 0, spiceScore: 0, media: [] },
        actorUser,
      ),
    ).toBe(false);
  });

  it("skips anonymous media owner on ownerless post", () => {
    expect(
      shouldSkipOwnerView(
        {
          id: "p1",
          userId: null,
          visibility: "PUBLIC",
          viewCount: 0,
          spiceScore: 0,
          media: [{ userId: null, voterKey: "a:vid", visibility: "PUBLIC" }],
        },
        actorAnon,
      ),
    ).toBe(true);
  });
});
