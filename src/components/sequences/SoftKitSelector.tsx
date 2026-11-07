"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { softKitFragment, type SoftKitSummary } from "@/lib/shot-sequence/kit-hook";

type Props = {
  value: string | null;
  onChange: (shortId: string | null, kit: SoftKitSummary | null) => void;
  /** Fired once after kits load so the parent can restore kitFragment without marking dirty. */
  onHydrate?: (kit: SoftKitSummary | null) => void;
  className?: string;
};

/**
 * Soft character-kit selector. Detects `/api/kits` (PR #70); until then shows a quiet hook note.
 */
export function SoftKitSelector({ value, onChange, onHydrate, className }: Props) {
  const [kits, setKits] = useState<SoftKitSummary[]>([]);
  const [available, setAvailable] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const hydratedRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/kits");
      if (!res.ok) {
        setAvailable(false);
        return;
      }
      const data = (await res.json()) as { kits?: SoftKitSummary[] };
      const list = Array.isArray(data.kits) ? data.kits : [];
      setKits(list);
      setAvailable(true);
    } catch {
      setAvailable(false);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load kit options once; state is set from the response
    void load();
  }, [load]);

  useEffect(() => {
    if (!loaded || !available || hydratedRef.current) return;
    hydratedRef.current = true;
    const kit = value ? (kits.find((k) => k.shortId === value) ?? null) : null;
    onHydrate?.(kit);
  }, [loaded, available, kits, value, onHydrate]);

  if (!loaded) return null;

  if (!available) {
    return (
      <p className={`text-xs text-[var(--text-muted)] ${className ?? ""}`} data-testid="soft-kit-unavailable">
        Character kits hook ready — available once kits are enabled on this deploy.
      </p>
    );
  }

  const selected = kits.find((k) => k.shortId === value) ?? null;

  return (
    <div className={className} data-testid="soft-kit-selector">
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]" htmlFor="soft-kit-select">
        Character kit
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <select
          id="soft-kit-select"
          value={value ?? ""}
          onChange={(e) => {
            const next = e.target.value || null;
            const kit = kits.find((k) => k.shortId === next) ?? null;
            onChange(next, kit);
          }}
          className="min-h-11 min-w-[10rem] flex-1 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-raised)] px-3 text-sm"
          aria-label="Character kit"
          data-testid="soft-kit-select"
        >
          <option value="">No character kit</option>
          {kits.map((k) => (
            <option key={k.shortId} value={k.shortId}>
              {k.name}
            </option>
          ))}
        </select>
        <Link href="/kits/new" className="text-xs font-medium text-[var(--accent-primary)] hover:underline">
          New kit
        </Link>
      </div>
      {selected && softKitFragment(selected).fragment ? (
        <p className="mt-1 line-clamp-2 text-[11px] text-[var(--text-muted)]">{softKitFragment(selected).fragment}</p>
      ) : null}
    </div>
  );
}
