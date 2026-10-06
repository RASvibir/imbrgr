"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export function HeaderAuth() {
  const { data: session } = useSession();
  return (
    <nav className="flex items-center gap-1 sm:gap-2" aria-label="Main">
      <Link
        href="/"
        className="rounded-md px-2 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] sm:px-3"
      >
        Gallery
      </Link>
      <Link
        href="/upload"
        className="rounded-md px-2 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] sm:px-3"
      >
        Upload
      </Link>
      <Link
        href="/create/ai"
        className="hidden rounded-md px-3 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] sm:inline"
      >
        AI
      </Link>
      <Link
        href="/tags"
        className="hidden rounded-md px-3 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] sm:inline"
      >
        Tags
      </Link>
      <Link
        href="/search"
        className="rounded-md px-2 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] sm:px-3"
      >
        Search
      </Link>
      <ThemeToggle />
      {session?.user ? (
        <>
          <Link
            href="/settings"
            className="hidden rounded-md px-3 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] sm:inline"
          >
            Settings
          </Link>
          <Link
            href={`/u/${session.user.username}`}
            className="hidden rounded-md px-3 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] sm:inline"
          >
            @{session.user.username}
          </Link>
          <button
            type="button"
            onClick={() => signOut()}
            className="rounded-lg border border-[var(--border-strong)] px-3 py-2 text-sm"
          >
            Sign out
          </button>
        </>
      ) : (
        <Link
          href="/auth/signin"
          className="ml-1 rounded-lg bg-[var(--accent-primary)] px-3 py-2 text-sm font-semibold text-[var(--on-accent)] shadow-[var(--shadow-ember)]"
        >
          Sign in
        </Link>
      )}
    </nav>
  );
}
