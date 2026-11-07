"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  BRAND_CONSTRAINT_MODE_HINTS,
  BRAND_CONSTRAINT_MODE_LABELS,
  BRAND_CONSTRAINT_MODES,
  type BrandConstraintMode,
  type LogoSafeZone,
} from "@/lib/brand-prompt";

export type BrandKitOption = {
  shortId: string;
  name: string;
  styleLock?: string | null;
  typographyLock?: string | null;
  stylePreset?: string | null;
  logoSafeZone?: LogoSafeZone | string | null;
  palette?: { primary?: string; secondary?: string; accents?: string[] } | null;
  logo?: { previewUrl: string } | null;
};

type Props = {
  brandKitShortId: string | null;
  brandMode: BrandConstraintMode;
  onBrandKitChange: (shortId: string | null, brand?: BrandKitOption | null) => void;
  onBrandModeChange: (mode: BrandConstraintMode) => void;
  className?: string;
};

export function BrandKitSelector({
  brandKitShortId,
  brandMode,
  onBrandKitChange,
  onBrandModeChange,
  className,
}: Props) {
  const [brands, setBrands] = useState<BrandKitOption[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/brands");
      const data = await res.json();
      if (res.ok) setBrands(data.brands ?? []);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load brand options once for the selector
    void load();
  }, [load]);

  const selected = brands.find((b) => b.shortId === brandKitShortId) ?? null;
  const modes = BRAND_CONSTRAINT_MODES;

  return (
    <div className={className} data-testid="brand-kit-selector">
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="brand-kit-select">
          Brand kit
        </label>
        <select
          id="brand-kit-select"
          value={brandKitShortId ?? ""}
          onChange={(e) => {
            const next = e.target.value || null;
            const brand = brands.find((b) => b.shortId === next) ?? null;
            onBrandKitChange(next, brand);
            if (next && brandMode === "none") onBrandModeChange("on_brand");
            if (!next && brandMode === "on_brand") onBrandModeChange("none");
          }}
          className="min-h-11 min-w-[10rem] rounded-lg border px-2 text-base sm:text-sm"
          aria-label="Brand kit"
          data-testid="brand-kit-select"
        >
          <option value="">No brand kit</option>
          {brands.map((b) => (
            <option key={b.shortId} value={b.shortId}>
              {b.name}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="brand-mode-select">
          Brand constraint mode
        </label>
        <select
          id="brand-mode-select"
          value={brandMode}
          onChange={(e) => onBrandModeChange(e.target.value as BrandConstraintMode)}
          className="min-h-11 min-w-[11rem] rounded-lg border px-2 text-base sm:text-sm"
          aria-label="Brand constraint mode"
          data-testid="brand-mode-select"
        >
          {modes.map((m) => (
            <option key={m} value={m}>
              {BRAND_CONSTRAINT_MODE_LABELS[m]}
            </option>
          ))}
        </select>
        <Link
          href="/brands/new"
          className="text-xs font-medium text-[var(--accent-primary)] hover:underline"
          data-testid="brand-kit-new-link"
        >
          New brand kit
        </Link>
        {loaded && brands.length === 0 ? (
          <Link href="/brands" className="text-xs text-[var(--text-muted)] hover:underline">
            Manage brands
          </Link>
        ) : null}
      </div>
      {brandMode !== "none" ? (
        <p className="mt-1 text-[11px] text-[var(--text-muted)]" data-testid="brand-mode-hint">
          {BRAND_CONSTRAINT_MODE_HINTS[brandMode]}
        </p>
      ) : null}
      {selected?.styleLock ? (
        <p className="mt-1 line-clamp-2 text-[11px] text-[var(--text-muted)]" data-testid="brand-kit-lock-preview">
          Style lock: {selected.styleLock}
        </p>
      ) : null}
    </div>
  );
}
