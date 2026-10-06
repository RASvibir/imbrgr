"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ImageEditor } from "@/components/editor/ImageEditor";
import { ShareLinks } from "@/components/share/ShareLinks";
import { StorageMeter } from "@/components/storage/StorageMeter";
import { ASPECT_PRESETS } from "@/lib/ai/image-prompt";
import { STYLES } from "@/lib/ai/styles";
import { ImageSettingsPanel, type ImageSettingsValues } from "@/components/images/ImageSettingsPanel";
import { normalizeStudioAsset } from "@/lib/studio-asset";
import { COPY, friendlyError } from "@/lib/user-messages";
import { mediaUrl } from "@/lib/urls";
import { useRouter } from "next/navigation";

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
  { id: "generate", label: "Create" },
  { id: "share", label: "Links" },
];

function parseStudioTab(raw: string | null | undefined): Tab {
  if (raw && TABS.some((t) => t.id === raw)) return raw as Tab;
  return "import";
}

const GENERATE_CLIENT_TIMEOUT_MS = 90_000;

export function ImageStudio({ defaultTab }: { defaultTab?: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const params = useSearchParams();
  const tabFromUrl = parseStudioTab(defaultTab ?? params.get("tab"));

  const [tab, setTab] = useState<Tab>(tabFromUrl);
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
  const [kitchenOpen, setKitchenOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [aiEditText, setAiEditText] = useState("");
  const [suggestions, setSuggestions] = useState<{ caption?: string; alt?: string; tags?: string[] }>({});
  const [deleteToken, setDeleteToken] = useState<string | null>(null);
  const [settings, setSettings] = useState<ImageSettingsValues>({
    title: "",
    description: "",
    tags: "",
    altText: "",
    mature: false,
    visibility: "UNLISTED",
  });

  useEffect(() => {
    setTab(parseStudioTab(defaultTab ?? params.get("tab")));
  }, [defaultTab, params]);

  const selectTab = (next: Tab) => {
    setTab(next);
    router.replace(`/studio?tab=${next}`, { scroll: false });
  };

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
      setMsg(COPY.imageReady);
      await refreshShare(next.shortId);
    },
    [refreshShare],
  );

  const importFile = async (file: File) => {
    setErr("");
    const form = new FormData();
    form.set("file", file);
    form.set("visibility", settings.visibility ?? "UNLISTED");
    const res = await fetch("/api/studio/import", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) {
      setErr(friendlyError(data.error ?? "Import failed"));
      return;
    }
    if (data.deleteToken) setDeleteToken(data.deleteToken);
    await setActiveAsset(normalizeStudioAsset(data));
    selectTab("edit");
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
      setErr(friendlyError(data.error ?? "Convert failed"));
      return;
    }
    await setActiveAsset(normalizeStudioAsset(data));
    selectTab("share");
  };

  const generate = async () => {
    setErr("");
    setBusy(true);
    const preset = ASPECT_PRESETS[aspect];
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), GENERATE_CLIENT_TIMEOUT_MS);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          prompt,
          enhance,
          width: preset.width,
          height: preset.height,
          style: style || undefined,
          safe: true,
          variations,
          visibility: settings.visibility,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setKitchenOpen(false);
        setErr(friendlyError(data.error ?? "Generation failed"));
        return;
      }
      setKitchenOpen(true);
      if (data.deleteToken) setDeleteToken(data.deleteToken);
      const primary = data.variations?.[0] ?? data;
      await setActiveAsset(
        normalizeStudioAsset({
          mediaShortId: primary.mediaShortId ?? data.mediaShortId,
          storageKey: primary.storageKey ?? data.storageKey,
          mimeType: "image/png",
        }),
      );
      selectTab("share");
    } catch (e) {
      const aborted = e instanceof DOMException && e.name === "AbortError";
      setErr(
        friendlyError(aborted ? "image_gen_timeout" : e instanceof Error ? e.message : "Generation failed"),
      );
    } finally {
      window.clearTimeout(timer);
      setBusy(false);
    }
  };

  const saveEditorBlob = async (blob: Blob) => {
    if (!asset) return;
    const form = new FormData();
    form.set("file", blob, "studio-edit.jpg");
    form.set("mode", "version");
    const res = await fetch(`/api/media/${asset.shortId}/edit`, { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) {
      setErr(friendlyError(data.error ?? "Save failed"));
      return;
    }
    const meta = await fetch(`/api/media/${data.shortId}`).then((r) => r.json());
    await setActiveAsset(
      normalizeStudioAsset({
        shortId: data.shortId,
        storageKey: meta.storageKey,
        mimeType: meta.mimeType,
        width: meta.width,
        height: meta.height,
      }),
    );
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
      setErr(friendlyError(data.error ?? "AI edit failed"));
      return;
    }
    await setActiveAsset(
      normalizeStudioAsset({
        mediaShortId: data.mediaShortId,
        storageKey: data.storageKey,
        mimeType: "image/png",
      }),
    );
    setAiEditText("");
    setMsg(COPY.settingsSaved);
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
      setErr(friendlyError(data.error ?? "Auto-enhance failed"));
      return;
    }
    await setActiveAsset(normalizeStudioAsset(data));
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

  const signedIn = Boolean(session?.user);
  const preview = asset ? mediaUrl(asset.storageKey, asset.mimeType) : null;

  const saveMediaSettings = async () => {
    if (!asset) return;
    await fetch(`/api/media/${asset.shortId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        altText: settings.altText,
        mature: settings.mature,
        visibility: settings.visibility,
      }),
    });
    await refreshShare(asset.shortId);
    setMsg(COPY.settingsSaved);
  };

  const publishToGallery = async () => {
    if (!asset || !signedIn) return;
    setErr("");
    setBusy(true);
    const title = settings.title?.trim() || "Untitled";
    const tags =
      settings.tags?.split(/[,\s#]+/).map((t) => t.trim()).filter(Boolean) ?? [];
    const res = await fetch("/api/posts/from-media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: settings.description || undefined,
        tags,
        visibility: settings.visibility ?? "PUBLIC",
        mediaShortIds: [asset.shortId],
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setErr(friendlyError(data.error ?? "Could not publish"));
      return;
    }
    setMsg(COPY.publishSuccess);
    router.push(`/p/${data.shortId}`);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6" onPaste={onPaste}>
      <header>
        <h1 className="text-3xl font-bold">Image studio</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {COPY.studioTagline}{" "}
          <Link href="/upload" className="text-[var(--accent-primary)]">Classic upload</Link>
        </p>
        <div className="mt-4 max-w-md">
          <StorageMeter />
        </div>
        {!kitchenOpen ? (
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            The kitchen&apos;s resting for now — try again later or{" "}
            <Link href="/auth/signin" className="text-[var(--accent-primary)]">sign in</Link> for more.
          </p>
        ) : null}
        {!signedIn ? (
          <p className="mt-2 rounded-lg border border-[var(--accent-primary)]/40 bg-[var(--surface-raised)] p-3 text-sm">
            {COPY.guestBanner}{" "}
            <Link href="/auth/signup" className="font-medium text-[var(--accent-primary)]">Create an account</Link>
          </p>
        ) : null}
      </header>

      <nav className="mt-6 flex gap-1 overflow-x-auto border-b border-[var(--border-subtle)] pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => selectTab(t.id)}
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
            <h3 className="font-semibold">Describe a tweak</h3>
            <p className="text-xs text-[var(--text-muted)]">{COPY.aiAssistantBlurb}</p>
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
              {COPY.applyAiEdit}
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
            {COPY.enhancePrompt}
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
            {busy ? COPY.generateWorking : COPY.generateCta}
          </button>
        </section>
      ) : null}

      {tab === "share" ? (
        <div className="mt-6 space-y-4">
          <ImageSettingsPanel
            signedIn={signedIn}
            values={settings}
            onChange={(v) => setSettings(v)}
            compact
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={saveMediaSettings} className="rounded-lg border border-[var(--border-strong)] px-4 py-2 text-sm font-medium">
              Save details
            </button>
            {signedIn ? (
              <button
                type="button"
                disabled={busy || !settings.title?.trim()}
                onClick={publishToGallery}
                className="rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm font-semibold text-[var(--on-accent)] disabled:opacity-50"
              >
                {COPY.publishCta}
              </button>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">
                <Link href="/auth/signup" className="text-[var(--accent-primary)]">Sign up</Link> to add this to the gallery.
              </p>
            )}
          </div>
          {signedIn && !settings.title?.trim() ? (
            <p className="text-xs text-[var(--text-muted)]">Add a title above to serve this to the gallery.</p>
          ) : null}
          {deleteToken ? (
            <p className="rounded-lg border border-[var(--warning)]/50 bg-[var(--surface-raised)] p-3 text-xs">
              {COPY.guestDeleteHint}{" "}
              <code className="break-all">{deleteToken}</code>
            </p>
          ) : null}
          {share ? <ShareLinks share={share} /> : null}
        </div>
      ) : null}
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
