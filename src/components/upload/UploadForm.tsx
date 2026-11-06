"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ImageEditor } from "@/components/editor/ImageEditor";
import { ImageSettingsPanel, type ImageSettingsValues } from "@/components/images/ImageSettingsPanel";
import { StorageMeter } from "@/components/storage/StorageMeter";
import { validateStackUploadFile } from "@/lib/upload-client";
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
  const [urlBusy, setUrlBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [deleteToken, setDeleteToken] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      setFiles((list) => {
        list.forEach((f) => URL.revokeObjectURL(f.preview));
        return [];
      });
    };
  }, []);

  const addFiles = useCallback((list: FileList | File[]) => {
    const next: StagedFile[] = [];
    const errors: string[] = [];
    Array.from(list).forEach((file) => {
      const validationErr = validateStackUploadFile(file);
      if (validationErr) {
        errors.push(`${file.name}: ${validationErr}`);
        return;
      }
      next.push({ file, preview: URL.createObjectURL(file) });
    });
    if (errors.length) {
      setError(errors[0] ?? "Some files could not be added.");
    } else if (next.length) {
      setError("");
    }
    if (!next.length) return;
    setFiles((f) => [...f, ...next].slice(0, 20));
  }, []);

  const removeFile = (index: number) => {
    setFiles((list) => {
      const copy = [...list];
      const [removed] = copy.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed.preview);
      return copy;
    });
    setEditIdx((idx) => (idx === index ? null : idx != null && idx > index ? idx - 1 : idx));
  };

  const replaceFile = (index: number, blob: Blob) => {
    const file = new File([blob], `edited-${index}.jpg`, { type: "image/jpeg" });
    const preview = URL.createObjectURL(blob);
    setFiles((list) => {
      const copy = [...list];
      const prev = copy[index];
      if (prev) URL.revokeObjectURL(prev.preview);
      copy[index] = { file, preview };
      return copy;
    });
    setEditIdx(null);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
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
    if (!urlInput.trim() || urlBusy || busy) return;
    setError("");
    setUrlBusy(true);
    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 30_000);
      const res = await fetch("/api/upload/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput }),
        signal: controller.signal,
      }).finally(() => window.clearTimeout(timer));
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(friendlyError(data.error ?? "URL fetch failed"));
        return;
      }
      const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
      const file = new File([bytes], data.filename || "from-url", { type: data.mime || "image/jpeg" });
      const validationErr = validateStackUploadFile(file);
      if (validationErr) {
        setError(validationErr);
        return;
      }
      addFiles([file]);
      setUrlInput("");
    } catch (e) {
      const aborted = e instanceof DOMException && e.name === "AbortError";
      setError(
        aborted
          ? "That URL took too long — try downloading the image and uploading the file."
          : friendlyError("URL fetch failed"),
      );
    } finally {
      setUrlBusy(false);
    }
  };

  const submit = async () => {
    setError("");
    if (!settings.title?.trim() || files.length === 0) {
      setError("Title and at least one file required");
      return;
    }
    if (busy || urlBusy) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.set("title", settings.title ?? "");
      form.set("description", settings.description ?? "");
      form.set("tags", settings.tags ?? "");
      form.set("visibility", settings.visibility ?? "PUBLIC");
      form.set("altText", settings.altText ?? "");
      form.set("mature", settings.mature ? "true" : "false");
      files.forEach((f) => form.append("files", f.file));
      const res = await fetch("/api/posts", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(friendlyError(data.error ?? "Upload failed"));
        return;
      }
      if (data.deleteToken) setDeleteToken(data.deleteToken);
      if (!data.shortId) {
        setError(friendlyError("Upload failed"));
        return;
      }
      router.push(`/p/${data.shortId}`);
    } catch {
      setError(friendlyError("Upload failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6" onPaste={onPaste} data-testid="upload-form">
      <StorageMeter />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`rounded-2xl border-2 border-dashed bg-[var(--surface-raised)] p-8 text-center transition-colors ${
          dragging
            ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 shadow-[var(--shadow-ember)]"
            : "border-[var(--border-strong)]"
        }`}
        data-testid="upload-dropzone"
      >
        <p className="text-[var(--text-secondary)]">Drag & drop, paste, or pick files (images + short video)</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">Images ~20 MB · Video ~100 MB / 60 s max · up to 20 files</p>
        <button
          type="button"
          className="mt-4 tap-target rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm font-semibold text-[var(--on-accent)]"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          data-testid="upload-choose-files"
        >
          Choose files
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm"
          className="hidden"
          data-testid="upload-file-input"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="Or paste image URL"
          disabled={busy || urlBusy}
          className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 py-2"
          data-testid="upload-url-input"
          onKeyDown={(e) => e.key === "Enter" && void fetchUrl()}
        />
        <button
          type="button"
          onClick={() => void fetchUrl()}
          disabled={busy || urlBusy || !urlInput.trim()}
          className="tap-target rounded-lg border border-[var(--border-strong)] px-4 py-2 text-sm font-medium disabled:opacity-50"
          data-testid="upload-url-fetch"
        >
          {urlBusy ? "Fetching…" : "Fetch URL"}
        </button>
      </div>

      {files.length > 0 ? (
        <div className="flex flex-wrap gap-3" data-testid="upload-staged-files">
          {files.map((f, i) => (
            <div key={`${f.file.name}-${i}`} className="relative w-20">
              <div className="relative h-20 w-20 overflow-hidden rounded-lg border border-[var(--border-subtle)]">
                {f.file.type.startsWith("video/") ? (
                  <video src={f.preview} className="h-full w-full object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.preview} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="mt-1 flex items-center justify-between gap-1">
                {f.file.type.startsWith("image/") ? (
                  <button
                    type="button"
                    className="text-xs text-[var(--accent-primary)]"
                    onClick={() => setEditIdx(i)}
                  >
                    Edit
                  </button>
                ) : (
                  <span className="text-[10px] text-[var(--text-muted)]">Video</span>
                )}
                <button
                  type="button"
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--danger)]"
                  onClick={() => removeFile(i)}
                  aria-label={`Remove ${f.file.name}`}
                >
                  Remove
                </button>
              </div>
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
        <p className="text-xs text-[var(--text-muted)]">
          {COPY.guestDeleteHint} <code>{deleteToken}</code>
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-[var(--danger)]" role="alert" data-testid="upload-error">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={busy || urlBusy || files.length === 0}
        onClick={() => void submit()}
        className="tap-target rounded-xl bg-[var(--accent-primary)] px-6 py-3 font-semibold text-[var(--on-accent)] shadow-[var(--shadow-ember)] disabled:opacity-50"
        data-testid="upload-submit"
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
