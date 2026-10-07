"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useState } from "react";
import { MobileBottomSheet } from "@/components/layout/MobileBottomSheet";

const PRIMARY = [
  { href: "/", label: "Gallery" },
  { href: "/hot", label: "Hot" },
  { href: "/studio", label: "Studio", accent: true },
  { href: "/search", label: "Search" },
] as const;

export function MobileBottomNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--border-subtle)] bg-[var(--surface-base)]/95 backdrop-blur-md lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        aria-label="Mobile navigation"
        data-testid="mobile-bottom-nav"
      >
        <ul className="mx-auto flex max-w-lg items-stretch justify-around gap-1 px-1 pt-1">
          {PRIMARY.map((item) => (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={`tap-target flex flex-col items-center justify-center rounded-lg px-1 py-2 text-[11px] font-medium leading-tight ${
                  isActive(item.href)
                    ? "accent" in item && item.accent
                      ? "text-[var(--accent-primary)]"
                      : "text-[var(--text-primary)]"
                    : "text-[var(--text-muted)]"
                }`}
              >
                {item.label}
              </Link>
            </li>
          ))}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className="tap-target flex w-full flex-col items-center justify-center rounded-lg px-1 py-2 text-[11px] font-medium text-[var(--text-muted)]"
              data-testid="mobile-nav-more"
            >
              More
            </button>
          </li>
        </ul>
      </nav>

      <MobileBottomSheet open={moreOpen} onClose={() => setMoreOpen(false)} title="More">
        <ul className="space-y-1 text-base" data-testid="mobile-nav-menu">
          <li>
            <Link href="/tags" className="tap-target block rounded-lg px-3 py-3 hover:bg-[var(--surface-hover)]" onClick={() => setMoreOpen(false)}>
              Tags
            </Link>
          </li>
          <li>
            <Link href="/upload" className="tap-target block rounded-lg px-3 py-3 hover:bg-[var(--surface-hover)]" onClick={() => setMoreOpen(false)}>
              Multi-image upload
            </Link>
          </li>
          {session?.user ? (
            <>
              <li>
                <Link
                  href={`/u/${session.user.username}`}
                  className="tap-target block rounded-lg px-3 py-3 hover:bg-[var(--surface-hover)]"
                  onClick={() => setMoreOpen(false)}
                >
                  Your profile
                </Link>
              </li>
              <li>
                <Link href="/settings" className="tap-target block rounded-lg px-3 py-3 hover:bg-[var(--surface-hover)]" onClick={() => setMoreOpen(false)}>
                  Settings
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  className="tap-target w-full rounded-lg px-3 py-3 text-left hover:bg-[var(--surface-hover)]"
                  onClick={() => signOut()}
                >
                  Sign out
                </button>
              </li>
            </>
          ) : (
            <li>
              <Link href="/auth/signin" className="tap-target block rounded-lg bg-[var(--accent-primary)] px-3 py-3 text-center font-semibold text-[var(--on-accent)]" onClick={() => setMoreOpen(false)}>
                Sign in
              </Link>
            </li>
          )}
        </ul>
      </MobileBottomSheet>
    </>
  );
}
