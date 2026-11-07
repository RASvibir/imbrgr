"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { STYLES } from "@/lib/ai/styles";
import {
  LOGO_SAFE_ZONE_LABELS,
  LOGO_SAFE_ZONES,
  type LogoSafeZone,
} from "@/lib/brand-prompt";
import type { KitPalette } from "@/lib/kit-prompt";
import { btnPrimary, btnSecondary } from "@/lib/ui/button-classes";
import { friendlyError } from "@/lib/user-messages";

type BrandMedia = {
  shortId: string;
  previewUrl: string;
  mimeType: string;
};

type BrandDetail = {
  shortId: string;
  name: string;
  description: string | null;
  styleLock: string | null;
  typographyLock: string | null;
  stylePreset: string | null;
  logoSafeZone: LogoSafeZone;
  palette: KitPalette | null;
  logo: BrandMedia | null;
};

type LibrarySave = {
  shortId: string;
  media: BrandMedia & { title?: string | null };
};

type Props = {
  mode: "create" | "edit";
  shortId?: string;
};

const emptyPalette: KitPalette = { primary: "", secondary: "", accents: [] };

export function BrandEditor({ mode, shortId }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [styleLock, setStyleLock] = useState("");
  const [typographyLock, setTypographyLock] = useState("");
  const [stylePreset, setStylePreset] = useState("");
  const [logoSafeZone, setLogoSafeZone] = useState<LogoSafeZone>("BOTTOM_RIGHT");
  const [palette, setPalette] = useState<KitPalette>(emptyPalette);
  const [logo, setLogo] = useState<BrandMedia | null>(null);
  const [brandShortId, setBrandShortId] = useState<string | null>(shortId ?? null);
  const [library, setLibrary] = useState<LibrarySave[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(mode === "create");

  const loadBrand = useCallback(async () => {
    if (!shortId) return;
    try {
      const res = await fetch(`/api/brands/${shortId}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(friendlyError(data.error ?? "Could not load brand kit"));
        return;
      }
      const brand = data.brand as BrandDetail;
      setBrandShortId(brand.shortId);
      setName(brand.name);
      setDescription(brand.description ?? "");
      setStyleLock(brand.styleLock ?? "");
      setTypographyLock(brand.typographyLock ?? "");
      setStylePreset(brand.stylePreset ?? "");
      setLogoSafeZone(brand.logoSafeZone ?? "BOTTOM_RIGHT");
      setPalette({
        primary: brand.palette?.primary ?? "",
        secondary: brand.palette?.secondary ?? "",
        accents: brand.palette?.accents ?? [],
      });
      setLogo(brand.logo);
    } catch {
      setErr("Could not load brand kit");
    } finally {
      setLoaded(true);
    }
  }, [shortId]);

  const loadLibrary = useCallback(async () => {
    const res = await fetch("/api/library?kind=LOGO");
    const data = await res.json();
    if (!res.ok) return;
    const logoSaves = (data.saves ?? []) as LibrarySave[];
    if (logoSaves.length > 0) {
      setLibrary(logoSaves);
      return;
    }
    const all = await fetch("/api/library");
    const allData = await all.json();
    if (all.ok) setLibrary(allData.saves ?? []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate editor from API
    void loadBrand();
    void loadLibrary();
  }, [loadBrand, loadLibrary]);

  const palettePayload = () => {
    const accents = (palette.accents ?? []).map((a) => a.trim()).filter(Boolean);
    const payload = {
      primary: palette.primary?.trim() || undefined,
      secondary: palette.secondary?.trim() || undefined,
      accents: accents.length ? accents : undefined,
    };
    if (!payload.primary && !payload.secondary && !payload.accents) return null;
    return payload;
  };

  const saveMeta = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setErr("Name is required");
      return;
    }
    setBusy(true);
    setErr("");
    setMsg("");
    const body = {
      name: trimmed,
      description: description.trim() || null,
      styleLock: styleLock.trim() || null,
      typographyLock: typographyLock.trim() || null,
      stylePreset: stylePreset.trim() || null,
      logoSafeZone,
      palette: palettePayload(),
    };

    if (mode === "create" && !brandShortId) {
      const res = await fetch("/api/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setBusy(false);
      if (!res.ok) {
        setErr(friendlyError(data.error ?? "Could not create brand kit"));
        return;
      }
      setBrandShortId(data.brand.shortId);
      setMsg("Brand kit created — optionally attach a logo from your library.");
      router.replace(`/brands/${data.brand.shortId}`);
      return;
    }

    const id = brandShortId!;
    const res = await fetch(`/api/brands/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setErr(friendlyError(data.error ?? "Could not save brand kit"));
      return;
    }
    setLogo(data.brand.logo ?? logo);
    setMsg("Saved");
  };

  const setLogoMedia = async (mediaShortId: string | null) => {
    if (!brandShortId) {
      setErr("Save the brand kit first, then attach a logo.");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/brands/${brandShortId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logoMediaShortId: mediaShortId }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setErr(friendlyError(data.error ?? "Could not update logo"));
      return;
    }
    setLogo(data.brand.logo ?? null);
    setPickerOpen(false);
    setMsg(mediaShortId ? "Logo attached" : "Logo cleared");
  };

  if (!loaded) {
    return <p className="p-8 text-center text-[var(--text-muted)]">Loading brand kit…</p>;
  }

  if (err && mode === "edit" && !name) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6" data-testid="brand-editor">
        <p className="text-sm text-[var(--danger)]" role="alert">
          {err}
        </p>
        <Link href="/brands" className="mt-4 inline-block text-sm text-[var(--accent-primary)] hover:underline">
          All brand kits
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6" data-testid="brand-editor">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
            Brand kit
          </p>
          <h1 className="text-2xl font-bold">{mode === "create" ? "New brand kit" : "Edit brand kit"}</h1>
        </div>
        <Link href="/brands" className="text-sm text-[var(--accent-primary)] hover:underline">
          All brand kits
        </Link>
      </div>

      <div className="space-y-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-5">
        <label className="block">
          <span className="text-sm font-medium">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border px-3 text-base"
            maxLength={80}
            data-testid="brand-name"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-base"
            maxLength={2000}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Style lock</span>
          <textarea
            value={styleLock}
            onChange={(e) => setStyleLock(e.target.value)}
            rows={2}
            placeholder="flat vector, generous whitespace, soft gradients…"
            className="mt-1 w-full rounded-lg border px-3 py-2 text-base"
            maxLength={2000}
            data-testid="brand-style-lock"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Typography lock</span>
          <textarea
            value={typographyLock}
            onChange={(e) => setTypographyLock(e.target.value)}
            rows={2}
            placeholder="geometric sans, tight tracking, no serifs…"
            className="mt-1 w-full rounded-lg border px-3 py-2 text-base"
            maxLength={2000}
            data-testid="brand-typography-lock"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">Default look</span>
            <select
              value={stylePreset}
              onChange={(e) => setStylePreset(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-lg border px-2 text-base sm:text-sm"
            >
              <option value="">None</option>
              {Object.keys(STYLES).map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium">Logo-safe zone</span>
            <select
              value={logoSafeZone}
              onChange={(e) => setLogoSafeZone(e.target.value as LogoSafeZone)}
              className="mt-1 min-h-11 w-full rounded-lg border px-2 text-base sm:text-sm"
              data-testid="brand-logo-safe-zone"
            >
              {LOGO_SAFE_ZONES.map((z) => (
                <option key={z} value={z}>
                  {LOGO_SAFE_ZONE_LABELS[z]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div>
          <p className="text-sm font-medium">Palette lock</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="block text-xs text-[var(--text-muted)]">
              Primary
              <input
                value={palette.primary ?? ""}
                onChange={(e) => setPalette((p) => ({ ...p, primary: e.target.value }))}
                placeholder="#f97316"
                className="mt-1 min-h-11 w-full rounded-lg border px-3 font-mono text-sm"
                data-testid="brand-palette-primary"
              />
            </label>
            <label className="block text-xs text-[var(--text-muted)]">
              Secondary
              <input
                value={palette.secondary ?? ""}
                onChange={(e) => setPalette((p) => ({ ...p, secondary: e.target.value }))}
                placeholder="#1c1816"
                className="mt-1 min-h-11 w-full rounded-lg border px-3 font-mono text-sm"
              />
            </label>
          </div>
          <label className="mt-2 block text-xs text-[var(--text-muted)]">
            Accents (comma-separated hex)
            <input
              value={(palette.accents ?? []).join(", ")}
              onChange={(e) =>
                setPalette((p) => ({
                  ...p,
                  accents: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                }))
              }
              placeholder="#db2777, #fbbf24"
              className="mt-1 min-h-11 w-full rounded-lg border px-3 font-mono text-sm"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => void saveMeta()} className={btnPrimary}>
            {mode === "create" && !brandShortId ? "Create brand kit" : "Save"}
          </button>
          {brandShortId ? (
            <Link
              href={`/studio?tab=create&brand=${brandShortId}&brandMode=on_brand`}
              className={btnSecondary}
            >
              Use in studio
            </Link>
          ) : null}
        </div>
      </div>

      <section className="mt-8 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Logo mark</h2>
          <button
            type="button"
            className={btnSecondary}
            disabled={!brandShortId || busy}
            onClick={() => setPickerOpen((o) => !o)}
            data-testid="brand-logo-picker-toggle"
          >
            {pickerOpen ? "Close picker" : "Pick from library"}
          </button>
        </div>
        {logo ? (
          <div className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo.previewUrl} alt="" className="h-16 w-16 rounded-lg object-contain bg-[var(--surface-raised)]" />
            <button
              type="button"
              className={`${btnSecondary} text-sm text-[var(--danger)]`}
              disabled={busy}
              onClick={() => void setLogoMedia(null)}
            >
              Clear logo
            </button>
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">
            Optional. Attach a logo from library assets tagged as Logos for reference.
          </p>
        )}
        {pickerOpen ? (
          <ul className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
            {library.map((save) => (
              <li key={save.shortId}>
                <button
                  type="button"
                  className="w-full overflow-hidden rounded-lg border border-[var(--border-subtle)]"
                  onClick={() => void setLogoMedia(save.media.shortId)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={save.media.previewUrl} alt="" className="aspect-square w-full object-cover" />
                </button>
              </li>
            ))}
            {library.length === 0 ? (
              <li className="col-span-full text-sm text-[var(--text-muted)]">
                No library media yet. Save images from studio first.
              </li>
            ) : null}
          </ul>
        ) : null}
      </section>

      {msg ? <p className="mt-4 text-sm text-[var(--accent-primary)]">{msg}</p> : null}
      {err ? (
        <p className="mt-4 text-sm text-[var(--danger)]" role="alert">
          {err}
        </p>
      ) : null}
    </div>
  );
}
