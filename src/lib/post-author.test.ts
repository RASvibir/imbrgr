import { describe, expect, it } from "vitest";
import { DELETED_USER_LABEL, isAnonymousGuestPost, postAuthorLabel } from "@/lib/post-author";

describe("postAuthorLabel", () => {
  it("shows username when present", () => {
    expect(postAuthorLabel({ user: { username: "chef" } })).toBe("@chef");
  });

  it("shows anonymous for guest posts", () => {
    expect(postAuthorLabel({ user: null })).toBe("anonymous");
    expect(postAuthorLabel({ user: null, authorDeleted: false })).toBe("anonymous");
    expect(isAnonymousGuestPost({ user: null })).toBe(true);
  });

  it("shows deleted user for posts kept after account deletion", () => {
    expect(postAuthorLabel({ user: null, authorDeleted: true })).toBe(DELETED_USER_LABEL);
    expect(isAnonymousGuestPost({ user: null, authorDeleted: true })).toBe(false);
  });
});
