import { useId } from "react";

type MarkSize = "sm" | "md" | "lg";

const sizes: Record<MarkSize, number> = {
  sm: 24,
  md: 32,
  lg: 40,
};

/** Tech-burger mark: stacked buns with a pixel/frame layer (ember glow). */
export function ImbrgrMark({
  size = "md",
  className,
  title = "imbrgr",
  simplified = false,
}: {
  size?: MarkSize;
  className?: string;
  title?: string;
  /** Bold silhouette for very small UI (matches favicon). */
  simplified?: boolean;
}) {
  const px = sizes[size];
  const uid = useId().replace(/:/g, "");
  const bunId = `bun-${uid}`;
  const emberId = `ember-${uid}`;

  if (simplified || px <= 24) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 32 32"
        width={px}
        height={px}
        className={className}
        role="img"
        aria-label={title}
      >
        <defs>
          <linearGradient id={bunId} x1="16" y1="4" x2="16" y2="28" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
        </defs>
        <rect x="4" y="21" width="24" height="7" rx="3.5" fill={`url(#${bunId})`} />
        <rect x="5" y="17" width="22" height="4" rx="2" fill="#c2410c" />
        <rect x="5" y="11" width="22" height="5" rx="2" fill="var(--accent-primary)" />
        <rect x="4" y="4" width="24" height="7" rx="3.5" fill={`url(#${bunId})`} />
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={px}
      height={px}
      className={className}
      role="img"
      aria-label={title}
    >
      <defs>
        <linearGradient id={bunId} x1="16" y1="2" x2="16" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="55%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#ea580c" />
        </linearGradient>
        <linearGradient id={emberId} x1="8" y1="12" x2="24" y2="18" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#db2777" />
        </linearGradient>
      </defs>
      <rect x="4" y="21" width="24" height="7" rx="3.5" fill={`url(#${bunId})`} />
      <rect x="5" y="18" width="22" height="3" rx="1.5" fill="#9a3412" />
      <rect
        x="5.5"
        y="10.5"
        width="21"
        height="7"
        rx="2"
        fill="var(--surface-base)"
        stroke="var(--accent-primary)"
        strokeWidth="1.2"
      />
      <rect x="7.5" y="12.5" width="3" height="3" rx="0.5" fill="var(--accent-primary)" />
      <rect x="11.5" y="12.5" width="3" height="3" rx="0.5" fill="var(--accent-amber)" />
      <rect x="15.5" y="12.5" width="3" height="3" rx="0.5" fill="var(--accent-primary)" />
      <path
        d="M21.5 16.2V13.2M20.2 14.4l1.3-1.2 1.3 1.2"
        stroke={`url(#${emberId})`}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M8 16.8h3.5M20.5 16.8H24"
        stroke="#fb923c"
        strokeWidth="0.9"
        strokeLinecap="round"
        opacity="0.9"
      />
      <rect x="4" y="4" width="24" height="7" rx="3.5" fill={`url(#${bunId})`} />
    </svg>
  );
}
