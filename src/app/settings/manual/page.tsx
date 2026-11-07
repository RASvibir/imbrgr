import type { Metadata } from "next";
import Link from "next/link";
import { UserManual } from "@/components/settings/UserManual";

export const metadata: Metadata = {
  title: "User Manual — Settings — imbrgr",
  description: "Easy guide to creating, hosting, organizing, and sharing on imbrgr.",
};

export default function SettingsUserManualPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6" data-testid="settings-user-manual-page">
      <p className="text-sm text-[var(--text-muted)]">
        <Link href="/settings" className="text-[var(--accent-primary)] hover:underline">
          ← Settings
        </Link>
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">User Manual</h1>
      <div className="mt-6">
        <UserManual />
      </div>
    </div>
  );
}
