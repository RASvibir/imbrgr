"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import {
  headerNavLinkAccentClass,
  headerNavLinkClass,
  headerNavLinkPrimaryClass,
} from "@/components/layout/header-nav-classes";

export function HeaderAuth({ showAdminLink = false }: { showAdminLink?: boolean }) {
  const { data: session } = useSession();
  return (
    <nav className="flex items-center gap-1 sm:gap-2" aria-label="Main">
      <div className="hidden items-center gap-1 lg:flex">
        <Link href="/" className={headerNavLinkClass}>
          Gallery
        </Link>
        <Link href="/hot" className={headerNavLinkClass}>
          Hot
        </Link>
        <Link href="/studio" className={headerNavLinkAccentClass}>
          Studio
        </Link>
      </div>
      <Link href="/tags" className={`${headerNavLinkClass} hidden lg:inline-flex`}>
        Tags
      </Link>
      <Link href="/search" className={`${headerNavLinkClass} hidden lg:inline-flex`}>
        Search
      </Link>
      <ThemeToggle />
      {session?.user ? (
        <>
          {showAdminLink ? (
            <Link
              href="/admin"
              className={`${headerNavLinkAccentClass} hidden font-semibold sm:inline-flex`}
            >
              Admin
            </Link>
          ) : null}
          <Link href="/settings" className={`${headerNavLinkClass} hidden sm:inline-flex`}>
            Settings
          </Link>
          <Link
            href={`/u/${session.user.username}`}
            className={`${headerNavLinkClass} hidden sm:inline-flex`}
          >
            @{session.user.username}
          </Link>
          <button
            type="button"
            onClick={() => signOut()}
            className={`${headerNavLinkClass} hidden border border-[var(--border-strong)] lg:inline-flex`}
          >
            Sign out
          </button>
        </>
      ) : (
        <Link href="/auth/signin" className={`${headerNavLinkPrimaryClass} hidden lg:inline-flex`}>
          Sign in
        </Link>
      )}
    </nav>
  );
}
