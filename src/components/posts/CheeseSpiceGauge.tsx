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
        <span>{viewCount} {viewCount === 1 ? "viewer" : "viewers"}</span>
        <span aria-hidden className="text-[var(--accent-primary)]">🌶️{level}</span>
      </span>
    );
  }

  return (
    <div
      className="mt-3 max-w-md rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3"
      data-testid="cheese-spice-gauge"
      aria-label={`${viewCount} unique viewers. Kitchen heat: ${copy.chili}.`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-medium text-[var(--text-primary)]">
          {viewCount} {viewCount === 1 ? "viewer" : "viewers"}
        </span>
        <span className="text-xs text-[var(--text-muted)]">Each cook counts once</span>
      </div>

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-xs text-[var(--text-muted)]">
          <span>Cheese pull</span>
          <span>{copy.cheese}</span>
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
        <div className="mb-1 flex items-center justify-between text-xs text-[var(--text-muted)]">
          <span>Spicy meter</span>
          <span>{copy.chili}</span>
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
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          Extra passes and guest buzz warm the kitchen — not added to unique viewers.
        </p>
      </div>
    </div>
  );
}
