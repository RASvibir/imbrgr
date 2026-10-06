/** Reddit-style hot score for feed sorting (higher = more viral). */
export function hotScore(upvotes: number, downvotes: number, createdAt: Date, now = new Date()): number {
  const score = upvotes - downvotes;
  const order = Math.log10(Math.max(Math.abs(score), 1));
  const sign = score > 0 ? 1 : score < 0 ? -1 : 0;
  const seconds = (createdAt.getTime() - now.getTime()) / 1000;
  return sign * order + seconds / 45000;
}

export function topScore(upvotes: number, downvotes: number): number {
  return upvotes - downvotes;
}
