import { describe, expect, it } from "vitest";
import { canDeletePost, isGuestPostOwner } from "@/lib/post-cleanup";

describe("guest post ownership", () => {
  const actor = { userId: null, voterKey: "vk-guest", ipHash: "x" };

  it("allows guest delete when all media share voterKey", () => {
    const post = { userId: null };
    const media = [{ userId: null, voterKey: "vk-guest", deleteTokenHash: null }];
    expect(isGuestPostOwner(post, media, actor)).toBe(true);
    expect(canDeletePost(post, media, actor)).toBe(true);
  });

  it("denies when voterKey mismatches", () => {
    const post = { userId: null };
    const media = [{ userId: null, voterKey: "other", deleteTokenHash: null }];
    expect(canDeletePost(post, media, actor)).toBe(false);
  });
});
