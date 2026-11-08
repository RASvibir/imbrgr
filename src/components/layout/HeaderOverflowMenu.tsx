"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { FIELDPRESS_URL } from "@/lib/fieldpress";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

type Props = {
  showAdminLink?: boolean;
  /** When true, theme control lives in the overflow panel (compact header chrome). */
  includeTheme?: boolean;
};

function MenuLink({
  href,
  children,
  onClick,
  external,
  accent,
  testId,
}: {
  href: string;
  children: React.ReactNode;
  onClick: () => void;
  external?: boolean;
  accent?: boolean;
  testId?: string;
}) {
  const className = `tap-target flex w-full items-center rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-[var(--surface-hover)] ${
    accent ? "text-[var(--accent-primary)]" : "text-[var(--text-primary)]"
  }`;

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        onClick={onClick}
        role="menuitem"
        data-testid={testId}
      >
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className} onClick={onClick} role="menuitem" data-testid={testId}>
      {children}
    </Link>
  );
}

function MenuSection({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="py-1">
      {label ? (
        <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
          {label}
        </p>
      ) : null}
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

export function HeaderOverflowMenu({ showAdminLink = false, includeTheme = false }: Props) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) close();
    };
    window.addEventListener("mousedown", onPointer);
    return () => window.removeEventListener("mousedown", onPointer);
  }, [open, close]);

  return (
    <div className="relative shrink-0" ref={menuRef}>
      <button
        type="button"
        className="tap-target inline-flex h-10 w-10 items-center justify-center rounded-md text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        data-testid="header-overflow-menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex flex-col gap-1" aria-hidden>
          <span className="block h-0.5 w-4 rounded-full bg-current" />
          <span className="block h-0.5 w-4 rounded-full bg-current" />
          <span className="block h-0.5 w-4 rounded-full bg-current" />
        </span>
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="More"
          data-testid="header-overflow-panel"
          className="absolute right-0 top-full z-[70] mt-2 max-h-[min(80dvh,28rem)] w-[min(18rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-xl border border-[var(--border-strong)] bg-[var(--surface-raised)] p-1.5 shadow-[var(--shadow-ember)]"
        >
          <MenuSection label="Explore">
            <MenuLink href="/hot" onClick={close}>
              Hot
            </MenuLink>
            <MenuLink href="/tools" onClick={close}>
              Tools
            </MenuLink>
            <MenuLink href="/studio?tab=video" onClick={close}>
              Video Studio
            </MenuLink>
            <MenuLink href="/tags" onClick={close}>
              Tags
            </MenuLink>
            <MenuLink href="/search" onClick={close}>
              Search
            </MenuLink>
            <MenuLink
              href={FIELDPRESS_URL}
              external
              onClick={close}
              testId="fieldpress-nav-link"
            >
              FieldPress ↗
              <span className="sr-only">(opens in new tab)</span>
            </MenuLink>
          </MenuSection>

          <div className="my-1 border-t border-[var(--border-subtle)]" />

          <MenuSection label="Workspace">
            {showAdminLink ? (
              <MenuLink href="/admin" onClick={close} accent>
                Admin
              </MenuLink>
            ) : null}
            <MenuLink href="/sequences" onClick={close}>
              Sequences
            </MenuLink>
            <MenuLink href="/library" onClick={close}>
              Library
            </MenuLink>
            <MenuLink href="/kits" onClick={close}>
              Kits
            </MenuLink>
            <MenuLink href="/brands" onClick={close}>
              Brands
            </MenuLink>
            <MenuLink href="/settings/manual" onClick={close} testId="header-nav-user-manual">
              Manual
            </MenuLink>
          </MenuSection>

          <div className="my-1 border-t border-[var(--border-subtle)]" />

          <MenuSection label="Account">
            {includeTheme ? (
              <div
                className="flex items-center justify-between gap-2 rounded-lg px-3 py-2"
                role="none"
              >
                <span className="text-sm font-medium text-[var(--text-primary)]">Theme</span>
                <ThemeToggle />
              </div>
            ) : null}
            {session?.user ? (
              <>
                <MenuLink href={`/u/${session.user.username}`} onClick={close}>
                  @{session.user.username}
                </MenuLink>
                <MenuLink href="/settings" onClick={close}>
                  Settings
                </MenuLink>
                <button
                  type="button"
                  role="menuitem"
                  className="tap-target flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                  onClick={() => {
                    close();
                    void signOut();
                  }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <MenuLink href="/auth/signin" onClick={close} accent>
                Sign in
              </MenuLink>
            )}
          </MenuSection>
        </div>
      ) : null}
    </div>
  );
}
