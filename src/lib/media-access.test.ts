import { describe, expect, it } from "vitest";
import { canViewPost, isMediaOwner } from "./media-access";

describe("media access", () => {
  const owner = { userId: "u1", voterKey: "u:u1", ipHash: "x" };
  const stranger = { userId: "u2", voterKey: "u:u2", ipHash: "y" };
  const anon = { userId: null, voterKey: "a:vid", ipHash: "z" };

  it("private post hidden from stranger", () => {
    expect(canViewPost({ userId: "u1", visibility: "PRIVATE" }, stranger)).toBe(false);
    expect(canViewPost({ userId: "u1", visibility: "PRIVATE" }, owner)).toBe(true);
  });

  it("unlisted visible with link context", () => {
    expect(canViewPost({ userId: "u1", visibility: "UNLISTED" }, stranger)).toBe(true);
  });

  it("anon media owner by voterKey", () => {
    expect(
      isMediaOwner({ userId: null, voterKey: "a:vid", visibility: "UNLISTED" }, anon),
    ).toBe(true);
  });
});
