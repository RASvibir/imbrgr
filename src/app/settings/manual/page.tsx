import type { Metadata } from "next";
import Link from "next/link";
import { UserManual } from "@/components/settings/UserManual";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "User Manual — Settings — imbrgr",
  description: "Easy guide to creating, hosting, organizing, and sharing on imbrgr.",
};

export default async function SettingsUserManualPage() {
  const session = await auth();
  const signedIn = Boolean(session?.user);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6" data-testid="settings-user-manual-page">
      <p className="text-sm text-[var(--text-muted)]">
        {signedIn ? (
          <Link href="/settings" className="text-[var(--accent-primary)] hover:underline">
            ← Settings
          </Link>
        ) : (
          <Link href="/" className="text-[var(--accent-primary)] hover:underline">
            ← Home
          </Link>
        )}
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">User Manual</h1>
      <div className="mt-6">
        <UserManual />
      </div>
    </div>
  );
}
