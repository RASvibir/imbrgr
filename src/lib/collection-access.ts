import type { Actor } from "@/lib/request-identity";
import { isPostOwner } from "@/lib/media-access";

type CollectionLike = {
  userId: string;
  visibility: string;
  hiddenByAdmin?: boolean;
};

export function isCollectionOwner(collection: CollectionLike, actor: Actor): boolean {
  return Boolean(actor.userId && collection.userId === actor.userId);
}

export function canViewCollection(collection: CollectionLike, actor: Actor): boolean {
  if (collection.hiddenByAdmin && !isCollectionOwner(collection, actor)) return false;
  if (collection.visibility === "PUBLIC") return true;
  if (collection.visibility === "UNLISTED") return true;
  if (collection.visibility === "PRIVATE") return isCollectionOwner(collection, actor);
  return false;
}

export function canAddPostToCollection(
  collection: CollectionLike,
  post: { userId: string | null },
  actor: Actor,
): boolean {
  if (!isCollectionOwner(collection, actor)) return false;
  if (!post.userId || post.userId !== actor.userId) return false;
  return true;
}
