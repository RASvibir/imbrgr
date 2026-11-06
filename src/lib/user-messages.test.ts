import { describe, expect, it } from "vitest";
import { friendlyError } from "./user-messages";

describe("friendlyError", () => {
  it("hides provider and HTTP status", () => {
    expect(friendlyError("pollinations 500")).toBe(
      "We couldn't finish that image — tweak your description, or upload a photo to host and refine instead.",
    );
    expect(friendlyError("image_gen_http_502")).toBe(
      "We couldn't finish that image — tweak your description, or upload a photo to host and refine instead.",
    );
  });

  it("maps timeouts", () => {
    expect(friendlyError("image_gen_timeout")).toContain("couldn't finish");
    expect(friendlyError("upstream_timeout")).toMatch(/upload a photo|simpler description/i);
  });

  it("hides internal wording that no earlier rule catches", () => {
    expect(friendlyError("Invalid prisma client request")).toBe(
      "Something didn't quite work — give it another try.",
    );
  });

  it("passes short plain messages through", () => {
    expect(friendlyError("Title and at least one file required")).toBe(
      "Title and at least one file required",
    );
  });

  it("does not swallow messages containing an underscore filename", () => {
    expect(friendlyError("holiday_photo.png is too large")).toBe("holiday_photo.png is too large");
  });
});
