import { Logo } from "@/components/brand/Logo";
import { isSuperAdminViewer } from "@/lib/admin/auth";
import { AnnouncementBanner } from "./AnnouncementBanner";
import { HeaderAuth } from "./HeaderAuth";

export async function Header() {
  const showAdminLink = await isSuperAdminViewer();
  return (
    <>
      <AnnouncementBanner />
      <header className="sticky top-0 z-50 border-b border-[var(--border-subtle)] bg-[var(--surface-base)]/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:h-16 sm:px-6">
          <Logo />
          <HeaderAuth showAdminLink={showAdminLink} />
        </div>
      </header>
    </>
  );
}
