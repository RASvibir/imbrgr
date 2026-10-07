/** Time-decayed engagement for the Hot page (unique cooks + kitchen heat + recency). */
export function computeHotScore(
  viewCount: number,
  spiceScore: number,
  createdAt: Date,
  now = new Date(),
): number {
  const ageHours = Math.max(0.25, (now.getTime() - createdAt.getTime()) / 3_600_000);
  const engagement = viewCount * 3 + spiceScore * 2 + 1;
  return engagement / Math.pow(ageHours + 2, 1.35);
}

export async function refreshPostHotScore(
  postId: string,
  viewCount: number,
  spiceScore: number,
  createdAt: Date,
) {
  const hotScore = computeHotScore(viewCount, spiceScore, createdAt);
  const { prisma } = await import("@/lib/db");
  await prisma.post.update({
    where: { id: postId },
    data: { hotScore },
  });
  return hotScore;
}
