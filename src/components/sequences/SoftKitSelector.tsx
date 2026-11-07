"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchKitsSoft, softKitFragment, type SoftKitSummary } from "@/lib/shot-sequence/kit-hook";

type Props = {
  value: string | null;
  onChange: (shortId: string | null, kit: SoftKitSummary | null) => void;
  className?: string;
};

/**
 * Soft character-kit selector. Renders nothing useful until `/api/kits` exists (PR #70);
 * still exposes an empty select so the sequence can store kitShortId once kits land.
 */
export function SoftKitSelector({ value, onChange, className }: Props) {
  const [kits, setKits] = useState<SoftKitSummary[]>([]);
  const [available, setAvailable] = useState(false);

  const load = useCallback(async () => {
    const list = await fetchKitsSoft();
    setKits(list);
    setAvailable(list.length > 0);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!available && !value) {
    return (
      <p className={`text-xs text-[var(--text-muted)] ${className ?? ""}`} data-testid="soft-kit-unavailable">
        Character kits hook ready — available once kits are enabled on this deploy.
      </p>
    );
  }

  return (
    <div className={className} data-testid="soft-kit-selector">
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]" htmlFor="soft-kit-select">
        Character kit
      </label>
      <select
        id="soft-kit-select"
        value={value ?? ""}
        onChange={(e) => {
          const next = e.target.value || null;
          const kit = kits.find((k) => k.shortId === next) ?? null;
          onChange(next, kit);
        }}
        className="min-h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-raised)] px-3 text-sm"
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
      {value && softKitFragment(kits.find((k) => k.shortId === value)).fragment ? (
        <p className="mt-1 line-clamp-2 text-[11px] text-[var(--text-muted)]">
          {softKitFragment(kits.find((k) => k.shortId === value)).fragment}
        </p>
      ) : null}
    </div>
  );
}
