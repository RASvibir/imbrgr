import { prisma } from "@/lib/db";
import { anonymousStorageQuotaBytes, userStorageQuotaBytes } from "@/lib/config";

export function quotaExceededMessage(used: bigint, quota: number): string {
  const usedMb = Number(used) / (1024 * 1024);
  const quotaMb = quota / (1024 * 1024);
  return `Storage quota exceeded (${usedMb.toFixed(1)} / ${quotaMb.toFixed(0)} MB). Delete content or upgrade later.`;
}

export async function getUserStorage(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { storageBytesUsed: true },
  });
  const used = user?.storageBytesUsed ?? BigInt(0);
  const quota = userStorageQuotaBytes();
  return { used, quota, remaining: BigInt(Math.max(0, quota - Number(used))) };
}

export async function assertUserCanStore(userId: string, addBytes: number) {
  const { used, quota } = await getUserStorage(userId);
  if (Number(used) + addBytes > quota) {
    throw new Error(quotaExceededMessage(used, quota));
  }
}

export async function addUserStorage(userId: string, bytes: number) {
  await prisma.user.update({
    where: { id: userId },
    data: { storageBytesUsed: { increment: bytes } },
  });
}

export async function removeUserStorage(userId: string, bytes: number) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { storageBytesUsed: true } });
  if (!user) return;
  const next = Math.max(0, Number(user.storageBytesUsed) - bytes);
  await prisma.user.update({
    where: { id: userId },
    data: { storageBytesUsed: BigInt(next) },
  });
}

export async function getAnonymousStorage(voterKey: string) {
  const row = await prisma.anonymousStorage.findUnique({ where: { voterKey } });
  const used = row?.bytesUsed ?? BigInt(0);
  const quota = anonymousStorageQuotaBytes();
  return { used, quota, remaining: BigInt(Math.max(0, quota - Number(used))) };
}

export async function assertAnonymousCanStore(voterKey: string, addBytes: number) {
  const { used, quota } = await getAnonymousStorage(voterKey);
  if (Number(used) + addBytes > quota) {
    throw new Error(quotaExceededMessage(used, quota));
  }
}

export async function addAnonymousStorage(voterKey: string, bytes: number) {
  await prisma.anonymousStorage.upsert({
    where: { voterKey },
    create: { voterKey, bytesUsed: BigInt(bytes) },
    update: { bytesUsed: { increment: bytes } },
  });
}

export async function removeAnonymousStorage(voterKey: string, bytes: number) {
  const row = await prisma.anonymousStorage.findUnique({ where: { voterKey } });
  if (!row) return;
  const next = Math.max(0, Number(row.bytesUsed) - bytes);
  await prisma.anonymousStorage.update({
    where: { voterKey },
    data: { bytesUsed: BigInt(next) },
  });
}

/** Pure helpers for tests */
export function wouldExceedQuota(used: number, add: number, quota: number): boolean {
  return used + add > quota;
}

export function remainingGenerations(usedToday: number, dailyLimit: number): number {
  return Math.max(0, dailyLimit - usedToday);
}

export function canGenerate(usedToday: number, dailyLimit: number): boolean {
  return usedToday < dailyLimit;
}
