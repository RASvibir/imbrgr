import { ImbrgrMark } from "@/components/brand/ImbrgrMark";

/** Large ember-burger mark for hero and empty states — crisp SVG, soft glow, motion-safe. */
export function EmberBurgerHero({
  className = "",
  compact = false,
  /** Only one primary hero mark should expose this for e2e. */
  primary = false,
}: {
  className?: string;
  /** Slightly smaller for tight mobile layouts (still prominent). */
  compact?: boolean;
  primary?: boolean;
}) {
  // Compact decorative marks omit the e2e id so home only has one primary mark.
  const testId = primary || !compact ? "ember-hero-mark" : undefined;

  if (compact) {
    return (
      <div
        className={`ember-burger-hero ember-burger-hero--compact ${className}`.trim()}
        data-testid={testId}
        aria-hidden
      >
        <ImbrgrMark size="xl" className="relative z-[1]" />
      </div>
    );
  }

  return (
    <div className={`ember-burger-hero ${className}`.trim()} data-testid={testId} aria-hidden>
      <ImbrgrMark size="xl" className="relative z-[1] sm:hidden" />
      <ImbrgrMark size="hero" className="relative z-[1] hidden sm:block" />
    </div>
  );
}
