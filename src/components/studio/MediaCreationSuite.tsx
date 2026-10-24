"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { btnPrimary, btnSecondary } from "@/lib/ui/button-classes";
import { useToolHandoff } from "@/lib/landing/use-tool-handoff";
import { LoadedFromDropChip, HandoffExpiredNote } from "@/components/landing/HandoffNotice";
import {
  computeFrameRects,
  normalizeClipRange,
  type MediaStudioLayout,
} from "@/lib/media-studio-layout";
import {
  VideoPluginManager,
  BUILTIN_VIDEO_PLUGINS,
  type PerformanceMode,
} from "@/lib/video-plugins";
import {
  calculateTimelineDuration,
  formatTimecode,
  splitClipAtTime,
  trimClip,
  computeMotionTransform,
} from "@/lib/video-timeline/timeline-ops";
import type {
  AudioClip,
  TextOverlay,
  TransitionType,
  VisualClip,
} from "@/lib/video-timeline/timeline-types";

import { AiVideoGeneratorPanel } from "./video/AiVideoGeneratorPanel";
import { VideoPluginsPanel } from "./video/VideoPluginsPanel";
import { VideoTextOverlayPanel } from "./video/VideoTextOverlayPanel";
import { VideoTimelineTrackView } from "./video/VideoTimelineTrackView";
import { VideoPreviewPlayer } from "./video/VideoPreviewPlayer";

type ToolboxTab = "ai" | "assets" | "plugins" | "text" | "layout" | "export";

type ImportedAsset = {
  id: string;
  file: File;
  url: string;
  name: string;
  kind: "image" | "gif" | "video" | "audio";
  durationSec: number;
};

const LAYOUTS: { id: MediaStudioLayout; label: string }[] = [
  { id: "grid", label: "Full / Grid" },
  { id: "side-by-side", label: "Side by Side" },
  { id: "stacked", label: "Stacked Vertical" },
  { id: "overlay", label: "Overlay / Blend" },
  { id: "pip", label: "Picture in Picture" },
  { id: "collage", label: "Collage" },
];

function pickRecorderMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4",
  ];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
}

export function MediaCreationSuite() {
  const [activeToolboxTab, setActiveToolboxTab] = useState<ToolboxTab>("ai");

  // Project state
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16" | "1:1">("16:9");
  const [performanceMode, setPerformanceMode] = useState<PerformanceMode>("active");

  // Imported raw media files
  const [importedAssets, setImportedAssets] = useState<ImportedAsset[]>([]);

  // Timeline Tracks
  const [visualClips, setVisualClips] = useState<VisualClip[]>([]);
  const [audioClips, setAudioClips] = useState<AudioClip[]>([]);
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  // Playhead & Transport
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Layout parameters for collage/grid
  const [layout, setLayout] = useState<MediaStudioLayout>("grid");
  const [bgColor, setBgColor] = useState("#0c0d12");
  const [fit, setFit] = useState<"contain" | "cover">("cover");

  // Export & Publishing state
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [exportedBlob, setExportedBlob] = useState<Blob | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const cancelExportRef = useRef(false);

  // Gallery Post Publish Form State
  const [postTitle, setPostTitle] = useState("AI Video Creation");
  const [postVisibility, setPostVisibility] = useState<"PUBLIC" | "UNLISTED" | "PRIVATE">("PUBLIC");
  const [postTags, setPostTags] = useState("video, ai, creative");
  const [postMature, setPostMature] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishedShortId, setPublishedShortId] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState<string | null>(null);
  const [shareToast, setShareToast] = useState("");

  // pacNcap Plugin Manager
  const pluginManager = useMemo(() => {
    return new VideoPluginManager({ performanceMode });
  }, []);

  const [enabledPluginIds, setEnabledPluginIds] = useState<Set<string>>(new Set());
  const [pluginParams, setPluginParams] = useState<Map<string, Record<string, unknown>>>(new Map());

  // Register builtin plugins on mount
  useEffect(() => {
    for (const plugin of BUILTIN_VIDEO_PLUGINS) {
      void pluginManager.registerPlugin(plugin, false);
    }
  }, [pluginManager]);

  // Synchronize performance mode
  useEffect(() => {
    pluginManager.setPerformanceMode(performanceMode);
  }, [performanceMode, pluginManager]);

  // Total duration of project
  const totalDurationSec = useMemo(() => {
    return calculateTimelineDuration(visualClips, audioClips, textOverlays);
  }, [visualClips, audioClips, textOverlays]);

  // Available assets for the AI panel
  const availableVisualAssets = useMemo(() => {
    return importedAssets
      .filter((a) => a.kind !== "audio")
      .map((a) => ({ id: a.id, name: a.name, url: a.url, kind: a.kind as "image" | "video" | "gif" }));
  }, [importedAssets]);

  // Handle file imports
  const onFiles = async (files: FileList | null | File[]) => {
    if (!files || files.length === 0) return;
    setError("");
    const next: ImportedAsset[] = [];

    for (const file of Array.from(files)) {
      let kind: "image" | "gif" | "video" | "audio" = "image";
      if (file.type === "image/gif") kind = "gif";
      else if (file.type.startsWith("image/")) kind = "image";
      else if (file.type.startsWith("video/")) kind = "video";
      else if (file.type.startsWith("audio/")) kind = "audio";
      else {
        setError(`Unsupported file type: ${file.name}`);
        continue;
      }

      const id = `asset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const url = URL.createObjectURL(file);
      const durationSec = kind === "image" || kind === "gif" ? 3 : 5;

      next.push({
        id,
        file,
        url,
        name: file.name,
        kind,
        durationSec,
      });

      // Auto-insert into visual track if timeline is empty
      if (kind !== "audio") {
        setVisualClips((prev) => {
          const start = prev.length > 0 ? prev[prev.length - 1].endSec : 0;
          return [
            ...prev,
            {
              id: `clip-${id}`,
              trackId: "visual-1",
              assetId: id,
              url,
              name: file.name,
              kind,
              startSec: start,
              endSec: start + durationSec,
              sourceStartSec: 0,
              sourceDurationSec: durationSec,
              motion: kind === "image" ? "zoom-in" : undefined,
              transition: "dissolve",
              transitionDurationSec: 0.5,
            },
          ];
        });
      }
    }

    if (next.length > 0) {
      setImportedAssets((prev) => [...prev, ...next]);
      setStatus(`Imported ${next.length} media file${next.length > 1 ? "s" : ""}.`);
    }
  };

  // Handoff integration from landing
  const handleLoadMediaFile = useCallback(async (file: File) => {
    await onFiles([file]);
  }, []);

  const handleClearMedia = useCallback(() => {
    setImportedAssets([]);
    setVisualClips([]);
    setAudioClips([]);
    setTextOverlays([]);
    setSelectedClipId(null);
  }, []);

  const { isLoadedFromDrop, fileName, isExpired, clearHandoff, dismissExpired } = useToolHandoff({
    onFileLoaded: handleLoadMediaFile,
    onClear: handleClearMedia,
  });

  // Timeline operations
  const handleAddVisualClip = (clip: VisualClip) => {
    setVisualClips((prev) => {
      // Append to the end of the visual track
      const lastEnd = prev.length > 0 ? prev[prev.length - 1].endSec : 0;
      const duration = clip.endSec - clip.startSec;
      const adjusted: VisualClip = {
        ...clip,
        startSec: lastEnd,
        endSec: lastEnd + duration,
      };
      return [...prev, adjusted];
    });
    setSelectedClipId(clip.id);
    setStatus(`Added "${clip.name}" to visual timeline.`);
  };

  const handleSplitClip = (clipId: string, splitTimeSec: number) => {
    const target = visualClips.find((c) => c.id === clipId);
    if (!target) return;
    const split = splitClipAtTime(target, splitTimeSec);
    if (!split) {
      setError("Cannot split clip at this playhead position (must be at least 0.1s from clip edges).");
      return;
    }
    const [left, right] = split;
    setVisualClips((prev) => {
      const idx = prev.findIndex((c) => c.id === clipId);
      if (idx < 0) return prev;
      const copy = [...prev];
      copy.splice(idx, 1, left, right);
      return copy;
    });
    setSelectedClipId(right.id);
    setStatus("Clip split at playhead.");
  };

  const handleDeleteClip = (clipId: string) => {
    setVisualClips((prev) => prev.filter((c) => c.id !== clipId));
    if (selectedClipId === clipId) setSelectedClipId(null);
  };

  const handleTrimClip = (clipId: string, newStartSec: number, newEndSec: number) => {
    setVisualClips((prev) =>
      prev.map((c) => (c.id === clipId ? trimClip(c, newStartSec, newEndSec) : c)),
    );
  };

  const handleUpdateTransition = (clipId: string, transition: TransitionType) => {
    setVisualClips((prev) =>
      prev.map((c) => (c.id === clipId ? { ...c, transition } : c)),
    );
  };

  // Text Overlay Operations
  const handleAddTextOverlay = (overlay: TextOverlay) => {
    setTextOverlays((prev) => [...prev, overlay]);
  };

  const handleRemoveTextOverlay = (id: string) => {
    setTextOverlays((prev) => prev.filter((t) => t.id !== id));
  };

  const handleUpdateTextOverlay = (id: string, patch: Partial<TextOverlay>) => {
    setTextOverlays((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    );
  };

  // Plugin Management
  const handleTogglePlugin = (pluginId: string, enabled: boolean) => {
    pluginManager.setPluginEnabled(pluginId, enabled);
    setEnabledPluginIds((prev) => {
      const next = new Set(prev);
      if (enabled) next.add(pluginId);
      else next.delete(pluginId);
      return next;
    });
  };

  const handleParamChange = (pluginId: string, paramId: string, value: unknown) => {
    pluginManager.setPluginParam(pluginId, paramId, value);
    setPluginParams((prev) => {
      const next = new Map(prev);
      const curr = next.get(pluginId) ?? {};
      curr[paramId] = value;
      next.set(pluginId, curr);
      return next;
    });
  };

  // Render & In-Browser Export
  const exportVideo = async () => {
    setError("");
    setStatus("");
    if (visualClips.length === 0) {
      setError("Please add at least one visual clip to the timeline before exporting.");
      return;
    }
    const mime = pickRecorderMime();
    if (!mime) {
      setError("MediaRecorder is not supported in this browser for video export.");
      return;
    }

    const width = aspectRatio === "9:16" ? 720 : aspectRatio === "1:1" ? 1080 : 1280;
    const height = aspectRatio === "9:16" ? 1280 : aspectRatio === "1:1" ? 1080 : 720;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      setError("Failed to create rendering canvas.");
      return;
    }

    // Preload all visual clip images and videos
    const imageElements = new Map<string, HTMLImageElement>();
    const videoElements = new Map<string, HTMLVideoElement>();

    for (const clip of visualClips) {
      if (clip.kind === "video") {
        const v = document.createElement("video");
        v.muted = true;
        v.playsInline = true;
        v.src = clip.url;
        await new Promise<void>((resolve) => {
          v.onloadedmetadata = () => resolve();
          v.onerror = () => resolve();
        });
        videoElements.set(clip.id, v);
      } else {
        const img = new Image();
        img.src = clip.url;
        await new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
        });
        imageElements.set(clip.id, img);
      }
    }

    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    cancelExportRef.current = false;
    setExporting(true);
    setExportProgress(0);
    recorder.start();

    const fps = 30;
    const totalFrames = Math.max(1, Math.floor(totalDurationSec * fps));
    let frame = 0;

    const renderLoop = async () => {
      if (cancelExportRef.current || frame >= totalFrames) {
        recorder.stop();
        setExporting(false);
        setStatus(cancelExportRef.current ? "Export canceled." : "Video rendering complete!");
        return;
      }

      const time = frame / fps;
      setExportProgress(Math.floor((frame / totalFrames) * 100));

      // 1. Clear Background
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);

      // 2. Render Active Visual Clips
      const active = visualClips.filter((c) => time >= c.startSec && time < c.endSec);
      for (const clip of active) {
        const clipDur = Math.max(0.1, clip.endSec - clip.startSec);
        const progress = Math.max(0, Math.min(1, (time - clip.startSec) / clipDur));
        const motion = computeMotionTransform(clip.motion, progress);

        ctx.save();
        ctx.globalAlpha = motion.alpha;

        const cx = width / 2;
        const cy = height / 2;
        ctx.translate(cx, cy);
        ctx.scale(motion.scale, motion.scale);
        if (motion.rotateDeg) {
          ctx.rotate((motion.rotateDeg * Math.PI) / 180);
        }
        ctx.translate(-cx, -cy);

        if (clip.kind === "video") {
          const v = videoElements.get(clip.id);
          if (v) {
            v.currentTime = clip.sourceStartSec + (time - clip.startSec);
            drawCover(ctx, v, v.videoWidth, v.videoHeight, width, height);
          }
        } else {
          const img = imageElements.get(clip.id);
          if (img) {
            drawCover(ctx, img, img.naturalWidth, img.naturalHeight, width, height);
          }
        }
        ctx.restore();
      }

      // 3. Render Active Text Overlays
      const activeTexts = textOverlays.filter((t) => time >= t.startSec && time < t.endSec);
      for (const t of activeTexts) {
        ctx.save();
        const x = (t.xPercent / 100) * width;
        const y = (t.yPercent / 100) * height;
        const scaleRef = width / 1280;
        const fontSize = Math.max(16, Math.floor(t.fontSize * scaleRef));

        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const textMetrics = ctx.measureText(t.text);
        const paddingX = fontSize * 0.6;
        const paddingY = fontSize * 0.4;
        const boxWidth = textMetrics.width + paddingX * 2;
        const boxHeight = fontSize + paddingY * 2;

        if (t.bgColor && t.bgColor !== "transparent") {
          ctx.fillStyle = t.bgColor;
          ctx.beginPath();
          ctx.roundRect(x - boxWidth / 2, y - boxHeight / 2, boxWidth, boxHeight, 8);
          ctx.fill();
        }

        ctx.fillStyle = t.fontColor;
        ctx.fillText(t.text, x, y);
        ctx.restore();
      }

      // 4. Pass Frame through pacNcap Plugin Pipeline
      pluginManager.setFrameContext(time, frame);
      const raw = ctx.getImageData(0, 0, width, height);
      const filtered = await pluginManager.processFrame(raw);
      ctx.putImageData(filtered, 0, 0);

      frame++;
      // Yield to event loop to keep UI responsive
      setTimeout(renderLoop, 1000 / fps);
    };

    const drawCover = (
      c: CanvasRenderingContext2D,
      source: CanvasImageSource,
      sw: number,
      sh: number,
      dw: number,
      dh: number,
    ) => {
      if (!sw || !sh) return;
      const ratio = Math.max(dw / sw, dh / sh);
      const cw = dw / ratio;
      const ch = dh / ratio;
      c.drawImage(source, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, dw, dh);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mime.split(";")[0] });
      setExportedBlob(blob);
      setExportUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
      setActiveToolboxTab("export");
    };

    void renderLoop();
  };

  // Direct Gallery Publishing
  const handlePublishToGallery = async () => {
    if (!exportedBlob) {
      setError("Please render/export your video first.");
      return;
    }
    setPublishing(true);
    setError("");
    setStatus("Publishing video to imbrgr gallery…");

    try {
      const formData = new FormData();
      const file = new File([exportedBlob], "imbrgr-video.webm", {
        type: exportedBlob.type || "video/webm",
      });
      const isMature = postMature || visualClips.some((c) => c.mature);
      const effectiveVisibility = isMature && postVisibility === "PUBLIC" ? "UNLISTED" : postVisibility;
      formData.append("files", file);
      formData.append("title", postTitle || "AI Video Creation");
      formData.append("tags", postTags);
      formData.append("visibility", effectiveVisibility);
      formData.append("mature", String(isMature));
      formData.append("aiGenerated", "true");
      formData.append("aiPrompt", visualClips.map((c) => c.name).join(", "));

      const res = await fetch("/api/posts", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.shortId) {
        throw new Error(data.error || "Failed to publish post");
      }

      setPublishedShortId(data.shortId);
      setStatus(`Published successfully! Short ID: ${data.shortId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish post");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <section className="mt-6 space-y-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4 shadow-sm">
      {/* Studio Header & pacNcap Catalyst Badge */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight">AI Video Studio</h2>
            <span className="rounded-full border border-[var(--accent-primary)]/50 bg-[var(--accent-primary)]/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--accent-primary)]">
              ⚡ pacNcap Engine
            </span>
          </div>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            Full-featured timeline editor, AI text/image video generation, Ken Burns motion camera, and hot-swappable visual effect plugins.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isLoadedFromDrop && (
            <LoadedFromDropChip fileName={fileName} onClear={clearHandoff} />
          )}
          {isExpired && (
            <HandoffExpiredNote onDismiss={dismissExpired} />
          )}

          {/* Performance Mode Badge */}
          <button
            type="button"
            onClick={() => {
              const modes: PerformanceMode[] = ["eco", "active", "workstation"];
              const next = modes[(modes.indexOf(performanceMode) + 1) % modes.length];
              setPerformanceMode(next);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-sunken)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:border-[var(--accent-primary)]"
            title="Click to cycle performance modes"
          >
            {performanceMode === "eco" && "🍃 Eco Mode (Fast Scrub)"}
            {performanceMode === "active" && "🚀 Active Mode"}
            {performanceMode === "workstation" && "🔥 Workstation Mode"}
          </button>

          <button
            type="button"
            disabled={exporting || visualClips.length === 0}
            onClick={() => void exportVideo()}
            className={`${btnPrimary} px-4 py-1.5 text-xs font-semibold`}
          >
            {exporting ? `Rendering ${exportProgress}%…` : "🎥 Render Video"}
          </button>
        </div>
      </header>

      {/* Main Studio Grid: Left Toolbox & Right Live Preview Player */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Left Column: Toolbox Tabs & Panels (5 cols) */}
        <div className="flex flex-col rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] lg:col-span-5">
          {/* Sub-nav tabs */}
          <div className="flex overflow-x-auto border-b border-[var(--border-subtle)] bg-[var(--surface-sunken)]/60 p-1">
            <button
              type="button"
              onClick={() => setActiveToolboxTab("ai")}
              className={`flex-1 min-w-[70px] rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                activeToolboxTab === "ai"
                  ? "bg-[var(--surface-base)] font-semibold text-[var(--accent-primary)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              ✨ AI Gen
            </button>
            <button
              type="button"
              onClick={() => setActiveToolboxTab("assets")}
              className={`flex-1 min-w-[70px] rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                activeToolboxTab === "assets"
                  ? "bg-[var(--surface-base)] font-semibold text-[var(--accent-primary)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              📁 Media ({importedAssets.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveToolboxTab("plugins")}
              className={`flex-1 min-w-[70px] rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                activeToolboxTab === "plugins"
                  ? "bg-[var(--surface-base)] font-semibold text-[var(--accent-primary)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              ⚡ Plugins ({enabledPluginIds.size})
            </button>
            <button
              type="button"
              onClick={() => setActiveToolboxTab("text")}
              className={`flex-1 min-w-[70px] rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                activeToolboxTab === "text"
                  ? "bg-[var(--surface-base)] font-semibold text-[var(--accent-primary)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              💬 Text
            </button>
            <button
              type="button"
              onClick={() => setActiveToolboxTab("export")}
              className={`flex-1 min-w-[70px] rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                activeToolboxTab === "export"
                  ? "bg-[var(--surface-base)] font-semibold text-[var(--accent-primary)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              🚀 Publish
            </button>
          </div>

          {/* Panel Contents */}
          <div className="p-3.5 max-h-[460px] overflow-y-auto">
            {activeToolboxTab === "ai" && (
              <AiVideoGeneratorPanel
                onAddClip={handleAddVisualClip}
                availableAssets={availableVisualAssets}
              />
            )}

            {activeToolboxTab === "assets" && (
              <div className="space-y-3">
                <label className="block rounded-xl border border-dashed border-[var(--border-strong)] p-4 text-center cursor-pointer hover:border-[var(--accent-primary)] transition">
                  <span className="text-xs font-semibold text-[var(--accent-primary)]">
                    + Upload Images, Videos, or Audio
                  </span>
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                    PNG, JPG, WebP, MP4, WebM, GIF, MP3
                  </p>
                  <input
                    type="file"
                    accept="image/*,video/*,audio/*"
                    multiple
                    className="hidden"
                    onChange={(e) => void onFiles(e.target.files)}
                  />
                </label>

                {importedAssets.length > 0 ? (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Project Assets
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {importedAssets.map((asset) => (
                        <div
                          key={asset.id}
                          className="flex flex-col overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-2 text-xs"
                        >
                          <div className="relative h-20 w-full overflow-hidden rounded bg-black/60">
                            {asset.kind === "video" ? (
                              <video src={asset.url} className="h-full w-full object-cover" />
                            ) : (
                              <img src={asset.url} alt={asset.name} className="h-full w-full object-cover" />
                            )}
                            <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[9px] uppercase font-bold text-white">
                              {asset.kind}
                            </span>
                          </div>
                          <p className="mt-1 truncate font-medium text-[11px]">{asset.name}</p>
                          <div className="mt-2 flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                const newClip: VisualClip = {
                                  id: `clip-${asset.id}-${Date.now()}`,
                                  trackId: "visual-1",
                                  assetId: asset.id,
                                  url: asset.url,
                                  name: asset.name,
                                  kind: asset.kind as "image" | "video" | "gif",
                                  startSec: 0,
                                  endSec: asset.durationSec,
                                  sourceStartSec: 0,
                                  sourceDurationSec: asset.durationSec,
                                  motion: asset.kind === "image" ? "zoom-in" : undefined,
                                  transition: "fade",
                                  transitionDurationSec: 0.5,
                                };
                                handleAddVisualClip(newClip);
                              }}
                              className={`${btnSecondary} flex-1 py-1 text-[11px]`}
                            >
                              + Insert
                            </button>
                            <a
                              href={asset.url}
                              download={asset.name}
                              className="inline-flex items-center justify-center rounded-lg border border-[var(--border-strong)] bg-[var(--surface-base)] px-2.5 py-1 text-[11px] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]"
                              title="Download asset"
                            >
                              💾
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {activeToolboxTab === "plugins" && (
              <VideoPluginsPanel
                performanceMode={performanceMode}
                onPerformanceModeChange={setPerformanceMode}
                enabledPluginIds={enabledPluginIds}
                onTogglePlugin={handleTogglePlugin}
                pluginParams={pluginParams}
                onParamChange={handleParamChange}
              />
            )}

            {activeToolboxTab === "text" && (
              <VideoTextOverlayPanel
                textOverlays={textOverlays}
                currentTimeSec={currentTimeSec}
                onAddTextOverlay={handleAddTextOverlay}
                onRemoveTextOverlay={handleRemoveTextOverlay}
                onUpdateTextOverlay={handleUpdateTextOverlay}
              />
            )}

            {activeToolboxTab === "export" && (
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--accent-primary)]">
                  🚀 Export, Download & Share
                </h3>

                {exporting ? (
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-4 text-center">
                    <p className="text-xs font-semibold">Rendering video frames with pacNcap shaders…</p>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--border-subtle)]">
                      <div
                        className="h-full bg-[var(--accent-primary)] transition-all"
                        style={{ width: `${exportProgress}%` }}
                      />
                    </div>
                    <span className="mt-1 block font-mono text-xs text-[var(--text-muted)]">
                      {exportProgress}%
                    </span>
                    <button
                      type="button"
                      onClick={() => { cancelExportRef.current = true; }}
                      className={`${btnSecondary} mt-3 text-xs`}
                    >
                      Cancel Export
                    </button>
                  </div>
                ) : null}

                {exportUrl ? (
                  <div className="space-y-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3.5">
                    <video src={exportUrl} controls className="max-h-48 w-full rounded-lg bg-black" />
                    
                    {/* Primary Action Buttons: Download & Native Share Video File */}
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={exportUrl}
                        download={`imbrgr-${(postTitle || "video").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.webm`}
                        className={`${btnPrimary} flex-1 text-center py-2 text-xs font-semibold`}
                      >
                        💾 Download WebM {exportedBlob ? `(${(exportedBlob.size / 1024 / 1024).toFixed(1)} MB)` : ""}
                      </a>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!exportedBlob) return;
                          try {
                            const file = new File([exportedBlob], "imbrgr-video.webm", {
                              type: exportedBlob.type || "video/webm",
                            });
                            if (typeof navigator !== "undefined" && navigator.canShare && navigator.canShare({ files: [file] })) {
                              await navigator.share({
                                title: postTitle || "imbrgr AI Video",
                                text: "Check out this video made on imbrgr!",
                                files: [file],
                              });
                              setShareToast("Shared video successfully!");
                              setTimeout(() => setShareToast(""), 3500);
                              return;
                            }
                          } catch {
                            /* user dismissed share dialog */
                          }
                          // Fallback to clipboard if file sharing is not supported by device
                          if (publishedShortId) {
                            const pageUrl = `${window.location.origin}/p/${publishedShortId}`;
                            await navigator.clipboard.writeText(pageUrl);
                            setShareCopied("published-link");
                            setShareToast("Post link copied to clipboard!");
                            setTimeout(() => { setShareCopied(null); setShareToast(""); }, 3500);
                          } else {
                            setShareToast("Video ready! Click 'Download WebM' or publish below to get a public link.");
                            setTimeout(() => setShareToast(""), 4000);
                          }
                        }}
                        className={`${btnSecondary} flex-1 py-2 text-xs font-semibold`}
                      >
                        🔗 Share Video File
                      </button>
                    </div>

                    {shareToast ? (
                      <p className="rounded-lg bg-[var(--accent-primary)]/10 p-2 text-center text-xs font-semibold text-[var(--accent-primary)]" role="status">
                        {shareToast}
                      </p>
                    ) : null}

                    {/* Gallery Publishing Form */}
                    <div className="border-t border-[var(--border-subtle)] pt-3 space-y-2">
                      <h4 className="text-xs font-semibold">Publish directly to imbrgr Gallery:</h4>
                      <div>
                        <label className="text-[11px] text-[var(--text-muted)]">Post Title</label>
                        <input
                          type="text"
                          value={postTitle}
                          onChange={(e) => setPostTitle(e.target.value)}
                          className="mt-0.5 w-full rounded border border-[var(--border-subtle)] bg-[var(--surface-base)] px-2 py-1 text-xs"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[11px] text-[var(--text-muted)]">Tags</label>
                          <input
                            type="text"
                            value={postTags}
                            onChange={(e) => setPostTags(e.target.value)}
                            className="mt-0.5 w-full rounded border border-[var(--border-subtle)] bg-[var(--surface-base)] px-2 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-[var(--text-muted)]">Visibility</label>
                          <select
                            value={postVisibility}
                            onChange={(e) => setPostVisibility(e.target.value as "PUBLIC" | "UNLISTED" | "PRIVATE")}
                            className="mt-0.5 w-full rounded border border-[var(--border-subtle)] bg-[var(--surface-base)] px-2 py-1 text-xs"
                          >
                            <option value="PUBLIC">Public</option>
                            <option value="UNLISTED">Unlisted</option>
                            <option value="PRIVATE">Private</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-0.5">
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--text-secondary)]">
                          <input
                            type="checkbox"
                            checked={postMature || visualClips.some((c) => c.mature)}
                            onChange={(e) => setPostMature(e.target.checked)}
                            className="rounded border-[var(--border-subtle)]"
                          />
                          <span>🔞 18+ Mature Video (Clamps to Unlisted/Private)</span>
                        </label>
                      </div>

                      <button
                        type="button"
                        disabled={publishing}
                        onClick={() => void handlePublishToGallery()}
                        className={`${btnPrimary} w-full py-2 text-xs font-semibold shadow-[var(--shadow-ember)]`}
                      >
                        {publishing ? "Publishing to Gallery…" : "🔥 One-Click Post to Gallery"}
                      </button>

                      {publishedShortId ? (
                        <div className="space-y-2.5 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-base)] p-3 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[var(--accent-primary)]">🎉 Published to Gallery!</span>
                            <span className="rounded-full bg-[var(--surface-sunken)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
                              {postVisibility}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                const url = `${window.location.origin}/p/${publishedShortId}`;
                                await navigator.clipboard.writeText(url);
                                setShareCopied("post-link");
                                setShareToast("Post URL copied!");
                                setTimeout(() => { setShareCopied(null); setShareToast(""); }, 3000);
                              }}
                              className={`${btnSecondary} flex-1 py-1.5 text-xs font-semibold`}
                            >
                              {shareCopied === "post-link" ? "✓ Copied!" : "📋 Copy Link"}
                            </button>

                            <button
                              type="button"
                              onClick={async () => {
                                const url = `${window.location.origin}/p/${publishedShortId}`;
                                if (navigator.share) {
                                  try {
                                    await navigator.share({
                                      title: postTitle || "imbrgr AI Video",
                                      url,
                                    });
                                  } catch {
                                    /* dismissed */
                                  }
                                } else {
                                  await navigator.clipboard.writeText(url);
                                  setShareCopied("post-link");
                                  setShareToast("Link copied to clipboard!");
                                  setTimeout(() => { setShareCopied(null); setShareToast(""); }, 3000);
                                }
                              }}
                              className={`${btnSecondary} flex-1 py-1.5 text-xs font-semibold`}
                            >
                              🚀 Share Post
                            </button>

                            <Link
                              href={`/p/${publishedShortId}`}
                              className={`${btnPrimary} flex-1 text-center py-1.5 text-xs font-semibold`}
                            >
                              👁️ View Post →
                            </Link>
                          </div>

                          <details className="mt-2 text-[11px] text-[var(--text-muted)]">
                            <summary className="cursor-pointer font-medium hover:text-[var(--text-primary)]">
                              Embed Codes & Direct Links
                            </summary>
                            <div className="mt-2 space-y-1.5">
                              <div>
                                <span className="block text-[10px]">HTML5 Video Embed:</span>
                                <input
                                  readOnly
                                  value={`<video src="${typeof window !== "undefined" ? window.location.origin : ""}/p/${publishedShortId}" controls width="640"></video>`}
                                  className="w-full rounded border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-2 py-1 text-[10px]"
                                />
                              </div>
                              <div>
                                <span className="block text-[10px]">Markdown:</span>
                                <input
                                  readOnly
                                  value={`[Watch ${postTitle || "Video"} on imbrgr](${typeof window !== "undefined" ? window.location.origin : ""}/p/${publishedShortId})`}
                                  className="w-full rounded border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-2 py-1 text-[10px]"
                                />
                              </div>
                            </div>
                          </details>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  !exporting && (
                    <div className="text-center rounded-xl border border-dashed border-[var(--border-subtle)] p-6">
                      <p className="text-xs text-[var(--text-muted)]">
                        No video rendered yet. Click &quot;Render Video&quot; to compile your multi-track timeline and pacNcap plugins.
                      </p>
                      <button
                        type="button"
                        disabled={visualClips.length === 0}
                        onClick={() => void exportVideo()}
                        className={`${btnPrimary} mt-3 text-xs`}
                      >
                        Render Timeline Video
                      </button>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Interactive Live Preview Player (7 cols) */}
        <div className="lg:col-span-7">
          <VideoPreviewPlayer
            visualClips={visualClips}
            audioClips={audioClips}
            textOverlays={textOverlays}
            currentTimeSec={currentTimeSec}
            totalDurationSec={totalDurationSec}
            isPlaying={isPlaying}
            aspectRatio={aspectRatio}
            onAspectRatioChange={setAspectRatio}
            onTimeUpdate={setCurrentTimeSec}
            onTogglePlay={() => setIsPlaying((p) => !p)}
            pluginManager={pluginManager}
            pluginStateKey={JSON.stringify([[...enabledPluginIds], [...pluginParams]])}
          />
        </div>
      </div>

      {/* Bottom Section: CapCut-style Multi-track Timeline */}
      <div className="mt-4">
        <VideoTimelineTrackView
          visualClips={visualClips}
          audioClips={audioClips}
          textOverlays={textOverlays}
          currentTimeSec={currentTimeSec}
          totalDurationSec={totalDurationSec}
          selectedClipId={selectedClipId}
          onSelectClip={setSelectedClipId}
          onSeek={setCurrentTimeSec}
          onSplitClip={handleSplitClip}
          onDeleteClip={handleDeleteClip}
          onTrimClip={handleTrimClip}
          onUpdateTransition={handleUpdateTransition}
        />
      </div>

      {status ? <p className="text-xs text-[var(--accent-primary)]">{status}</p> : null}
      {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
    </section>
  );
}
