"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  headerNavLinkAccentClass,
  headerNavLinkClass,
  headerNavLinkPrimaryClass,
} from "@/components/layout/header-nav-classes";
import { HeaderOverflowMenu } from "@/components/layout/HeaderOverflowMenu";

/**
 * Visitor-focused header chrome:
 * - Competitive CTAs stay visible (Create / Upload / Gallery) where they don't fight the mobile bottom nav.
 * - Utility destinations (Admin, Sequences, Library, Kits, Manual, theme, etc.) live in the overflow menu.
 */
export function HeaderAuth({ showAdminLink = false }: { showAdminLink?: boolean }) {
  const { data: session } = useSession();

  return (
    <nav className="flex min-w-0 shrink items-center justify-end gap-1 sm:gap-2" aria-label="Main">
      {/* Competitive CTAs — hidden below lg when the bottom nav already surfaces Create/Gallery */}
      <Link
        href="/create"
        className={`${headerNavLinkAccentClass} hidden lg:inline-flex`}
        data-testid="header-nav-create"
      >
        Create
      </Link>
      <Link
        href="/upload"
        className={`${headerNavLinkClass} inline-flex`}
        data-testid="header-nav-upload"
      >
        Upload
      </Link>
      <Link
        href="/"
        className={`${headerNavLinkClass} hidden lg:inline-flex`}
        data-testid="header-nav-gallery"
      >
        Gallery
      </Link>

      {/* Guest sign-in stays one tap away on wide layouts; signed-in account lives in overflow */}
      {!session?.user ? (
        <Link
          href="/auth/signin"
          className={`${headerNavLinkPrimaryClass} hidden lg:inline-flex`}
          data-testid="header-nav-signin"
        >
          Sign in
        </Link>
      ) : null}

      <HeaderOverflowMenu showAdminLink={showAdminLink} includeTheme />
    </nav>
  );
}
