import { describe, expect, it } from "vitest";
import {
  absoluteOgMediaUrl,
  buildImagePageMetadata,
  buildPostPageMetadata,
  CRAWLER_ACTOR,
  mediaEligibleForOg,
} from "./og";

describe("og metadata", () => {
  it("allows unlisted standalone media for crawlers", () => {
    const ok = mediaEligibleForOg({
      shortId: "abc12345",
      mimeType: "image/png",
      altText: null,
      width: 512,
      height: 512,
      visibility: "UNLISTED",
      userId: null,
      voterKey: "guest",
      post: null,
    });
    expect(ok).toBe(true);
  });

  it("blocks private post media from OG", () => {
    const ok = mediaEligibleForOg({
      shortId: "abc12345",
      mimeType: "image/jpeg",
      altText: null,
      width: 100,
      height: 100,
      visibility: "PRIVATE",
      userId: "u1",
      voterKey: null,
      post: { userId: "u1", visibility: "PRIVATE" },
    });
    expect(ok).toBe(false);
  });

  it("buildPostPageMetadata uses OG image route for public posts", () => {
    const meta = buildPostPageMetadata(
      {
        shortId: "post1",
        title: "Sunset plate",
        description: "Yum",
        visibility: "PUBLIC",
        userId: "u1",
      },
      {
        shortId: "img1",
        mimeType: "image/png",
        altText: "sunset",
        width: 800,
        height: 600,
        visibility: "PUBLIC",
        userId: "u1",
        voterKey: null,
        post: { userId: "u1", visibility: "PUBLIC" },
      },
      "/p/post1",
    );
    const og = meta.openGraph as { images?: { url: string }[]; type?: string } | undefined;
    expect(og?.images?.[0]?.url).toBe(absoluteOgMediaUrl("img1"));
    expect(og?.type).toBe("article");
    expect((meta.twitter as { card?: string })?.card).toBe("summary_large_image");
  });

  it("private post falls back to branding metadata", () => {
    const meta = buildPostPageMetadata(
      {
        shortId: "priv",
        title: "Secret",
        description: null,
        visibility: "PRIVATE",
        userId: "u1",
      },
      null,
      "/p/priv",
    );
    expect(meta.robots).toEqual({ index: false, follow: false });
    expect(CRAWLER_ACTOR.userId).toBeNull();
    const images = meta.openGraph?.images;
    const first = Array.isArray(images) ? images[0] : images;
    const url = typeof first === "object" && first && "url" in first ? first.url : first;
    expect(url).toBe("/og-image.png");
  });

  it("buildImagePageMetadata sets og:url", () => {
    const meta = buildImagePageMetadata(
      {
        shortId: "img2",
        mimeType: "image/webp",
        altText: "Burger",
        width: 400,
        height: 400,
        visibility: "UNLISTED",
        userId: null,
        voterKey: "v",
        post: null,
      },
      "/i/img2",
    );
    expect(meta.openGraph?.url).toContain("/i/img2");
  });
});
