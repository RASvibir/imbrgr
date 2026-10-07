"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export function HeaderAuth({ showAdminLink = false }: { showAdminLink?: boolean }) {
  const { data: session } = useSession();
  return (
    <nav className="flex items-center gap-1 sm:gap-2" aria-label="Main">
      <div className="hidden items-center gap-1 lg:flex">
      <Link
        href="/"
        className="tap-target rounded-md px-2 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] sm:px-3"
      >
        Gallery
      </Link>
      <Link
        href="/hot"
        className="tap-target rounded-md px-2 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] sm:px-3"
      >
        Hot
      </Link>
      <Link
        href="/studio"
        className="tap-target rounded-md px-2 py-2 text-sm font-medium text-[var(--accent-primary)] hover:bg-[var(--surface-hover)] sm:px-3"
      >
        Studio
      </Link>
      </div>
      <Link
        href="/tags"
        className="tap-target hidden items-center rounded-md px-3 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] sm:inline-flex"
      >
        Tags
      </Link>
      <Link
        href="/search"
        className="tap-target hidden rounded-md px-2 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] lg:inline-flex sm:px-3"
      >
        Search
      </Link>
      <ThemeToggle />
      {session?.user ? (
        <>
          {showAdminLink ? (
            <Link
              href="/admin"
              className="tap-target hidden rounded-md px-3 text-sm font-semibold text-[var(--accent-primary)] hover:bg-[var(--surface-hover)] sm:inline-flex"
            >
              Admin
            </Link>
          ) : null}
          <Link
            href="/settings"
            className="tap-target hidden rounded-md px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] sm:inline-flex"
          >
            Settings
          </Link>
          <Link
            href={`/u/${session.user.username}`}
            className="tap-target hidden rounded-md px-3 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] sm:inline-flex"
          >
            @{session.user.username}
          </Link>
          <button
            type="button"
            onClick={() => signOut()}
            className="tap-target hidden rounded-lg border border-[var(--border-strong)] px-3 py-2 text-sm lg:inline-flex"
          >
            Sign out
          </button>
        </>
      ) : (
        <Link
          href="/auth/signin"
          className="tap-target ml-1 hidden rounded-lg bg-[var(--accent-primary)] px-3 py-2 text-sm font-semibold text-[var(--on-accent)] shadow-[var(--shadow-ember)] lg:inline-flex"
        >
          Sign in
        </Link>
      )}
    </nav>
  );
}
