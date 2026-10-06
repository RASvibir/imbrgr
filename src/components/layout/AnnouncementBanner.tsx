import { getSiteSettings } from "@/lib/site-settings";

export async function AnnouncementBanner() {
  const settings = await getSiteSettings();
  if (!settings.announcementBanner?.trim()) return null;
  return (
    <div className="border-b border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10 px-4 py-2 text-center text-sm text-[var(--text-secondary)]">
      {settings.announcementBanner}
    </div>
  );
}
