import { CookCountFlameLabel } from "@/components/posts/CookCountFlameLabel";
import {
  cheeseMeltPercent,
  spiceKitchenCopy,
  spiceLevel,
  SPICE_LEVEL_MAX,
} from "@/lib/cheese-spice";

type Props = {
  viewCount: number;
  spiceScore: number;
  compact?: boolean;
};

export function CheeseSpiceGauge({ viewCount, spiceScore, compact }: Props) {
  const level = spiceLevel(spiceScore);
  const melt = cheeseMeltPercent(spiceScore);
  const copy = spiceKitchenCopy(level);

  if (compact) {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)]" data-testid="cheese-spice-gauge">
        <CookCountFlameLabel count={viewCount} compact />
        <span aria-hidden className="text-[var(--accent-primary)]">🌶️{level}</span>
      </span>
    );
  }

  return (
    <div
      className="mt-3 max-w-md rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3"
      data-testid="cheese-spice-gauge"
      aria-label={`Cook count ${viewCount}. Kitchen heat: ${copy.chili}.`}
    >
      <CookCountFlameLabel count={viewCount} />

      <div className="mt-3">
        <div className="mb-1 grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-0.5 text-xs text-[var(--text-muted)]">
          <span className="min-w-0">Cheese pull</span>
          <span className="shrink-0 text-right">{copy.cheese}</span>
        </div>
        <div
          className="relative h-3 overflow-hidden rounded-full bg-[var(--surface-hover)]"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={melt}
          aria-label="Cheese stretch meter"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-200 via-amber-400 to-orange-500 transition-[width] duration-500"
            style={{ width: `${melt}%` }}
          />
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1 grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-0.5 text-xs text-[var(--text-muted)]">
          <span className="min-w-0">Kitchen heat</span>
          <span className="shrink-0 text-right">{copy.chili}</span>
        </div>
        <div className="flex gap-1" role="img" aria-label={`${level} of ${SPICE_LEVEL_MAX} chili ticks`}>
          {Array.from({ length: SPICE_LEVEL_MAX }, (_, i) => (
            <span
              key={i}
              className={`text-base leading-none ${i < level ? "opacity-100" : "opacity-25 grayscale"}`}
              aria-hidden
            >
              🌶️
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
