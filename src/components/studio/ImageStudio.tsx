"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { ImageEditor } from "@/components/editor/ImageEditor";
import { ShareLinks } from "@/components/share/ShareLinks";
import { StorageMeter } from "@/components/storage/StorageMeter";
import { ASPECT_PRESETS } from "@/lib/ai/image-prompt";
import { ImageSettingsPanel, type ImageSettingsValues } from "@/components/images/ImageSettingsPanel";
import { normalizeStudioAsset } from "@/lib/studio-asset";
import { COPY, friendlyError } from "@/lib/user-messages";
import { mediaUrl } from "@/lib/urls";
import { StudioAiAssist } from "@/components/studio/StudioAiAssist";
import { StudioPromptHero } from "@/components/studio/StudioPromptHero";

type StudioAsset = {
  shortId: string;
  storageKey: string;
  mimeType: string;
  width?: number | null;
  height?: number | null;
};

type Tab = "create" | "refine" | "share";

const TABS: { id: Tab; label: string }[] = [
  { id: "create", label: "Create" },
  { id: "refine", label: "Refine" },
  { id: "share", label: "Share" },
];

function parseStudioTab(raw: string | null | undefined): Tab {
  if (raw === "share" || raw === "links") return "share";
  if (raw === "refine" || raw === "edit" || raw === "convert") return "refine";
  return "create";
}

const GENERATE_CLIENT_TIMEOUT_MS = 90_000;

export function ImageStudio({
  defaultTab,
  initialPrompt,
}: {
  defaultTab?: string;
  initialPrompt?: string;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const params = useSearchParams();
  const urlTab = parseStudioTab(defaultTab ?? params.get("tab"));
  const [tabOverride, setTabOverride] = useState<Tab | null>(null);
  const tab = tabOverride ?? urlTab;
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

  const [prompt, setPrompt] = useState(() =>
    initialPrompt ? decodeURIComponent(initialPrompt) : "",
  );
  const [enhance, setEnhance] = useState(true);
  const [style, setStyle] = useState("");
  const [aspect, setAspect] = useState<keyof typeof ASPECT_PRESETS>("1:1");
  const [variations, setVariations] = useState(1);
  const [kitchenOpen, setKitchenOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [aiAssistOn, setAiAssistOn] = useState(false);
  const [aiEditText, setAiEditText] = useState("");
  const [assistErr, setAssistErr] = useState("");
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

  const selectTab = (next: Tab) => {
    setTabOverride(next);
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
    selectTab("refine");
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
      setErr(friendlyError(data.error ?? "URL fetch failed"));
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
      selectTab("refine");
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
    setMsg(COPY.settingsSaved);
  };

  const aiNaturalEdit = async () => {
    if (!asset || !aiEditText.trim()) return;
    setBusy(true);
    setAssistErr("");
    const res = await fetch("/api/ai/edit-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mediaShortId: asset.shortId, instruction: aiEditText }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setAssistErr(data.error ?? "Edit failed");
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
  };

  const autoEnhance = async () => {
    if (!asset) return;
    setBusy(true);
    setAssistErr("");
    const res = await fetch("/api/studio/auto-enhance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mediaShortId: asset.shortId }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setAssistErr(data.error ?? "Sharpen failed");
      return;
    }
    await setActiveAsset(normalizeStudioAsset(data));
  };

  const runSuggest = async (type: "caption" | "alt" | "tags") => {
    const context = prompt || settings.title || "image";
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

  const applySuggestion = (type: "caption" | "alt" | "tags", value: string | string[]) => {
    if (type === "alt" && typeof value === "string") setSettings((s) => ({ ...s, altText: value }));
    if (type === "caption" && typeof value === "string") setSettings((s) => ({ ...s, description: value }));
    if (type === "tags" && Array.isArray(value)) setSettings((s) => ({ ...s, tags: value.join(", ") }));
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
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6" onPaste={onPaste}>
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Image studio</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{COPY.studioTagline}</p>
        {signedIn ? (
          <div className="mt-3 max-w-md">
            <StorageMeter />
          </div>
        ) : null}
        {!kitchenOpen ? (
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            The kitchen&apos;s resting — try again later or{" "}
            <Link href="/auth/signin" className="text-[var(--accent-primary)]">sign in</Link>.
          </p>
        ) : null}
        {!signedIn ? (
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            {COPY.guestBanner}{" "}
            <Link href="/auth/signup" className="text-[var(--accent-primary)]">Create an account</Link>
          </p>
        ) : null}
      </header>

      <nav className="flex gap-1 border-b border-[var(--border-subtle)] pb-1" aria-label="Studio steps">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => selectTab(t.id)}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
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
          <img src={preview} alt="" className="max-h-72 w-full object-contain" />
        </div>
      ) : null}

      {tab === "create" ? (
        <div className="mt-6 space-y-6">
          <StudioPromptHero
            prompt={prompt}
            onPromptChange={setPrompt}
            enhance={enhance}
            onEnhanceChange={setEnhance}
            style={style}
            onStyleChange={setStyle}
            aspect={aspect}
            onAspectChange={setAspect}
            variations={variations}
            onVariationsChange={setVariations}
            busy={busy}
            onGenerate={generate}
          />
          <details className="rounded-xl border border-[var(--border-subtle)] p-4">
            <summary className="cursor-pointer text-sm text-[var(--text-muted)]">Bring your own image</summary>
            <div className="mt-4 space-y-3">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
                className="rounded-xl border border-dashed border-[var(--border-strong)] p-6 text-center text-sm text-[var(--text-secondary)]"
              >
                Drag & drop or paste
                <label className="mt-3 inline-block cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium">
                  Choose file
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
                  placeholder="Or paste an image URL"
                  className="flex-1 rounded-lg border px-3 py-2 text-sm"
                />
                <button type="button" onClick={importFromUrl} className="rounded-lg border px-4 py-2 text-sm">
                  Import
                </button>
              </div>
            </div>
          </details>
        </div>
      ) : null}

      {tab === "refine" ? (
        <section className="mt-6 space-y-4">
          {!asset ? (
            <p className="text-sm text-[var(--text-muted)]">
              Create or import an image first, then refine it here.
            </p>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="w-full rounded-xl bg-[var(--accent-primary)] px-4 py-3 text-sm font-semibold text-[var(--on-accent)] sm:w-auto"
              >
                Open editor
              </button>
              <StudioAiAssist
                enabled={aiAssistOn}
                onEnabledChange={setAiAssistOn}
                editText={aiEditText}
                onEditTextChange={setAiEditText}
                busy={busy}
                hasAsset={Boolean(asset)}
                onApplyEdit={aiNaturalEdit}
                onSharpen={autoEnhance}
                onSuggest={runSuggest}
                onApplySuggestion={applySuggestion}
                suggestions={suggestions}
                err={assistErr}
              />
              <details className="rounded-lg border border-[var(--border-subtle)] p-3 text-sm">
                <summary className="cursor-pointer text-[var(--text-muted)]">Export format</summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label>
                    Format
                    <select value={format} onChange={(e) => setFormat(e.target.value as typeof format)} className="mt-1 w-full rounded border px-2 py-2">
                      <option value="jpeg">JPEG</option>
                      <option value="png">PNG</option>
                      <option value="webp">WebP</option>
                      <option value="avif">AVIF</option>
                    </select>
                  </label>
                  <label>
                    Quality ({quality})
                    <input type="range" min={40} max={100} value={quality} onChange={(e) => setQuality(+e.target.value)} className="mt-2 w-full" />
                  </label>
                  <label className="sm:col-span-2">
                    Max width
                    <input type="number" value={maxWidth} onChange={(e) => setMaxWidth(+e.target.value)} className="mt-1 w-full rounded border px-2 py-2" />
                  </label>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={convert}
                    className="sm:col-span-2 rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50"
                  >
                    Save converted copy
                  </button>
                </div>
              </details>
            </>
          )}
        </section>
      ) : null}

      {tab === "share" ? (
        <div className="mt-6 space-y-4">
          {!asset ? (
            <p className="text-sm text-[var(--text-muted)]">Nothing to share yet — start in Create.</p>
          ) : (
            <>
              <ImageSettingsPanel signedIn={signedIn} values={settings} onChange={(v) => setSettings(v)} compact />
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={saveMediaSettings} className="rounded-lg border px-4 py-2 text-sm font-medium">
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
                    <Link href="/auth/signup" className="text-[var(--accent-primary)]">Sign up</Link> to add to the gallery.
                  </p>
                )}
              </div>
              {deleteToken ? (
                <p className="rounded-lg border border-[var(--warning)]/50 bg-[var(--surface-raised)] p-3 text-xs">
                  {COPY.guestDeleteHint} <code className="break-all">{deleteToken}</code>
                </p>
              ) : null}
              {share ? <ShareLinks share={share} /> : null}
            </>
          )}
        </div>
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
