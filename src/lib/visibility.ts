export type Visibility = "PUBLIC" | "UNLISTED" | "PRIVATE";

export const VISIBILITY_OPTIONS: { value: Visibility; label: string; hint: string }[] = [
  { value: "PUBLIC", label: "Public", hint: "Everyone" },
  { value: "UNLISTED", label: "Unlisted", hint: "Anyone with the link" },
  { value: "PRIVATE", label: "Private", hint: "Only you" },
];

export function normalizeVisibility(raw: string | null | undefined): Visibility {
  if (raw === "PUBLIC" || raw === "UNLISTED" || raw === "PRIVATE") return raw;
  if (raw === "HIDDEN") return "PRIVATE";
  return "UNLISTED";
}

export function effectiveMediaVisibility(
  media: { visibility: string },
  post: { visibility: string } | null,
): Visibility {
  if (post) return normalizeVisibility(post.visibility);
  return normalizeVisibility(media.visibility);
}

/** Mature content may be shared by link but never listed publicly. */
export function clampMatureVisibility(visibility: Visibility, mature: boolean): Visibility {
  if (mature && visibility === "PUBLIC") return "UNLISTED";
  return visibility;
}

/** Mature is sticky across versions: a derived media row stays mature if its parent is. */
export function inheritMature(explicit: boolean | undefined, parentMature: boolean | undefined): boolean {
  return Boolean(explicit) || Boolean(parentMature);
}
