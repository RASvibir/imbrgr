"use client";

import { useState } from "react";
import { btnPrimary, btnSecondary } from "@/lib/ui/button-classes";
import {
  CAMERA_MOTIONS,
  VIDEO_STYLES,
  type CameraMotion,
} from "@/lib/ai/video-provider";
import type { VisualClip } from "@/lib/video-timeline/timeline-types";

type Props = {
  onAddClip: (clip: VisualClip) => void;
  availableAssets: { id: string; name: string; url: string; kind: "image" | "video" | "gif" }[];
};

export function AiVideoGeneratorPanel({ onAddClip, availableAssets }: Props) {
  const [mode, setMode] = useState<"text" | "image">("text");
  const [prompt, setPrompt] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<string>("cinematic");
  const [selectedMotion, setSelectedMotion] = useState<CameraMotion>("zoom-in");
  const [durationSec, setDurationSec] = useState<number>(3);
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16" | "1:1">("16:9");
  const [selectedAssetId, setSelectedAssetId] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [generatedPreview, setGeneratedPreview] = useState<{
    url: string;
    motion: CameraMotion;
    durationSec: number;
    prompt: string;
  } | null>(null);

  const handleGenerateTextToVideo = async () => {
    if (!prompt.trim() || prompt.trim().length < 3) {
      setError("Please enter a prompt of at least 3 characters.");
      return;
    }
    setError("");
    setGenerating(true);
    try {
      const res = await fetch("/api/ai/video/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          style: selectedStyle,
          motion: selectedMotion,
          durationSec,
          aspectRatio,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to generate video");
      }
      setGeneratedPreview({
        url: data.video.previewUrl,
        motion: data.video.motion,
        durationSec: data.video.durationSec,
        prompt,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Video generation failed");
    } finally {
      setGenerating(false);
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
    const clipId = `clip-ai-${Date.now()}`;
    const newClip: VisualClip = {
      id: clipId,
      trackId: "visual-1",
      assetId: `asset-ai-${Date.now()}`,
      url: generatedPreview.url,
      name: `AI: ${generatedPreview.prompt.slice(0, 24)}…`,
      kind: "image",
      startSec: 0,
      endSec: generatedPreview.durationSec,
      sourceStartSec: 0,
      sourceDurationSec: generatedPreview.durationSec,
      motion: generatedPreview.motion,
      transition: "dissolve",
      transitionDurationSec: 0.5,
    };
    onAddClip(newClip);
    setGeneratedPreview(null);
  };

  return (
    <div className="space-y-4">
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
                Duration
              </label>
              <select
                value={durationSec}
                onChange={(e) => setDurationSec(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-2.5 py-1.5 text-xs"
              >
                <option value={2}>2 seconds</option>
                <option value={3}>3 seconds (Standard)</option>
                <option value={5}>5 seconds</option>
                <option value={8}>8 seconds</option>
              </select>
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

          <button
            type="button"
            disabled={generating || !prompt.trim()}
            onClick={() => void handleGenerateTextToVideo()}
            className={`${btnPrimary} w-full py-2.5 text-sm font-semibold`}
          >
            {generating ? "Synthesizing AI Video..." : "✨ Generate AI Video Clip"}
          </button>

          {generatedPreview ? (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3">
              <p className="text-xs font-semibold text-[var(--accent-primary)]">
                AI Clip Ready ({generatedPreview.durationSec}s · {generatedPreview.motion})
              </p>
              <div className="mt-2 overflow-hidden rounded-lg bg-black">
                <img
                  src={generatedPreview.url}
                  alt={generatedPreview.prompt}
                  className="max-h-36 w-full object-contain"
                />
              </div>
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
              min={1}
              max={8}
              step={0.5}
              value={durationSec}
              onChange={(e) => setDurationSec(Number(e.target.value))}
              className="mt-1 w-full"
            />
            <div className="flex justify-between text-[10px] text-[var(--text-muted)]">
              <span>1s (Quick)</span>
              <span>{durationSec}s</span>
              <span>8s (Long)</span>
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
