import type { Visibility } from "@/lib/visibility";
import { FIELDPRESS_URL, isSafeFieldPressImageUrl } from "@/lib/fieldpress";

export const FIELDPRESS_DRAFT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export const FIELDPRESS_DRAFT_SESSION_KEY = "imbrgr-fieldpress-draft-id";

/**
 * Default visibility for new studio media when the user arrived from FieldPress (signed-in only).
 * Guests keep the existing public default.
 */
export const FIELDPRESS_RETURN_DEFAULT_VISIBILITY: Visibility = "UNLISTED";

const listeners = new Set<() => void>();

function notifyDraftListeners(): void {
  for (const listener of listeners) listeners();
}

export function subscribeFieldPressDraftId(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function parseFieldPressDraftId(raw: string | null | undefined): string | null {
  if (!raw || !FIELDPRESS_DRAFT_ID_PATTERN.test(raw)) return null;
  return raw;
}

export function readFieldPressDraftId(): string | null {
  try {
    return parseFieldPressDraftId(sessionStorage.getItem(FIELDPRESS_DRAFT_SESSION_KEY));
  } catch {
    return null;
  }
}

export function persistFieldPressDraftId(rawId: string): string | null {
  const id = parseFieldPressDraftId(rawId);
  if (!id) return null;
  try {
    sessionStorage.setItem(FIELDPRESS_DRAFT_SESSION_KEY, id);
  } catch {
    return null;
  }
  notifyDraftListeners();
  return id;
}

export function clearFieldPressDraftId(): void {
  try {
    sessionStorage.removeItem(FIELDPRESS_DRAFT_SESSION_KEY);
  } catch {
    /* ignore */
  }
  notifyDraftListeners();
}

/** `https://fieldpress.studio/?compose=1&draft=<id>` — no open redirect; origin is fixed. */
export function fieldpressDraftReturnUrl(draftId: string): string | null {
  const id = parseFieldPressDraftId(draftId);
  if (!id) return null;
  const url = new URL(FIELDPRESS_URL);
  url.searchParams.set("compose", "1");
  url.searchParams.set("draft", id);
  return url.toString();
}

export function fieldpressDraftComposeWithImageUrl(
  draftId: string,
  imageDirectUrl: string,
  title?: string | null,
): string | null {
  const id = parseFieldPressDraftId(draftId);
  if (!id || !isSafeFieldPressImageUrl(imageDirectUrl)) return null;
  const url = new URL(FIELDPRESS_URL);
  url.searchParams.set("compose", "1");
  url.searchParams.set("draft", id);
  url.searchParams.set("image", imageDirectUrl);
  const trimmed = title?.trim();
  if (trimmed) url.searchParams.set("title", trimmed);
  return url.toString();
}

export function ingestFieldPressDraftFromQuery(
  from: string | null | undefined,
  draft: string | null | undefined,
): string | null {
  if (from !== "fieldpress") return readFieldPressDraftId();
  const id = parseFieldPressDraftId(draft);
  if (!id) return readFieldPressDraftId();
  return persistFieldPressDraftId(id);
}
