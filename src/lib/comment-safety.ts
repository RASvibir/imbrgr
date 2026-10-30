export type CommentBlockReason = "child_safety" | "spam";

const CHILD_SAFETY =
  /\b(child\s+(porn|sexual|sex|abuse|erotica)|underage\s+(sex|porn|nude|sexual|erotic)|pedo|pedophil\w*|csam|jailbait)\b/i;

const LINK = /https?:\/\/\S+/gi;
const MAX_LINKS = 3;
const REPEATED_CHAR = /(.)\1{29,}/;

export function commentBlockReason(body: string): CommentBlockReason | null {
  const t = body.trim();
  if (t.length < 2) return null;
  if (CHILD_SAFETY.test(t)) return "child_safety";
  if ((t.match(LINK)?.length ?? 0) > MAX_LINKS) return "spam";
  if (REPEATED_CHAR.test(t)) return "spam";
  return null;
}

export function isCommentBlocked(body: string): boolean {
  return commentBlockReason(body) !== null;
}

export const commentBlockedMessage = "That comment can't be posted. Try rewording it.";

export type CommentErrorCode =
  | "invalid"
  | "blocked"
  | "parent"
  | "rate_limited"
  | "forbidden"
  | "not_found";

export const commentErrorCopy: Record<CommentErrorCode, string> = {
  invalid: "Write a comment between 1 and 5000 characters.",
  blocked: commentBlockedMessage,
  parent: "The comment you're replying to is no longer available.",
  rate_limited: "You're posting comments too fast. Wait a moment and try again.",
  forbidden: "You can't comment right now.",
  not_found: "This post is no longer available.",
};

export function commentErrorMessage(code: unknown, fallback = "Could not post comment"): string {
  return typeof code === "string" && code in commentErrorCopy
    ? commentErrorCopy[code as CommentErrorCode]
    : fallback;
}
