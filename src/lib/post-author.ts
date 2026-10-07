export const DELETED_USER_LABEL = "Deleted user";

export type PostAuthorInput = {
  user: { username: string } | null;
  /** True when the owner deleted their account but the public post was kept. */
  authorDeleted?: boolean | null;
};

/** Ownerless posts are guest uploads unless the owner deleted their account. */
export function isAnonymousGuestPost(post: PostAuthorInput): boolean {
  return !post.user && !post.authorDeleted;
}

export function postAuthorLabel(post: PostAuthorInput): string {
  if (post.user) return `@${post.user.username}`;
  if (post.authorDeleted) return DELETED_USER_LABEL;
  return "anonymous";
}
