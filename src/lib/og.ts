import type { Metadata } from "next";
import { canViewMedia, canViewPost } from "@/lib/media-access";
import type { Actor } from "@/lib/request-identity";
import { siteUrl } from "@/lib/urls";

/** Actor with no session — matches Facebook/Google crawlers. */
export const CRAWLER_ACTOR: Actor = {
  userId: null,
  voterKey: "",
  ipHash: "",
};

const SITE_OG_IMAGE = "/og-image.png";

export function ogMediaRoutePath(mediaShortId: string): string {
  return `/api/og/m/${mediaShortId}`;
}

export function absoluteOgMediaUrl(mediaShortId: string): string {
  return siteUrl(ogMediaRoutePath(mediaShortId));
}

export function absolutePageUrl(path: string): string {
  return siteUrl(path);
}

type MediaRow = {
  shortId: string;
  mimeType: string;
  altText: string | null;
  width: number | null;
  height: number | null;
  visibility: string;
  userId: string | null;
  voterKey: string | null;
  post?: { userId: string | null; visibility: string } | null;
};

type PostRow = {
  shortId: string;
  title: string;
  description: string | null;
  visibility: string;
  userId: string | null;
  hiddenByAdmin?: boolean;
};

export function mediaEligibleForOg(media: MediaRow): boolean {
  if (!media.mimeType.startsWith("image/")) return false;
  return canViewMedia(media, CRAWLER_ACTOR);
}

export function defaultShareMetadata(): Metadata {
  return {
    openGraph: {
      images: [{ url: SITE_OG_IMAGE, width: 1200, height: 630, alt: "imbrgr — images, served hot" }],
    },
    twitter: {
      card: "summary_large_image",
      images: [SITE_OG_IMAGE],
    },
  };
}

export function buildImagePageMetadata(
  media: MediaRow,
  pagePath: string,
): Metadata {
  if (!mediaEligibleForOg(media)) {
    return {
      title: "imbrgr",
      robots: { index: false, follow: false },
      ...defaultShareMetadata(),
    };
  }

  const title = media.altText?.trim() || "Image on imbrgr";
  const description = "Shared on imbrgr — images, served hot.";
  const imageUrl = absoluteOgMediaUrl(media.shortId);

  return {
    title,
    description,
    openGraph: {
      type: "website",
      url: absolutePageUrl(pagePath),
      title,
      description,
      images: [
        {
          url: imageUrl,
          width: media.width ?? 1200,
          height: media.height ?? 630,
          alt: media.altText ?? title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export function buildPostPageMetadata(
  post: PostRow,
  primaryMedia: MediaRow | null,
  pagePath: string,
): Metadata {
  if (!canViewPost(post, CRAWLER_ACTOR)) {
    return {
      title: "imbrgr",
      robots: { index: false, follow: false },
      ...defaultShareMetadata(),
    };
  }

  const description =
    post.description?.trim().slice(0, 300) ||
    "Shared on imbrgr — images, served hot.";

  const base: Metadata = {
    title: post.title,
    description,
    openGraph: {
      type: "article",
      url: absolutePageUrl(pagePath),
      title: post.title,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description,
    },
  };

  if (primaryMedia && mediaEligibleForOg(primaryMedia)) {
    const imageUrl = absoluteOgMediaUrl(primaryMedia.shortId);
    const image = {
      url: imageUrl,
      width: primaryMedia.width ?? 1200,
      height: primaryMedia.height ?? 630,
      alt: primaryMedia.altText ?? post.title,
    };
    return {
      ...base,
      openGraph: { ...base.openGraph, images: [image] },
      twitter: { ...base.twitter, images: [imageUrl] },
    };
  }

  return { ...base, ...defaultShareMetadata() };
}
