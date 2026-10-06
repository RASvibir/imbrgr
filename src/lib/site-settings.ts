import { prisma } from "@/lib/db";
import { anonAiDailyLimit } from "@/lib/config";

export type SiteSettings = {
  anonymousUploadsEnabled: boolean;
  anonymousAiEnabled: boolean;
  anonAiDailyLimit: number;
  announcementBanner: string | null;
};

export async function getSiteSettings(): Promise<SiteSettings> {
  await ensureSiteSettingsRow();
  const row = await prisma.siteSetting.findUnique({ where: { id: "global" } });
  return {
    anonymousUploadsEnabled: row?.anonymousUploadsEnabled ?? true,
    anonymousAiEnabled: row?.anonymousAiEnabled ?? true,
    anonAiDailyLimit: row?.anonAiDailyLimit ?? anonAiDailyLimit(),
    announcementBanner: row?.announcementBanner ?? null,
  };
}

export async function ensureSiteSettingsRow() {
  await prisma.siteSetting.upsert({
    where: { id: "global" },
    create: { id: "global", updatedAt: new Date() },
    update: { updatedAt: new Date() },
  });
}
