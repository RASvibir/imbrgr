"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ImageEditor } from "@/components/editor/ImageEditor";
import { mediaUrl } from "@/lib/urls";

const STYLES = [
  { id: "", label: "Default" },
  { id: "photo", label: "Photo" },
  { id: "anime", label: "Anime" },
  { id: "ember", label: "Ember" },
  { id: "sketch", label: "Sketch" },
];

const RATIOS = [
  { id: "1:1", w: 1024, h: 1024 },
  { id: "16:9", w: 1280, h: 720 },
  { id: "9:16", w: 720, h: 1280 },
  { id: "4:3", w: 1024, h: 768 },
];

export default function AiCreatePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [enhance, setEnhance] = useState(true);
  const [style, setStyle] = useState("");
  const [ratio, setRatio] = useState(RATIOS[0]);
  const [usage, setUsage] = useState<{ used: number; limit: number; remaining: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<{
    mediaShortId: string;
    storageKey: string;
    prompt: string;
    enhanceSource?: string;
    imageProvider: string;
  } | null>(null);
  const [title, setTitle] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin?callbackUrl=/create/ai");
  }, [status, router]);

  useEffect(() => {
    if (!session?.user) return;
    void fetch("/api/ai/usage")
      .then((r) => r.json())
      .then((d) => setUsage(d))
      .catch(() => undefined);
  }, [session?.user]);

  const generate = async () => {
    setErr("");
    setBusy(true);
    setResult(null);
    const res = await fetch("/api/ai/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        enhance,
        width: ratio.w,
        height: ratio.h,
        style: style || undefined,
        safe: true,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setErr(data.error ?? "Generation failed");
      return;
    }
    setUsage(data.usage);
    setResult({
      mediaShortId: data.mediaShortId,
      storageKey: data.storageKey,
      prompt: data.prompt,
      enhanceSource: data.enhanceSource,
      imageProvider: data.imageProvider,
    });
    setTitle(prompt.slice(0, 80));
  };

  const publish = async () => {
    if (!result) return;
    const res = await fetch("/api/posts/from-media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title || "AI creation",
        mediaShortIds: [result.mediaShortId],
        visibility: "PUBLIC",
        tags: ["ai"],
      }),
    });
    const data = await res.json();
    if (res.ok) router.push(`/p/${data.shortId}`);
    else setErr(data.error ?? "Post failed");
  };

  const saveEdit = async (blob: Blob, mode: "replace" | "version") => {
    if (!result) return;
    const form = new FormData();
    form.set("file", blob, "edit.jpg");
    form.set("mode", mode);
    const res = await fetch(`/api/media/${result.mediaShortId}/edit`, { method: "POST", body: form });
    const data = await res.json();
    if (res.ok) {
      setResult({ ...result, mediaShortId: data.shortId });
      setEditing(false);
    } else setErr(data.error ?? "Edit failed");
  };

  if (status === "loading") {
    return <p className="p-8 text-center text-[var(--text-muted)]">Loading…</p>;
  }

  const preview = result ? mediaUrl(result.storageKey, "image/jpeg") : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-bold">AI image generator</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Flux via Pollinations · prompt enhance: Ollama → Groq → Gemini
      </p>
      {usage ? (
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          {usage.remaining} of {usage.limit} generations left today (UTC)
        </p>
      ) : null}

      <div className="mt-6 space-y-4 rounded-xl border border-[var(--border-subtle)] p-4">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="Describe the image you want…"
          className="w-full rounded-lg border px-3 py-2"
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={enhance} onChange={(e) => setEnhance(e.target.checked)} />
          Enhance my prompt (LLM rewrite, ~45 words)
        </label>
        <div className="flex flex-wrap gap-2">
          <select value={style} onChange={(e) => setStyle(e.target.value)} className="rounded border px-2 py-1 text-sm">
            {STYLES.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          <select
            value={ratio.id}
            onChange={(e) => setRatio(RATIOS.find((r) => r.id === e.target.value) ?? RATIOS[0])}
            className="rounded border px-2 py-1 text-sm"
          >
            {RATIOS.map((r) => (
              <option key={r.id} value={r.id}>{r.id}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          disabled={busy || prompt.length < 3}
          onClick={generate}
          className="rounded-xl bg-[var(--accent-primary)] px-6 py-2 font-semibold text-[var(--on-accent)] disabled:opacity-50"
        >
          {busy ? "Generating…" : "Generate"}
        </button>
      </div>

      {err ? <p className="mt-4 text-sm text-[var(--danger)]">{err}</p> : null}

      {result && preview ? (
        <section className="mt-8 space-y-4">
          <div className="relative overflow-hidden rounded-xl border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="" className="w-full" />
            <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">AI generated</span>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Provider: {result.imageProvider}
            {result.enhanceSource ? ` · enhance: ${result.enhanceSource}` : ""}
          </p>
          <p className="text-sm text-[var(--text-secondary)]">{result.prompt}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded-lg border px-3 py-1 text-sm" onClick={() => setEditing(true)}>
              Edit image
            </button>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Post title"
              className="flex-1 rounded-lg border px-3 py-2 text-sm"
            />
            <button type="button" onClick={publish} className="rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm font-semibold text-[var(--on-accent)]">
              Publish post
            </button>
          </div>
          <p className="text-xs">
            Or <Link href="/upload" className="text-[var(--accent-primary)]">upload more files</Link> to combine in a gallery post.
          </p>
        </section>
      ) : null}

      {editing && preview ? (
        <ImageEditor imageSrc={preview} onCancel={() => setEditing(false)} onExport={saveEdit} />
      ) : null}
    </div>
  );
}
