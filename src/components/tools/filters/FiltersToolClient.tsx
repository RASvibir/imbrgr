"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { btnPrimary, btnSecondary, btnGhost } from "@/lib/ui/button-classes";
import { useToolHandoff } from "@/lib/landing/use-tool-handoff";
import { LoadedFromDropChip, HandoffExpiredNote } from "@/components/landing/HandoffNotice";
import { ShareLinks } from "@/components/share/ShareLinks";
import {
  FILTER_CATEGORIES,
  UNIFIED_FILTERS,
  getFilterItem,
  type FilterCategory,
  type UnifiedFilterItem,
} from "@/lib/filter-registry";
import {
  applyFilterStack,
  createFilterLayer,
  DEFAULT_SAMPLE_SVG,
  MAX_FILTER_STACK,
  pickRecorderMime,
  renderComparisonFrame,
  type FilterStackLayer,
} from "@/lib/tools/filters-engine";

export function FiltersToolClient() {
  const { data: session } = useSession();

  // Media Source State: 'image' or 'video'
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [mediaSrc, setMediaSrc] = useState<string>(DEFAULT_SAMPLE_SVG);
  const [sourceName, setSourceName] = useState<string>("imbrgr-sample");
  const [sourceWidth, setSourceWidth] = useState<number>(800);
  const [sourceHeight, setSourceHeight] = useState<number>(600);

  // Video playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);

  // Filter Stacking (up to 3)
  const [stack, setStack] = useState<FilterStackLayer[]>([
    createFilterLayer("cinematic-teal-orange", 0.85),
  ]);
  const [selectedLayerIndex, setSelectedLayerIndex] = useState<number>(0);

  // History for Undo / Redo
  const [history, setHistory] = useState<FilterStackLayer[][]>([
    [createFilterLayer("cinematic-teal-orange", 0.85)],
  ]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // UI States
  const [selectedCategory, setSelectedCategory] = useState<FilterCategory>("all");
  const [compareSplit, setCompareSplit] = useState<number>(100); // 0 = Before (original), 100 = After (filtered)
  const [isHoldingCompare, setIsHoldingCompare] = useState<boolean>(false);
  const [filterSearch, setFilterSearch] = useState<string>("");

  // Live Thumbnails cache
  const [filterThumbs, setFilterThumbs] = useState<Record<string, string>>({});

  // Export State
  const [exportFormat] = useState<"png" | "jpeg" | "webp">("png");
  const [exportQuality] = useState<number>(92);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [statusToast, setStatusToast] = useState<string | null>(null);

  // Gallery Publish Modal / Panel
  const [showGalleryModal, setShowGalleryModal] = useState<boolean>(false);
  const [postTitle, setPostTitle] = useState<string>("Filtered Aesthetic");
  const [postTags, setPostTags] = useState<string>("filters, aesthetics");
  const [postVisibility, setPostVisibility] = useState<"PUBLIC" | "UNLISTED" | "PRIVATE">("PUBLIC");
  const [postMature, setPostMature] = useState<boolean>(false);
  const [publishedShortId, setPublishedShortId] = useState<string | null>(null);
  const [sharePayload, setSharePayload] = useState<{
    pageUrl: string;
    directUrl: string;
    markdown: string;
    html: string;
    bbcode: string;
  } | null>(null);

  // Canvas Refs
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenOriginalRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenFilteredRef = useRef<HTMLCanvasElement | null>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const imageElementRef = useRef<HTMLImageElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isDraggingSplitRef = useRef<boolean>(false);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);

  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const showToast = useCallback((msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setStatusToast(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setStatusToast(null);
    }, 4000);
  }, []);

  // Commit changes to history
  const commitStack = useCallback(
    (newStack: FilterStackLayer[]) => {
      setStack(newStack);
      const nextHistory = history.slice(0, historyIndex + 1);
      nextHistory.push(newStack.map((l) => ({ ...l })));
      setHistory(nextHistory);
      setHistoryIndex(nextHistory.length - 1);
    },
    [history, historyIndex],
  );

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const handleUndo = useCallback(() => {
    if (!canUndo) return;
    const nextIdx = historyIndex - 1;
    setHistoryIndex(nextIdx);
    setStack(history[nextIdx].map((l) => ({ ...l })));
  }, [canUndo, historyIndex, history]);

  const handleRedo = useCallback(() => {
    if (!canRedo) return;
    const nextIdx = historyIndex + 1;
    setHistoryIndex(nextIdx);
    setStack(history[nextIdx].map((l) => ({ ...l })));
  }, [canRedo, historyIndex, history]);

  // Generate thumbnail rail swatches (40x40)
  const generateThumbnails = useCallback((source: CanvasImageSource) => {
    try {
      const c = document.createElement("canvas");
      c.width = 44;
      c.height = 44;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(source, 0, 0, 44, 44);
      const baseData = ctx.getImageData(0, 0, 44, 44);

      const thumbs: Record<string, string> = {};
      for (const f of UNIFIED_FILTERS) {
        if (f.id === "none") {
          thumbs[f.id] = c.toDataURL("image/jpeg", 0.6);
          continue;
        }
        const copy = new ImageData(new Uint8ClampedArray(baseData.data), 44, 44);
        f.apply(copy, 0, 1);
        ctx.putImageData(copy, 0, 0);
        thumbs[f.id] = c.toDataURL("image/jpeg", 0.6);
      }
      setFilterThumbs(thumbs);
    } catch {
      /* fallback to emoji */
    }
  }, []);

  // Frame Rendering Loop (downscaled preview for responsive 60fps)
  const renderCurrentFrame = useCallback(() => {
    const previewCanvas = previewCanvasRef.current;
    if (!previewCanvas) return;
    const ctx = previewCanvas.getContext("2d");
    if (!ctx) return;

    // Determine preview dimensions (max 720px width/height for fast response)
    const maxDim = 720;
    const scale = Math.min(1, maxDim / Math.max(sourceWidth || 1, sourceHeight || 1));
    const pw = Math.max(1, Math.round((sourceWidth || 800) * scale));
    const ph = Math.max(1, Math.round((sourceHeight || 600) * scale));

    if (previewCanvas.width !== pw || previewCanvas.height !== ph) {
      previewCanvas.width = pw;
      previewCanvas.height = ph;
    }

    // 1. Prepare original buffer
    let originalCanvas = offscreenOriginalRef.current;
    if (!originalCanvas) {
      originalCanvas = document.createElement("canvas");
      offscreenOriginalRef.current = originalCanvas;
    }
    if (originalCanvas.width !== pw || originalCanvas.height !== ph) {
      originalCanvas.width = pw;
      originalCanvas.height = ph;
    }
    const origCtx = originalCanvas.getContext("2d", { willReadFrequently: true });
    if (!origCtx) return;

    if (mediaType === "video" && videoElementRef.current) {
      origCtx.drawImage(videoElementRef.current, 0, 0, pw, ph);
    } else if (imageElementRef.current) {
      origCtx.drawImage(imageElementRef.current, 0, 0, pw, ph);
    }

    // 2. Prepare filtered buffer
    let filteredCanvas = offscreenFilteredRef.current;
    if (!filteredCanvas) {
      filteredCanvas = document.createElement("canvas");
      offscreenFilteredRef.current = filteredCanvas;
    }
    if (filteredCanvas.width !== pw || filteredCanvas.height !== ph) {
      filteredCanvas.width = pw;
      filteredCanvas.height = ph;
    }
    const filtCtx = filteredCanvas.getContext("2d", { willReadFrequently: true });
    if (!filtCtx) return;

    const imgData = origCtx.getImageData(0, 0, pw, ph);
    const timeSec =
      mediaType === "video" && videoElementRef.current
        ? videoElementRef.current.currentTime
        : 0;

    // Apply the active stack
    applyFilterStack(imgData, stack, timeSec);
    filtCtx.putImageData(imgData, 0, 0);

    // 3. Render comparison split
    const effectiveSplit = isHoldingCompare ? 0 : compareSplit;
    renderComparisonFrame(ctx, originalCanvas, filteredCanvas, effectiveSplit, true);
  }, [sourceWidth, sourceHeight, mediaType, stack, compareSplit, isHoldingCompare]);

  // Keyboard shortcuts for Undo/Redo & Compare
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (modifier && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndo();
      } else if (
        (modifier && e.shiftKey && e.key.toLowerCase() === "z") ||
        (modifier && e.key.toLowerCase() === "y")
      ) {
        e.preventDefault();
        handleRedo();
      } else if (e.code === "Space" && mediaType === "video") {
        e.preventDefault();
        const vid = videoElementRef.current;
        if (vid) {
          if (vid.paused) {
            void vid.play().catch(() => {});
            setIsPlaying(true);
          } else {
            vid.pause();
            setIsPlaying(false);
          }
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleUndo, handleRedo, mediaType]);

  // Handle media source loading
  useEffect(() => {
    if (mediaType === "image") {
      const img = new Image();
      if (mediaSrc.startsWith("http://") || mediaSrc.startsWith("https://")) {
        img.crossOrigin = "anonymous";
      }
      img.src = mediaSrc;
      img.onload = () => {
        imageElementRef.current = img;
        const w = img.naturalWidth || 800;
        const h = img.naturalHeight || 600;
        setSourceWidth(w);
        setSourceHeight(h);
        renderCurrentFrame();
        generateThumbnails(img);
      };
    } else {
      const vid = document.createElement("video");
      if (mediaSrc.startsWith("http://") || mediaSrc.startsWith("https://")) {
        vid.crossOrigin = "anonymous";
      }
      vid.src = mediaSrc;
      vid.muted = true;
      vid.loop = true;
      vid.playsInline = true;
      videoElementRef.current = vid;

      vid.onloadedmetadata = () => {
        setSourceWidth(vid.videoWidth || 640);
        setSourceHeight(vid.videoHeight || 360);
        setVideoDuration(vid.duration || 0);
        vid.currentTime = 0;
      };

      vid.onseeked = () => {
        renderCurrentFrame();
      };
    }
  }, [mediaSrc, mediaType, renderCurrentFrame, generateThumbnails]);

  // Re-render when stack or compare changes
  useEffect(() => {
    renderCurrentFrame();
  }, [renderCurrentFrame]);

  // Video Playback Animation Frame Loop
  useEffect(() => {
    if (mediaType !== "video" || !isPlaying) return;

    let active = true;
    const loop = () => {
      if (!active) return;
      const vid = videoElementRef.current;
      if (vid && !vid.paused && !vid.ended) {
        setCurrentTime(vid.currentTime);
        renderCurrentFrame();
      }
      animationFrameRef.current = requestAnimationFrame(loop);
    };

    animationFrameRef.current = requestAnimationFrame(loop);
    return () => {
      active = false;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [mediaType, isPlaying, renderCurrentFrame]);

  const togglePlay = () => {
    const vid = videoElementRef.current;
    if (!vid) return;
    if (vid.paused) {
      void vid.play();
      setIsPlaying(true);
    } else {
      vid.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (newTime: number) => {
    const vid = videoElementRef.current;
    if (!vid) return;
    vid.currentTime = Math.max(0, Math.min(videoDuration, newTime));
    setCurrentTime(vid.currentTime);
    renderCurrentFrame();
  };

  // Upload Handling
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith("video/");
    const url = URL.createObjectURL(file);
    setMediaType(isVideo ? "video" : "image");
    setMediaSrc(url);
    setSourceName(file.name.replace(/\.[^/.]+$/, ""));
    setIsPlaying(false);
    showToast(`Loaded ${isVideo ? "video" : "photo"}: ${file.name}`);
  };

  // Handoff integration from landing
  const handleLoadMediaFile = useCallback((file: File) => {
    const isVideo = file.type.startsWith("video/");
    const url = URL.createObjectURL(file);
    setMediaType(isVideo ? "video" : "image");
    setMediaSrc(url);
    setSourceName(file.name.replace(/\.[^/.]+$/, ""));
    setIsPlaying(false);
    showToast(`Loaded ${isVideo ? "video" : "photo"}: ${file.name}`);
  }, [showToast]);

  const handleClearMedia = useCallback(() => {
    setMediaType("image");
    setMediaSrc(DEFAULT_SAMPLE_SVG);
    setSourceName("imbrgr-sample");
    setIsPlaying(false);
  }, []);

  const { isLoadedFromDrop, fileName, isExpired, clearHandoff, dismissExpired } = useToolHandoff({
    onFileLoaded: handleLoadMediaFile,
    onClear: handleClearMedia,
  });

  // Stack Layer Management
  const addLayer = (filterId: string) => {
    if (stack.length >= MAX_FILTER_STACK) {
      showToast(`Maximum ${MAX_FILTER_STACK} filter layers stacked.`);
      return;
    }
    const newLayer = createFilterLayer(filterId, 1);
    const nextStack = [...stack, newLayer];
    commitStack(nextStack);
    setSelectedLayerIndex(nextStack.length - 1);
    showToast(`Added filter layer: ${getFilterItem(filterId)?.label ?? filterId}`);
  };

  const updateSelectedLayerFilter = (filterId: string) => {
    if (stack.length === 0) {
      addLayer(filterId);
      return;
    }
    const next = [...stack];
    next[selectedLayerIndex] = {
      ...next[selectedLayerIndex],
      filterId,
    };
    commitStack(next);
  };

  const updateSelectedLayerIntensity = (intensity: number) => {
    if (!stack[selectedLayerIndex]) return;
    const next = [...stack];
    next[selectedLayerIndex] = {
      ...next[selectedLayerIndex],
      intensity: Math.max(0, Math.min(1, intensity)),
    };
    // Update live state without spamming undo history
    setStack(next);
  };

  const commitLayerIntensity = () => {
    commitStack([...stack]);
  };

  const toggleLayerEnabled = (idx: number) => {
    const next = [...stack];
    next[idx] = { ...next[idx], enabled: !next[idx].enabled };
    commitStack(next);
  };

  const removeLayer = (idx: number) => {
    if (stack.length <= 1) {
      // Don't leave empty, set to Original ("none")
      const next = [createFilterLayer("none", 1)];
      commitStack(next);
      setSelectedLayerIndex(0);
      return;
    }
    const next = stack.filter((_, i) => i !== idx);
    commitStack(next);
    setSelectedLayerIndex(Math.max(0, idx - 1));
  };

  const moveLayer = (idx: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= stack.length) return;
    const next = [...stack];
    const temp = next[idx];
    next[idx] = next[targetIdx];
    next[targetIdx] = temp;
    commitStack(next);
    setSelectedLayerIndex(targetIdx);
  };

  // Drag comparison split divider
  const handlePointerDownSplit = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingSplitRef.current = true;
    updateSplitFromPointer(e.clientX);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMoveSplit = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingSplitRef.current) return;
    updateSplitFromPointer(e.clientX);
  };

  const handlePointerUpSplit = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingSplitRef.current) {
      isDraggingSplitRef.current = false;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
  };

  const updateSplitFromPointer = (clientX: number) => {
    const container = splitContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const ratio = Math.round((x / rect.width) * 100);
    setCompareSplit(ratio);
  };

  // Full-Resolution Rendering for Image Export
  const renderFullResImageBlob = async (): Promise<Blob> => {
    const fullCanvas = document.createElement("canvas");
    fullCanvas.width = sourceWidth || 800;
    fullCanvas.height = sourceHeight || 600;
    const ctx = fullCanvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Could not initialize full-res canvas context.");

    if (imageElementRef.current && imageElementRef.current.complete) {
      ctx.drawImage(imageElementRef.current, 0, 0, fullCanvas.width, fullCanvas.height);
    } else if (previewCanvasRef.current) {
      ctx.drawImage(previewCanvasRef.current, 0, 0, fullCanvas.width, fullCanvas.height);
    } else if (videoElementRef.current) {
      ctx.drawImage(videoElementRef.current, 0, 0, fullCanvas.width, fullCanvas.height);
    }

    try {
      const fullData = ctx.getImageData(0, 0, fullCanvas.width, fullCanvas.height);
      applyFilterStack(fullData, stack, 0);
      ctx.putImageData(fullData, 0, 0);
    } catch {
      /* ignore if canvas pixel access is restricted */
    }

    const mime =
      exportFormat === "jpeg"
        ? "image/jpeg"
        : exportFormat === "webp"
        ? "image/webp"
        : "image/png";

    return new Promise((resolve) => {
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          try {
            const dataUrl = fullCanvas.toDataURL(mime, exportQuality / 100);
            const byteString = atob(dataUrl.split(",")[1]);
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) {
              ia[i] = byteString.charCodeAt(i);
            }
            resolve(new Blob([ab], { type: mime }));
          } catch {
            resolve(new Blob(["filters-export"], { type: mime }));
          }
        }
      }, 500);

      try {
        fullCanvas.toBlob(
          (b) => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              resolve(b || new Blob(["filters-export"], { type: mime }));
            }
          },
          mime,
          exportQuality / 100,
        );
      } catch {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve(new Blob(["filters-export"], { type: mime }));
        }
      }
    });
  };

  // Video Export Pipeline using MediaRecorder
  const renderVideoExportBlob = async (): Promise<Blob> => {
    const vid = videoElementRef.current;
    if (!vid) throw new Error("No video loaded for export.");

    const mime = pickRecorderMime();
    if (!mime) throw new Error("MediaRecorder not supported for video export.");

    const exportW = sourceWidth;
    const exportH = sourceHeight;

    const canvas = document.createElement("canvas");
    canvas.width = exportW;
    canvas.height = exportH;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Failed to create export canvas.");

    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    setIsExporting(true);
    setExportProgress(0);
    recorder.start();

    const fps = 30;
    const totalFrames = Math.max(1, Math.round((videoDuration || 2) * fps));
    const frameIntervalSec = 1 / fps;

    for (let f = 0; f < totalFrames; f++) {
      const seekTime = f * frameIntervalSec;
      vid.currentTime = seekTime;
      await new Promise<void>((resolve) => {
        const onSeek = () => {
          vid.removeEventListener("seeked", onSeek);
          resolve();
        };
        vid.addEventListener("seeked", onSeek);
      });

      ctx.drawImage(vid, 0, 0, exportW, exportH);
      const frameData = ctx.getImageData(0, 0, exportW, exportH);
      applyFilterStack(frameData, stack, seekTime);
      ctx.putImageData(frameData, 0, 0);

      setExportProgress(Math.round(((f + 1) / totalFrames) * 100));
    }

    return new Promise((resolve) => {
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mime });
        setIsExporting(false);
        resolve(blob);
      };
      recorder.stop();
    });
  };

  // 1. Direct Download
  const handleDownload = async () => {
    try {
      setIsExporting(true);
      if (mediaType === "video") {
        const blob = await renderVideoExportBlob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${sourceName}-filtered.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const blob = await renderFullResImageBlob();
        const ext = exportFormat === "jpeg" ? "jpg" : exportFormat;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${sourceName}-filtered.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      showToast(`Downloaded Photo Filters creation!`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Download failed.");
    } finally {
      setIsExporting(false);
    }
  };

  // 2. Save to Signed-in Library
  const handleSaveToLibrary = async () => {
    if (!session?.user) {
      showToast("Sign in to save directly to your library.");
      return;
    }

    try {
      setIsExporting(true);
      showToast("Saving to your personal library…");
      let blob: Blob;
      let filename: string;
      if (mediaType === "video") {
        blob = await renderVideoExportBlob();
        filename = `${sourceName}-filtered.webm`;
      } else {
        blob = await renderFullResImageBlob();
        const ext = exportFormat === "jpeg" ? "jpg" : exportFormat;
        filename = `${sourceName}-filtered.${ext}`;
      }

      const file = new File([blob], filename, { type: blob.type });
      const formData = new FormData();
      formData.set("file", file);
      formData.set("visibility", "PRIVATE");
      formData.set("keepOriginal", "true");
      formData.set("mature", String(postMature));

      const res = await fetch("/api/studio/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed.");

      showToast("Saved to your imbrgr library!");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Library save failed.");
    } finally {
      setIsExporting(false);
    }
  };

  // 3. Post to Public / Unlisted Gallery
  const handlePublishToGallery = async () => {
    try {
      setIsExporting(true);
      showToast("Publishing to imbrgr gallery…");
      let blob: Blob;
      let filename: string;
      if (mediaType === "video") {
        blob = await renderVideoExportBlob();
        filename = `${sourceName}-filtered.webm`;
      } else {
        blob = await renderFullResImageBlob();
        const ext = exportFormat === "jpeg" ? "jpg" : exportFormat;
        filename = `${sourceName}-filtered.${ext}`;
      }

      const file = new File([blob], filename, { type: blob.type });
      const effectiveVisibility =
        postMature && postVisibility === "PUBLIC" ? "UNLISTED" : postVisibility;

      const tagsArray = postTags
        .split(/[,\s#]+/)
        .map((t) => t.trim())
        .filter(Boolean);
      if (!tagsArray.includes("filters")) tagsArray.push("filters");

      const formData = new FormData();
      formData.append("files", file);
      formData.append("title", postTitle.trim() || `${sourceName} Filtered`);
      formData.append("tags", tagsArray.join(", "));
      formData.append("visibility", effectiveVisibility);
      formData.append("mature", String(postMature));

      const res = await fetch("/api/posts", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.shortId) {
        throw new Error(data.error || "Failed to publish post.");
      }

      const shortId = data.shortId;
      setPublishedShortId(shortId);

      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const page = `${origin}/p/${shortId}`;
      setSharePayload({
        pageUrl: page,
        directUrl: page,
        markdown: `![${postTitle}](${page})`,
        html: `<a href="${page}"><img src="${page}" alt="${postTitle}"/></a>`,
        bbcode: `[url=${page}][img]${page}[/img][/url]`,
      });

      showToast("Published to imbrgr gallery!");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Gallery post failed.");
    } finally {
      setIsExporting(false);
    }
  };

  // Filter items in the thumbnail rail based on category and search
  const visibleFilterItems = useMemo(() => {
    return UNIFIED_FILTERS.filter((f) => {
      if (selectedCategory !== "all" && f.category !== selectedCategory) {
        return false;
      }
      if (filterSearch.trim()) {
        const q = filterSearch.toLowerCase();
        return (
          f.label.toLowerCase().includes(q) ||
          f.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [selectedCategory, filterSearch]);

  const activeLayer = stack[selectedLayerIndex] || stack[0];

  return (
    <div
      className="flex min-h-[calc(100dvh-4rem)] flex-col bg-[var(--surface-base)] text-[var(--text-primary)]"
      data-testid="tool-shell"
    >
      {/* Header Bar */}
      <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)]/95 px-4 py-2.5 backdrop-blur-md sm:px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/tools"
            className="tap-target inline-flex items-center rounded-lg px-2 text-sm text-[var(--text-muted)] transition hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            aria-label="Back to Tools index"
          >
            ← <span className="ml-1 hidden sm:inline">Back to Tools</span>
          </Link>
          <div className="h-4 w-px bg-[var(--border-subtle)]" />
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold sm:text-lg" data-testid="tool-title">
              Photo Filters & Video Looks
            </h1>
            <span className="rounded-full border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10 px-2 py-0.5 text-xs font-semibold text-[var(--accent-primary)]">
              🎨 26+ Presets
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isLoadedFromDrop && (
            <LoadedFromDropChip fileName={fileName} onClear={clearHandoff} />
          )}
          {isExpired && (
            <HandoffExpiredNote onDismiss={dismissExpired} />
          )}

          {/* Undo / Redo */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleUndo}
              disabled={!canUndo}
              className="tap-target inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-sm transition hover:bg-[var(--surface-hover)] disabled:opacity-40"
              title="Undo (Ctrl/Cmd+Z)"
              aria-label="Undo"
            >
              ↩
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={!canRedo}
              className="tap-target inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-sm transition hover:bg-[var(--surface-hover)] disabled:opacity-40"
              title="Redo (Ctrl/Cmd+Shift+Z)"
              aria-label="Redo"
            >
              ↪
            </button>
          </div>

          <div className="h-4 w-px bg-[var(--border-subtle)]" />

          {/* Action buttons matching testIDs */}
          <button
            type="button"
            data-testid="tool-download-btn"
            disabled={isExporting}
            onClick={handleDownload}
            className={`${btnPrimary} min-h-9 px-3.5 text-xs font-semibold`}
          >
            {isExporting ? `Exporting ${exportProgress}%…` : "💾 Download"}
          </button>

          <button
            type="button"
            data-testid="tool-save-btn"
            disabled={isExporting}
            onClick={handleSaveToLibrary}
            className={`${btnSecondary} min-h-9 px-3 text-xs`}
          >
            📁 Save to Library
          </button>

          <button
            type="button"
            data-testid="tool-post-btn"
            disabled={isExporting}
            onClick={() => setShowGalleryModal(true)}
            className={`${btnSecondary} min-h-9 px-3 text-xs`}
          >
            🚀 Post to Gallery
          </button>
        </div>
      </header>

      {/* Status Toast */}
      {statusToast && (
        <aside
          role="status"
          aria-live="polite"
          data-testid="tool-status-toast"
          className="fixed bottom-6 right-6 z-50 flex max-w-sm items-center gap-2 rounded-xl border border-[var(--accent-primary)]/40 bg-[var(--surface-raised)] px-4 py-3 text-sm font-medium text-[var(--text-primary)] shadow-2xl backdrop-blur-md"
        >
          <span className="text-base text-[var(--accent-primary)]">✨</span>
          <span className="flex-1">{statusToast}</span>
          <button
            type="button"
            onClick={() => setStatusToast(null)}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            aria-label="Dismiss toast"
          >
            ✕
          </button>
        </aside>
      )}

      {/* Main Workspace */}
      <div className="flex flex-1 flex-col lg:flex-row" data-testid="tool-workspace">
        {/* Left Area: Viewport Canvas & Before/After Controls */}
        <main className="flex flex-1 flex-col items-center justify-center p-4 lg:p-6">
          <div className="w-full max-w-4xl space-y-3">
            {/* Top Toolbar: Upload Button & Hold Compare */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="media-file-input"
                />
                <label
                  htmlFor="media-file-input"
                  className={`${btnSecondary} cursor-pointer min-h-9 px-3 text-xs font-semibold`}
                >
                  📁 Upload Photo or Video
                </label>

                {mediaType === "video" ? (
                  <span className="rounded-md bg-[var(--accent-primary)]/10 px-2 py-1 text-[11px] font-semibold text-[var(--accent-primary)]">
                    🎥 Video Mode ({videoDuration.toFixed(1)}s)
                  </span>
                ) : (
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {sourceWidth} × {sourceHeight} px
                  </span>
                )}
              </div>

              {/* Hold Compare Button */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={`tap-target min-h-9 rounded-xl border px-3 text-xs font-semibold transition ${
                    isHoldingCompare
                      ? "border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--on-accent)]"
                      : "border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                  }`}
                  onPointerDown={() => setIsHoldingCompare(true)}
                  onPointerUp={() => setIsHoldingCompare(false)}
                  onPointerLeave={() => setIsHoldingCompare(false)}
                  title="Hold to preview original unfiltered media"
                >
                  👁️ Hold Compare (Original)
                </button>
              </div>
            </div>

            {/* Canvas Container with Split Comparison Interaction */}
            <div
              ref={splitContainerRef}
              className="relative aspect-video w-full overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] shadow-inner touch-none flex items-center justify-center select-none"
              onPointerDown={handlePointerDownSplit}
              onPointerMove={handlePointerMoveSplit}
              onPointerUp={handlePointerUpSplit}
              onPointerCancel={handlePointerUpSplit}
            >
              <canvas
                ref={previewCanvasRef}
                className="max-h-[55vh] w-full object-contain"
                aria-label="Filtered media preview canvas"
              />

              {/* Split Overlay Badges */}
              {compareSplit > 5 && compareSplit < 95 && (
                <>
                  <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
                    Before
                  </div>
                  <div className="pointer-events-none absolute right-3 top-3 rounded-md bg-[var(--accent-primary)]/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--on-accent)] backdrop-blur-sm">
                    After
                  </div>
                </>
              )}
            </div>

            {/* Split Comparison Range Slider */}
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-semibold text-[var(--text-muted)]">Before / After Split:</span>
                <div className="flex flex-1 items-center gap-2">
                  <span className="text-[11px] text-[var(--text-muted)]">Original</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={compareSplit}
                    onChange={(e) => setCompareSplit(Number(e.target.value))}
                    className="flex-1"
                    aria-label="Before and after split slider"
                  />
                  <span className="text-[11px] font-semibold text-[var(--accent-primary)]">
                    Filtered
                  </span>
                </div>
                <span className="w-8 text-right font-mono text-xs">{compareSplit}%</span>
              </div>
            </div>

            {/* Video Timeline Scrubber (only visible for video) */}
            {mediaType === "video" && (
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={togglePlay}
                    className={`${btnPrimary} min-h-8 px-3 text-xs font-bold`}
                  >
                    {isPlaying ? "⏸️ Pause" : "▶️ Play Video"}
                  </button>
                  <span className="font-mono text-xs text-[var(--text-muted)]">
                    {currentTime.toFixed(2)}s / {videoDuration.toFixed(2)}s
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={videoDuration || 1}
                  step={0.033}
                  value={currentTime}
                  onChange={(e) => handleSeek(Number(e.target.value))}
                  className="w-full"
                  aria-label="Video scrubber"
                />
              </div>
            )}
          </div>
        </main>

        {/* Right Sidebar: Stack Inspector & Preset Picker */}
        <aside className="w-full border-t border-[var(--border-subtle)] bg-[var(--surface-raised)]/60 p-4 backdrop-blur-md lg:w-96 lg:border-l lg:border-t-0 lg:p-5 flex flex-col gap-4">
          {/* Stacking Section: Up to 3 Filters */}
          <div className="space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3.5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Active Filter Stack ({stack.length}/{MAX_FILTER_STACK})
                </h2>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  Combine up to 3 looks for unique aesthetic blends
                </p>
              </div>

              {stack.length < MAX_FILTER_STACK && (
                <button
                  type="button"
                  onClick={() => addLayer("film-grain")}
                  className="tap-target rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-2.5 py-1 text-xs font-semibold text-[var(--accent-primary)] hover:bg-[var(--surface-hover)]"
                >
                  + Add Layer
                </button>
              )}
            </div>

            {/* Stack Layers List */}
            <div className="space-y-2">
              {stack.map((layer, index) => {
                const item = getFilterItem(layer.filterId);
                const isSelected = selectedLayerIndex === index;

                return (
                  <div
                    key={layer.id}
                    onClick={() => setSelectedLayerIndex(index)}
                    className={`cursor-pointer rounded-xl border p-2.5 transition ${
                      isSelected
                        ? "border-[var(--accent-primary)] bg-[var(--surface-base)] shadow-sm"
                        : "border-[var(--border-subtle)] bg-[var(--surface-sunken)] opacity-85 hover:opacity-100"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm">{item?.emoji ?? "🎨"}</span>
                        <div className="min-w-0">
                          <span className="truncate text-xs font-semibold text-[var(--text-primary)]">
                            {item?.label ?? layer.filterId}
                          </span>
                          <span className="ml-1.5 text-[10px] text-[var(--text-muted)]">
                            ({Math.round(layer.intensity * 100)}%)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => toggleLayerEnabled(index)}
                          className={`tap-target h-7 w-7 rounded border border-[var(--border-subtle)] text-xs ${
                            layer.enabled ? "text-[var(--accent-primary)]" : "text-[var(--text-muted)]"
                          }`}
                          title={layer.enabled ? "Disable layer" : "Enable layer"}
                        >
                          {layer.enabled ? "👁️" : "🕶️"}
                        </button>
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => moveLayer(index, "up")}
                          className="tap-target h-7 w-7 rounded border border-[var(--border-subtle)] text-xs disabled:opacity-30"
                          title="Move up"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={index === stack.length - 1}
                          onClick={() => moveLayer(index, "down")}
                          className="tap-target h-7 w-7 rounded border border-[var(--border-subtle)] text-xs disabled:opacity-30"
                          title="Move down"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => removeLayer(index)}
                          className="tap-target h-7 w-7 rounded border border-[var(--border-subtle)] text-xs text-[var(--danger)] hover:bg-red-500/10"
                          title="Remove layer"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {/* Active Layer Intensity Slider */}
                    {isSelected && (
                      <div className="mt-2.5 border-t border-[var(--border-subtle)] pt-2 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[var(--text-muted)]">Layer Intensity:</span>
                          <span className="font-mono text-[10px] text-[var(--accent-primary)]">
                            {Math.round(layer.intensity * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.01}
                          value={layer.intensity}
                          onChange={(e) => updateSelectedLayerIntensity(Number(e.target.value))}
                          onPointerUp={commitLayerIntensity}
                          onTouchEnd={commitLayerIntensity}
                          className="w-full"
                          aria-label="Layer intensity"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Preset Picker Rail & Categories */}
          <div className="flex-1 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Browse Preset Looks
              </h3>
              <input
                type="search"
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                placeholder="Search presets…"
                className="w-32 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-2 py-0.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
              />
            </div>

            {/* Category Scroll Strip */}
            <div className="flex gap-1 overflow-x-auto pb-1 text-xs chip-scroll">
              {FILTER_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`tap-target shrink-0 rounded-lg px-2.5 py-1 transition ${
                    selectedCategory === cat.id
                      ? "bg-[var(--accent-primary)] text-[var(--on-accent)] font-semibold shadow-sm"
                      : "border border-[var(--border-subtle)] bg-[var(--surface-sunken)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Presets Grid Rail with Live Thumbnails */}
            <div className="grid grid-cols-2 gap-2 max-h-[36vh] overflow-y-auto pr-1">
              {visibleFilterItems.map((preset: UnifiedFilterItem) => {
                const isCurrentLayerPreset = activeLayer?.filterId === preset.id;
                const thumb = filterThumbs[preset.id];

                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => updateSelectedLayerFilter(preset.id)}
                    className={`tap-target flex flex-col items-start rounded-xl border p-2 text-left transition ${
                      isCurrentLayerPreset
                        ? "border-[var(--accent-primary)] bg-[var(--surface-base)] shadow-sm"
                        : "border-[var(--border-subtle)] bg-[var(--surface-sunken)] opacity-90 hover:opacity-100 hover:border-[var(--border-strong)]"
                    }`}
                  >
                    <div className="relative mb-1.5 h-14 w-full overflow-hidden rounded-lg bg-black/40">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xl">
                          {preset.emoji}
                        </div>
                      )}
                      {preset.animated && (
                        <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 text-[9px] font-bold text-amber-300">
                          ⚡ Motion
                        </span>
                      )}
                    </div>

                    <div className="w-full">
                      <div className="flex items-center gap-1 font-semibold text-xs text-[var(--text-primary)]">
                        <span>{preset.emoji}</span>
                        <span className="truncate">{preset.label}</span>
                      </div>
                      <p className="line-clamp-2 mt-0.5 text-[10px] text-[var(--text-muted)] leading-tight">
                        {preset.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>
      </div>

      {/* Gallery Publish Modal */}
      {showGalleryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <h3 className="text-base font-bold">Publish to imbrgr Gallery</h3>
              <button
                type="button"
                onClick={() => setShowGalleryModal(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div>
                <label className="font-semibold block text-[var(--text-muted)] mb-1">
                  Creation Title
                </label>
                <input
                  type="text"
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                  placeholder="Give your filtered work a title…"
                />
              </div>

              <div>
                <label className="font-semibold block text-[var(--text-muted)] mb-1">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={postTags}
                  onChange={(e) => setPostTags(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                  placeholder="filters, aesthetic, vaporwave"
                />
              </div>

              <div>
                <label className="font-semibold block text-[var(--text-muted)] mb-1">
                  Visibility
                </label>
                <select
                  value={postVisibility}
                  onChange={(e) =>
                    setPostVisibility(
                      e.target.value as "PUBLIC" | "UNLISTED" | "PRIVATE",
                    )
                  }
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                >
                  <option value="PUBLIC">Public (Featured in gallery)</option>
                  <option value="UNLISTED">Unlisted (Accessible by link)</option>
                  <option value="PRIVATE">Private (Only you)</option>
                </select>
              </div>

              {/* Mature/NSFW clamp: mature defaults to false and clamps public to unlisted */}
              <label className="flex items-center gap-2 text-xs text-[var(--text-muted)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={postMature}
                  onChange={(e) => setPostMature(e.target.checked)}
                  className="rounded border-[var(--border-strong)]"
                />
                <span>Contains mature / sensitive content (never reaches public gallery)</span>
              </label>

              {sharePayload ? (
                <div className="mt-4 border-t border-[var(--border-subtle)] pt-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[var(--success)]">
                    <span>✅ Published successfully!</span>
                    <Link
                      href={`/p/${publishedShortId}`}
                      className="underline hover:text-[var(--accent-primary)]"
                    >
                      View Post
                    </Link>
                  </div>
                  <ShareLinks share={sharePayload} title={postTitle} visibility={postVisibility} />
                </div>
              ) : (
                <div className="mt-6 flex justify-end gap-3 border-t border-[var(--border-subtle)] pt-4">
                  <button
                    type="button"
                    onClick={() => setShowGalleryModal(false)}
                    className={`${btnGhost} min-h-9 px-4 text-xs`}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isExporting}
                    onClick={handlePublishToGallery}
                    className={`${btnPrimary} min-h-9 px-4 text-xs font-bold`}
                  >
                    {isExporting ? `Rendering ${exportProgress}%…` : "Publish Now"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
