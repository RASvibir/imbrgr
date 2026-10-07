import { prisma } from "@/lib/db";
import { collectUserStorageKeys } from "@/lib/media-storage";
import { deleteObject } from "@/lib/storage";

export async function deleteUserAccount(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      posts: { include: { media: true } },
      mediaAssets: true,
    },
  });
  if (!user) return;

  for (const key of collectUserStorageKeys(user)) {
    await deleteObject(key);
  }

  await prisma.user.delete({ where: { id: userId } });
}
