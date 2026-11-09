import { buildShareCodes } from "@/lib/embed-codes";
import { normalizeVisibility, type Visibility } from "@/lib/visibility";

/** Sister app — journalism & dispatches (images stay on imbrgr). */
export const FIELDPRESS_URL = "https://fieldpress.studio";

export const FIELDPRESS_INVITE_DISMISS_STORAGE_KEY = "imbrgr-fieldpress-invite-dismissed";

export function canOfferFieldPressLink(visibility: string | null | undefined): boolean {
  if (visibility == null || visibility === "") return false;
  const v = normalizeVisibility(visibility);
  return v === "PUBLIC" || v === "UNLISTED";
}

/** Generic “story on FieldPress” invite — not when a draft return path is active. */
export function showFieldPressStoryInvite(
  activeFieldPressDraftId: string | null | undefined,
  mediaVisibility: string | null | undefined,
): boolean {
  if (activeFieldPressDraftId) return false;
  if (mediaVisibility == null) return false;
  return canOfferFieldPressLink(mediaVisibility);
}

/** Absolute direct file URL (`share.directUrl`) for FieldPress compose `image=`. */
export function mediaDirectFileUrl(storageKey: string, mimeType: string): string {
  return buildShareCodes("media", storageKey, mimeType).directUrl;
}

/** Direct file URLs that FieldPress will accept (HTTPS imbrgr hosts only). */
export function isSafeFieldPressImageUrl(imageDirectUrl: string): boolean {
  try {
    const url = new URL(imageDirectUrl);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") return false;
    if (host === "imbrgr.website" || host === "www.imbrgr.website" || host === "imbrgr.vercel.app") {
      return true;
    }
    // Absolute media URLs always come from NEXT_PUBLIC_SITE_URL in production.
    const site = process.env.NEXT_PUBLIC_SITE_URL;
    if (site) {
      try {
        if (host === new URL(site).hostname.toLowerCase()) return true;
      } catch {
        /* ignore */
      }
    }
    return false;
  } catch {
    return false;
  }
}

export function fieldpressComposeUrl(imageDirectUrl: string, title?: string | null): string | null {
  if (!isSafeFieldPressImageUrl(imageDirectUrl)) return null;
  const url = new URL(FIELDPRESS_URL);
  url.searchParams.set("compose", "1");
  url.searchParams.set("image", imageDirectUrl);
  const trimmed = title?.trim();
  if (trimmed) url.searchParams.set("title", trimmed);
  return url.toString();
}

export type FieldPressStoryLinkInput = {
  storageKey: string;
  mimeType: string;
  visibility: Visibility | string;
  title?: string | null;
};

export function fieldpressStoryHref(input: FieldPressStoryLinkInput): string | null {
  if (!canOfferFieldPressLink(input.visibility)) return null;
  const direct = mediaDirectFileUrl(input.storageKey, input.mimeType);
  if (!isSafeFieldPressImageUrl(direct)) return null;
  return fieldpressComposeUrl(direct, input.title);
}
