/** Shared header nav styles — callers must set display (e.g. `inline-flex`, `hidden lg:inline-flex`). */
export const headerNavLinkClass =
  "tap-target items-center whitespace-nowrap rounded-md px-2 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] sm:px-3";

export const headerNavLinkAccentClass =
  "tap-target items-center whitespace-nowrap rounded-md px-2 py-2 text-sm font-medium text-[var(--accent-primary)] hover:bg-[var(--surface-hover)] sm:px-3";

export const headerNavLinkPrimaryClass =
  "tap-target ml-1 items-center whitespace-nowrap rounded-lg bg-[var(--accent-primary)] px-3 py-2 text-sm font-semibold text-[var(--on-accent)] shadow-[var(--shadow-ember)]";
