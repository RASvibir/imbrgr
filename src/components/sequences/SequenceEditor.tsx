"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CAMERA_MOTIONS, VIDEO_STYLES } from "@/lib/ai/video-provider";
import { btnPrimary, btnSecondary, btnGhost } from "@/lib/ui/button-classes";
import { softKitFragment, type SoftKitSummary } from "@/lib/shot-sequence/kit-hook";
import { newBeatId } from "@/lib/shot-sequence/defaults";
import { framingHintForRole } from "@/lib/shot-sequence/prompts";
import {
  BEAT_ROLE_LABELS,
  BEAT_ROLES,
  type BeatRole,
  type SequenceExportFormat,
  type ShotBeat,
} from "@/lib/shot-sequence/types";
import { LibraryBeatPicker } from "./LibraryBeatPicker";
import { SoftKitSelector } from "./SoftKitSelector";

export type SequenceDTO = {
  shortId: string;
  title: string;
  look: string | null;
  narration: string | null;
  aspectRatio: string;
  stylePreset: string | null;
  kitShortId: string | null;
  beats: ShotBeat[];
  beatCount: number;
  totalDurationSec: number;
  visibility: string;
};

type Props = {
  initial: SequenceDTO;
};

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function SequenceEditor({ initial }: Props) {
  const [seq, setSeq] = useState<SequenceDTO>(initial);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState<SequenceExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [kit, setKit] = useState<SoftKitSummary | null>(null);
  const [dirty, setDirty] = useState(false);

  const sortedBeats = useMemo(
    () => [...seq.beats].sort((a, b) => a.sortOrder - b.sortOrder),
    [seq.beats],
  );

  const totalSec = sortedBeats.reduce((s, b) => s + b.durationSec, 0);

  const patchLocal = useCallback((partial: Partial<SequenceDTO>) => {
    setSeq((prev) => ({ ...prev, ...partial }));
    setDirty(true);
  }, []);

  const updateBeat = useCallback((id: string, partial: Partial<ShotBeat>) => {
    setSeq((prev) => ({
      ...prev,
      beats: prev.beats.map((b) => (b.id === id ? { ...b, ...partial } : b)),
    }));
    setDirty(true);
  }, []);

  const moveBeat = useCallback((id: string, dir: -1 | 1) => {
    setSeq((prev) => {
      const beats = [...prev.beats].sort((a, b) => a.sortOrder - b.sortOrder);
      const idx = beats.findIndex((b) => b.id === id);
      const swap = idx + dir;
      if (idx < 0 || swap < 0 || swap >= beats.length) return prev;
      const a = beats[idx]!;
      const b = beats[swap]!;
      const next = beats.map((beat) => {
        if (beat.id === a.id) return { ...beat, sortOrder: b.sortOrder };
        if (beat.id === b.id) return { ...beat, sortOrder: a.sortOrder };
        return beat;
      });
      return { ...prev, beats: next };
    });
    setDirty(true);
  }, []);

  const addBeat = useCallback((role: BeatRole = "custom") => {
    setSeq((prev) => {
      const order = prev.beats.length;
      const beat: ShotBeat = {
        id: newBeatId(),
        role,
        caption: BEAT_ROLE_LABELS[role],
        visualPrompt: `shot of ${prev.title}, matching look and lighting`,
        action: "",
        stockQuery: prev.title.slice(0, 40),
        motion: role === "closeup" ? "zoom-in" : role === "establishing" ? "zoom-out" : "pan-right",
        durationSec: 3,
        sortOrder: order,
        mediaShortId: null,
      };
      return { ...prev, beats: [...prev.beats, beat] };
    });
    setDirty(true);
  }, []);

  const removeBeat = useCallback((id: string) => {
    setSeq((prev) => {
      if (prev.beats.length <= 1) return prev;
      return {
        ...prev,
        beats: prev.beats
          .filter((b) => b.id !== id)
          .map((b, i) => ({ ...b, sortOrder: i })),
      };
    });
    setDirty(true);
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/sequences/${seq.shortId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: seq.title,
          look: seq.look,
          narration: seq.narration,
          aspectRatio: seq.aspectRatio,
          stylePreset: seq.stylePreset,
          kitShortId: seq.kitShortId,
          beats: seq.beats,
          visibility: seq.visibility,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setSeq(data.sequence);
      setDirty(false);
      setSavedFlash(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [seq]);

  useEffect(() => {
    if (!savedFlash) return;
    const t = setTimeout(() => setSavedFlash(false), 1800);
    return () => clearTimeout(t);
  }, [savedFlash]);

  const runExport = useCallback(
    async (format: SequenceExportFormat) => {
      setExporting(format);
      setError(null);
      try {
        if (dirty) await save();
        const kitFrag = softKitFragment(kit).fragment;
        const res = await fetch(`/api/sequences/${seq.shortId}/export`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ format, kitFragment: kitFrag || null }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Export failed");
        const slug = seq.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40) || "sequence";
        downloadJson(`imbrgr-${slug}-${format}.json`, data.export);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Export failed");
      } finally {
        setExporting(null);
      }
    },
    [dirty, kit, save, seq.shortId, seq.title],
  );

  const firstStudioHref = useMemo(() => {
    const first = sortedBeats[0];
    if (!first) return "/studio?tab=video";
    const prompt = encodeURIComponent(first.visualPrompt.slice(0, 200));
    return `/studio?tab=video&prompt=${prompt}&preset=${first.motion}`;
  }, [sortedBeats]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10" data-testid="sequence-editor">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent-primary)]">
            Shot sequence
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{seq.title}</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {sortedBeats.length} beats · {totalSec}s · lock look, camera, and duration across the pack
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/sequences" className={btnGhost}>
            All sequences
          </Link>
          <button type="button" className={btnSecondary} onClick={() => void save()} disabled={saving || !dirty}>
            {saving ? "Saving…" : savedFlash ? "Saved" : "Save"}
          </button>
        </div>
      </div>

      {error ? (
        <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200" role="alert">
          {error}
        </p>
      ) : null}

      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4 sm:p-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)]">Continuity</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Title</span>
            <input
              className="min-h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-base)] px-3 text-sm"
              value={seq.title}
              maxLength={80}
              onChange={(e) => patchLocal({ title: e.target.value })}
              data-testid="sequence-title"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Look lock</span>
            <textarea
              className="min-h-[4.5rem] w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-base)] px-3 py-2 text-sm"
              value={seq.look ?? ""}
              maxLength={400}
              onChange={(e) => patchLocal({ look: e.target.value })}
              placeholder="Subject, setting, palette, lighting — repeated on every beat"
              data-testid="sequence-look"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Narration (optional)</span>
            <textarea
              className="min-h-[4rem] w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-base)] px-3 py-2 text-sm"
              value={seq.narration ?? ""}
              maxLength={1200}
              onChange={(e) => patchLocal({ narration: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Aspect</span>
            <select
              className="min-h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-base)] px-3 text-sm"
              value={seq.aspectRatio}
              onChange={(e) => patchLocal({ aspectRatio: e.target.value })}
            >
              <option value="16:9">16:9</option>
              <option value="9:16">9:16</option>
              <option value="1:1">1:1</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Style preset</span>
            <select
              className="min-h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-base)] px-3 text-sm"
              value={seq.stylePreset ?? ""}
              onChange={(e) => patchLocal({ stylePreset: e.target.value || null })}
            >
              <option value="">None</option>
              {VIDEO_STYLES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2">
            <SoftKitSelector
              value={seq.kitShortId}
              onChange={(shortId, nextKit) => {
                setKit(nextKit);
                patchLocal({
                  kitShortId: shortId,
                  stylePreset: nextKit?.stylePreset || seq.stylePreset,
                });
              }}
            />
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)]">Beats</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnSecondary} onClick={() => addBeat("establishing")}>
              + Establishing
            </button>
            <button type="button" className={btnSecondary} onClick={() => addBeat("action")}>
              + Action
            </button>
            <button type="button" className={btnSecondary} onClick={() => addBeat("closeup")}>
              + Close-up
            </button>
          </div>
        </div>

        <ol className="mt-4 space-y-4" data-testid="sequence-beats">
          {sortedBeats.map((beat, index) => (
            <li
              key={beat.id}
              className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-4 sm:p-5"
              data-testid={`sequence-beat-${beat.role}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-primary)]/15 text-sm font-bold text-[var(--accent-primary)]">
                    {index + 1}
                  </span>
                  <select
                    className="min-h-10 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-raised)] px-2 text-sm font-semibold"
                    value={beat.role}
                    onChange={(e) => updateBeat(beat.id, { role: e.target.value as BeatRole })}
                    aria-label="Beat role"
                  >
                    {BEAT_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {BEAT_ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-1">
                  <button type="button" className={btnGhost} onClick={() => moveBeat(beat.id, -1)} disabled={index === 0}>
                    ↑
                  </button>
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() => moveBeat(beat.id, 1)}
                    disabled={index === sortedBeats.length - 1}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() => removeBeat(beat.id)}
                    disabled={sortedBeats.length <= 1}
                  >
                    Remove
                  </button>
                </div>
              </div>
              <p className="mt-2 text-xs text-[var(--text-muted)]">{framingHintForRole(beat.role)}</p>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Visual prompt</span>
                  <textarea
                    className="min-h-[4.5rem] w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-raised)] px-3 py-2 text-sm"
                    value={beat.visualPrompt}
                    maxLength={400}
                    onChange={(e) => updateBeat(beat.id, { visualPrompt: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Caption</span>
                  <input
                    className="min-h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-raised)] px-3 text-sm"
                    value={beat.caption}
                    maxLength={140}
                    onChange={(e) => updateBeat(beat.id, { caption: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Action</span>
                  <input
                    className="min-h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-raised)] px-3 text-sm"
                    value={beat.action ?? ""}
                    maxLength={200}
                    onChange={(e) => updateBeat(beat.id, { action: e.target.value })}
                    placeholder="What moves in this beat"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Camera move</span>
                  <select
                    className="min-h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-raised)] px-3 text-sm"
                    value={beat.motion}
                    onChange={(e) =>
                      updateBeat(beat.id, { motion: e.target.value as ShotBeat["motion"] })
                    }
                  >
                    {CAMERA_MOTIONS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Duration (sec)</span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    className="min-h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-raised)] px-3 text-sm"
                    value={beat.durationSec}
                    onChange={(e) =>
                      updateBeat(beat.id, {
                        durationSec: Math.min(10, Math.max(1, Number(e.target.value) || 1)),
                      })
                    }
                  />
                </label>
                <div className="sm:col-span-2">
                  <LibraryBeatPicker
                    value={beat.mediaShortId}
                    onChange={(mediaShortId) => updateBeat(beat.id, { mediaShortId })}
                  />
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-8 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4 sm:p-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)]">Export & handoff</h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Download a storyboard or clip pack with look-locked prompts, camera moves, and durations — then cook clips in Video Studio.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className={btnPrimary}
            disabled={!!exporting}
            onClick={() => void runExport("storyboard")}
            data-testid="export-storyboard"
          >
            {exporting === "storyboard" ? "Exporting…" : "Export storyboard"}
          </button>
          <button
            type="button"
            className={btnSecondary}
            disabled={!!exporting}
            onClick={() => void runExport("clip-pack")}
            data-testid="export-clip-pack"
          >
            {exporting === "clip-pack" ? "Exporting…" : "Export clip pack"}
          </button>
          <Link href={firstStudioHref} className={btnSecondary} data-testid="open-video-studio">
            Open first beat in Video Studio
          </Link>
        </div>
      </section>
    </div>
  );
}
