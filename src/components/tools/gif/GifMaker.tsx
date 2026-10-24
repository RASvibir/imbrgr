"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ToolShell } from "@/components/tools/ToolShell";
import { ExportPanel, type ExportFormat, type ExportScale } from "@/components/tools/ExportPanel";
import { btnPrimary, btnSecondary } from "@/lib/ui/button-classes";
import { useToolHandoff } from "@/lib/landing/use-tool-handoff";
import { LoadedFromDropChip, HandoffExpiredNote } from "@/components/landing/HandoffNotice";
import {
  MEME_FONTS,
  initHistory,
  recordHistory,
  undoHistory,
  redoHistory,
  type HistoryManager,
} from "@/lib/tools/meme-render";
import { FUN_FILTERS, applyFunFilter } from "@/lib/fun-filters";
import {
  calculateFrameDelay,
  calculateEstimatedGifSize,
  buildBoomerangFrames,
  reverseFrames,
  encodeGifWithWorker,
  type GifDitherOption,
  type GifFrameInput,
} from "@/lib/gif/encode";
import {
  decodeGifWithImageDecoder,
  extractFramesFromVideo,
  loadImagesAsFrames,
  isImageDecoderSupported,
  type DecodedFrame,
} from "@/lib/gif/decode";
import { exportFramesToWebM } from "@/lib/gif/webm-export";

// Maximum limits to protect memory and browser stability
const MAX_FRAMES_LIMIT = 180;
const MAX_CANVAS_DIM = 800;

export type GifCropAspect = "original" | "1:1" | "4:5" | "16:9" | "9:16";
export type GifResizePreset = "320" | "480" | "640" | "original";

export interface CaptionOverlay {
  id: string;
  text: string;
  position: "top" | "center" | "bottom" | "custom";
  yPercent: number; // 0-100
  fontFamily: string;
  fontSize: number;
  align: "left" | "center" | "right";
  allCaps: boolean;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  shadow: boolean;
}

export interface GifProjectSettings {
  trimStart: number; // 0-based frame index
  trimEnd: number; // 0-based frame index (inclusive)
  fps: number; // 5 to 30
  speed: number; // 0.25 to 4
  reverse: boolean;
  boomerang: boolean;
  loopCount: number; // 0 = infinite, 1 = once, N = N times
  aspect: GifCropAspect;
  resizePreset: GifResizePreset;
  filterId: string;
  filterIntensity: number; // 0 to 1
  paletteSize: number; // 16 to 256
  dither: GifDitherOption;
  captions: CaptionOverlay[];
}

const DEFAULT_SETTINGS: GifProjectSettings = {
  trimStart: 0,
  trimEnd: 0,
  fps: 12,
  speed: 1,
  reverse: false,
  boomerang: false,
  loopCount: 0,
  aspect: "original",
  resizePreset: "480",
  filterId: "none",
  filterIntensity: 1,
  paletteSize: 256,
  dither: false,
  captions: [],
};

const SPEED_PRESETS = [0.25, 0.5, 1, 1.5, 2, 4];
const PALETTE_SIZES = [16, 32, 64, 128, 256];
const ASPECT_PRESETS: { id: GifCropAspect; label: string; ratio?: number }[] = [
  { id: "original", label: "Original" },
  { id: "1:1", label: "1:1 Square", ratio: 1 },
  { id: "4:5", label: "4:5 Portrait", ratio: 4 / 5 },
  { id: "16:9", label: "16:9 Landscape", ratio: 16 / 9 },
  { id: "9:16", label: "9:16 Story", ratio: 9 / 16 },
];

export function GifMaker() {
  // Loaded raw frames
  const [sourceFrames, setSourceFrames] = useState<DecodedFrame[]>([]);
  const [sourceWidth, setSourceWidth] = useState(480);
  const [sourceHeight, setSourceHeight] = useState(360);
  const [sourceType, setSourceType] = useState<string | null>(null);

  // History management
  const [history, setHistory] = useState<HistoryManager<GifProjectSettings>>(() =>
    initHistory(DEFAULT_SETTINGS),
  );
  const settings = history.present;

  // Zoom & view
  const [zoom, setZoom] = useState(1);
  const [activeTab, setActiveTab] = useState<
    "source" | "timeline" | "crop" | "captions" | "filter" | "quality" | "export"
  >("source");
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentFrameIdx, setCurrentFrameIdx] = useState(0);

  // Loading, progress & error feedback
  const [busy, setBusy] = useState(false);
  const [busyMessage, setBusyMessage] = useState("");
  const [importProgress, setImportProgress] = useState<number | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [fallbackWarning, setFallbackWarning] = useState<string | null>(null);

  // Export progress & abort
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Webcam stream & recording state
  const [webcamActive, setWebcamActive] = useState(false);
  const [webcamCountdown, setWebcamCountdown] = useState<number | null>(null);
  const [webcamRecording, setWebcamRecording] = useState(false);
  const webcamVideoRef = useRef<HTMLVideoElement | null>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);

  // Canvas ref
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const objectUrlsRef = useRef<string[]>([]);

  // Revoke URLs and media streams on unmount
  useEffect(() => {
    const urls = objectUrlsRef.current;
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
      if (webcamStreamRef.current) {
        webcamStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Update settings with history tracking
  const updateSettings = useCallback(
    (patch: Partial<GifProjectSettings>) => {
      setHistory((prev) => recordHistory(prev, { ...prev.present, ...patch }));
    },
    [],
  );

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;
  const handleUndo = () => setHistory((h) => undoHistory(h));
  const handleRedo = () => setHistory((h) => redoHistory(h));

  // Compute effective timeline frames (applying trim, reverse, boomerang)
  const processedFrames = useMemo(() => {
    if (sourceFrames.length === 0) return [];

    const start = Math.max(0, Math.min(settings.trimStart, sourceFrames.length - 1));
    const end = Math.max(start, Math.min(settings.trimEnd || sourceFrames.length - 1, sourceFrames.length - 1));
    let frames = sourceFrames.slice(start, end + 1);

    if (settings.reverse) {
      frames = reverseFrames(frames);
    }
    if (settings.boomerang) {
      frames = buildBoomerangFrames(frames);
    }

    return frames;
  }, [sourceFrames, settings.trimStart, settings.trimEnd, settings.reverse, settings.boomerang]);

  // Compute canvas export dimensions (aspect crop + resize preset)
  const { outWidth, outHeight, cropRect } = useMemo(() => {
    const baseW = sourceWidth;
    const baseH = sourceHeight;

    let sx = 0;
    let sy = 0;
    let sw = baseW;
    let sh = baseH;

    const aspectConfig = ASPECT_PRESETS.find((a) => a.id === settings.aspect);
    if (aspectConfig && aspectConfig.ratio) {
      const targetRatio = aspectConfig.ratio;
      const currentRatio = baseW / baseH;
      if (currentRatio > targetRatio) {
        // Source is wider than target aspect: crop sides
        sw = Math.round(baseH * targetRatio);
        sx = Math.round((baseW - sw) / 2);
      } else {
        // Source is taller than target aspect: crop top/bottom
        sh = Math.round(baseW / targetRatio);
        sy = Math.round((baseH - sh) / 2);
      }
    }

    let targetW = sw;
    let targetH = sh;

    if (settings.resizePreset === "320") {
      targetW = 320;
      targetH = Math.round((320 / sw) * sh);
    } else if (settings.resizePreset === "480") {
      targetW = 480;
      targetH = Math.round((480 / sw) * sh);
    } else if (settings.resizePreset === "640") {
      targetW = 640;
      targetH = Math.round((640 / sw) * sh);
    }

    // Safeguard max bounds
    if (targetW > MAX_CANVAS_DIM || targetH > MAX_CANVAS_DIM) {
      const scale = Math.min(MAX_CANVAS_DIM / targetW, MAX_CANVAS_DIM / targetH);
      targetW = Math.round(targetW * scale);
      targetH = Math.round(targetH * scale);
    }

    // Ensure even dimensions for video / GIF encoders
    targetW = targetW % 2 === 0 ? targetW : targetW - 1;
    targetH = targetH % 2 === 0 ? targetH : targetH - 1;

    return {
      outWidth: Math.max(64, targetW),
      outHeight: Math.max(64, targetH),
      cropRect: { sx, sy, sw, sh },
    };
  }, [sourceWidth, sourceHeight, settings.aspect, settings.resizePreset]);

  // Estimated file size calculation
  const estimatedGifBytes = useMemo(() => {
    return calculateEstimatedGifSize(
      outWidth,
      outHeight,
      processedFrames.length,
      settings.paletteSize,
      settings.dither,
    );
  }, [outWidth, outHeight, processedFrames.length, settings.paletteSize, settings.dither]);

  const isSizeOverThreshold = estimatedGifBytes > 5 * 1024 * 1024; // > 5MB

  // Format bytes for display
  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `~${Math.round(bytes / 1024)} KB`;
    return `~${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Helper to draw a frame onto a target 2D context with crop, resize, filter, and captions
  const renderFrameToContext = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      frame: DecodedFrame,
      frameTimeSec: number,
      targetW: number,
      targetH: number,
    ) => {
      // 1. Draw source ImageData onto an intermediate helper canvas to perform crop & scale
      const helperCanvas = document.createElement("canvas");
      helperCanvas.width = frame.imageData.width;
      helperCanvas.height = frame.imageData.height;
      const helperCtx = helperCanvas.getContext("2d");
      if (!helperCtx) return;

      helperCtx.putImageData(frame.imageData, 0, 0);

      // Draw cropped and scaled image onto main context
      ctx.drawImage(
        helperCanvas,
        cropRect.sx,
        cropRect.sy,
        cropRect.sw,
        cropRect.sh,
        0,
        0,
        targetW,
        targetH,
      );

      // 2. Apply fun filter if active
      if (settings.filterId && settings.filterId !== "none") {
        const frameImgData = ctx.getImageData(0, 0, targetW, targetH);
        applyFunFilter(frameImgData, settings.filterId, {
          timeSec: frameTimeSec,
          intensity: settings.filterIntensity,
        });
        ctx.putImageData(frameImgData, 0, 0);
      }

      // 3. Render caption text overlays
      settings.captions.forEach((cap) => {
        if (!cap.text.trim()) return;

        ctx.save();
        const content = cap.allCaps ? cap.text.toUpperCase() : cap.text;
        const fontSize = Math.max(12, Math.round((cap.fontSize / 480) * targetW));
        ctx.font = `bold ${fontSize}px ${cap.fontFamily}`;
        ctx.textAlign = cap.align;
        ctx.textBaseline = "middle";

        let textX = targetW / 2;
        if (cap.align === "left") textX = targetW * 0.05;
        if (cap.align === "right") textX = targetW * 0.95;

        let textY = targetH * 0.12;
        if (cap.position === "center") textY = targetH * 0.5;
        else if (cap.position === "bottom") textY = targetH * 0.88;
        else if (cap.position === "custom") textY = (targetH * cap.yPercent) / 100;

        if (cap.shadow) {
          ctx.shadowColor = "rgba(0,0,0,0.85)";
          ctx.shadowBlur = Math.max(3, fontSize * 0.15);
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;
        }

        if (cap.strokeWidth > 0 && cap.strokeColor) {
          ctx.lineWidth = Math.max(2, (cap.strokeWidth / 480) * targetW * 2);
          ctx.strokeStyle = cap.strokeColor;
          ctx.lineJoin = "round";
          ctx.lineCap = "round";
          ctx.strokeText(content, textX, textY);
        }

        ctx.fillStyle = cap.fillColor;
        ctx.fillText(content, textX, textY);
        ctx.restore();
      });
    },
    [cropRect, settings.filterId, settings.filterIntensity, settings.captions],
  );

  // Live preview animation loop
  useEffect(() => {
    if (processedFrames.length === 0) return;

    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    canvas.width = outWidth;
    canvas.height = outHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const frameIdx = Math.min(currentFrameIdx, processedFrames.length - 1);
    const frame = processedFrames[frameIdx];
    if (!frame) return;

    const frameDelayMs = calculateFrameDelay(settings.fps, settings.speed);
    const frameTimeSec = (frameIdx * frameDelayMs) / 1000;

    renderFrameToContext(ctx, frame, frameTimeSec, outWidth, outHeight);

    if (!isPlaying) return;

    const timeout = setTimeout(() => {
      setCurrentFrameIdx((prev) => (prev + 1) % processedFrames.length);
    }, frameDelayMs);

    return () => clearTimeout(timeout);
  }, [
    processedFrames,
    currentFrameIdx,
    isPlaying,
    outWidth,
    outHeight,
    settings.fps,
    settings.speed,
    renderFrameToContext,
  ]);

  // Load new frames and initialize project settings
  const handleLoadFrames = (result: {
    frames: DecodedFrame[];
    width: number;
    height: number;
    sourceType: string;
  }) => {
    setSourceFrames(result.frames);
    setSourceWidth(result.width);
    setSourceHeight(result.height);
    setSourceType(result.sourceType);
    setCurrentFrameIdx(0);
    setIsPlaying(true);
    setFallbackWarning(null);
    setErrorBanner(null);

    const initialSettings: GifProjectSettings = {
      ...DEFAULT_SETTINGS,
      trimStart: 0,
      trimEnd: result.frames.length - 1,
    };
    setHistory(initHistory(initialSettings));
    setActiveTab("timeline");
  };

  const handleLoadMediaFile = useCallback(async (file: File) => {
    setBusy(true);
    setBusyMessage("Loading media file…");
    setErrorBanner(null);
    try {
      if (file.type.startsWith("video/")) {
        const result = await extractFramesFromVideo(file, {
          fps: 12,
          maxWidth: 640,
          maxHeight: 640,
          maxFrames: MAX_FRAMES_LIMIT,
        });
        handleLoadFrames(result);
      } else if (file.type === "image/gif") {
        if (isImageDecoderSupported()) {
          const result = await decodeGifWithImageDecoder(file, MAX_FRAMES_LIMIT);
          if (result && result.frames.length > 0) {
            handleLoadFrames(result);
            return;
          }
        }
        const imgResult = await loadImagesAsFrames([file], { maxWidth: 640, maxHeight: 640 });
        handleLoadFrames(imgResult);
      } else {
        const imgResult = await loadImagesAsFrames([file], { maxWidth: 640, maxHeight: 640 });
        handleLoadFrames(imgResult);
      }
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : "Failed to load media file");
    } finally {
      setBusy(false);
    }
  }, []);

  const handleClearMedia = useCallback(() => {
    setSourceFrames([]);
    setSourceType(null);
    setHistory(initHistory(DEFAULT_SETTINGS));
    setActiveTab("source");
  }, []);

  const { isLoadedFromDrop, fileName, isExpired, clearHandoff, dismissExpired } = useToolHandoff({
    onFileLoaded: handleLoadMediaFile,
    onClear: handleClearMedia,
  });

  // 1. Input: Video file upload
  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBusy(true);
    setBusyMessage("Extracting frames from video…");
    setImportProgress(0);
    setErrorBanner(null);

    try {
      const result = await extractFramesFromVideo(file, {
        fps: 12,
        maxWidth: 640,
        maxHeight: 640,
        maxFrames: MAX_FRAMES_LIMIT,
        onProgress: setImportProgress,
      });
      handleLoadFrames(result);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : "Failed to load video file");
    } finally {
      setBusy(false);
      setImportProgress(null);
      e.target.value = "";
    }
  };

  // 2. Input: Image sequence upload
  const handleImageSequenceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setBusy(true);
    setBusyMessage("Loading image sequence…");
    setImportProgress(0);
    setErrorBanner(null);

    try {
      const result = await loadImagesAsFrames(files.slice(0, MAX_FRAMES_LIMIT), {
        maxWidth: 640,
        maxHeight: 640,
        defaultDelay: 120,
        onProgress: setImportProgress,
      });
      handleLoadFrames(result);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : "Failed to load image sequence");
    } finally {
      setBusy(false);
      setImportProgress(null);
      e.target.value = "";
    }
  };

  // 3. Input: Existing GIF upload with ImageDecoder
  const handleGifUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBusy(true);
    setBusyMessage("Decoding GIF frames…");
    setImportProgress(0);
    setErrorBanner(null);
    setFallbackWarning(null);

    try {
      if (!isImageDecoderSupported()) {
        setFallbackWarning(
          "Your browser does not support frame-by-frame GIF decoding (ImageDecoder API). Please upload a video (MP4/WebM), an image sequence, or capture from webcam.",
        );
        setBusy(false);
        return;
      }

      const result = await decodeGifWithImageDecoder(
        file,
        MAX_FRAMES_LIMIT,
        setImportProgress,
      );

      if (!result) {
        setFallbackWarning(
          "Your browser was unable to decode this GIF file. You can upload a video (MP4/WebM), an image sequence, or capture from webcam.",
        );
      } else {
        handleLoadFrames(result);
      }
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : "Failed to decode GIF");
    } finally {
      setBusy(false);
      setImportProgress(null);
      e.target.value = "";
    }
  };

  // 4. Input: Screen-free webcam capture
  const handleStartWebcam = async () => {
    setErrorBanner(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: false,
      });
      webcamStreamRef.current = stream;
      setWebcamActive(true);

      if (webcamVideoRef.current) {
        webcamVideoRef.current.srcObject = stream;
        await webcamVideoRef.current.play();
      }
    } catch (err) {
      setErrorBanner(
        err instanceof Error
          ? err.message
          : "Webcam access denied. Please grant camera permission.",
      );
    }
  };

  const handleStopWebcam = () => {
    if (webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach((t) => t.stop());
      webcamStreamRef.current = null;
    }
    setWebcamActive(false);
    setWebcamRecording(false);
    setWebcamCountdown(null);
  };

  const handleTriggerWebcamCapture = () => {
    setWebcamCountdown(3);
    const interval = setInterval(() => {
      setWebcamCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          startRecordingWebcamFrames();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startRecordingWebcamFrames = () => {
    const video = webcamVideoRef.current;
    if (!video) return;

    setWebcamRecording(true);
    const captured: DecodedFrame[] = [];
    const fps = 12;
    const intervalMs = 1000 / fps;
    const maxRecordFrames = 48; // ~4 seconds at 12 fps

    const captureCanvas = document.createElement("canvas");
    captureCanvas.width = video.videoWidth || 480;
    captureCanvas.height = video.videoHeight || 360;
    const ctx = captureCanvas.getContext("2d");
    if (!ctx) return;

    const recordTimer = setInterval(() => {
      if (captured.length >= maxRecordFrames || !webcamStreamRef.current) {
        clearInterval(recordTimer);
        handleStopWebcam();
        if (captured.length > 0) {
          handleLoadFrames({
            frames: captured,
            width: captureCanvas.width,
            height: captureCanvas.height,
            sourceType: "webcam",
          });
        }
        return;
      }

      ctx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);
      const imgData = ctx.getImageData(0, 0, captureCanvas.width, captureCanvas.height);
      captured.push({
        imageData: imgData,
        delay: intervalMs,
      });
    }, intervalMs);
  };

  // Render all active frames as ImageDatas for export (at target export dimensions & quality)
  const generateExportImageDataFrames = useCallback(
    (scale: ExportScale): ImageData[] => {
      const targetW = Math.round(outWidth * scale);
      const targetH = Math.round(outHeight * scale);

      const offCanvas = document.createElement("canvas");
      offCanvas.width = targetW;
      offCanvas.height = targetH;
      const ctx = offCanvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("Could not create canvas context");

      const delayMs = calculateFrameDelay(settings.fps, settings.speed);
      const rendered: ImageData[] = [];

      for (let i = 0; i < processedFrames.length; i++) {
        ctx.clearRect(0, 0, targetW, targetH);
        const frameTimeSec = (i * delayMs) / 1000;
        renderFrameToContext(ctx, processedFrames[i], frameTimeSec, targetW, targetH);
        rendered.push(ctx.getImageData(0, 0, targetW, targetH));
      }

      return rendered;
    },
    [outWidth, outHeight, processedFrames, settings.fps, settings.speed, renderFrameToContext],
  );

  // Generate GIF or WebM blob for ExportPanel
  const handleGenerateExportBlob = async (
    format: ExportFormat,
    _quality: number,
    scale: ExportScale,
  ): Promise<Blob | null> => {
    if (processedFrames.length === 0) return null;

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    setExportProgress(0);

    try {
      const renderedFrames = generateExportImageDataFrames(scale);
      const targetW = Math.round(outWidth * scale);
      const targetH = Math.round(outHeight * scale);
      const delayMs = calculateFrameDelay(settings.fps, settings.speed);

      if (format === "webm") {
        const webmBlob = await exportFramesToWebM(renderedFrames, settings.fps, {
          onProgress: setExportProgress,
          signal,
        });
        setExportProgress(100);
        return webmBlob;
      }

      // Default: GIF export using Web Worker
      const frameInputs: GifFrameInput[] = renderedFrames.map((f) => ({
        width: targetW,
        height: targetH,
        data: new Uint8Array(f.data.buffer),
        delay: delayMs,
      }));

      const gifBlob = await encodeGifWithWorker(frameInputs, {
        delay: delayMs,
        paletteSize: settings.paletteSize,
        dither: settings.dither,
        loopCount: settings.loopCount,
        onProgress: (_curr, _total, percent) => {
          setExportProgress(percent);
        },
        signal,
      });

      setExportProgress(100);
      return gifBlob;
    } catch (err) {
      if ((err as Error)?.name === "AbortError") {
        return null;
      }
      throw err;
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleCancelExport = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setExportProgress(null);
  };

  // Thumbnail Scrubber Click
  const handleScrubberClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (sourceFrames.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const targetIdx = Math.round(ratio * (sourceFrames.length - 1));
    setCurrentFrameIdx(targetIdx);
  };

  return (
    <ToolShell
      title="GIF Maker"
      badge="Studio Tool"
      description="Create, trim, filter, caption, and export animated GIFs & WebM client-side."
      canUndo={canUndo}
      canRedo={canRedo}
      onUndo={handleUndo}
      onRedo={handleRedo}
      zoom={zoom}
      onZoomIn={() => setZoom((z) => Math.min(2.0, Math.round((z + 0.1) * 10) / 10))}
      onZoomOut={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))}
      onResetZoom={() => setZoom(1)}
      headerActions={
        <div className="flex flex-wrap items-center gap-2">
          {isLoadedFromDrop && (
            <LoadedFromDropChip fileName={fileName} onClear={clearHandoff} />
          )}
          {isExpired && (
            <HandoffExpiredNote onDismiss={dismissExpired} />
          )}
          {sourceFrames.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setActiveTab("export");
                setMobileDrawerOpen(true);
              }}
              className={`${btnPrimary} !min-h-9 !px-3 text-xs font-semibold shadow-[var(--shadow-ember)]`}
            >
              💾 Export GIF / WebM
            </button>
          )}
        </div>
      }
      sidebar={
        <div className="space-y-5" data-testid="gif-maker-sidebar">
          {/* Navigation Tabs */}
          <div className="flex flex-wrap gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-1">
            {(
              [
                { id: "timeline", label: "⏱️ Timeline" },
                { id: "crop", label: "📐 Crop & Size" },
                { id: "captions", label: "💬 Captions" },
                { id: "filter", label: "✨ Filters" },
                { id: "quality", label: "⚙️ Quality" },
                { id: "export", label: "🚀 Export" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`tap-target flex-1 rounded-lg px-2 text-xs font-medium transition ${
                  activeTab === t.id
                    ? "bg-[var(--accent-primary)] font-semibold text-[var(--on-accent)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Change Media Source */}
          {sourceFrames.length > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-2.5 text-xs">
              <span className="text-[var(--text-muted)]">
                Source: <strong className="text-[var(--text-primary)] uppercase">{sourceType}</strong> ({sourceFrames.length} frames)
              </span>
              <button
                type="button"
                onClick={() => setActiveTab("source")}
                className="tap-target font-semibold text-[var(--accent-primary)] hover:underline"
              >
                Change source
              </button>
            </div>
          )}

          {/* TAB 0: SOURCE INPUTS */}
          {activeTab === "source" && (
            <div className="space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                Choose Media Input
              </h2>

              {/* Video upload input */}
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--border-strong)] bg-[var(--surface-base)] p-5 text-center transition hover:border-[var(--accent-primary)] hover:bg-[var(--surface-hover)]">
                <span className="text-2xl">📹</span>
                <span className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                  Upload Video File
                </span>
                <span className="mt-0.5 text-xs text-[var(--text-muted)]">
                  MP4, WebM, or MOV
                </span>
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={handleVideoUpload}
                  className="hidden"
                />
              </label>

              {/* Image sequence multi-select */}
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--border-strong)] bg-[var(--surface-base)] p-5 text-center transition hover:border-[var(--accent-primary)] hover:bg-[var(--surface-hover)]">
                <span className="text-2xl">🖼️</span>
                <span className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                  Image Sequence
                </span>
                <span className="mt-0.5 text-xs text-[var(--text-muted)]">
                  Select multiple JPG, PNG, or WebP files
                </span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageSequenceUpload}
                  className="hidden"
                />
              </label>

              {/* Existing GIF upload */}
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--border-strong)] bg-[var(--surface-base)] p-5 text-center transition hover:border-[var(--accent-primary)] hover:bg-[var(--surface-hover)]">
                <span className="text-2xl">🎞️</span>
                <span className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                  Import Animated GIF
                </span>
                <span className="mt-0.5 text-xs text-[var(--text-muted)]">
                  Decode and edit an existing GIF
                </span>
                <input
                  type="file"
                  accept="image/gif"
                  onChange={handleGifUpload}
                  className="hidden"
                />
              </label>

              {/* Screen-free Webcam capture */}
              {!webcamActive ? (
                <button
                  type="button"
                  onClick={handleStartWebcam}
                  className={`${btnSecondary} w-full py-3 text-xs font-semibold`}
                >
                  🎥 Record from Webcam
                </button>
              ) : (
                <div className="space-y-3 rounded-2xl border border-[var(--accent-primary)]/50 bg-[var(--surface-base)] p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--accent-primary)]">
                      Webcam Active
                    </span>
                    <button
                      type="button"
                      onClick={handleStopWebcam}
                      className="tap-target text-xs text-[var(--danger)] hover:underline"
                    >
                      Cancel
                    </button>
                  </div>

                  <video
                    ref={webcamVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="aspect-video w-full rounded-xl bg-black object-cover"
                  />

                  {webcamCountdown !== null ? (
                    <div className="text-center font-extrabold text-2xl text-[var(--accent-primary)]">
                      Starting in {webcamCountdown}…
                    </div>
                  ) : webcamRecording ? (
                    <div className="flex items-center justify-center gap-2 text-xs font-bold text-[var(--danger)]">
                      <span className="h-3 w-3 animate-pulse rounded-full bg-[var(--danger)]" />
                      Recording frames…
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleTriggerWebcamCapture}
                      className={`${btnPrimary} w-full text-xs font-semibold`}
                    >
                      ⏺ Record 4-Second Clip
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 1: TIMELINE & TRIM */}
          {activeTab === "timeline" && (
            <div className="space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                Timeline & Playback
              </h2>

              {/* Trim Range Sliders */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-secondary)]">
                  <span>Trim Range</span>
                  <span>
                    Frames {settings.trimStart + 1} – {settings.trimEnd + 1} ({processedFrames.length} total)
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-[var(--text-muted)]">Start Frame</label>
                    <input
                      type="range"
                      min={0}
                      max={Math.max(0, settings.trimEnd - 1)}
                      value={settings.trimStart}
                      onChange={(e) => updateSettings({ trimStart: Number(e.target.value) })}
                      className="mt-1 w-full accent-[var(--accent-primary)]"
                      aria-label="Trim start frame"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-[var(--text-muted)]">End Frame</label>
                    <input
                      type="range"
                      min={Math.min(settings.trimStart + 1, sourceFrames.length - 1)}
                      max={sourceFrames.length - 1}
                      value={settings.trimEnd}
                      onChange={(e) => updateSettings({ trimEnd: Number(e.target.value) })}
                      className="mt-1 w-full accent-[var(--accent-primary)]"
                      aria-label="Trim end frame"
                    />
                  </div>
                </div>
              </div>

              {/* Speed Presets */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                  Speed ({settings.speed}x)
                </label>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {SPEED_PRESETS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => updateSettings({ speed: s })}
                      className={`tap-target flex-1 rounded-lg px-2 text-xs font-bold transition ${
                        settings.speed === s
                          ? "bg-[var(--accent-primary)] text-[var(--on-accent)]"
                          : "border border-[var(--border-strong)] bg-[var(--surface-base)] text-[var(--text-secondary)]"
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>

              {/* FPS Slider */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-secondary)]">
                  <span>Frame Rate</span>
                  <span>{settings.fps} FPS</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={30}
                  step={1}
                  value={settings.fps}
                  onChange={(e) => updateSettings({ fps: Number(e.target.value) })}
                  className="mt-1.5 w-full accent-[var(--accent-primary)]"
                  aria-label="Frame rate"
                />
              </div>

              {/* Reverse & Boomerang Toggles */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => updateSettings({ reverse: !settings.reverse })}
                  className={`tap-target flex items-center justify-center gap-1.5 rounded-xl border text-xs font-bold transition ${
                    settings.reverse
                      ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
                      : "border-[var(--border-strong)] bg-[var(--surface-base)] text-[var(--text-secondary)]"
                  }`}
                  aria-label="Toggle reverse"
                >
                  <span>⏪ Reverse</span>
                  <span>{settings.reverse ? "ON" : "OFF"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => updateSettings({ boomerang: !settings.boomerang })}
                  className={`tap-target flex items-center justify-center gap-1.5 rounded-xl border text-xs font-bold transition ${
                    settings.boomerang
                      ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
                      : "border-[var(--border-strong)] bg-[var(--surface-base)] text-[var(--text-secondary)]"
                  }`}
                  aria-label="Toggle boomerang"
                >
                  <span>🔁 Boomerang</span>
                  <span>{settings.boomerang ? "ON" : "OFF"}</span>
                </button>
              </div>

              {/* Loop Count */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                  Loop Setting
                </label>
                <select
                  value={settings.loopCount}
                  onChange={(e) => updateSettings({ loopCount: Number(e.target.value) })}
                  className="tap-target mt-1 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface-base)] px-3 text-xs font-medium"
                >
                  <option value={0}>Infinite Loop (Forever)</option>
                  <option value={1}>Play Once (No Loop)</option>
                  <option value={2}>Repeat 2 times</option>
                  <option value={3}>Repeat 3 times</option>
                  <option value={5}>Repeat 5 times</option>
                </select>
              </div>
            </div>
          )}

          {/* TAB 2: CROP & SIZE */}
          {activeTab === "crop" && (
            <div className="space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                Crop & Resolution
              </h2>

              {/* Aspect Ratio Presets */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                  Aspect Ratio
                </label>
                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                  {ASPECT_PRESETS.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => updateSettings({ aspect: a.id })}
                      className={`tap-target rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                        settings.aspect === a.id
                          ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
                          : "border-[var(--border-strong)] bg-[var(--surface-base)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                      }`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Resize Presets */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                  Output Width Preset
                </label>
                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { id: "320", label: "320px (Compact / Emoji)" },
                      { id: "480", label: "480px (Standard Web)" },
                      { id: "640", label: "640px (High Quality)" },
                      { id: "original", label: "Original Resolution" },
                    ] as const
                  ).map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => updateSettings({ resizePreset: r.id })}
                      className={`tap-target rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                        settings.resizePreset === r.id
                          ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
                          : "border-[var(--border-strong)] bg-[var(--surface-base)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dimensions Summary */}
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3 text-xs">
                <span className="text-[var(--text-muted)]">Render Dimensions: </span>
                <strong className="text-[var(--text-primary)]">
                  {outWidth} × {outHeight} px
                </strong>
              </div>
            </div>
          )}

          {/* TAB 3: CAPTIONS & TEXT OVERLAYS */}
          {activeTab === "captions" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Text Captions
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    const newCap: CaptionOverlay = {
                      id: `cap-${Date.now()}`,
                      text: "MEME CAPTION",
                      position: settings.captions.length === 0 ? "top" : "bottom",
                      yPercent: 12,
                      fontFamily: MEME_FONTS[0].stack,
                      fontSize: 36,
                      align: "center",
                      allCaps: true,
                      fillColor: "#ffffff",
                      strokeColor: "#000000",
                      strokeWidth: 3,
                      shadow: true,
                    };
                    updateSettings({ captions: [...settings.captions, newCap] });
                  }}
                  className={`${btnSecondary} !min-h-8 !px-2.5 text-xs font-bold`}
                >
                  + Add Caption
                </button>
              </div>

              {settings.captions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--border-subtle)] p-6 text-center text-xs text-[var(--text-muted)]">
                  No text overlays yet. Click &quot;+ Add Caption&quot; to overlay meme captions, labels, or titles.
                </div>
              ) : (
                <div className="space-y-3">
                  {settings.captions.map((cap, idx) => (
                    <div
                      key={cap.id}
                      className="space-y-2.5 rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-base)] p-3"
                    >
                      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-1.5">
                        <span className="text-xs font-bold text-[var(--accent-primary)]">
                          Caption #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            updateSettings({
                              captions: settings.captions.filter((c) => c.id !== cap.id),
                            });
                          }}
                          className="tap-target text-xs text-[var(--danger)] hover:underline"
                        >
                          Remove
                        </button>
                      </div>

                      {/* Text string input */}
                      <div>
                        <input
                          type="text"
                          value={cap.text}
                          onChange={(e) => {
                            const updated = settings.captions.map((c) =>
                              c.id === cap.id ? { ...c, text: e.target.value } : c,
                            );
                            updateSettings({ captions: updated });
                          }}
                          className="tap-target w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface-raised)] px-2.5 text-xs text-[var(--text-primary)]"
                          placeholder="Type caption text…"
                          aria-label={`Caption ${idx + 1} text`}
                        />
                      </div>

                      {/* Position & Style Controls */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[11px] text-[var(--text-muted)]">Position</label>
                          <select
                            value={cap.position}
                            onChange={(e) => {
                              const pos = e.target.value as "top" | "center" | "bottom";
                              const updated = settings.captions.map((c) =>
                                c.id === cap.id ? { ...c, position: pos } : c,
                              );
                              updateSettings({ captions: updated });
                            }}
                            className="tap-target mt-0.5 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 text-xs"
                          >
                            <option value="top">Top</option>
                            <option value="center">Center</option>
                            <option value="bottom">Bottom</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] text-[var(--text-muted)]">Font</label>
                          <select
                            value={cap.fontFamily}
                            onChange={(e) => {
                              const updated = settings.captions.map((c) =>
                                c.id === cap.id ? { ...c, fontFamily: e.target.value } : c,
                              );
                              updateSettings({ captions: updated });
                            }}
                            className="tap-target mt-0.5 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 text-xs"
                          >
                            {MEME_FONTS.map((f) => (
                              <option key={f.id} value={f.stack}>
                                {f.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Font Size & Color */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                            <span>Font Size</span>
                            <span>{cap.fontSize}px</span>
                          </div>
                          <input
                            type="range"
                            min={16}
                            max={72}
                            value={cap.fontSize}
                            onChange={(e) => {
                              const updated = settings.captions.map((c) =>
                                c.id === cap.id ? { ...c, fontSize: Number(e.target.value) } : c,
                              );
                              updateSettings({ captions: updated });
                            }}
                            className="mt-1 w-full accent-[var(--accent-primary)]"
                            aria-label={`Caption ${idx + 1} font size`}
                          />
                        </div>

                        <div className="flex items-center gap-2 pt-3">
                          <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                            <input
                              type="color"
                              value={cap.fillColor}
                              onChange={(e) => {
                                const updated = settings.captions.map((c) =>
                                  c.id === cap.id ? { ...c, fillColor: e.target.value } : c,
                                );
                                updateSettings({ captions: updated });
                              }}
                              className="h-7 w-7 rounded border border-[var(--border-strong)] bg-transparent p-0.5"
                              aria-label={`Caption ${idx + 1} color`}
                            />
                            <span>Color</span>
                          </label>

                          <label className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                            <input
                              type="checkbox"
                              checked={cap.allCaps}
                              onChange={(e) => {
                                const updated = settings.captions.map((c) =>
                                  c.id === cap.id ? { ...c, allCaps: e.target.checked } : c,
                                );
                                updateSettings({ captions: updated });
                              }}
                              className="rounded accent-[var(--accent-primary)]"
                            />
                            <span>Caps</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: FUN FILTERS */}
          {activeTab === "filter" && (
            <div className="space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                imbrgr Fun Filters
              </h2>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => updateSettings({ filterId: "none" })}
                  className={`tap-target flex flex-col items-center justify-center rounded-xl border p-2 text-center transition ${
                    settings.filterId === "none"
                      ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/15 font-bold text-[var(--accent-primary)]"
                      : "border-[var(--border-subtle)] bg-[var(--surface-base)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                  }`}
                >
                  <span className="text-lg">🚫</span>
                  <span className="mt-1 text-xs">No Filter</span>
                </button>

                {FUN_FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => updateSettings({ filterId: f.id })}
                    className={`tap-target flex flex-col items-center justify-center rounded-xl border p-2 text-center transition ${
                      settings.filterId === f.id
                        ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/15 font-bold text-[var(--accent-primary)]"
                        : "border-[var(--border-subtle)] bg-[var(--surface-base)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                    }`}
                  >
                    <span className="text-lg">{f.emoji}</span>
                    <span className="mt-1 text-xs">{f.label}</span>
                  </button>
                ))}
              </div>

              {settings.filterId !== "none" && (
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-secondary)]">
                    <span>Filter Intensity</span>
                    <span>{Math.round(settings.filterIntensity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={settings.filterIntensity}
                    onChange={(e) => updateSettings({ filterIntensity: Number(e.target.value) })}
                    className="mt-1.5 w-full accent-[var(--accent-primary)]"
                    aria-label="Filter intensity"
                  />
                </div>
              )}
            </div>
          )}

          {/* TAB 5: QUALITY & OPTIMIZATION */}
          {activeTab === "quality" && (
            <div className="space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                GIF Palette & Dithering
              </h2>

              {/* Palette Size */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                  Palette Colors ({settings.paletteSize})
                </label>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {PALETTE_SIZES.map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => updateSettings({ paletteSize: size })}
                      className={`tap-target flex-1 rounded-lg px-2 text-xs font-bold transition ${
                        settings.paletteSize === size
                          ? "bg-[var(--accent-primary)] text-[var(--on-accent)]"
                          : "border border-[var(--border-strong)] bg-[var(--surface-base)] text-[var(--text-secondary)]"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dithering Option */}
              <div className="pt-1">
                <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                  Dithering
                </label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => updateSettings({ dither: false })}
                    className={`tap-target rounded-xl border px-3 py-2 text-xs font-bold transition ${
                      !settings.dither
                        ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
                        : "border-[var(--border-strong)] bg-[var(--surface-base)] text-[var(--text-secondary)]"
                    }`}
                  >
                    None (Crisper / Smaller)
                  </button>

                  <button
                    type="button"
                    onClick={() => updateSettings({ dither: "floyd-steinberg" })}
                    className={`tap-target rounded-xl border px-3 py-2 text-xs font-bold transition ${
                      settings.dither
                        ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
                        : "border-[var(--border-strong)] bg-[var(--surface-base)] text-[var(--text-secondary)]"
                    }`}
                  >
                    Floyd-Steinberg (Smooth)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: EXPORT */}
          {activeTab === "export" && (
            <div className="space-y-4">
              <ExportPanel
                canvasWidth={outWidth}
                canvasHeight={outHeight}
                onGenerateBlob={handleGenerateExportBlob}
                allowedFormats={["gif", "webm"]}
                initialFormat="gif"
                defaultTitle="My GIF Creation"
                autoTag="gif"
                customFilePrefix="imbrgr-gif"
                estimatedBytesOverride={estimatedGifBytes}
                progressPercent={exportProgress}
                onCancel={handleCancelExport}
              />
            </div>
          )}
        </div>
      }
      mobileToolbar={
        <div className="flex items-center justify-around py-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab("timeline");
              setMobileDrawerOpen(true);
            }}
            className="tap-target flex flex-col items-center text-[10px] font-semibold text-[var(--text-secondary)]"
          >
            <span className="text-base">⏱️</span>
            <span>Trim</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("crop");
              setMobileDrawerOpen(true);
            }}
            className="tap-target flex flex-col items-center text-[10px] font-semibold text-[var(--text-secondary)]"
          >
            <span className="text-base">📐</span>
            <span>Crop</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("captions");
              setMobileDrawerOpen(true);
            }}
            className="tap-target flex flex-col items-center text-[10px] font-semibold text-[var(--text-secondary)]"
          >
            <span className="text-base">💬</span>
            <span>Text</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("filter");
              setMobileDrawerOpen(true);
            }}
            className="tap-target flex flex-col items-center text-[10px] font-semibold text-[var(--text-secondary)]"
          >
            <span className="text-base">✨</span>
            <span>Filter</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("export");
              setMobileDrawerOpen(true);
            }}
            className="tap-target flex flex-col items-center text-[10px] font-bold text-[var(--accent-primary)]"
          >
            <span className="text-base">💾</span>
            <span>Export</span>
          </button>
        </div>
      }
      isMobileDrawerOpen={mobileDrawerOpen}
      onCloseMobileDrawer={() => setMobileDrawerOpen(false)}
      mobileDrawerTitle={
        activeTab === "timeline"
          ? "Timeline Options"
          : activeTab === "crop"
            ? "Crop & Resize"
            : activeTab === "captions"
              ? "Captions"
              : activeTab === "filter"
                ? "Fun Filters"
                : activeTab === "quality"
                  ? "Quality & Palette"
                  : activeTab === "export"
                    ? "Export GIF"
                    : "Media Source"
      }
      mobileDrawerContent={
        <div className="space-y-4">
          {activeTab === "export" ? (
            <ExportPanel
              canvasWidth={outWidth}
              canvasHeight={outHeight}
              onGenerateBlob={handleGenerateExportBlob}
              allowedFormats={["gif", "webm"]}
              initialFormat="gif"
              defaultTitle="My GIF Creation"
              autoTag="gif"
              customFilePrefix="imbrgr-gif"
              estimatedBytesOverride={estimatedGifBytes}
              progressPercent={exportProgress}
              onCancel={handleCancelExport}
            />
          ) : (
            <p className="text-xs text-[var(--text-secondary)]">
              Use the desktop panel or controls to adjust {activeTab} settings.
            </p>
          )}
        </div>
      }
    >
      {/* MAIN STAGE (Center Canvas) */}
      <div className="flex w-full flex-col items-center justify-center space-y-4">
        {/* Error / Fallback Banners */}
        {errorBanner && (
          <div className="w-full max-w-xl rounded-xl border border-[var(--danger)]/50 bg-[var(--danger)]/10 p-3 text-xs text-[var(--danger)]">
            {errorBanner}
          </div>
        )}

        {fallbackWarning && (
          <div className="w-full max-w-xl rounded-xl border border-[var(--accent-amber)]/50 bg-[var(--accent-amber)]/10 p-3 text-xs text-[var(--accent-amber)]">
            ⚠️ {fallbackWarning}
          </div>
        )}

        {/* Loading Spinner during Import */}
        {busy && (
          <div className="flex flex-col items-center justify-center space-y-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-8">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent-primary)] border-t-transparent" />
            <p className="text-xs font-semibold text-[var(--text-primary)]">{busyMessage}</p>
            {importProgress !== null && (
              <span className="font-mono text-xs text-[var(--accent-primary)]">{importProgress}%</span>
            )}
          </div>
        )}

        {/* When No Source Media Loaded: Welcome Drag & Drop Zone */}
        {!busy && sourceFrames.length === 0 && (
          <div className="flex w-full max-w-2xl flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--border-subtle)] bg-[var(--surface-raised)]/60 p-8 text-center sm:p-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent-primary)]/10 text-3xl">
              🎞️
            </div>
            <h2 className="mt-4 text-xl font-bold tracking-tight">imbrgr GIF Maker</h2>
            <p className="mt-1.5 max-w-md text-xs leading-relaxed text-[var(--text-secondary)] sm:text-sm">
              Convert videos, photo burst sequences, or webcam recordings into crisp, lightweight animated GIFs and WebM clips.
            </p>

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <label className={`${btnPrimary} cursor-pointer text-xs font-semibold`}>
                📹 Upload Video
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={handleVideoUpload}
                  className="hidden"
                />
              </label>

              <label className={`${btnSecondary} cursor-pointer text-xs font-semibold`}>
                🖼️ Image Sequence
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageSequenceUpload}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={handleStartWebcam}
                className={`${btnSecondary} text-xs font-semibold`}
              >
                🎥 Webcam
              </button>

              <label className={`${btnSecondary} cursor-pointer text-xs font-semibold`}>
                🎞️ Import GIF
                <input
                  type="file"
                  accept="image/gif"
                  onChange={handleGifUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        )}

        {/* When Media is Loaded: Live Canvas Stage */}
        {sourceFrames.length > 0 && !busy && (
          <div className="flex w-full flex-col items-center space-y-3">
            {/* Size Warning & 1-Click Suggestions */}
            {isSizeOverThreshold && (
              <div
                className="flex w-full max-w-xl flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--accent-amber)]/60 bg-[var(--accent-amber)]/10 px-3.5 py-2 text-xs text-[var(--text-primary)]"
                data-testid="gif-size-warning"
              >
                <span>
                  ⚠️ Estimated GIF is <strong>{formatBytes(estimatedGifBytes)}</strong>. Large GIFs load slowly on mobile.
                </span>
                <div className="flex items-center gap-1.5">
                  {settings.resizePreset !== "320" && (
                    <button
                      type="button"
                      onClick={() => updateSettings({ resizePreset: "320" })}
                      className="tap-target rounded-lg bg-[var(--surface-raised)] border border-[var(--border-subtle)] px-2 py-0.5 text-[11px] font-bold text-[var(--accent-primary)] hover:bg-[var(--surface-hover)]"
                    >
                      ⚡ 320px
                    </button>
                  )}
                  {settings.fps > 10 && (
                    <button
                      type="button"
                      onClick={() => updateSettings({ fps: 10 })}
                      className="tap-target rounded-lg bg-[var(--surface-raised)] border border-[var(--border-subtle)] px-2 py-0.5 text-[11px] font-bold text-[var(--accent-primary)] hover:bg-[var(--surface-hover)]"
                    >
                      ⚡ 10 FPS
                    </button>
                  )}
                  {settings.paletteSize > 128 && (
                    <button
                      type="button"
                      onClick={() => updateSettings({ paletteSize: 128 })}
                      className="tap-target rounded-lg bg-[var(--surface-raised)] border border-[var(--border-subtle)] px-2 py-0.5 text-[11px] font-bold text-[var(--accent-primary)] hover:bg-[var(--surface-hover)]"
                    >
                      ⚡ 128 colors
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Live Canvas */}
            <div
              className="relative flex items-center justify-center overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-black shadow-2xl transition-all"
              style={{
                maxWidth: "100%",
                maxHeight: "65vh",
              }}
            >
              <canvas
                ref={previewCanvasRef}
                className="max-h-[60vh] max-w-full object-contain"
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: "center center",
                }}
              />
            </div>

            {/* Transport & Playback Bar */}
            <div className="flex w-full max-w-xl flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3">
              {/* Thumbnail Timeline Strip */}
              <div
                className="relative h-10 w-full cursor-pointer overflow-hidden rounded-xl bg-black/40"
                onClick={handleScrubberClick}
                title="Click timeline to scrub frame"
              >
                {/* Visual playhead */}
                {processedFrames.length > 0 && (
                  <div
                    className="absolute top-0 bottom-0 w-1 bg-[var(--accent-primary)] shadow-md transition-all duration-75"
                    style={{
                      left: `${(currentFrameIdx / Math.max(1, processedFrames.length - 1)) * 100}%`,
                    }}
                  />
                )}
              </div>

              {/* Scrubber controls */}
              <div className="mt-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsPlaying((p) => !p)}
                    className="tap-target inline-flex !min-h-9 !min-w-9 items-center justify-center rounded-xl bg-[var(--accent-primary)] text-sm font-bold text-[var(--on-accent)] shadow-[var(--shadow-ember)]"
                    aria-label={isPlaying ? "Pause animation" : "Play animation"}
                  >
                    {isPlaying ? "⏸" : "▶"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      setCurrentFrameIdx((prev) =>
                        prev <= 0 ? processedFrames.length - 1 : prev - 1,
                      );
                    }}
                    className="tap-target inline-flex !min-h-9 !min-w-9 items-center justify-center rounded-xl border border-[var(--border-subtle)] hover:bg-[var(--surface-hover)]"
                    title="Previous frame"
                    aria-label="Previous frame"
                  >
                    ⏮
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      setCurrentFrameIdx((prev) => (prev + 1) % processedFrames.length);
                    }}
                    className="tap-target inline-flex !min-h-9 !min-w-9 items-center justify-center rounded-xl border border-[var(--border-subtle)] hover:bg-[var(--surface-hover)]"
                    title="Next frame"
                    aria-label="Next frame"
                  >
                    ⏭
                  </button>
                </div>

                {/* Status Chips */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-md bg-[var(--surface-sunken)] px-2 py-0.5 font-mono text-[var(--text-muted)]">
                    Frame {currentFrameIdx + 1} / {processedFrames.length}
                  </span>
                  <span className="rounded-md bg-[var(--surface-sunken)] px-2 py-0.5 font-mono text-[var(--text-muted)]">
                    {outWidth} × {outHeight} px
                  </span>
                  <span className="rounded-md bg-[var(--surface-sunken)] px-2 py-0.5 font-bold text-[var(--accent-primary)]">
                    {formatBytes(estimatedGifBytes)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ToolShell>
  );
}
