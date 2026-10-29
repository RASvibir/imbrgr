import { describe, expect, it } from "vitest";
import {
  commentBlockReason,
  commentBlockedMessage,
  commentErrorCopy,
  commentErrorMessage,
  isCommentBlocked,
} from "./comment-safety";

describe("comment-safety", () => {
  it("blocks child exploitation terms", () => {
    expect(commentBlockReason("child sexual abuse material")).toBe("child_safety");
    expect(commentBlockReason("underage sex photo")).toBe("child_safety");
    expect(commentBlockReason("csam")).toBe("child_safety");
    expect(commentBlockReason("pedophile")).toBe("child_safety");
  });

  it("blocks link spam and character floods", () => {
    const links = "http://a.example http://b.example http://c.example http://d.example";
    expect(commentBlockReason(links)).toBe("spam");
    expect(commentBlockReason("a".repeat(40))).toBe("spam");
  });

  it("permits ordinary comments, including words near the old image-prompt list", () => {
    const ordinary = [
      "Love this one, the lighting is great",
      "my cp setup is a Raspberry Pi",
      "naked eye visibility is poor at this zoom",
      "a sexual health clinic poster would look similar",
      "check http://a.example and http://b.example",
      "minor adjustments to the spice ratio",
      "childhood memory diner smashburger",
      "a",
    ];
    for (const text of ordinary) {
      expect(isCommentBlocked(text), text).toBe(false);
    }
  });

  it("maps codes to copy and falls back for unknown codes", () => {
    expect(commentErrorMessage("blocked")).toBe(commentBlockedMessage);
    expect(commentErrorMessage("rate_limited")).toBe(commentErrorCopy.rate_limited);
    expect(commentErrorMessage(undefined)).toBe("Could not post comment");
    expect(commentErrorMessage("nope", "x")).toBe("x");
  });
});
