import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearFieldPressDraftId,
  fieldpressDraftComposeWithImageUrl,
  fieldpressDraftReturnUrl,
  ingestFieldPressDraftFromQuery,
  parseFieldPressDraftId,
  readFieldPressDraftId,
} from "@/lib/fieldpress-draft";

const memory = new Map<string, string>();

describe("fieldpress draft context", () => {
  beforeEach(() => {
    memory.clear();
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => memory.get(k) ?? null,
      setItem: (k: string, v: string) => memory.set(k, v),
      removeItem: (k: string) => memory.delete(k),
    });
    clearFieldPressDraftId();
  });

  afterEach(() => {
    clearFieldPressDraftId();
    vi.unstubAllGlobals();
  });

  it("validates draft ids", () => {
    expect(parseFieldPressDraftId("abc-123_9")).toBe("abc-123_9");
    expect(parseFieldPressDraftId("../evil")).toBeNull();
    expect(parseFieldPressDraftId("a".repeat(65))).toBeNull();
    expect(parseFieldPressDraftId("")).toBeNull();
  });

  it("builds compose URLs only from FIELDPRESS_URL", () => {
    const back = fieldpressDraftReturnUrl("draft42");
    expect(back).toBe("https://fieldpress.studio/?compose=1&draft=draft42");
    expect(back).not.toContain("evil.com");

    const withImage = fieldpressDraftComposeWithImageUrl(
      "draft42",
      "https://imbrgr.vercel.app/api/media/file/x.png?mime=image%2Fpng",
      "Headline",
    );
    expect(withImage).toContain("https://fieldpress.studio/");
    expect(withImage).toContain("draft=draft42");
    const parsed = new URL(withImage!);
    expect(parsed.searchParams.get("image")).toContain("imbrgr.vercel.app");
    expect(parsed.searchParams.get("title")).toBe("Headline");
  });

  it("rejects unsafe image hosts", () => {
    expect(
      fieldpressDraftComposeWithImageUrl("d1", "http://localhost:3000/api/media/file/x.png"),
    ).toBeNull();
  });

  it("persists valid draft in sessionStorage for the tab", () => {
    expect(ingestFieldPressDraftFromQuery("fieldpress", "my-draft")).toBe("my-draft");
    expect(readFieldPressDraftId()).toBe("my-draft");
    expect(ingestFieldPressDraftFromQuery("fieldpress", "bad/id")).toBe("my-draft");
  });
});
