/** Shared tap-friendly controls — keep primary actions obvious and consistent. */
export const btnPrimary =
  "tap-target inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--accent-primary)] px-5 text-sm font-semibold text-[var(--on-accent)] shadow-[var(--shadow-ember)] transition hover:bg-[var(--accent-primary-hover)] disabled:pointer-events-none disabled:opacity-50";

export const btnSecondary =
  "tap-target inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border-strong)] bg-[var(--surface-raised)] px-5 text-sm font-medium text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)] disabled:pointer-events-none disabled:opacity-50";

export const btnGhost =
  "tap-target inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]";
