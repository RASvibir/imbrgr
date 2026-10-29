import { describe, expect, it } from "vitest";
import { parseTags, slugifyTag, validateUploadMime } from "./validation";

describe("parseTags", () => {
  it("parses comma and hash separated tags", () => {
    expect(parseTags("cats, #dogs memes")).toEqual(["cats", "dogs", "memes"]);
  });
});

describe("slugifyTag", () => {
  it("slugifies names", () => {
    expect(slugifyTag("Hello World!")).toBe("hello-world");
  });
});

describe("validateUploadMime", () => {
  it("allows webp and mp4", () => {
    expect(validateUploadMime("image/webp")).toBe(true);
    expect(validateUploadMime("video/mp4")).toBe(true);
    expect(validateUploadMime("application/pdf")).toBe(false);
  });
});

describe("commentInputSchema", () => {
  it("validates comment body length and optional parentId", async () => {
    const { commentInputSchema } = await import("./validation");
    expect(commentInputSchema.safeParse({ body: "Delicious smashburger!" }).success).toBe(true);
    expect(commentInputSchema.safeParse({ body: "Nice reply", parentId: "c123" }).success).toBe(true);
    expect(commentInputSchema.safeParse({ body: "" }).success).toBe(false);
    // The comment form sends parentId: null for top-level comments.
    const topLevel = commentInputSchema.safeParse({ body: "Top-level comment", parentId: null });
    expect(topLevel.success).toBe(true);
    expect(topLevel.success && topLevel.data.parentId).toBeUndefined();
    expect(commentInputSchema.safeParse({ body: "a".repeat(5001) }).success).toBe(false);
  });
});
