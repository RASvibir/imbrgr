export type Visibility = "PUBLIC" | "UNLISTED" | "PRIVATE";

export const VISIBILITY_OPTIONS: { value: Visibility; label: string; hint: string }[] = [
  { value: "PUBLIC", label: "Public", hint: "Gallery, search, tags, and your profile" },
  { value: "UNLISTED", label: "Unlisted", hint: "Anyone with the link" },
  { value: "PRIVATE", label: "Private", hint: "Only you when signed in" },
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
