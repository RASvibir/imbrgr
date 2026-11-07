"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { LOGO_SAFE_ZONE_LABELS, type LogoSafeZone } from "@/lib/brand-prompt";
import { btnPrimary, btnSecondary } from "@/lib/ui/button-classes";
import { friendlyError } from "@/lib/user-messages";

type BrandRow = {
  shortId: string;
  name: string;
  description: string | null;
  styleLock: string | null;
  typographyLock: string | null;
  stylePreset: string | null;
  logoSafeZone: LogoSafeZone;
  updatedAt: string;
  logo: { previewUrl: string } | null;
  palette: { primary?: string; secondary?: string; accents?: string[] } | null;
};

export function BrandsPanel() {
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/brands");
    const data = await res.json();
    if (!res.ok) {
      setErr(friendlyError(data.error ?? "Could not load brand kits"));
      return;
    }
    setBrands(data.brands ?? []);
    setErr("");
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch brands on mount
    void load();
  }, [load]);

  const remove = async (shortId: string) => {
    if (!confirm("Delete this brand kit? Logo media stays in your library.")) return;
    setBusy(true);
    const res = await fetch(`/api/brands/${shortId}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(friendlyError(data.error ?? "Could not delete brand kit"));
      return;
    }
    await load();
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6" data-testid="brands-panel">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Brand kits</h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--text-muted)]">
            Lock palette, typography, and logo-safe layouts so studio generations stay on-brand.
          </p>
        </div>
        <Link href="/brands/new" className={`${btnPrimary} inline-flex justify-center`} data-testid="brands-create-cta">
          New brand kit
        </Link>
      </header>

      {brands.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] px-4 py-16 text-center">
          <p className="text-sm text-[var(--text-muted)]">
            No brand kits yet. Create one with a palette and type lock, then pick a constraint mode in
            the studio.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link href="/brands/new" className={btnPrimary}>
              Create a brand kit
            </Link>
            <Link href="/library" className={btnSecondary}>
              Open library
            </Link>
          </div>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {brands.map((brand) => (
            <li
              key={brand.shortId}
              className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)]"
              data-testid={`brand-card-${brand.shortId}`}
            >
              <Link href={`/brands/${brand.shortId}`} className="block">
                <div className="aspect-[4/3] bg-[var(--surface-raised)]">
                  {brand.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={brand.logo.previewUrl} alt="" className="h-full w-full object-contain p-6" />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 p-4">
                      {brand.palette?.primary ? (
                        <div className="flex gap-1">
                          {[brand.palette.primary, brand.palette.secondary, ...(brand.palette.accents ?? [])]
                            .filter(Boolean)
                            .slice(0, 4)
                            .map((hex) => (
                              <span
                                key={hex}
                                className="h-8 w-8 rounded-full border border-[var(--border-subtle)]"
                                style={{ backgroundColor: hex }}
                                title={hex}
                              />
                            ))}
                        </div>
                      ) : (
                        <span className="text-sm text-[var(--text-muted)]">No logo yet</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="space-y-1 p-4">
                  <h2 className="font-semibold text-[var(--text-primary)]">{brand.name}</h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    Logo-safe: {LOGO_SAFE_ZONE_LABELS[brand.logoSafeZone] ?? brand.logoSafeZone}
                    {brand.stylePreset ? ` · ${brand.stylePreset}` : ""}
                  </p>
                  {brand.typographyLock ? (
                    <p className="line-clamp-2 text-xs text-[var(--text-secondary)]">
                      Type: {brand.typographyLock}
                    </p>
                  ) : null}
                </div>
              </Link>
              <div className="flex gap-2 border-t border-[var(--border-subtle)] px-4 py-3">
                <Link
                  href={`/studio?tab=create&brand=${brand.shortId}&brandMode=on_brand`}
                  className={`${btnPrimary} flex-1 justify-center text-sm`}
                >
                  Use in studio
                </Link>
                <button
                  type="button"
                  disabled={busy}
                  className={`${btnSecondary} text-sm text-[var(--danger)]`}
                  onClick={() => void remove(brand.shortId)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {err ? (
        <p className="mt-4 text-sm text-[var(--danger)]" role="alert">
          {err}
        </p>
      ) : null}
    </div>
  );
}
