import { describe, expect, it } from "vitest";
import { DELETED_USER_LABEL, isAnonymousGuestPost, postAuthorLabel } from "@/lib/post-author";

describe("postAuthorLabel", () => {
  it("shows username when present", () => {
    expect(postAuthorLabel({ user: { username: "chef" }, media: [] })).toBe("@chef");
  });

  it("shows anonymous for guest voterKey posts", () => {
    expect(
      postAuthorLabel({ user: null, media: [{ voterKey: "a:abc" }] }),
    ).toBe("anonymous");
    expect(isAnonymousGuestPost({ user: null, media: [{ voterKey: "a:abc" }] })).toBe(true);
  });

  it("shows deleted user for ownerless posts without guest keys", () => {
    expect(postAuthorLabel({ user: null, media: [{ voterKey: null }] })).toBe(DELETED_USER_LABEL);
    expect(isAnonymousGuestPost({ user: null, media: [] })).toBe(false);
  });
});
