type Props = {
  count: number;
  compact?: boolean;
};

const FLAME_ASCII = String.raw`  )  (
 (\/ )
  \/ `;

/** Decorative fiery header for unique cook count (aria on wrapper). */
export function CookCountFlameLabel({ count, compact }: Props) {
  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-sm" aria-label="Cook count">
        <span aria-hidden className="cook-count-flame text-[10px] leading-none text-orange-400">
          /\
        </span>
        <span className="cook-count-flame-text text-xs font-bold tracking-wide">COOK COUNT</span>
        <span className="tabular-nums font-semibold text-[var(--text-primary)]">{count}</span>
      </span>
    );
  }

  return (
    <div className="min-w-0" aria-label="Cook count">
      <pre
        aria-hidden
        className="cook-count-flame m-0 select-none whitespace-pre font-mono text-[10px] leading-[1.1] text-transparent sm:text-[11px]"
        style={{
          backgroundImage: "linear-gradient(180deg, #fcd34d 0%, #fb923c 45%, #f43f5e 85%, #be185d 100%)",
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
        }}
      >
        {FLAME_ASCII}
      </pre>
      <p className="mt-0.5 font-mono text-sm font-bold tracking-[0.12em] sm:text-base">
        <span className="cook-count-flame cook-count-flame-text">COOK COUNT</span>
        <span className="ml-2 tabular-nums text-[var(--text-primary)]">{count}</span>
      </p>
    </div>
  );
}
