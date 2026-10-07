import { describe, expect, it, vi, beforeEach } from "vitest";
import { mediaFileCacheControl } from "@/lib/serve-media-file";

const { deleteObjectMock } = vi.hoisted(() => ({
  deleteObjectMock: vi.fn(async () => undefined),
}));
vi.mock("@/lib/storage", () => ({
  deleteObject: deleteObjectMock,
}));

describe("mediaFileCacheControl", () => {
  it("uses no-store for private post media", () => {
    expect(
      mediaFileCacheControl(
        {
          visibility: "PUBLIC",
          post: { userId: "u1", visibility: "PRIVATE", hiddenByAdmin: false } as const,
        },
        false,
      ),
    ).toBe("private, no-store");
  });

  it("avoids immutable cache for public gallery media", () => {
    const cc = mediaFileCacheControl(
      {
        visibility: "PUBLIC",
        post: { userId: "u1", visibility: "PUBLIC", hiddenByAdmin: false },
      },
      false,
    );
    expect(cc).not.toContain("immutable");
    expect(cc).toContain("must-revalidate");
  });

  it("allows short public cache for profile assets", () => {
    expect(mediaFileCacheControl(null, true)).toBe("public, max-age=86400");
  });
});

describe("collectUserStorageKeys", () => {
  it("includes thumbnail keys", async () => {
    const { collectUserStorageKeys } = await import("@/lib/media-storage");
    const keys = collectUserStorageKeys({
      avatarKey: "av.jpg",
      bannerKey: null,
      posts: [
        {
          media: [{ storageKey: "a.webp", thumbSmKey: "a-sm.webp", thumbMdKey: "a-md.webp" }],
        },
      ],
      mediaAssets: [{ storageKey: "b.webp", thumbSmKey: null, thumbMdKey: null }],
    });
    expect(keys.sort()).toEqual(["a-md.webp", "a-sm.webp", "a.webp", "av.jpg", "b.webp"].sort());
  });
});

describe("deleteMediaStorage", () => {
  beforeEach(() => {
    deleteObjectMock.mockClear();
  });

  it("deletes original and both thumb keys", async () => {
    const { deleteMediaStorage } = await import("@/lib/media-storage");
    await deleteMediaStorage({
      storageKey: "orig.webp",
      thumbSmKey: "sm.webp",
      thumbMdKey: "md.webp",
    });
    expect(deleteObjectMock).toHaveBeenCalledTimes(3);
    expect(deleteObjectMock).toHaveBeenCalledWith("orig.webp");
    expect(deleteObjectMock).toHaveBeenCalledWith("sm.webp");
    expect(deleteObjectMock).toHaveBeenCalledWith("md.webp");
  });
});
