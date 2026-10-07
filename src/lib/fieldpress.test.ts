import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  canOfferFieldPressLink,
  fieldpressComposeUrl,
  isSafeFieldPressImageUrl,
  mediaDirectFileUrl,
} from "@/lib/fieldpress";

describe("fieldpress", () => {
  const prev = process.env.NEXT_PUBLIC_SITE_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://imbrgr.vercel.app";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = prev;
  });

  it("builds direct file URLs for compose", () => {
    const direct = mediaDirectFileUrl("uploads/x.png", "image/png");
    expect(direct).toBe(
      "https://imbrgr.vercel.app/api/media/file/uploads/x.png?mime=image%2Fpng",
    );
    const compose = fieldpressComposeUrl(direct, "My title");
    expect(compose).toBeTruthy();
    const parsed = new URL(compose!);
    expect(parsed.searchParams.get("compose")).toBe("1");
    expect(parsed.searchParams.get("image")).toBe(direct);
    expect(parsed.searchParams.get("title")).toBe("My title");
  });

  it("gates private media", () => {
    expect(canOfferFieldPressLink("PUBLIC")).toBe(true);
    expect(canOfferFieldPressLink("UNLISTED")).toBe(true);
    expect(canOfferFieldPressLink("PRIVATE")).toBe(false);
  });

  it("rejects localhost compose image URLs", () => {
    expect(isSafeFieldPressImageUrl("http://localhost:3000/api/media/file/x.png")).toBe(false);
    expect(fieldpressComposeUrl("http://localhost:3000/api/media/file/x.png")).toBeNull();
    expect(isSafeFieldPressImageUrl("https://imbrgr.vercel.app/api/media/file/x.png")).toBe(true);
  });
});
