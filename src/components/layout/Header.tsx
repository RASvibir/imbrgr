import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border-subtle)] bg-[var(--surface-base)]/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:h-16 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Main">
          <Link
            href="/"
            className="rounded-md px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
          >
            Gallery
          </Link>
          <Link
            href="/upload"
            className="rounded-md px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
          >
            Upload
          </Link>
          <Link
            href="/tags"
            className="hidden rounded-md px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] sm:inline"
          >
            Tags
          </Link>
          <ThemeToggle />
          <Link
            href="/auth/signin"
            className="ml-1 rounded-lg bg-[var(--accent-primary)] px-3 py-2 text-sm font-semibold text-[var(--on-accent)] shadow-[var(--shadow-ember)] transition hover:bg-[var(--accent-primary-hover)]"
          >
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}
