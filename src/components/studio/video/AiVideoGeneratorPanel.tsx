"use client";

import { useState } from "react";
import { btnPrimary, btnSecondary } from "@/lib/ui/button-classes";
import {
  CAMERA_MOTIONS,
  VIDEO_STYLES,
  type CameraMotion,
} from "@/lib/ai/video-provider";
import { getVideoLimits, type VideoMode } from "@/lib/ai/video-limits";
import type { VisualClip } from "@/lib/video-timeline/timeline-types";

type JobState = {
  id: string;
  status: "queued" | "running" | "done" | "failed";
  durationSec: number;
  mature: boolean;
  total: number;
  completed: number;
  error?: string;
  shots?: {
    durationSec: number;
    motion: CameraMotion;
    caption?: string;
    imageUrl?: string;
    videoUrl?: string;
    mediaType?: "image" | "video";
  }[];
};

type Props = {
  onAddClip: (clip: VisualClip) => void;
  availableAssets: { id: string; name: string; url: string; kind: "image" | "video" | "gif"; mature?: boolean }[];
  initialPrompt?: string;
  initialMotion?: CameraMotion;
  initialStyle?: string;
};

export function AiVideoGeneratorPanel({
  onAddClip,
  availableAssets,
  initialPrompt,
  initialMotion,
  initialStyle,
}: Props) {
  const [mode, setMode] = useState<"text" | "image">("text");
  const [prompt, setPrompt] = useState(() => initialPrompt ?? "");
  const [selectedStyle, setSelectedStyle] = useState<string>(() => initialStyle ?? "cinematic");
  const [selectedMotion, setSelectedMotion] = useState<CameraMotion>(() => initialMotion ?? "zoom-in");
  const [clipKind, setClipKind] = useState<VideoMode>("video");
  const [durationSec, setDurationSec] = useState<number>(getVideoLimits("video").defaultSec);
  const limits = getVideoLimits(clipKind);
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16" | "1:1">("16:9");
  const [selectedAssetId, setSelectedAssetId] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [mature, setMature] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [generatedPreview, setGeneratedPreview] = useState<{
    shots: { url: string; motion: CameraMotion; durationSec: number; caption?: string; mediaType: "image" | "video" }[];
    durationSec: number;
    prompt: string;
    mature?: boolean;
  } | null>(null);

  const switchClipKind = (kind: VideoMode) => {
    setClipKind(kind);
    setDurationSec(getVideoLimits(kind).defaultSec);
  };

  const handleGenerateTextToVideo = async () => {
    if (!prompt.trim() || prompt.trim().length < 3) {
      setError("Please enter a prompt of at least 3 characters.");
      return;
    }
    setError("");
    setGenerating(true);
    try {
      const created = await fetch("/api/ai/video/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          style: selectedStyle,
          motion: selectedMotion,
          mode: clipKind,
          durationSec,
          aspectRatio,
          safe: !mature,
          mature,
        }),
      });
      const createdData = await created.json();
      if (!created.ok || !createdData.success) {
        throw new Error(createdData.error || "Failed to generate video");
      }
      let job: JobState = createdData.job;
      setProgress({ done: job.completed, total: job.total });
      while (job.status === "queued" || job.status === "running") {
        const stepRes = await fetch(`/api/ai/video/jobs/${job.id}/step`, { method: "POST" });
        const stepData = await stepRes.json();
        if (!stepRes.ok || !stepData.success) {
          throw new Error(stepData.error || "Failed to generate video");
        }
        job = stepData.job;
        setProgress({ done: job.completed, total: job.total });
      }
      if (job.status === "failed" || !job.shots) {
        throw new Error(job.error || "Video generation failed");
      }
      setGeneratedPreview({
        shots: job.shots.map((shot) => {
          const isVideo = Boolean(shot.videoUrl) || shot.mediaType === "video";
          return {
            url: (isVideo ? shot.videoUrl : shot.imageUrl) ?? shot.imageUrl ?? "",
            motion: shot.motion,
            durationSec: shot.durationSec,
            caption: shot.caption,
            mediaType: isVideo ? "video" : "image",
          };
        }),
        durationSec: job.durationSec,
        prompt,
        mature: job.mature,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Video generation failed");
    } finally {
      setGenerating(false);
      setProgress(null);
    }
  };

  const handleAnimateImageToVideo = (assetUrl: string, assetName: string) => {
    const clipId = `clip-motion-${Date.now()}`;
    const newClip: VisualClip = {
      id: clipId,
      trackId: "visual-1",
      assetId: `asset-${Date.now()}`,
      url: assetUrl,
      name: `${assetName} (${selectedMotion})`,
      kind: "image",
      startSec: 0,
      endSec: durationSec,
      sourceStartSec: 0,
      sourceDurationSec: durationSec,
      motion: selectedMotion,
      transition: "fade",
      transitionDurationSec: 0.5,
    };
    onAddClip(newClip);
  };

  const handleInsertGenerated = () => {
    if (!generatedPreview) return;
    const stamp = Date.now();
    generatedPreview.shots.forEach((shot, i) => {
      const isVideo = shot.mediaType === "video" || shot.url.endsWith(".mp4");
      const newClip: VisualClip = {
        id: `clip-ai-${stamp}-${i}`,
        trackId: "visual-1",
        assetId: `asset-ai-${stamp}-${i}`,
        url: shot.url,
        name: `AI: ${(shot.caption ?? generatedPreview.prompt).slice(0, 24)}…`,
        kind: isVideo ? "video" : "image",
        startSec: 0,
        endSec: shot.durationSec,
        sourceStartSec: 0,
        sourceDurationSec: shot.durationSec,
        motion: isVideo ? undefined : shot.motion,
        transition: "dissolve",
        transitionDurationSec: Math.min(0.5, shot.durationSec / 2),
        mature: generatedPreview.mature,
      };
      onAddClip(newClip);
    });
    setGeneratedPreview(null);
  };

  return (
    <div className="space-y-4" data-testid="video-generator-panel">
      <div className="flex rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-1" data-testid="clip-kind-toggle">
        {(["video", "gif"] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => switchClipKind(kind)}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              clipKind === kind
                ? "bg-[var(--surface-raised)] text-[var(--accent-primary)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            {kind === "video" ? `Video (${getVideoLimits("video").minSec}-${getVideoLimits("video").maxSec}s)` : `GIF (${getVideoLimits("gif").minSec}-${getVideoLimits("gif").maxSec}s)`}
          </button>
        ))}
      </div>

      {/* Tab toggle between Text-to-Video and Image-to-Video */}
      <div className="flex rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-1">
        <button
          type="button"
          onClick={() => setMode("text")}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
            mode === "text"
              ? "bg-[var(--surface-raised)] text-[var(--accent-primary)] shadow-sm"
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          ✨ Text-to-Video
        </button>
        <button
          type="button"
          onClick={() => setMode("image")}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
            mode === "image"
              ? "bg-[var(--surface-raised)] text-[var(--accent-primary)] shadow-sm"
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          🎬 Image-to-Video (Motion)
        </button>
      </div>

      {mode === "text" ? (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              AI Video Prompt
            </label>
            <textarea
              rows={2}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Sizzling smashed cheeseburger in cyberpunk neon rain, slow motion, shallow depth of field..."
              className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-2.5 text-sm outline-none focus:border-[var(--accent-primary)]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-muted)]">
              Cinematic Style
            </label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {VIDEO_STYLES.map((style) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => setSelectedStyle(style.id)}
                  className={`rounded-full border px-2.5 py-1 text-xs transition ${
                    selectedStyle === style.id
                      ? "border-[var(--accent-primary)] bg-[var(--accent-primary-subtle)] font-medium text-[var(--accent-primary)]"
                      : "border-[var(--border-subtle)] bg-[var(--surface-sunken)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
                  }`}
                >
                  {style.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)]">
                Camera Motion
              </label>
              <select
                value={selectedMotion}
                onChange={(e) => setSelectedMotion(e.target.value as CameraMotion)}
                className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-2.5 py-1.5 text-xs"
              >
                {CAMERA_MOTIONS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)]">
                Duration ({durationSec}s)
              </label>
              <input
                type="range"
                min={limits.minSec}
                max={limits.maxSec}
                step={limits.stepSec}
                value={durationSec}
                onChange={(e) => setDurationSec(Number(e.target.value))}
                className="mt-1 w-full"
                data-testid="video-duration-slider"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-muted)]">Aspect ratio</span>
            <div className="flex gap-1">
              {(["16:9", "9:16", "1:1"] as const).map((ratio) => (
                <button
                  key={ratio}
                  type="button"
                  onClick={() => setAspectRatio(ratio)}
                  className={`rounded border px-2 py-0.5 text-xs ${
                    aspectRatio === ratio
                      ? "border-[var(--accent-primary)] bg-[var(--accent-primary-subtle)] font-medium text-[var(--accent-primary)]"
                      : "border-[var(--border-subtle)] text-[var(--text-muted)]"
                  }`}
                >
                  {ratio}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={mature}
                onChange={(e) => setMature(e.target.checked)}
                className="rounded border-[var(--border-subtle)]"
              />
              <span>18+ Mature Video</span>
            </label>
          </div>

          <button
            type="button"
            disabled={generating || !prompt.trim()}
            onClick={() => void handleGenerateTextToVideo()}
            className={`${btnPrimary} w-full py-2.5 text-sm font-semibold`}
          >
            {generating
              ? progress
                ? `Rendering shot ${Math.min(progress.done + 1, progress.total)} of ${progress.total}...`
                : "Starting..."
              : "✨ Generate AI Video Clip"}
          </button>

          {generatedPreview ? (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3">
              <p className="text-xs font-semibold text-[var(--accent-primary)]">
                AI Clip Ready ({generatedPreview.durationSec}s · {generatedPreview.shots.length} {generatedPreview.shots.length === 1 ? "shot" : "shots"})
              </p>
              <div className="mt-2 overflow-hidden rounded-lg bg-black">
                {generatedPreview.shots[0]?.mediaType === "video" ||
                generatedPreview.shots[0]?.url.endsWith(".mp4") ? (
                  <video
                    src={generatedPreview.shots[0]?.url}
                    controls
                    playsInline
                    className="max-h-36 w-full object-contain"
                  />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={generatedPreview.shots[0]?.url}
                    alt={generatedPreview.prompt}
                    className="max-h-36 w-full object-contain"
                    onError={() => {
                      setGeneratedPreview(null);
                      setError("The preview couldn't load — try generating again.");
                    }}
                  />
                )}
              </div>
              {generatedPreview.shots.length > 1 ? (
                <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
                  {generatedPreview.shots.map((shot, idx) => (
                    <div
                      key={idx}
                      className="shrink-0 rounded border border-[var(--border-subtle)] bg-[var(--surface-frame)] px-2 py-1 text-[11px] text-[var(--text-secondary)]"
                    >
                      Shot {idx + 1}: {shot.durationSec}s {shot.mediaType === "video" ? "📹" : "🖼️"}
                    </div>
                  ))}
                </div>
              ) : null}
              <button
                type="button"
                onClick={handleInsertGenerated}
                className={`${btnSecondary} mt-2 w-full py-1.5 text-xs font-medium`}
              >
                + Add Clip to Timeline
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        /* Image-to-Video Animation Mode */
        <div className="space-y-3">
          <p className="text-xs text-[var(--text-muted)]">
            Transform any static image into dynamic cinematic video with smooth AI camera motions (Ken Burns push, pull, orbital drift, or beat pulse).
          </p>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-muted)]">
              Choose Camera Motion
            </label>
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              {CAMERA_MOTIONS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedMotion(m.id)}
                  className={`rounded-lg border p-2 text-left transition ${
                    selectedMotion === m.id
                      ? "border-[var(--accent-primary)] bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)]"
                      : "border-[var(--border-subtle)] bg-[var(--surface-sunken)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
                  }`}
                >
                  <p className="text-xs font-semibold">{m.label}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">{m.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-muted)]">
              Clip Duration
            </label>
            <input
              type="range"
              min={limits.minSec}
              max={limits.maxSec}
              step={limits.stepSec}
              value={durationSec}
              onChange={(e) => setDurationSec(Number(e.target.value))}
              className="mt-1 w-full"
            />
            <div className="flex justify-between text-[10px] text-[var(--text-muted)]">
              <span>{limits.minSec}s</span>
              <span>{durationSec}s</span>
              <span>{limits.maxSec}s</span>
            </div>
          </div>

          {availableAssets.length > 0 ? (
            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)]">
                Select Asset to Animate
              </label>
              <div className="mt-1.5 grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                {availableAssets
                  .filter((a) => a.kind === "image" || a.kind === "gif")
                  .map((asset) => (
                    <div
                      key={asset.id}
                      onClick={() => setSelectedAssetId(asset.id)}
                      className={`cursor-pointer overflow-hidden rounded-lg border p-1 text-center transition ${
                        selectedAssetId === asset.id
                          ? "border-[var(--accent-primary)] bg-[var(--accent-primary-subtle)]"
                          : "border-[var(--border-subtle)] hover:border-[var(--border-strong)]"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={asset.url} alt={asset.name} className="h-16 w-full rounded object-cover" />
                      <p className="mt-1 truncate text-[10px] text-[var(--text-muted)]">{asset.name}</p>
                    </div>
                  ))}
              </div>

              {selectedAssetId ? (
                <button
                  type="button"
                  onClick={() => {
                    const hit = availableAssets.find((a) => a.id === selectedAssetId);
                    if (hit) handleAnimateImageToVideo(hit.url, hit.name);
                  }}
                  className={`${btnPrimary} mt-3 w-full py-2 text-xs font-semibold`}
                >
                  🎬 Animate Asset into Timeline Clip ({selectedMotion})
                </button>
              ) : null}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-[var(--border-subtle)] p-3 text-center text-xs text-[var(--text-muted)]">
              Import images in the Media tab or generate an image in Studio first to animate them.
            </p>
          )}
        </div>
      )}

      {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
