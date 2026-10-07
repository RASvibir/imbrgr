import { buildShareCodes } from "@/lib/embed-codes";
import { normalizeVisibility, type Visibility } from "@/lib/visibility";

/** Sister app — journalism & dispatches (images stay on imbrgr). */
export const FIELDPRESS_URL = "https://fieldpress.studio";

export const FIELDPRESS_INVITE_DISMISS_STORAGE_KEY = "imbrgr-fieldpress-invite-dismissed";

export function canOfferFieldPressLink(visibility: string | null | undefined): boolean {
  const v = normalizeVisibility(visibility);
  return v === "PUBLIC" || v === "UNLISTED";
}

/** Absolute direct file URL (`share.directUrl`) for FieldPress compose `image=`. */
export function mediaDirectFileUrl(storageKey: string, mimeType: string): string {
  return buildShareCodes("media", storageKey, mimeType).directUrl;
}

export function fieldpressComposeUrl(imageDirectUrl: string, title?: string | null): string {
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
  return fieldpressComposeUrl(direct, input.title);
}
