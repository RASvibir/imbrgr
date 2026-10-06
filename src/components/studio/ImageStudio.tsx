"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ImageEditor } from "@/components/editor/ImageEditor";
import { ShareLinks } from "@/components/share/ShareLinks";
import { StorageMeter } from "@/components/storage/StorageMeter";
import { ASPECT_PRESETS } from "@/lib/ai/image-prompt";
import { STYLES } from "@/lib/ai/styles";
import { mediaUrl } from "@/lib/urls";

type StudioAsset = {
  shortId: string;
  storageKey: string;
  mimeType: string;
  width?: number | null;
  height?: number | null;
};

type Tab = "import" | "convert" | "edit" | "generate" | "share";

const TABS: { id: Tab; label: string }[] = [
  { id: "import", label: "Import" },
  { id: "convert", label: "Convert" },
  { id: "edit", label: "Edit" },
  { id: "generate", label: "AI generate" },
  { id: "share", label: "Links" },
];

export function ImageStudio() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const initialTab = (params.get("tab") as Tab) || "import";

  const [tab, setTab] = useState<Tab>(initialTab);
  const [asset, setAsset] = useState<StudioAsset | null>(null);
  const [share, setShare] = useState<{
    pageUrl: string;
    directUrl: string;
    markdown: string;
    html: string;
    bbcode: string;
  } | null>(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [editing, setEditing] = useState(false);

  const [format, setFormat] = useState<"jpeg" | "png" | "webp" | "avif">("webp");
  const [quality, setQuality] = useState(85);
  const [maxWidth, setMaxWidth] = useState(1920);

  const [prompt, setPrompt] = useState("");
  const [enhance, setEnhance] = useState(true);
  const [style, setStyle] = useState("");
  const [aspect, setAspect] = useState<keyof typeof ASPECT_PRESETS>("1:1");
  const [variations, setVariations] = useState(1);
  const [usage, setUsage] = useState<{ used: number; limit: number; remaining: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiEditText, setAiEditText] = useState("");
  const [suggestions, setSuggestions] = useState<{ caption?: string; alt?: string; tags?: string[] }>({});

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin?callbackUrl=/studio");
  }, [status, router]);

  useEffect(() => {
    if (!session?.user) return;
    void fetch("/api/ai/usage").then((r) => r.json()).then(setUsage).catch(() => undefined);
  }, [session?.user]);

  const refreshShare = useCallback(async (shortId: string) => {
    const res = await fetch(`/api/media/${shortId}`);
    if (res.ok) {
      const data = await res.json();
      setShare(data.share);
    }
  }, []);

  const setActiveAsset = useCallback(
    async (next: StudioAsset) => {
      setAsset(next);
      setMsg("Image ready in studio");
      await refreshShare(next.shortId);
    },
    [refreshShare],
  );

  const importFile = async (file: File) => {
    setErr("");
    const form = new FormData();
    form.set("file", file);
    const res = await fetch("/api/studio/import", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) {
      setErr(data.error ?? "Import failed");
      return;
    }
    await setActiveAsset(data);
    setTab("edit");
  };

  const importFromUrl = async () => {
    setErr("");
    const res = await fetch("/api/upload/url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: urlInput }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErr(data.error ?? "URL fetch failed");
      return;
    }
    const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    const file = new File([bytes], data.filename || "import.jpg", { type: data.mime || "image/jpeg" });
    await importFile(file);
    setUrlInput("");
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) void importFile(f);
  };

  const onPaste = (e: React.ClipboardEvent) => {
    for (const item of e.clipboardData.items) {
      if (item.kind === "file") {
        const f = item.getAsFile();
        if (f?.type.startsWith("image/")) {
          e.preventDefault();
          void importFile(f);
          return;
        }
      }
    }
  };

  const convert = async () => {
    if (!asset) return;
    setBusy(true);
    setErr("");
    const res = await fetch("/api/studio/convert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mediaShortId: asset.shortId,
        format,
        quality,
        maxWidth,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setErr(data.error ?? "Convert failed");
      return;
    }
    await setActiveAsset(data);
    setTab("share");
  };

  const generate = async () => {
    setErr("");
    setBusy(true);
    const preset = ASPECT_PRESETS[aspect];
    const res = await fetch("/api/ai/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        enhance,
        width: preset.width,
        height: preset.height,
        style: style || undefined,
        safe: true,
        variations,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setErr(data.error ?? "Generation failed");
      return;
    }
    setUsage(data.usage);
    const primary = data.variations?.[0] ?? data;
    await setActiveAsset({
      shortId: primary.mediaShortId,
      storageKey: data.storageKey,
      mimeType: "image/png",
    });
    setTab("edit");
  };

  const saveEditorBlob = async (blob: Blob) => {
    if (!asset) return;
    const form = new FormData();
    form.set("file", blob, "studio-edit.jpg");
    form.set("mode", "version");
    const res = await fetch(`/api/media/${asset.shortId}/edit`, { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) {
      setErr(data.error ?? "Save failed");
      return;
    }
    const meta = await fetch(`/api/media/${data.shortId}`).then((r) => r.json());
    await setActiveAsset({
      shortId: data.shortId,
      storageKey: meta.storageKey,
      mimeType: meta.mimeType,
      width: meta.width,
      height: meta.height,
    });
    setEditing(false);
  };

  const aiNaturalEdit = async () => {
    if (!asset || !aiEditText.trim()) return;
    setBusy(true);
    setErr("");
    const res = await fetch("/api/ai/edit-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mediaShortId: asset.shortId, instruction: aiEditText }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setErr(data.error ?? "AI edit failed");
      return;
    }
    setUsage(data.usage);
    await setActiveAsset({
      shortId: data.mediaShortId,
      storageKey: data.storageKey,
      mimeType: "image/png",
    });
    setAiEditText("");
    setMsg("AI edit saved as new version");
  };

  const autoEnhance = async () => {
    if (!asset) return;
    setBusy(true);
    const res = await fetch("/api/studio/auto-enhance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mediaShortId: asset.shortId }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setErr(data.error ?? "Auto-enhance failed");
      return;
    }
    await setActiveAsset({ shortId: data.shortId, storageKey: data.storageKey, mimeType: data.mimeType });
  };

  const runSuggest = async (type: "caption" | "alt" | "tags") => {
    const context = prompt || "studio image";
    const res = await fetch("/api/ai/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, context }),
    });
    const data = await res.json();
    if (!res.ok) return;
    if (type === "tags") setSuggestions((s) => ({ ...s, tags: data.tags }));
    else if (type === "caption") setSuggestions((s) => ({ ...s, caption: data.text }));
    else setSuggestions((s) => ({ ...s, alt: data.text }));
  };

  if (status === "loading") {
    return <p className="p-8 text-center text-[var(--text-muted)]">Loading studio…</p>;
  }

  const preview = asset ? mediaUrl(asset.storageKey, asset.mimeType) : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6" onPaste={onPaste}>
      <header>
        <h1 className="text-3xl font-bold">Image studio</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Import, convert, edit, generate, and share — one flow.{" "}
          <Link href="/upload" className="text-[var(--accent-primary)]">Classic upload</Link>
        </p>
        <div className="mt-4 max-w-md">
          <StorageMeter />
        </div>
        {usage ? (
          <p className="mt-2 text-xs text-[var(--text-secondary)]">
            AI generations today: {usage.remaining} / {usage.limit} left
          </p>
        ) : null}
      </header>

      <nav className="mt-6 flex gap-1 overflow-x-auto border-b border-[var(--border-subtle)] pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap rounded-t-lg px-3 py-2 text-sm font-medium ${
              tab === t.id
                ? "bg-[var(--surface-raised)] text-[var(--accent-primary)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {asset && preview ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" className="max-h-64 w-full object-contain" />
          <p className="px-3 py-2 text-xs text-[var(--text-muted)]">
            Active: /i/{asset.shortId}
            {asset.width ? ` · ${asset.width}×${asset.height}` : ""}
          </p>
        </div>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-[var(--border-strong)] p-4 text-sm text-[var(--text-muted)]">
          No image yet — import or generate to get started.
        </p>
      )}

      {tab === "import" ? (
        <section className="mt-6 space-y-4">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            className="rounded-2xl border-2 border-dashed border-[var(--border-strong)] bg-[var(--surface-raised)] p-8 text-center"
          >
            <p className="text-[var(--text-secondary)]">Drag & drop, paste from clipboard, or pick a file</p>
            <label className="mt-4 inline-block cursor-pointer rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm font-semibold text-[var(--on-accent)]">
              Choose image
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])}
              />
            </label>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Import from URL"
              className="flex-1 rounded-lg border px-3 py-2"
            />
            <button type="button" onClick={importFromUrl} className="rounded-lg border px-4 py-2 text-sm">
              Fetch URL
            </button>
          </div>
        </section>
      ) : null}

      {tab === "convert" ? (
        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            Format
            <select value={format} onChange={(e) => setFormat(e.target.value as typeof format)} className="mt-1 w-full rounded border px-2 py-2">
              <option value="jpeg">JPEG</option>
              <option value="png">PNG</option>
              <option value="webp">WebP</option>
              <option value="avif">AVIF</option>
            </select>
          </label>
          <label className="text-sm">
            Quality ({quality})
            <input type="range" min={40} max={100} value={quality} onChange={(e) => setQuality(+e.target.value)} className="mt-2 w-full" />
          </label>
          <label className="text-sm sm:col-span-2">
            Max width (px)
            <input type="number" value={maxWidth} onChange={(e) => setMaxWidth(+e.target.value)} className="mt-1 w-full rounded border px-2 py-2" />
          </label>
          <button
            type="button"
            disabled={!asset || busy}
            onClick={convert}
            className="sm:col-span-2 rounded-xl bg-[var(--accent-primary)] px-4 py-3 font-semibold text-[var(--on-accent)] disabled:opacity-50"
          >
            Convert & save new version
          </button>
        </section>
      ) : null}

      {tab === "edit" ? (
        <section className="mt-6 space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!asset}
              onClick={() => setEditing(true)}
              className="rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm font-semibold text-[var(--on-accent)] disabled:opacity-50"
            >
              Open manual editor
            </button>
            <button type="button" disabled={!asset || busy} onClick={autoEnhance} className="rounded-lg border px-4 py-2 text-sm">
              Quick auto-enhance (sharp)
            </button>
          </div>
          <div className="rounded-xl border border-[var(--border-subtle)] p-4">
            <h3 className="font-semibold">AI assistant</h3>
            <p className="text-xs text-[var(--text-muted)]">Natural-language edits use Gemini and count toward your daily AI limit.</p>
            <textarea
              value={aiEditText}
              onChange={(e) => setAiEditText(e.target.value)}
              rows={2}
              placeholder='e.g. "make it sunset", "remove background", "add neon lights"'
              className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={!asset || busy || aiEditText.length < 3}
              onClick={aiNaturalEdit}
              className="mt-2 rounded-lg border border-[var(--accent-primary)] px-4 py-2 text-sm text-[var(--accent-primary)]"
            >
              Apply AI edit
            </button>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => runSuggest("caption")} className="rounded border px-2 py-1 text-xs">Suggest caption</button>
              <button type="button" onClick={() => runSuggest("alt")} className="rounded border px-2 py-1 text-xs">Suggest alt text</button>
              <button type="button" onClick={() => runSuggest("tags")} className="rounded border px-2 py-1 text-xs">Suggest tags</button>
            </div>
            {suggestions.caption ? <p className="mt-2 text-sm">Caption: {suggestions.caption}</p> : null}
            {suggestions.alt ? <p className="mt-1 text-sm">Alt: {suggestions.alt}</p> : null}
            {suggestions.tags?.length ? <p className="mt-1 text-sm">Tags: {suggestions.tags.join(", ")}</p> : null}
          </div>
        </section>
      ) : null}

      {tab === "generate" ? (
        <section className="mt-6 space-y-4 rounded-xl border p-4">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="Describe the image you want…"
            className="w-full rounded-lg border px-3 py-2"
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={enhance} onChange={(e) => setEnhance(e.target.checked)} />
            Enhance prompt (skips when already detailed; cached repeats are free)
          </label>
          <div className="flex flex-wrap gap-2">
            <select value={style} onChange={(e) => setStyle(e.target.value)} className="rounded border px-2 py-1 text-sm">
              <option value="">Style</option>
              {Object.keys(STYLES).map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
            <select value={aspect} onChange={(e) => setAspect(e.target.value as keyof typeof ASPECT_PRESETS)} className="rounded border px-2 py-1 text-sm">
              {Object.entries(ASPECT_PRESETS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <select value={variations} onChange={(e) => setVariations(+e.target.value)} className="rounded border px-2 py-1 text-sm">
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>{n} variation{n > 1 ? "s" : ""}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={busy || prompt.length < 3}
            onClick={generate}
            className="rounded-xl bg-[var(--accent-primary)] px-6 py-2 font-semibold text-[var(--on-accent)] disabled:opacity-50"
          >
            {busy ? "Working…" : "Generate with Flux"}
          </button>
        </section>
      ) : null}

      {tab === "share" && share ? <div className="mt-6"><ShareLinks share={share} /></div> : null}
      {tab === "share" && !share ? (
        <p className="mt-6 text-sm text-[var(--text-muted)]">Save or import an image to get share links.</p>
      ) : null}

      {err ? <p className="mt-4 text-sm text-[var(--danger)]">{err}</p> : null}
      {msg ? <p className="mt-4 text-sm text-[var(--accent-primary)]">{msg}</p> : null}

      {editing && preview ? (
        <ImageEditor
          imageSrc={preview}
          studioMode
          onCancel={() => setEditing(false)}
          onExport={(blob) => void saveEditorBlob(blob)}
        />
      ) : null}
    </div>
  );
}
