"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { STYLES } from "@/lib/ai/styles";
import { KIT_REF_ROLES, type KitPalette, type KitRefRole } from "@/lib/kit-prompt";
import { btnPrimary, btnSecondary } from "@/lib/ui/button-classes";
import { friendlyError } from "@/lib/user-messages";

type KitMedia = {
  shortId: string;
  previewUrl: string;
  mimeType: string;
  title?: string | null;
};

type KitRef = {
  id: string;
  role: string;
  note: string | null;
  media: KitMedia;
};

type KitDetail = {
  shortId: string;
  name: string;
  description: string | null;
  styleLock: string | null;
  stylePreset: string | null;
  palette: KitPalette | null;
  refs: KitRef[];
};

type LibrarySave = {
  shortId: string;
  media: KitMedia & { title?: string | null };
};

type Props = {
  mode: "create" | "edit";
  shortId?: string;
};

const emptyPalette: KitPalette = { primary: "", secondary: "", accents: [] };

export function KitEditor({ mode, shortId }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [styleLock, setStyleLock] = useState("");
  const [stylePreset, setStylePreset] = useState("");
  const [palette, setPalette] = useState<KitPalette>(emptyPalette);
  const [refs, setRefs] = useState<KitRef[]>([]);
  const [kitShortId, setKitShortId] = useState<string | null>(shortId ?? null);
  const [library, setLibrary] = useState<LibrarySave[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [refRole, setRefRole] = useState<KitRefRole>("REFERENCE");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(mode === "create");

  const loadKit = useCallback(async () => {
    if (!shortId) return;
    try {
      const res = await fetch(`/api/kits/${shortId}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(friendlyError(data.error ?? "Could not load kit"));
        return;
      }
      const kit = data.kit as KitDetail;
      setKitShortId(kit.shortId);
      setName(kit.name);
      setDescription(kit.description ?? "");
      setStyleLock(kit.styleLock ?? "");
      setStylePreset(kit.stylePreset ?? "");
      setPalette({
        primary: kit.palette?.primary ?? "",
        secondary: kit.palette?.secondary ?? "",
        accents: kit.palette?.accents ?? [],
      });
      setRefs(kit.refs ?? []);
    } catch {
      setErr("Could not load kit");
    } finally {
      setLoaded(true);
    }
  }, [shortId]);

  const loadLibrary = useCallback(async () => {
    // Full library so props/general/backgrounds stay attachable as kit refs
    // even when CHARACTER-tagged saves already exist.
    const res = await fetch("/api/library");
    const data = await res.json();
    if (!res.ok) return;
    setLibrary((data.saves ?? []) as LibrarySave[]);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate editor from API
    void loadKit();
    void loadLibrary();
  }, [loadKit, loadLibrary]);

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
      stylePreset: stylePreset.trim() || null,
      palette: palettePayload(),
    };

    if (mode === "create" && !kitShortId) {
      const res = await fetch("/api/kits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setBusy(false);
      if (!res.ok) {
        setErr(friendlyError(data.error ?? "Could not create kit"));
        return;
      }
      setKitShortId(data.kit.shortId);
      setMsg("Kit created — add reference images below.");
      router.replace(`/kits/${data.kit.shortId}`);
      return;
    }

    const id = kitShortId!;
    const res = await fetch(`/api/kits/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setErr(friendlyError(data.error ?? "Could not save kit"));
      return;
    }
    setRefs(data.kit.refs ?? refs);
    setMsg("Saved");
  };

  const addRef = async (mediaShortId: string) => {
    if (!kitShortId) {
      setErr("Save the kit name first, then add references.");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/kits/${kitShortId}/refs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mediaShortId, role: refRole }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setErr(friendlyError(data.error ?? "Could not add reference"));
      return;
    }
    setRefs(data.kit.refs ?? []);
    setPickerOpen(false);
    setMsg("Reference added");
  };

  const removeRef = async (mediaShortId: string) => {
    if (!kitShortId) return;
    setBusy(true);
    const res = await fetch(`/api/kits/${kitShortId}/refs`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mediaShortId }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setErr(friendlyError(data.error ?? "Could not remove reference"));
      return;
    }
    setRefs(data.kit.refs ?? []);
  };

  if (!loaded) {
    return <p className="p-8 text-center text-[var(--text-muted)]">Loading kit…</p>;
  }

  if (err && mode === "edit" && !name) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6" data-testid="kit-editor">
        <p className="text-sm text-[var(--danger)]" role="alert">
          {err}
        </p>
        <Link href="/kits" className="mt-4 inline-block text-sm text-[var(--accent-primary)] hover:underline">
          ← All kits
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6" data-testid="kit-editor">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/kits" className="text-xs text-[var(--text-muted)] hover:underline">
            ← All kits
          </Link>
          <h1 className="mt-1 text-2xl font-bold">
            {mode === "create" && !kitShortId ? "New character kit" : "Edit character kit"}
          </h1>
        </div>
        {kitShortId ? (
          <Link href={`/studio?tab=create&kit=${kitShortId}`} className={`${btnSecondary} text-sm`}>
            Use in studio
          </Link>
        ) : null}
      </div>

      <section className="space-y-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-5">
        <label className="block">
          <span className="text-sm font-medium">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border px-3"
            placeholder="e.g. Ember scout"
            data-testid="kit-name"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="Who is this character?"
            data-testid="kit-description"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Style lock</span>
          <textarea
            value={styleLock}
            onChange={(e) => setStyleLock(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="Always append these look constraints when generating…"
            data-testid="kit-style-lock"
          />
          <span className="mt-1 block text-xs text-[var(--text-muted)]">
            Appended to every generate that uses this kit.
          </span>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Default look</span>
          <select
            value={stylePreset}
            onChange={(e) => setStylePreset(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border px-2 text-sm"
            data-testid="kit-style-preset"
          >
            <option value="">None</option>
            {Object.keys(STYLES).map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Palette</legend>
          <div className="flex flex-wrap gap-3">
            <label className="text-xs">
              Primary
              <input
                type="color"
                value={palette.primary && /^#/.test(palette.primary) ? palette.primary : "#f97316"}
                onChange={(e) => setPalette((p) => ({ ...p, primary: e.target.value }))}
                className="mt-1 block h-10 w-16 cursor-pointer rounded border bg-transparent"
                data-testid="kit-palette-primary"
              />
            </label>
            <label className="text-xs">
              Secondary
              <input
                type="color"
                value={palette.secondary && /^#/.test(palette.secondary) ? palette.secondary : "#1c1816"}
                onChange={(e) => setPalette((p) => ({ ...p, secondary: e.target.value }))}
                className="mt-1 block h-10 w-16 cursor-pointer rounded border bg-transparent"
                data-testid="kit-palette-secondary"
              />
            </label>
          </div>
        </fieldset>
        <button
          type="button"
          disabled={busy}
          onClick={() => void saveMeta()}
          className={btnPrimary}
          data-testid="kit-save"
        >
          {busy ? "Saving…" : kitShortId ? "Save kit" : "Create kit"}
        </button>
      </section>

      <section className="mt-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Reference images</h2>
          <button
            type="button"
            className={btnSecondary}
            disabled={!kitShortId}
            onClick={() => setPickerOpen((o) => !o)}
            data-testid="kit-add-ref"
          >
            {pickerOpen ? "Close picker" : "Add from library"}
          </button>
        </div>
        {!kitShortId ? (
          <p className="text-sm text-[var(--text-muted)]">Save the kit first to attach references.</p>
        ) : null}

        {pickerOpen ? (
          <div className="rounded-xl border border-[var(--border-subtle)] p-4" data-testid="kit-ref-picker">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <label className="text-xs text-[var(--text-muted)]">
                Role
                <select
                  value={refRole}
                  onChange={(e) => setRefRole(e.target.value as KitRefRole)}
                  className="ml-2 min-h-9 rounded border px-2 text-sm"
                >
                  {KIT_REF_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r.replaceAll("_", " ").toLowerCase()}
                    </option>
                  ))}
                </select>
              </label>
              <Link href="/library" className="text-xs text-[var(--accent-primary)] hover:underline">
                Open full library
              </Link>
            </div>
            {library.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">
                Library is empty. Generate or upload images, save them, then attach here.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {library.map((s) => (
                  <button
                    key={s.shortId}
                    type="button"
                    disabled={busy || refs.some((r) => r.media.shortId === s.media.shortId)}
                    onClick={() => void addRef(s.media.shortId)}
                    className="overflow-hidden rounded-lg border border-[var(--border-subtle)] disabled:opacity-40"
                    title={s.media.title ?? s.media.shortId}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.media.previewUrl} alt="" className="aspect-square w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {refs.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--border-subtle)] px-4 py-10 text-center text-sm text-[var(--text-muted)]">
            No references yet.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {refs.map((r) => (
              <li
                key={r.id}
                className="flex gap-3 overflow-hidden rounded-xl border border-[var(--border-subtle)] p-2"
                data-testid={`kit-ref-${r.media.shortId}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.media.previewUrl} alt="" className="h-20 w-20 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                    {r.role.replaceAll("_", " ")}
                  </p>
                  <p className="truncate text-sm">{r.media.shortId}</p>
                  <button
                    type="button"
                    className="mt-2 text-xs text-[var(--danger)]"
                    onClick={() => void removeRef(r.media.shortId)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
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
