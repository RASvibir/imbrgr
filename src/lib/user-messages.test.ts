import { describe, expect, it } from "vitest";
import { friendlyError } from "./user-messages";

describe("friendlyError", () => {
  it("hides provider and HTTP status", () => {
    expect(friendlyError("pollinations 500")).toBe(
      "We couldn't finish that image — tweak your description and try again.",
    );
    expect(friendlyError("image_gen_http_502")).toBe(
      "We couldn't finish that image — tweak your description and try again.",
    );
  });

  it("maps timeouts", () => {
    expect(friendlyError("image_gen_timeout")).toContain("couldn't finish");
  });
});
