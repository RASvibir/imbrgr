import { FIELDPRESS_RETURN_DEFAULT_VISIBILITY } from "@/lib/fieldpress-draft";

export type ShareChoiceHighlight = "link" | "gallery";

/** Which share action to visually emphasize before the user taps. */
export function resolveShareChoiceHighlight(opts: {
  signedIn: boolean;
  defaultPostVisibility?: string | null;
  fieldPressHandoff?: boolean;
}): ShareChoiceHighlight {
  if (!opts.signedIn) return "link";
  if (opts.fieldPressHandoff) return "link";
  if (opts.defaultPostVisibility === FIELDPRESS_RETURN_DEFAULT_VISIBILITY) return "link";
  if (opts.defaultPostVisibility === "UNLISTED" || opts.defaultPostVisibility === "PRIVATE") {
    return "link";
  }
  return "gallery";
}

export function postShortIdFromSharePageUrl(pageUrl: string): string | null {
  const m = pageUrl.match(/\/p\/([^/?#]+)/);
  return m?.[1] ?? null;
}
