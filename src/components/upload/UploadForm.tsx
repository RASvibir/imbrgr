"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { ImageEditor } from "@/components/editor/ImageEditor";
import { ImageSettingsPanel, type ImageSettingsValues } from "@/components/images/ImageSettingsPanel";
import { StorageMeter } from "@/components/storage/StorageMeter";
import { COPY, friendlyError } from "@/lib/user-messages";
type StagedFile = { file: File; preview: string };

export function UploadForm() {
  const router = useRouter();
  const { data: session } = useSession();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<StagedFile[]>([]);
  const [settings, setSettings] = useState<ImageSettingsValues>({
    title: "",
    description: "",
    tags: "",
    altText: "",
    mature: false,
    visibility: "PUBLIC",
  });
  const [urlInput, setUrlInput] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [deleteToken, setDeleteToken] = useState<string | null>(null);

  const addFiles = useCallback((list: FileList | File[]) => {
    const next: StagedFile[] = [];
    Array.from(list).forEach((file) => {
      next.push({ file, preview: URL.createObjectURL(file) });
    });
    setFiles((f) => [...f, ...next].slice(0, 20));
  }, []);

  const replaceFile = (index: number, blob: Blob) => {
    const file = new File([blob], `edited-${index}.jpg`, { type: "image/jpeg" });
    const preview = URL.createObjectURL(blob);
    setFiles((list) => {
      const copy = [...list];
      copy[index] = { file, preview };
      return copy;
    });
    setEditIdx(null);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const list: File[] = [];
    for (const item of items) {
      if (item.kind === "file") {
        const f = item.getAsFile();
        if (f) list.push(f);
      }
    }
    if (list.length) addFiles(list);
  };

  const fetchUrl = async () => {
    if (!urlInput.trim()) return;
    setError("");
    const res = await fetch("/api/upload/url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: urlInput }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(friendlyError(data.error ?? "URL fetch failed"));
      return;
    }
    const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    const file = new File([bytes], data.filename, { type: data.mime });
    addFiles([file]);
    setUrlInput("");
  };

  const submit = async () => {
    setError("");
    if (!settings.title?.trim() || files.length === 0) {
      setError("Title and at least one file required");
      return;
    }
    setBusy(true);
    const form = new FormData();
    form.set("title", settings.title ?? "");
    form.set("description", settings.description ?? "");
    form.set("tags", settings.tags ?? "");
    form.set("visibility", settings.visibility ?? "PUBLIC");
    form.set("altText", settings.altText ?? "");
    form.set("mature", settings.mature ? "true" : "false");
    files.forEach((f) => form.append("files", f.file));
    const res = await fetch("/api/posts", { method: "POST", body: form });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(friendlyError(data.error ?? "Upload failed"));
      return;
    }
    if (data.deleteToken) setDeleteToken(data.deleteToken);
    router.push(`/p/${data.shortId}`);
  };

  return (
    <div className="space-y-6" onPaste={onPaste}>
      <StorageMeter />

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className="rounded-2xl border-2 border-dashed border-[var(--border-strong)] bg-[var(--surface-raised)] p-8 text-center"
      >
        <p className="text-[var(--text-secondary)]">Drag & drop, paste, or pick photos and short clips</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">Large files may take a moment — there are size limits per upload.</p>
        <button
          type="button"
          className="mt-4 rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm font-semibold text-[var(--on-accent)]"
          onClick={() => inputRef.current?.click()}
        >
          Choose files
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm"
          className="hidden"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="Or paste image URL"
          className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 py-2"
        />
        <button
          type="button"
          onClick={fetchUrl}
          className="rounded-lg border border-[var(--border-strong)] px-4 py-2 text-sm font-medium"
        >
          Fetch URL
        </button>
      </div>

      {files.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <div key={i} className="relative">
              <div className="relative h-20 w-20 overflow-hidden rounded-lg border">
                {f.file.type.startsWith("video/") ? (
                  <video src={f.preview} className="h-full w-full object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.preview} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              {f.file.type.startsWith("image/") ? (
                <button
                  type="button"
                  className="mt-1 w-full text-center text-xs text-[var(--accent-primary)]"
                  onClick={() => setEditIdx(i)}
                >
                  Edit
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <section className="rounded-xl border border-[var(--border-subtle)] p-4">
        <h2 className="font-semibold">Image settings</h2>
        <div className="mt-3">
          <ImageSettingsPanel
            signedIn={Boolean(session?.user)}
            values={settings}
            onChange={setSettings}
          />
        </div>
      </section>

      {deleteToken ? (
        <p className="text-xs text-[var(--text-muted)]">{COPY.guestDeleteHint} <code>{deleteToken}</code></p>
      ) : null}

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      <button
        type="button"
        disabled={busy}
        onClick={submit}
        className="rounded-xl bg-[var(--accent-primary)] px-6 py-3 font-semibold text-[var(--on-accent)] shadow-[var(--shadow-ember)] disabled:opacity-50"
      >
        {busy ? "Uploading…" : "Serve it hot"}
      </button>

      {editIdx != null && files[editIdx] ? (
        <ImageEditor
          imageSrc={files[editIdx].preview}
          studioMode
          onCancel={() => setEditIdx(null)}
          onExport={(blob) => replaceFile(editIdx, blob)}
        />
      ) : null}
    </div>
  );
}
