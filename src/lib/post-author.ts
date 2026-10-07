export const DELETED_USER_LABEL = "Deleted user";

type PostAuthorInput = {
  user: { username: string } | null;
  media?: { voterKey?: string | null }[];
};

/** Guest uploads keep a voterKey on media; deleted-account public posts do not. */
export function isAnonymousGuestPost(post: PostAuthorInput): boolean {
  if (post.user) return false;
  return (post.media ?? []).some((m) => Boolean(m.voterKey));
}

export function postAuthorLabel(post: PostAuthorInput): string {
  if (post.user) return `@${post.user.username}`;
  if (isAnonymousGuestPost(post)) return "anonymous";
  return DELETED_USER_LABEL;
}
