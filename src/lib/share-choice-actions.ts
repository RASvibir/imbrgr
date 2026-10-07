import { friendlyError } from "@/lib/user-messages";

export async function applyCopyLinkVisibility(mediaShortId: string, signedIn: boolean): Promise<string | null> {
  if (!signedIn) return null;
  const res = await fetch(`/api/media/${mediaShortId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visibility: "UNLISTED" }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return friendlyError((data as { error?: string }).error ?? "Could not update");
  }
  return null;
}

export async function applyPostToGallery(
  postShortId: string,
  title?: string,
): Promise<string | null> {
  const res = await fetch(`/api/posts/${postShortId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ visibility: "PUBLIC", title: title?.trim() || "Untitled" }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return friendlyError((data as { error?: string }).error ?? "Could not post");
  }
  return null;
}
