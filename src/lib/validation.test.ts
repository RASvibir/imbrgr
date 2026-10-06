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
