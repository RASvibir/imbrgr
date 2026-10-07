import { describe, expect, it } from "vitest";
import { postShortIdFromSharePageUrl, resolveShareChoiceHighlight } from "@/lib/share-choice-default";

describe("share choice default", () => {
  it("highlights gallery for signed-in public default", () => {
    expect(resolveShareChoiceHighlight({ signedIn: true, defaultPostVisibility: "PUBLIC" })).toBe("gallery");
  });

  it("highlights link for unlisted default and FieldPress", () => {
    expect(resolveShareChoiceHighlight({ signedIn: true, defaultPostVisibility: "UNLISTED" })).toBe("link");
    expect(resolveShareChoiceHighlight({ signedIn: true, fieldPressHandoff: true })).toBe("link");
  });

  it("guests only get link emphasis", () => {
    expect(resolveShareChoiceHighlight({ signedIn: false })).toBe("link");
  });

  it("parses post short id from page url", () => {
    expect(postShortIdFromSharePageUrl("https://imbrgr.com/p/abc123")).toBe("abc123");
  });
});
