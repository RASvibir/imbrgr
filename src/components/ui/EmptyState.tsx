import Link from "next/link";
import { EmberBurgerHero } from "@/components/brand/EmberBurgerHero";
import { btnPrimary, btnSecondary } from "@/lib/ui/button-classes";

type Action = { label: string; href: string; primary?: boolean };

export function EmptyState({
  title,
  description,
  actions = [],
  showMark = true,
  compactMark = false,
}: {
  title: string;
  description?: string;
  actions?: Action[];
  showMark?: boolean;
  compactMark?: boolean;
}) {
  return (
    <div
      className="flex flex-col items-center px-4 py-12 text-center sm:py-16"
      data-testid="empty-state"
    >
      {showMark ? <EmberBurgerHero compact={compactMark} className="mb-6" /> : null}
      <h2 className="text-xl font-semibold text-[var(--text-primary)] sm:text-2xl">{title}</h2>
      {description ? (
        <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
          {description}
        </p>
      ) : null}
      {actions.length > 0 ? (
        <div className="mt-6 flex w-full max-w-sm flex-col gap-3 sm:flex-row sm:justify-center">
          {actions.map((a) =>
            a.primary ? (
              <Link key={a.href} href={a.href} className={`${btnPrimary} w-full sm:w-auto`}>
                {a.label}
              </Link>
            ) : (
              <Link key={a.href} href={a.href} className={`${btnSecondary} w-full sm:w-auto`}>
                {a.label}
              </Link>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
