const BLOCKED = [
  /\b(nude|naked|nsfw|porn|xxx|sexual|erotic|hentai)\b/i,
  /\b(child|minor|underage|pedo)\b/i,
];

export function isPromptBlocked(prompt: string): boolean {
  const t = prompt.trim();
  if (t.length < 2) return false;
  return BLOCKED.some((re) => re.test(t));
}

export const blockedPromptMessage =
  "That description isn't a fit for the kitchen — try a different dish idea.";
