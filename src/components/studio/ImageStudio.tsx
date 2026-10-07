"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { FieldPressDraftStudioChrome } from "@/components/fieldpress/FieldPressDraftStudioChrome";
import { UseInFieldPressDraftLink } from "@/components/fieldpress/UseInFieldPressDraftLink";
import { AiEditPreview } from "@/components/studio/AiEditPreview";
import { ImageEditor } from "@/components/editor/ImageEditor";
import { ShareLinks } from "@/components/share/ShareLinks";
import { FieldPressInvite } from "@/components/fieldpress/FieldPressInvite";
import { canOfferFieldPressLink, showFieldPressStoryInvite } from "@/lib/fieldpress";
import { StorageMeter } from "@/components/storage/StorageMeter";
import { ASPECT_PRESETS } from "@/lib/ai/image-prompt";
import { ImageSettingsPanel, type ImageSettingsValues } from "@/components/images/ImageSettingsPanel";
import { normalizeStudioAsset } from "@/lib/studio-asset";
import { btnPrimary, btnSecondary } from "@/lib/ui/button-classes";
import { COPY, friendlyError } from "@/lib/user-messages";
import { mediaUrl } from "@/lib/urls";
import { StudioMobileActionBar } from "@/components/studio/StudioMobileActionBar";
import { StudioAiAssist } from "@/components/studio/StudioAiAssist";
import { StudioPromptHero } from "@/components/studio/StudioPromptHero";
import { StudioImageMenu } from "@/components/studio/StudioImageMenu";
import { StudioVersionStrip } from "@/components/studio/StudioVersionStrip";
import { KeepOriginalToggle } from "@/components/studio/KeepOriginalToggle";
import { readGuestKeepOriginal, writeGuestKeepOriginal } from "@/lib/studio-keep-original";
import type { StudioInitialAsset } from "@/lib/studio-initial-asset";
import {
  fieldpressStudioVisibilityFromUserDefault,
  ingestFieldPressDraftFromQuery,
  readFieldPressDraftId,
  subscribeFieldPressDraftId,
} from "@/lib/fieldpress-draft";

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
  if (raw === "generate" || raw === "create") return "create";
  return "create";
}

const GENERATE_CLIENT_TIMEOUT_MS = 90_000;

export function ImageStudio({
  defaultTab,
  initialPrompt,
  initialAssistPrompt,
  initialAsset,
  remixFromShortId,
}: {
  defaultTab?: string;
  initialPrompt?: string;
  initialAssistPrompt?: string;
  initialAsset?: StudioInitialAsset | null;
  remixFromShortId?: string;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const params = useSearchParams();
  const urlTab = parseStudioTab(defaultTab ?? params.get("tab"));
  const [tabOverride, setTabOverride] = useState<Tab | null>(null);
  const tab = tabOverride ?? urlTab;
  const [asset, setAsset] = useState<StudioAsset | null>(initialAsset ?? null);
  const [share, setShare] = useState<{
    pageUrl: string;
    directUrl: string;
    markdown: string;
    html: string;
    bbcode: string;
  } | null>(null);
  const [mediaVisibility, setMediaVisibility] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [editing, setEditing] = useState(false);

  const [format, setFormat] = useState<"jpeg" | "png" | "webp" | "avif">("webp");
  const [quality, setQuality] = useState(85);
  const [maxWidth, setMaxWidth] = useState(1920);

  const [prompt, setPrompt] = useState(() => initialPrompt ?? "");
  const [enhance, setEnhance] = useState(true);
  const [style, setStyle] = useState("");
  const [aspect, setAspect] = useState<keyof typeof ASPECT_PRESETS>("1:1");
  const [variations, setVariations] = useState(1);
  const [kitchenOpen, setKitchenOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [aiAssistOn, setAiAssistOn] = useState(() => Boolean(initialAssistPrompt?.trim()));
  const [aiEditText, setAiEditText] = useState(() => initialAssistPrompt ?? "");
  const [assistErr, setAssistErr] = useState("");
  const [assistProgress, setAssistProgress] = useState("");
  const [aiPreview, setAiPreview] = useState<{
    beforeSrc: string;
    afterSrc: string;
    after: StudioAsset;
  } | null>(null);
  const aiAbortRef = useRef<AbortController | null>(null);
  const applyFieldPressVisibilityRef = useRef(false);
  const fieldPressDraftId = useSyncExternalStore(
    subscribeFieldPressDraftId,
    readFieldPressDraftId,
    () => null,
  );
  const [suggestions, setSuggestions] = useState<{ caption?: string; alt?: string; tags?: string[] }>({});
  const [deleteToken, setDeleteToken] = useState<string | null>(null);
  const [versionRefreshKey, setVersionRefreshKey] = useState(0);
  const [canRevertOriginal, setCanRevertOriginal] = useState(false);
  const [keepOriginal, setKeepOriginal] = useState(true);
  const [settings, setSettings] = useState<ImageSettingsValues>({
    title: "",
    description: "",
    tags: "",
    altText: "",
    mature: false,
    visibility: "PUBLIC",
  });

  const selectTab = (next: Tab, mediaShortId?: string) => {
    setTabOverride(next);
    const id = mediaShortId ?? asset?.shortId;
    const q = id ? `?tab=${next}&media=${id}` : `?tab=${next}`;
    router.replace(`/studio${q}`, { scroll: false });
  };

  const refreshShare = useCallback(async (shortId: string) => {
    const res = await fetch(`/api/media/${shortId}`);
    if (res.ok) {
      const data = await res.json();
      setShare(data.share);
      setMediaVisibility(typeof data.visibility === "string" ? data.visibility : null);
    }
  }, []);

  useEffect(() => {
    if (initialAsset?.shortId) {
      void refreshShare(initialAsset.shortId);
    }
  }, [initialAsset?.shortId, refreshShare]);

  const setActiveAsset = useCallback(
    async (next: StudioAsset) => {
      setAsset(next);
      setVersionRefreshKey((k) => k + 1);
      setMsg(COPY.imageReady);
      await refreshShare(next.shortId);
    },
    [refreshShare],
  );

  const onVersionsLoaded = useCallback((versions: { locked: boolean; isCurrent: boolean }[]) => {
    const current = versions.find((v) => v.isCurrent);
    setCanRevertOriginal(Boolean(current && !current.locked && versions.some((v) => v.locked)));
  }, []);

  const revertToOriginal = useCallback(async () => {
    if (!asset) return;
    setErr("");
    const res = await fetch(`/api/media/${asset.shortId}/revert-original`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setErr(friendlyError(data.error ?? "Could not revert"));
      return;
    }
    await setActiveAsset(
      normalizeStudioAsset({
        shortId: data.shortId,
        storageKey: data.storageKey,
        mimeType: data.mimeType,
        width: data.width,
        height: data.height,
      }),
    );
    setMsg(COPY.libraryRevertOriginal);
  }, [asset, setActiveAsset]);

  const importFile = async (file: File) => {
    setErr("");
    const form = new FormData();
    form.set("file", file);
    form.set("visibility", settings.visibility ?? "UNLISTED");
    form.set("keepOriginal", keepOriginal ? "true" : "false");
    const res = await fetch("/api/studio/import", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) {
      setErr(friendlyError(data.error ?? "Import failed"));
      return;
    }
    if (data.deleteToken) setDeleteToken(data.deleteToken);
    const next = normalizeStudioAsset(data);
    await setActiveAsset(next);
    selectTab("refine", next.shortId);
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
          keepOriginal,
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
      const next = normalizeStudioAsset({
        mediaShortId: primary.mediaShortId ?? data.mediaShortId,
        storageKey: primary.storageKey ?? data.storageKey,
        mimeType: "image/png",
      });
      await setActiveAsset(next);
      const vis = data.galleryVisibility ?? settings.visibility ?? "PUBLIC";
      if (vis === "PUBLIC") setMsg(COPY.galleryLivePublic);
      else if (vis === "PRIVATE") setMsg(COPY.gallerySavedPrivate);
      else setMsg(COPY.gallerySavedUnlisted);
      selectTab("refine", next.shortId);
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
    form.set("keepOriginal", keepOriginal ? "true" : "false");
    const res = await fetch(`/api/media/${asset.shortId}/edit`, { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) {
      setErr(friendlyError(data.error ?? "Save failed"));
      return;
    }
    await setActiveAsset(
      normalizeStudioAsset({
        shortId: data.shortId,
        storageKey: data.storageKey,
        mimeType: data.mimeType ?? "image/jpeg",
        width: data.width,
        height: data.height,
      }),
    );
    setEditing(false);
    setMsg(COPY.settingsSaved);
  };

  const cancelAiEdit = () => {
    aiAbortRef.current?.abort();
    setBusy(false);
    setAssistProgress("");
  };

  const startAiEdit = async (instruction: string) => {
    if (!asset || !instruction.trim()) return;
    aiAbortRef.current?.abort();
    const ac = new AbortController();
    aiAbortRef.current = ac;
    setBusy(true);
    setAssistErr("");
    setAssistProgress(COPY.assistWorking);
    const beforeSrc = mediaUrl(asset.storageKey, asset.mimeType);
    try {
      const res = await fetch("/api/ai/edit-image", {
        method: "POST",
        signal: ac.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaShortId: asset.shortId, instruction, keepOriginal }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAssistErr(data.error ?? "Edit failed");
        return;
      }
      const after = normalizeStudioAsset({
        mediaShortId: data.mediaShortId ?? data.shortId,
        storageKey: data.storageKey,
        mimeType: data.mimeType ?? "image/png",
        width: data.width,
        height: data.height,
      });
      const afterSrc = mediaUrl(after.storageKey, after.mimeType);
      setAiPreview({ beforeSrc, afterSrc, after });
      setAiEditText("");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setAssistErr("We couldn't finish that tweak — try again or pick a quick chip.");
    } finally {
      setBusy(false);
      setAssistProgress("");
    }
  };

  const keepAiPreview = async () => {
    if (!aiPreview) return;
    await setActiveAsset(aiPreview.after);
    setAiPreview(null);
    setMsg("Change kept. Head to Share when you're ready.");
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

  const applySuggestion = (type: "alt" | "tags", value: string | string[]) => {
    if (type === "alt" && typeof value === "string") setSettings((s) => ({ ...s, altText: value }));
    if (type === "tags" && Array.isArray(value)) setSettings((s) => ({ ...s, tags: value.join(", ") }));
  };

  const signedIn = Boolean(session?.user);
  const preview = asset ? mediaUrl(asset.storageKey, asset.mimeType) : null;

  useEffect(() => {
    if (params.get("from") === "fieldpress") {
      const id = ingestFieldPressDraftFromQuery("fieldpress", params.get("draft"));
      if (id) applyFieldPressVisibilityRef.current = true;
    }
  }, [params]);

  useEffect(() => {
    if (signedIn) {
      void fetch("/api/me")
        .then((r) => (r.ok ? r.json() : null))
        .then((u) => {
          if (u && typeof u.studioKeepOriginal === "boolean") setKeepOriginal(u.studioKeepOriginal);
          if (applyFieldPressVisibilityRef.current && u) {
            applyFieldPressVisibilityRef.current = false;
            const visibility = fieldpressStudioVisibilityFromUserDefault(u.defaultPostVisibility);
            setSettings((s) => ({ ...s, visibility }));
          }
        });
    } else {
      setKeepOriginal(readGuestKeepOriginal());
    }
  }, [signedIn]);

  const setKeepOriginalPref = useCallback(
    (next: boolean) => {
      setKeepOriginal(next);
      if (!keepOriginal && next) {
        setVersionRefreshKey((k) => k + 1);
      }
      if (signedIn) {
        void fetch("/api/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studioKeepOriginal: next }),
        });
      } else {
        writeGuestKeepOriginal(next);
      }
    },
    [signedIn, keepOriginal],
  );

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
    const mediaRes = await fetch(`/api/media/${asset.shortId}`);
    const mediaData = await mediaRes.json().catch(() => ({}));
    const postPath =
      typeof mediaData.share?.pageUrl === "string" && mediaData.share.pageUrl.includes("/p/")
        ? mediaData.share.pageUrl.replace(/^.*\/p\//, "").split(/[?#]/)[0]
        : null;

    const res = postPath
      ? await fetch(`/api/posts/${postPath}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            description: settings.description || undefined,
            tags,
            visibility: settings.visibility ?? "PUBLIC",
          }),
        })
      : await fetch("/api/posts/from-media", {
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
    const shortId = postPath ?? data.shortId;
    setMsg(COPY.publishSuccess);
    router.push(`/p/${shortId}`);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 pb-44 sm:px-6 lg:pb-8" onPaste={onPaste}>
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Image studio</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{COPY.studioTagline}</p>
        {remixFromShortId ? (
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Remixing from{" "}
            <Link href={`/p/${remixFromShortId}`} className="text-[var(--accent-primary)]">
              original dish
            </Link>
          </p>
        ) : null}
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
            <Link href="/auth/signup" className="tap-target inline-flex items-center text-[var(--accent-primary)]">
              Create an account
            </Link>
          </p>
        ) : null}
        <FieldPressDraftStudioChrome />
      </header>

      <nav className="flex gap-1 overflow-x-auto border-b border-[var(--border-subtle)] pb-1" aria-label="Studio steps">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => selectTab(t.id)}
            className={`tap-target min-h-11 shrink-0 rounded-t-lg px-4 text-sm font-medium ${
              tab === t.id
                ? "bg-[var(--surface-raised)] text-[var(--accent-primary)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="mt-4">
        <KeepOriginalToggle checked={keepOriginal} onChange={setKeepOriginalPref} />
      </div>

      {asset && preview ? (
        <div className="mt-3 space-y-2">
          <StudioImageMenu
            imageSrc={preview}
            mediaShortId={asset.shortId}
            mimeType={asset.mimeType}
            storageKey={asset.storageKey}
            defaultVisibility={(settings.visibility ?? "PUBLIC") as "PUBLIC" | "UNLISTED" | "PRIVATE"}
            canRevert={canRevertOriginal}
            onRevertOriginal={() => void revertToOriginal()}
            onSaved={(m) => setMsg(m)}
            onError={(m) => setErr(m)}
            fieldPressDraftId={fieldPressDraftId}
            fieldPressImageDirectUrl={share?.directUrl ?? null}
            fieldPressVisibility={mediaVisibility}
            fieldPressTitle={settings.title}
          />
          <StudioVersionStrip
            mediaShortId={asset.shortId}
            refreshKey={versionRefreshKey}
            onVersionsLoaded={onVersionsLoaded}
            onSelectVersion={(v) => {
              void setActiveAsset({
                shortId: v.shortId,
                storageKey: v.storageKey,
                mimeType: v.mimeType,
                width: v.width,
                height: v.height,
              });
            }}
          />
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
            visibility={settings.visibility ?? "PUBLIC"}
            onVisibilityChange={(v) => setSettings((s) => ({ ...s, visibility: v }))}
            signedIn={signedIn}
            busy={busy}
            onGenerate={generate}
          />
          <details className="rounded-xl border border-[var(--border-subtle)] p-4">
            <summary className="tap-target flex cursor-pointer list-none items-center text-sm text-[var(--text-muted)]">Bring your own image</summary>
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
          <div className="h-8 lg:hidden" aria-hidden />
        </div>
      ) : null}

      {tab === "refine" ? (
        <section className="mt-6 space-y-4">
          {!asset ? (
            <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-4 py-8 text-center">
              <p className="text-sm text-[var(--text-secondary)]">Add an image on Create, then edit and assist here.</p>
              <button type="button" onClick={() => selectTab("create")} className={`${btnPrimary} mt-4`}>
                Go to Create
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                data-testid="studio-open-editor"
                onClick={() => setEditing(true)}
                className={`${btnPrimary} w-full sm:w-auto`}
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
                onApplyInstruction={(instruction) => void startAiEdit(instruction)}
                onCancel={cancelAiEdit}
                onSuggest={(type) => void runSuggest(type)}
                onApplySuggestion={applySuggestion}
                suggestions={suggestions}
                err={assistErr}
                progressLabel={assistProgress}
              />
              {aiPreview ? (
                <AiEditPreview
                  beforeSrc={aiPreview.beforeSrc}
                  afterSrc={aiPreview.afterSrc}
                  onKeep={() => void keepAiPreview()}
                  onUndo={() => setAiPreview(null)}
                />
              ) : null}
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
            <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-4 py-8 text-center">
              <p className="text-sm text-[var(--text-secondary)]">Cook or upload an image first, then share links here.</p>
              <button type="button" onClick={() => selectTab("create")} className={`${btnPrimary} mt-4`}>
                Go to Create
              </button>
            </div>
          ) : (
            <>
              <ImageSettingsPanel signedIn={signedIn} values={settings} onChange={(v) => setSettings(v)} compact />
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={saveMediaSettings} className={btnSecondary}>
                  Save details
                </button>
                {signedIn ? (
                  <button
                    type="button"
                    disabled={busy || !settings.title?.trim()}
                    onClick={publishToGallery}
                    className={btnPrimary}
                  >
                    {COPY.publishCta}
                  </button>
                ) : (
                  <p className="text-sm text-[var(--text-muted)]" data-testid="guest-keep-signin">
                    <Link
                      href={`/auth/signin?callbackUrl=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname + window.location.search : "/studio")}`}
                      className="text-[var(--accent-primary)]"
                    >
                      Sign in
                    </Link>
                    {" · "}
                    <Link href="/auth/signup" className="tap-target inline-flex items-center text-[var(--accent-primary)]">
                      Create an account
                    </Link>
                  </p>
                )}
              </div>
              {deleteToken ? (
                <p className="rounded-lg border border-[var(--warning)]/50 bg-[var(--surface-raised)] p-3 text-xs">
                  {COPY.guestDeleteHint} <code className="break-all">{deleteToken}</code>
                </p>
              ) : null}
              {share ? (
                <>
                  <ShareLinks
                    share={share}
                    visibility={settings.visibility}
                    successHref={share.pageUrl}
                  />
                  {showFieldPressStoryInvite(fieldPressDraftId, mediaVisibility) ? (
                    <FieldPressInvite
                      imageDirectUrl={share.directUrl}
                      visibility={mediaVisibility}
                      title={settings.title}
                    />
                  ) : null}
                  {fieldPressDraftId && mediaVisibility != null && canOfferFieldPressLink(mediaVisibility) ? (
                    <UseInFieldPressDraftLink
                      draftId={fieldPressDraftId}
                      imageDirectUrl={share.directUrl}
                      visibility={mediaVisibility}
                      title={settings.title}
                      className="text-sm text-[var(--text-secondary)] underline-offset-2 hover:underline"
                    />
                  ) : null}
                </>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {err ? (
        <p className="mt-4 rounded-lg border border-[var(--danger)]/40 bg-[var(--surface-raised)] px-4 py-3 text-sm text-[var(--danger)]" role="alert">
          {err}
        </p>
      ) : null}
      {msg ? (
        <p className="mt-4 rounded-lg border border-[var(--accent-primary)]/30 bg-[var(--surface-raised)] px-4 py-3 text-sm text-[var(--accent-primary)]" role="status">
          {msg}
        </p>
      ) : null}

      {editing && preview ? (
        <ImageEditor
          imageSrc={preview}
          studioMode
          onCancel={() => setEditing(false)}
          onExport={(blob) => void saveEditorBlob(blob)}
        />
      ) : null}

      <StudioMobileActionBar
        tab={tab}
        busy={busy}
        canGenerate={prompt.trim().length >= 3 && kitchenOpen}
        canShare={Boolean(share?.pageUrl)}
        onGenerate={() => void generate()}
        onSharePrimary={async () => {
          if (!share?.pageUrl) return;
          await navigator.clipboard.writeText(share.pageUrl);
          setMsg("Link copied — share it anywhere.");
        }}
        showKeepUndo={Boolean(aiPreview)}
        onKeep={() => void keepAiPreview()}
        onUndo={() => setAiPreview(null)}
      />
    </div>
  );
}
