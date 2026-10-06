import type { Actor } from "@/lib/request-identity";
import { effectiveMediaVisibility, type Visibility } from "@/lib/visibility";

type PostLike = { userId: string | null; visibility: string } | null;
type MediaLike = {
  userId: string | null;
  voterKey: string | null;
  visibility: string;
  post?: PostLike;
};

export function isPostOwner(post: PostLike, actor: Actor): boolean {
  return Boolean(post?.userId && actor.userId && post.userId === actor.userId);
}

export function isMediaOwner(media: MediaLike, actor: Actor): boolean {
  if (media.userId && actor.userId && media.userId === actor.userId) return true;
  if (!media.userId && media.voterKey && media.voterKey === actor.voterKey) return true;
  return false;
}

export function canViewVisibility(visibility: Visibility, post: PostLike, actor: Actor): boolean {
  if (visibility === "PUBLIC") return true;
  if (visibility === "UNLISTED") return true;
  if (visibility === "PRIVATE") return isPostOwner(post, actor) || false;
  return false;
}

export function canViewMedia(media: MediaLike & { post?: PostLike }, actor: Actor): boolean {
  const post = media.post ?? null;
  const vis = effectiveMediaVisibility(media, post);
  if (vis === "PRIVATE") {
    return isMediaOwner(media, actor) || isPostOwner(post, actor);
  }
  return canViewVisibility(vis, post, actor);
}

export function canViewPost(
  post: { userId: string | null; visibility: string; hiddenByAdmin?: boolean },
  actor: Actor,
): boolean {
  if (post.hiddenByAdmin && !isPostOwner(post, actor)) return false;
  const vis = effectiveMediaVisibility({ visibility: post.visibility }, post);
  return canViewVisibility(vis, post, actor);
}

export function postVisibilityWherePublic() {
  return { visibility: "PUBLIC" as const };
}
