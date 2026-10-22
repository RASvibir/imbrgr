const BLOCKED = [
  /\b(nude|naked|nsfw|porn|porno|pornography|xxx|sexual|erotic|hentai|ecchi)\b/i,
  /\b(child\s+(porn|sexual|sex|abuse|erotica)|underage\s+(sex|porn|nude|sexual|erotic)|pedo|pedophil\w*|csam)\b/i,
  /\b(cp|jailbait)\b/i,
];

export function isPromptBlocked(prompt: string): boolean {
  const t = prompt.trim();
  if (t.length < 2) return false;
  return BLOCKED.some((re) => re.test(t));
}

export const blockedPromptMessage =
  "That description isn't a fit for the kitchen — try a different dish idea.";

