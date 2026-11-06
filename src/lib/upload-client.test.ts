import { describe, expect, it } from "vitest";
import { inferUploadMime, validateStackUploadFile } from "@/lib/upload-client";

function fakeFile(name: string, type: string, size: number): File {
  const buf = new Uint8Array(Math.min(size, 64));
  const file = new File([buf], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("upload-client", () => {
  it("infers mime from extension when type is missing", () => {
    expect(inferUploadMime(fakeFile("shot.PNG", "", 10))).toBe("image/png");
    expect(inferUploadMime(fakeFile("clip.webm", "", 10))).toBe("video/webm");
  });

  it("rejects unsupported and empty files", () => {
    expect(validateStackUploadFile(fakeFile("notes.txt", "text/plain", 12))).toMatch(/format/i);
    expect(validateStackUploadFile(fakeFile("empty.png", "image/png", 0))).toMatch(/empty/i);
  });

  it("accepts normal images", () => {
    expect(validateStackUploadFile(fakeFile("burger.jpg", "image/jpeg", 1024))).toBeNull();
  });
});
