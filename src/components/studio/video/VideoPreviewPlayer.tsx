"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  formatTimecode,
  computeMotionTransform,
  transitionState,
  UNDERLAY_TAIL_SEC,
} from "@/lib/video-timeline/timeline-ops";
import type { VideoPluginManager } from "@/lib/video-plugins/plugin-manager";
import type { AudioClip, TextOverlay, VisualClip } from "@/lib/video-timeline/timeline-types";

type Props = {
  visualClips: VisualClip[];
  audioClips: AudioClip[];
  textOverlays: TextOverlay[];
  currentTimeSec: number;
  totalDurationSec: number;
  isPlaying: boolean;
  aspectRatio: "16:9" | "9:16" | "1:1";
  onAspectRatioChange: (ratio: "16:9" | "9:16" | "1:1") => void;
  onTimeUpdate: (timeSec: number) => void;
  onTogglePlay: () => void;
  pluginManager: VideoPluginManager;
  /** Changes whenever plugin enablement/params change so a paused frame re-renders. */
  pluginStateKey?: string;
};

export function VideoPreviewPlayer({
  visualClips,
  textOverlays,
  currentTimeSec,
  totalDurationSec,
  isPlaying,
  aspectRatio,
  onAspectRatioChange,
  onTimeUpdate,
  onTogglePlay,
  pluginManager,
  pluginStateKey,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loadedImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const loadedVideosRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  // URLs that would not load with CORS; they still play, but taint the canvas so plugins are skipped.
  const noCorsUrlsRef = useRef<Set<string>>(new Set());
  const warnedTaintRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const renderFrameRef = useRef<(time: number) => Promise<void>>(async () => {});
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const currentTimeRef = useRef(currentTimeSec);
  const latestTimeRef = useRef(0);
  const busyRef = useRef(false);
  const dirtyRef = useRef(false);

  const canvasWidth = aspectRatio === "9:16" ? 720 : aspectRatio === "1:1" ? 1080 : 1280;
  const canvasHeight = aspectRatio === "9:16" ? 1280 : aspectRatio === "1:1" ? 1080 : 720;

  // Preload and cache images/videos
  useEffect(() => {
    for (const clip of visualClips) {
      if (clip.kind === "video") {
        if (!loadedVideosRef.current.has(clip.url)) {
          const video = document.createElement("video");
          // Needed so frames can be read back for plugins without tainting the canvas.
          video.crossOrigin = "anonymous";
          video.addEventListener(
            "error",
            () => {
              if (video.crossOrigin === null) return;
              noCorsUrlsRef.current.add(clip.url);
              video.removeAttribute("crossorigin");
              video.src = clip.url;
              video.load();
            },
            { once: true },
          );
          video.src = clip.url;
          video.muted = true;
          video.preload = "auto";
          video.playsInline = true;
          loadedVideosRef.current.set(clip.url, video);
        }
      } else {
        if (!loadedImagesRef.current.has(clip.url)) {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onerror = () => {
            if (img.crossOrigin === null) return;
            noCorsUrlsRef.current.add(clip.url);
            img.removeAttribute("crossorigin");
            img.src = clip.url;
          };
          img.src = clip.url;
          loadedImagesRef.current.set(clip.url, img);
        }
      }
    }
  }, [visualClips]);

  // Handle Spacebar toggle
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space") {
        e.preventDefault();
        onTogglePlay();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onTogglePlay]);

  // Frame Render Function
  const renderFrame = async (time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    // 1. Clear background
    ctx.fillStyle = "#0c0d12";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Render active visual clips
    const activeClips = visualClips.filter((c) => time >= c.startSec && time < c.endSec);

    const drawVisual = (clip: VisualClip, clipTime: number, alpha: number) => {
      const clipDuration = Math.max(0.1, clip.endSec - clip.startSec);
      const clipProgress = Math.max(0, Math.min(1, (clipTime - clip.startSec) / clipDuration));
      const motionTransform = computeMotionTransform(clip.motion, clipProgress);

      ctx.save();
      ctx.globalAlpha = motionTransform.alpha * alpha;

      // Apply Ken Burns scale and translate
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      ctx.translate(cx, cy);
      ctx.scale(motionTransform.scale, motionTransform.scale);
      if (motionTransform.rotateDeg) {
        ctx.rotate((motionTransform.rotateDeg * Math.PI) / 180);
      }
      ctx.translate(-cx, -cy);

      if (clip.kind === "video") {
        const vid = loadedVideosRef.current.get(clip.url);
        if (vid && vid.readyState >= 2) {
          const expectedVideoTime = clip.sourceStartSec + (clipTime - clip.startSec);
          if (Math.abs(vid.currentTime - expectedVideoTime) > 0.3) {
            vid.currentTime = expectedVideoTime;
          }
          drawCover(ctx, vid, vid.videoWidth, vid.videoHeight, canvas.width, canvas.height);
        }
      } else {
        const img = loadedImagesRef.current.get(clip.url);
        if (img && img.complete && img.naturalWidth > 0) {
          drawCover(ctx, img, img.naturalWidth, img.naturalHeight, canvas.width, canvas.height);
        }
      }
      ctx.restore();
    };

    for (const clip of activeClips) {
      const { alpha, underlay } = transitionState(visualClips, clip, time);
      if (underlay) {
        drawVisual(underlay, Math.max(underlay.startSec, underlay.endSec - UNDERLAY_TAIL_SEC), 1);
      }
      drawVisual(clip, time, alpha);
    }

    // 3. Render active text overlays
    const activeTexts = textOverlays.filter((t) => time >= t.startSec && time < t.endSec);
    for (const overlay of activeTexts) {
      ctx.save();
      const x = (overlay.xPercent / 100) * canvas.width;
      const y = (overlay.yPercent / 100) * canvas.height;
      const scaleRef = canvas.width / 1280;
      const fontSize = Math.max(16, Math.floor(overlay.fontSize * scaleRef));

      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const textMetrics = ctx.measureText(overlay.text);
      const paddingX = fontSize * 0.6;
      const paddingY = fontSize * 0.4;
      const boxWidth = textMetrics.width + paddingX * 2;
      const boxHeight = fontSize + paddingY * 2;

      if (overlay.bgColor && overlay.bgColor !== "transparent") {
        ctx.fillStyle = overlay.bgColor;
        ctx.beginPath();
        ctx.roundRect(x - boxWidth / 2, y - boxHeight / 2, boxWidth, boxHeight, 8);
        ctx.fill();
      }

      ctx.fillStyle = overlay.fontColor;
      ctx.fillText(overlay.text, x, y);
      ctx.restore();
    }

    // 4. Pass frame through pacNcap Plugin Pipeline
    pluginManager.setFrameContext(time, Math.floor(time * 30));
    const tainted = activeClips.some((c) => noCorsUrlsRef.current.has(c.url));
    if (tainted) {
      if (!warnedTaintRef.current) {
        warnedTaintRef.current = true;
        console.warn("Plugins skipped: a clip's host does not allow cross-origin frame reads.");
      }
      return;
    }
    try {
      const rawFrame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const filtered = await pluginManager.processFrame(rawFrame);
      ctx.putImageData(filtered, 0, 0);
    } catch (err) {
      console.warn("Plugin frame processing error:", err);
    }
  };

  // Helper to draw image cover
  const drawCover = (
    ctx: CanvasRenderingContext2D,
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
    ctx.drawImage(source, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, dw, dh);
  };

  // Keep refs pointed at the latest closures so the rAF loop never renders stale clips/overlays.
  useEffect(() => {
    renderFrameRef.current = renderFrame;
    onTimeUpdateRef.current = onTimeUpdate;
    currentTimeRef.current = currentTimeSec;
  });

  // Serialize async frame renders (plugins are async); a newer request replaces a queued one.
  const scheduleRender = useCallback((time: number) => {
    latestTimeRef.current = time;
    if (busyRef.current) {
      dirtyRef.current = true;
      return;
    }
    busyRef.current = true;
    function run(t: number) {
      void renderFrameRef.current(t).finally(() => {
        if (dirtyRef.current) {
          dirtyRef.current = false;
          run(latestTimeRef.current);
        } else {
          busyRef.current = false;
        }
      });
    }
    run(time);
  }, []);

  // Playback Loop
  useEffect(() => {
    if (!isPlaying) return;

    lastTimeRef.current = performance.now();
    let currentT = currentTimeRef.current;
    let frameId = 0;

    const loop = (now: number) => {
      const deltaSec = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      currentT += deltaSec;
      if (currentT >= totalDurationSec) {
        currentT = 0; // Loop
      }

      onTimeUpdateRef.current(Number(currentT.toFixed(2)));
      scheduleRender(currentT);

      frameId = requestAnimationFrame(loop);
      animationFrameRef.current = frameId;
    };

    frameId = requestAnimationFrame(loop);
    animationFrameRef.current = frameId;
    return () => cancelAnimationFrame(frameId);
  }, [isPlaying, totalDurationSec, scheduleRender]);

  // Re-render a paused frame when time, clips, overlays, aspect or plugins change
  useEffect(() => {
    if (!isPlaying) {
      scheduleRender(currentTimeSec);
    }
  }, [currentTimeSec, visualClips, textOverlays, aspectRatio, pluginStateKey, isPlaying, scheduleRender]);

  return (
    <div className="flex flex-col items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3 shadow-sm">
      {/* Aspect Ratio & HUD Bar */}
      <div className="flex w-full items-center justify-between pb-2 text-xs">
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-[var(--text-muted)]">
          <span className="font-bold text-[var(--accent-primary)]">
            {formatTimecode(currentTimeSec)}
          </span>
          <span>/</span>
          <span>{formatTimecode(totalDurationSec)}</span>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[10px] text-[var(--text-muted)] mr-1">Aspect:</span>
          {(["16:9", "9:16", "1:1"] as const).map((ratio) => (
            <button
              key={ratio}
              type="button"
              onClick={() => onAspectRatioChange(ratio)}
              className={`rounded px-2 py-0.5 text-[10px] font-semibold transition ${
                aspectRatio === ratio
                  ? "bg-[var(--accent-primary)] text-[var(--on-accent)]"
                  : "bg-[var(--surface-base)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              {ratio}
            </button>
          ))}
        </div>
      </div>

      {/* Main Canvas Player */}
      <div
        className="relative flex items-center justify-center overflow-hidden rounded-lg bg-black shadow-lg"
        style={{
          width: "100%",
          maxHeight: "380px",
          aspectRatio: `${canvasWidth} / ${canvasHeight}`,
        }}
      >
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          className="h-full w-full object-contain"
        />
      </div>

      {/* Playback Transport Controls */}
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => onTimeUpdate(Math.max(0, currentTimeSec - 0.5))}
          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          title="Step back 0.5s"
        >
          ⏪ -0.5s
        </button>

        <button
          type="button"
          onClick={onTogglePlay}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-primary)] text-sm font-bold text-[var(--on-accent)] shadow-md transition hover:scale-105 active:scale-95"
          title={isPlaying ? "Pause (Space)" : "Play (Space)"}
        >
          {isPlaying ? "⏸" : "▶"}
        </button>

        <button
          type="button"
          onClick={() => onTimeUpdate(Math.min(totalDurationSec, currentTimeSec + 0.5))}
          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          title="Step forward 0.5s"
        >
          +0.5s ⏩
        </button>

        <button
          type="button"
          onClick={() => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const dataUrl = canvas.toDataURL("image/png");
            const a = document.createElement("a");
            a.href = dataUrl;
            a.download = `imbrgr-snapshot-${currentTimeSec.toFixed(1)}s.png`;
            a.click();
          }}
          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--accent-primary)]"
          title="Download snapshot of current frame"
        >
          📸 Snapshot
        </button>
      </div>
    </div>
  );
}
