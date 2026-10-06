import { Logo } from "@/components/brand/Logo";
import { HeaderAuth } from "./HeaderAuth";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border-subtle)] bg-[var(--surface-base)]/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:h-16 sm:px-6">
        <Logo />
        <HeaderAuth />
      </div>
    </header>
  );
}
