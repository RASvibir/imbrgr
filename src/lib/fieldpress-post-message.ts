import { FIELDPRESS_URL, isSafeFieldPressImageUrl } from "@/lib/fieldpress";
import { parseFieldPressDraftId } from "@/lib/fieldpress-draft";

/** Must match FieldPress `IMBRGR_COMPOSE_MESSAGE_TYPE`. */
export const IMBRGR_COMPOSE_MESSAGE_TYPE = "imbrgr:compose-image";

export function fieldPressParentOrigin(): string {
  try {
    return new URL(FIELDPRESS_URL).origin;
  } catch {
    return "https://fieldpress.studio";
  }
}

export function isEmbeddedInFieldPress(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.parent !== window;
  } catch {
    return true;
  }
}

/**
 * Notify FieldPress parent (iframe embed) that an image is ready.
 * Returns true when a message was posted (caller should still clear draft / skip navigation).
 */
export function tryPostComposeImageToParent(opts: {
  imageUrl: string;
  draftId?: string | null;
  title?: string | null;
}): boolean {
  if (!isEmbeddedInFieldPress()) return false;
  if (!isSafeFieldPressImageUrl(opts.imageUrl)) return false;
  const draftId = opts.draftId ? parseFieldPressDraftId(opts.draftId) : null;
  window.parent.postMessage(
    {
      type: IMBRGR_COMPOSE_MESSAGE_TYPE,
      imageUrl: opts.imageUrl,
      draftId,
      title: opts.title?.trim() || null,
    },
    fieldPressParentOrigin(),
  );
  return true;
}
