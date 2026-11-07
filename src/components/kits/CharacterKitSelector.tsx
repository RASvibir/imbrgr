"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export type KitOption = {
  shortId: string;
  name: string;
  styleLock?: string | null;
  stylePreset?: string | null;
  refCount?: number;
  cover?: { previewUrl: string } | null;
};

type Props = {
  value: string | null;
  onChange: (shortId: string | null, kit?: KitOption | null) => void;
  /** Fired once after kits load so parents can restore kit prompt state without marking dirty. */
  onHydrate?: (kit: KitOption | null) => void;
  className?: string;
};

export function CharacterKitSelector({ value, onChange, onHydrate, className }: Props) {
  const [kits, setKits] = useState<KitOption[]>([]);
  const [loaded, setLoaded] = useState(false);
  const hydratedRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/kits");
      const data = await res.json();
      if (res.ok) setKits(data.kits ?? []);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!loaded || hydratedRef.current) return;
    hydratedRef.current = true;
    const kit = value ? (kits.find((k) => k.shortId === value) ?? null) : null;
    onHydrate?.(kit);
  }, [loaded, kits, value, onHydrate]);

  const selected = kits.find((k) => k.shortId === value) ?? null;

  return (
    <div className={className} data-testid="character-kit-selector">
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="character-kit-select">
          Character kit
        </label>
        <select
          id="character-kit-select"
          value={value ?? ""}
          onChange={(e) => {
            const next = e.target.value || null;
            const kit = kits.find((k) => k.shortId === next) ?? null;
            onChange(next, kit);
          }}
          className="min-h-11 min-w-[10rem] rounded-lg border px-2 text-base sm:text-sm"
          aria-label="Character kit"
          data-testid="character-kit-select"
        >
          <option value="">No character kit</option>
          {kits.map((k) => (
            <option key={k.shortId} value={k.shortId}>
              {k.name}
              {k.refCount ? ` (${k.refCount} refs)` : ""}
            </option>
          ))}
        </select>
        <Link
          href="/kits/new"
          className="text-xs font-medium text-[var(--accent-primary)] hover:underline"
          data-testid="character-kit-new-link"
        >
          New kit
        </Link>
        {loaded && kits.length === 0 ? (
          <Link href="/kits" className="text-xs text-[var(--text-muted)] hover:underline">
            Manage kits
          </Link>
        ) : null}
      </div>
      {selected?.styleLock ? (
        <p className="mt-1 line-clamp-2 text-[11px] text-[var(--text-muted)]" data-testid="character-kit-lock-preview">
          Style lock: {selected.styleLock}
        </p>
      ) : null}
    </div>
  );
}
