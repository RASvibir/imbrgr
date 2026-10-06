import Link from "next/link";
import { ImbrgrMark } from "./ImbrgrMark";

export function Logo({ showWordmark = true }: { showWordmark?: boolean }) {
  return (
    <Link
      href="/"
      className="group inline-flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-base)]"
    >
      <ImbrgrMark size="md" className="shrink-0 transition-transform group-hover:scale-105" />
      {showWordmark ? (
        <span className="flex items-baseline text-xl font-bold tracking-tight sm:text-2xl">
          <span className="bg-gradient-to-br from-[var(--accent-primary)] via-[var(--accent-amber)] to-[var(--accent-amber)] bg-clip-text text-transparent">
            imbr
          </span>
          <span className="bg-gradient-to-r from-[var(--accent-secondary)] to-[var(--accent-magenta)] bg-clip-text text-transparent">
            gr
          </span>
        </span>
      ) : null}
    </Link>
  );
}
