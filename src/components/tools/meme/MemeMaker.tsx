"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ToolShell } from "@/components/tools/ToolShell";
import { LayerList } from "@/components/tools/LayerList";
import { ExportPanel, type ExportFormat, type ExportScale } from "@/components/tools/ExportPanel";
import { TemplateStrip } from "./TemplateStrip";
import { LayerPropertyPanel } from "./LayerPropertyPanel";
import {
  calculateCanvasDimensions,
  createDefaultMemeState,
  createLayerId,
  getHandleAtPoint,
  hitTestLayers,
  initHistory,
  recordHistory,
  redoHistory,
  undoHistory,
  renderMemeCanvas,
  renderSelectionOverlay,
  addLayer,
  updateLayer,
  removeLayer,
  reorderLayer,
  duplicateLayer,
  toggleLockLayer,
  toggleHideLayer,
  type HandleType,
  type MemeAspect,
  type MemeCanvasState,
  type MemeLayer,
  type MemeTextLayer,
  type MemeStickerLayer,
  type MemeShapeLayer,
} from "@/lib/tools/meme-render";
import type { MemeTemplate } from "@/lib/tools/meme-templates";
import { btnPrimary, btnSecondary } from "@/lib/ui/button-classes";
import { useToolHandoff } from "@/lib/landing/use-tool-handoff";
import { LoadedFromDropChip, HandoffExpiredNote } from "@/components/landing/HandoffNotice";

type MobileTab = "templates" | "text" | "stickers" | "aspect" | "layers" | "properties" | "export" | null;

export function MemeMaker() {
  // History state for undo/redo
  const [history, setHistory] = useState(() => initHistory(createDefaultMemeState()));
  const state = history.present;

  // Zoom level for canvas stage
  const [zoom, setZoom] = useState<number>(1);

  // Active tab in desktop sidebar or mobile drawer
  const [sidebarTab, setSidebarTab] = useState<"edit" | "templates" | "layers" | "export">("edit");
  const [mobileTab, setMobileTab] = useState<MobileTab>(null);

  // Drag and drop visual feedback
  const [isDragOver, setIsDragOver] = useState(false);

  // Image element cache for canvas rendering
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Pointer interaction state
  const interactionRef = useRef<{
    isDragging: boolean;
    handle: HandleType;
    startX: number;
    startY: number;
    layerStartX: number;
    layerStartY: number;
    layerStartW: number;
    layerStartH: number;
    layerStartRot: number;
    layerStartScale: number;
  } | null>(null);

  // Selected layer reference
  const selectedLayer = state.layers.find((l) => l.id === state.selectedLayerId) || null;

  // Helper to commit state change to undo/redo history
  const commitState = useCallback((nextState: MemeCanvasState) => {
    setHistory((prev) => recordHistory(prev, nextState));
  }, []);

  // Pre-load template/layer images into cache
  const ensureImageLoaded = useCallback((src: string, onLoaded?: () => void) => {
    if (!src || imageCacheRef.current.has(src)) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageCacheRef.current.set(src, img);
      onLoaded?.();
    };
    img.src = src;
  }, []);

  // Render canvas whenever state, selection, or zoom changes
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set physical dimensions
    if (canvas.width !== state.width || canvas.height !== state.height) {
      canvas.width = state.width;
      canvas.height = state.height;
    }

    // 1. Draw layers
    renderMemeCanvas(ctx, state, imageCacheRef.current);

    // 2. Draw active layer selection handles
    if (selectedLayer && !selectedLayer.locked && selectedLayer.visible) {
      renderSelectionOverlay(ctx, selectedLayer);
    }
  }, [state, selectedLayer]);

  // Trigger render on state updates and pre-load images
  useEffect(() => {
    for (const l of state.layers) {
      if (l.type === "image" && l.src) {
        ensureImageLoaded(l.src, renderCanvas);
      }
    }
    renderCanvas();
  }, [state, renderCanvas, ensureImageLoaded]);

  // Handle template selection
  const handleSelectTemplate = (template: MemeTemplate) => {
    const { width, height } = calculateCanvasDimensions(800, 800, template.aspect, 800);
    const layers: MemeLayer[] = [
      {
        id: createLayerId("bg-template"),
        type: "image",
        name: `${template.name} Format`,
        x: width / 2,
        y: height / 2,
        width,
        height,
        rotation: 0,
        scale: 1,
        opacity: 1,
        locked: true,
        visible: true,
        src: template.svgDataUrl,
        originalWidth: width,
        originalHeight: height,
        isBackground: true,
      },
      ...template.defaultLayers,
    ];

    const nextState: MemeCanvasState = {
      width,
      height,
      aspectRatio: template.aspect,
      backgroundColor: "#141210",
      layers,
      selectedLayerId: template.defaultLayers[0]?.id || null,
    };

    ensureImageLoaded(template.svgDataUrl, () => renderCanvas());
    commitState(nextState);
    setSidebarTab("edit");
    setMobileTab(null);
  };

  // Handle uploaded image or GIF frame
  const handleUploadImage = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const origW = img.naturalWidth || 800;
      const origH = img.naturalHeight || 800;
      const { width, height } = calculateCanvasDimensions(origW, origH, "original", 800);

      // Create new meme state preserving top/bottom text on top of the image
      const bgLayer: MemeLayer = {
        id: createLayerId("user-image"),
        type: "image",
        name: file.name.slice(0, 20),
        x: width / 2,
        y: height / 2,
        width,
        height,
        rotation: 0,
        scale: 1,
        opacity: 1,
        locked: true,
        visible: true,
        src: url,
        originalWidth: origW,
        originalHeight: origH,
        isBackground: true,
      };

      // Keep existing non-background layers or use defaults
      const textLayers = state.layers.filter((l) => l.type !== "image" || !l.isBackground);
      const nextLayers =
        textLayers.length > 0
          ? [bgLayer, ...textLayers]
          : createDefaultMemeState({ imageSrc: url, imgWidth: origW, imgHeight: origH }).layers;

      imageCacheRef.current.set(url, img);
      const nextState: MemeCanvasState = {
        width,
        height,
        aspectRatio: "original",
        backgroundColor: "#141210",
        layers: nextLayers,
        selectedLayerId: nextLayers[1]?.id || nextLayers[0]?.id || null,
      };

      commitState(nextState);
      renderCanvas();
    };
    img.src = url;
  }, [state, commitState, renderCanvas]);

  // Handoff integration from landing
  const { isLoadedFromDrop, fileName, isExpired, clearHandoff, dismissExpired } = useToolHandoff({
    onFileLoaded: (file) => {
      handleUploadImage(file);
    },
    onClear: () => {
      commitState(createDefaultMemeState());
    },
  });

  // Clipboard paste listener
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Don't intercept if user is typing text in an input
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            handleUploadImage(file);
            break;
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [state, handleUploadImage]);

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      handleUploadImage(file);
    }
  };

  // Aspect ratio switch
  const handleAspectChange = (aspect: MemeAspect) => {
    const { width, height } = calculateCanvasDimensions(state.width, state.height, aspect, 800);
    const scaleX = width / state.width;
    const scaleY = height / state.height;

    // Proportionally adjust layers
    const nextLayers = state.layers.map((l) => ({
      ...l,
      x: l.x * scaleX,
      y: l.y * scaleY,
      width: l.type === "image" && l.isBackground ? width : l.width,
      height: l.type === "image" && l.isBackground ? height : l.height,
    }));

    commitState({
      ...state,
      width,
      height,
      aspectRatio: aspect,
      layers: nextLayers,
    });
  };

  // Layer manipulation actions
  const handleAddText = () => {
    const newText: MemeTextLayer = {
      id: createLayerId("text"),
      type: "text",
      name: "New Caption",
      x: state.width / 2,
      y: state.height / 2,
      width: Math.min(600, state.width - 40),
      height: 70,
      rotation: 0,
      scale: 1,
      opacity: 1,
      locked: false,
      visible: true,
      text: "CAPTION HERE",
      fontFamily: 'Impact, "Arial Black", sans-serif',
      fontSize: 44,
      fillColor: "#ffffff",
      strokeColor: "#000000",
      strokeWidth: 4,
      shadow: true,
      shadowColor: "rgba(0,0,0,0.8)",
      shadowBlur: 4,
      shadowOffsetX: 2,
      shadowOffsetY: 2,
      align: "center",
      allCaps: true,
      lineHeight: 1.15,
    };

    commitState(addLayer(state, newText));
    setSidebarTab("edit");
    setMobileTab("properties");
  };

  const handleAddSticker = (emoji: string) => {
    const size = 120;
    const newSticker: MemeStickerLayer = {
      id: createLayerId("sticker"),
      type: "sticker",
      name: `${emoji} Sticker`,
      x: state.width / 2,
      y: state.height / 2,
      width: size,
      height: size,
      rotation: 0,
      scale: 1,
      opacity: 1,
      locked: false,
      visible: true,
      emoji,
    };

    commitState(addLayer(state, newSticker));
    setSidebarTab("edit");
    setMobileTab("properties");
  };

  const handleAddShape = (shape: MemeShapeLayer["shape"]) => {
    const newShape: MemeShapeLayer = {
      id: createLayerId("shape"),
      type: "shape",
      name: `${shape} shape`,
      x: state.width / 2,
      y: state.height / 2,
      width: 240,
      height: shape === "speech-bubble" ? 160 : 160,
      rotation: 0,
      scale: 1,
      opacity: 1,
      locked: false,
      visible: true,
      shape,
      fillColor: shape === "speech-bubble" ? "#ffffff" : "transparent",
      strokeColor: "#f97316",
      strokeWidth: 6,
    };

    commitState(addLayer(state, newShape));
    setSidebarTab("edit");
    setMobileTab("properties");
  };

  // Layer property update
  const handleUpdateActiveLayer = (patch: Partial<MemeLayer>) => {
    if (!selectedLayer) return;
    const nextState = updateLayer(state, selectedLayer.id, patch);
    setHistory((prev) => ({
      ...prev,
      present: nextState,
    }));
  };

  // Convert pointer event coordinate to canvas space
  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { cx: 0, cy: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;
    return { cx, cy };
  };

  // Interactive Pointer Events (Direct Manipulation)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { cx, cy } = getCanvasCoords(e);

    // 1. Check if clicking on active layer handles
    let handle: HandleType = null;
    let targetLayer = selectedLayer;

    if (targetLayer && !targetLayer.locked && targetLayer.visible) {
      handle = getHandleAtPoint(cx, cy, targetLayer);
    }

    // 2. If handle not hit on active layer, hit test layer stack
    if (!handle) {
      const hit = hitTestLayers(cx, cy, state.layers);
      if (hit) {
        targetLayer = hit.layer;
        handle = hit.handle;
        setHistory((prev) => ({
          ...prev,
          present: { ...prev.present, selectedLayerId: hit.layer.id },
        }));
      } else {
        // Deselect if clicked outside all layers
        setHistory((prev) => ({
          ...prev,
          present: { ...prev.present, selectedLayerId: null },
        }));
        return;
      }
    }

    if (!targetLayer || !handle) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    interactionRef.current = {
      isDragging: true,
      handle,
      startX: cx,
      startY: cy,
      layerStartX: targetLayer.x,
      layerStartY: targetLayer.y,
      layerStartW: targetLayer.width,
      layerStartH: targetLayer.height,
      layerStartRot: targetLayer.rotation,
      layerStartScale: targetLayer.scale,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { cx, cy } = getCanvasCoords(e);
    const interaction = interactionRef.current;

    if (!interaction || !interaction.isDragging || !selectedLayer) {
      // Dynamic cursor updates
      if (selectedLayer && !selectedLayer.locked && selectedLayer.visible) {
        const h = getHandleAtPoint(cx, cy, selectedLayer);
        const canvas = canvasRef.current;
        if (canvas) {
          if (h === "rot") canvas.style.cursor = "grab";
          else if (h === "tl" || h === "br") canvas.style.cursor = "nwse-resize";
          else if (h === "tr" || h === "bl") canvas.style.cursor = "nesw-resize";
          else if (h === "body") canvas.style.cursor = "move";
          else canvas.style.cursor = "default";
        }
      }
      return;
    }

    const dx = cx - interaction.startX;
    const dy = cy - interaction.startY;

    if (interaction.handle === "body") {
      // Move entire layer
      handleUpdateActiveLayer({
        x: Math.round(interaction.layerStartX + dx),
        y: Math.round(interaction.layerStartY + dy),
      });
    } else if (interaction.handle === "rot") {
      // Rotate around layer center
      const angleRad = Math.atan2(cy - selectedLayer.y, cx - selectedLayer.x);
      let deg = (angleRad * 180) / Math.PI + 90;
      if (deg < 0) deg += 360;
      handleUpdateActiveLayer({
        rotation: Math.round(deg),
      });
    } else if (
      interaction.handle === "tl" ||
      interaction.handle === "tr" ||
      interaction.handle === "bl" ||
      interaction.handle === "br"
    ) {
      // Scale / resize proportionally
      const origDist = Math.hypot(
        interaction.layerStartW / 2,
        interaction.layerStartH / 2,
      );
      const currDist = Math.hypot(
        cx - interaction.layerStartX,
        cy - interaction.layerStartY,
      );
      const scaleMultiplier = Math.max(0.2, currDist / origDist);

      handleUpdateActiveLayer({
        width: Math.round(interaction.layerStartW * scaleMultiplier),
        height: Math.round(interaction.layerStartH * scaleMultiplier),
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (interactionRef.current?.isDragging) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      interactionRef.current = null;
      // Commit final transformed position to history
      commitState(state);
    }
  };

  // Double click layer to inline edit text or switch to property panel
  const handleDoubleClick = () => {
    if (selectedLayer?.type === "text") {
      setSidebarTab("edit");
      setMobileTab("properties");
    }
  };

  // Export render generator
  const handleGenerateBlob = async (
    format: ExportFormat,
    quality: number,
    scale: ExportScale,
  ): Promise<Blob | null> => {
    const offscreen = document.createElement("canvas");
    offscreen.width = Math.round(state.width * scale);
    offscreen.height = Math.round(state.height * scale);
    const ctx = offscreen.getContext("2d");
    if (!ctx) return null;

    ctx.save();
    ctx.scale(scale, scale);
    // Render layers without selection handles
    renderMemeCanvas(ctx, state, imageCacheRef.current);
    ctx.restore();

    const mime = format === "jpeg" ? "image/jpeg" : format === "webp" ? "image/webp" : "image/png";
    const q = format === "png" ? undefined : quality / 100;

    return new Promise((resolve) => {
      offscreen.toBlob((b) => resolve(b), mime, q);
    });
  };

  return (
    <ToolShell
      title="Meme Maker"
      badge="🔥 Studio Tool"
      description="Craft viral memes with custom text, original templates, stickers, shapes, and instant gallery posting."
      canUndo={history.past.length > 0}
      canRedo={history.future.length > 0}
      onUndo={() => setHistory((h) => undoHistory(h))}
      onRedo={() => setHistory((h) => redoHistory(h))}
      zoom={zoom}
      onZoomIn={() => setZoom((z) => Math.min(2.5, +(z + 0.15).toFixed(2)))}
      onZoomOut={() => setZoom((z) => Math.max(0.4, +(z - 0.15).toFixed(2)))}
      onResetZoom={() => setZoom(1)}
      headerActions={
        <div className="flex flex-wrap items-center gap-1.5">
          {isLoadedFromDrop && (
            <LoadedFromDropChip fileName={fileName} onClear={clearHandoff} />
          )}
          {isExpired && (
            <HandoffExpiredNote onDismiss={dismissExpired} />
          )}
          <button
            type="button"
            onClick={() => {
              setSidebarTab("export");
              setMobileTab("export");
            }}
            className={`${btnPrimary} !min-h-9 !px-3 text-xs font-semibold`}
            aria-label="Export or Post Meme"
          >
            🚀 Export…
          </button>
        </div>
      }
      sidebar={
        <div className="space-y-4">
          {/* Desktop Tab Switcher */}
          <div className="flex rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-1 text-xs">
            <button
              type="button"
              onClick={() => setSidebarTab("edit")}
              className={`tap-target flex-1 rounded-lg font-semibold transition ${
                sidebarTab === "edit"
                  ? "bg-[var(--accent-primary)] text-[var(--on-accent)] shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              Properties
            </button>
            <button
              type="button"
              onClick={() => setSidebarTab("templates")}
              className={`tap-target flex-1 rounded-lg font-semibold transition ${
                sidebarTab === "templates"
                  ? "bg-[var(--accent-primary)] text-[var(--on-accent)] shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              Formats
            </button>
            <button
              type="button"
              onClick={() => setSidebarTab("layers")}
              className={`tap-target flex-1 rounded-lg font-semibold transition ${
                sidebarTab === "layers"
                  ? "bg-[var(--accent-primary)] text-[var(--on-accent)] shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              Layers ({state.layers.length})
            </button>
            <button
              type="button"
              onClick={() => setSidebarTab("export")}
              className={`tap-target flex-1 rounded-lg font-semibold transition ${
                sidebarTab === "export"
                  ? "bg-[var(--accent-primary)] text-[var(--on-accent)] shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              Export
            </button>
          </div>

          {/* Quick Creation Bar (Desktop) */}
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={handleAddText}
              className={`${btnSecondary} !min-h-9 text-xs font-semibold`}
            >
              + Text
            </button>
            <button
              type="button"
              onClick={() => handleAddSticker("🔥")}
              className={`${btnSecondary} !min-h-9 text-xs font-semibold`}
            >
              + Sticker
            </button>
            <button
              type="button"
              onClick={() => handleAddShape("speech-bubble")}
              className={`${btnSecondary} !min-h-9 text-xs font-semibold`}
            >
              + Bubble
            </button>
          </div>

          {/* Desktop Tab Contents */}
          {sidebarTab === "edit" && (
            <div className="space-y-4">
              <LayerPropertyPanel
                layer={selectedLayer}
                onUpdateLayer={handleUpdateActiveLayer}
                onDeleteLayer={() => {
                  if (selectedLayer) commitState(removeLayer(state, selectedLayer.id));
                }}
              />

              {/* Aspect Ratio Selector */}
              <div className="border-t border-[var(--border-subtle)] pt-3">
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                  Canvas Aspect Ratio
                </label>
                <div className="grid grid-cols-4 gap-1">
                  {(["1:1", "4:5", "16:9", "original"] as const).map((asp) => (
                    <button
                      key={asp}
                      type="button"
                      onClick={() => handleAspectChange(asp)}
                      className={`tap-target rounded-lg border text-xs font-bold transition ${
                        state.aspectRatio === asp
                          ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
                          : "border-[var(--border-subtle)] bg-[var(--surface-base)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                      }`}
                    >
                      {asp}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {sidebarTab === "templates" && (
            <TemplateStrip
              onSelectTemplate={handleSelectTemplate}
              onUploadImage={handleUploadImage}
            />
          )}

          {sidebarTab === "layers" && (
            <LayerList
              layers={state.layers}
              selectedLayerId={state.selectedLayerId}
              onSelectLayer={(id) =>
                setHistory((h) => ({
                  ...h,
                  present: { ...h.present, selectedLayerId: id },
                }))
              }
              onMoveUp={(id) => commitState(reorderLayer(state, id, "up"))}
              onMoveDown={(id) => commitState(reorderLayer(state, id, "down"))}
              onDuplicate={(id) => commitState(duplicateLayer(state, id))}
              onDelete={(id) => commitState(removeLayer(state, id))}
              onToggleLock={(id) => commitState(toggleLockLayer(state, id))}
              onToggleHide={(id) => commitState(toggleHideLayer(state, id))}
            />
          )}

          {sidebarTab === "export" && (
            <ExportPanel
              canvasWidth={state.width}
              canvasHeight={state.height}
              onGenerateBlob={handleGenerateBlob}
              defaultTitle="Meme Creation"
              autoTag="meme"
            />
          )}
        </div>
      }
      mobileToolbar={
        <div className="flex items-center justify-around gap-1">
          <button
            type="button"
            onClick={() => setMobileTab("templates")}
            className="tap-target flex flex-1 flex-col items-center justify-center rounded-lg p-1 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <span>🎨</span>
            <span>Formats</span>
          </button>
          <button
            type="button"
            onClick={handleAddText}
            className="tap-target flex flex-1 flex-col items-center justify-center rounded-lg p-1 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <span>🔤</span>
            <span>+ Text</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("stickers")}
            className="tap-target flex flex-1 flex-col items-center justify-center rounded-lg p-1 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <span>🎭</span>
            <span>Stickers</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("aspect")}
            className="tap-target flex flex-1 flex-col items-center justify-center rounded-lg p-1 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <span>📐</span>
            <span>Aspect</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("layers")}
            className="tap-target flex flex-1 flex-col items-center justify-center rounded-lg p-1 text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <span>📑</span>
            <span>Layers ({state.layers.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("export")}
            className="tap-target flex flex-1 flex-col items-center justify-center rounded-lg p-1 text-[11px] font-bold text-[var(--accent-primary)]"
          >
            <span>🚀</span>
            <span>Export</span>
          </button>
        </div>
      }
      isMobileDrawerOpen={mobileTab !== null}
      mobileDrawerTitle={
        mobileTab === "templates"
          ? "Original Meme Formats"
          : mobileTab === "stickers"
            ? "Add Stickers & Shapes"
            : mobileTab === "aspect"
              ? "Canvas Aspect Ratio"
              : mobileTab === "layers"
                ? "Layer Management"
                : mobileTab === "properties"
                  ? "Layer Properties"
                  : mobileTab === "export"
                    ? "Export & Gallery Post"
                    : "Options"
      }
      onCloseMobileDrawer={() => setMobileTab(null)}
      mobileDrawerContent={
        <div className="space-y-4 pb-6">
          {mobileTab === "templates" && (
            <TemplateStrip
              onSelectTemplate={handleSelectTemplate}
              onUploadImage={handleUploadImage}
            />
          )}

          {mobileTab === "stickers" && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
                  Stickers
                </h4>
                <div className="grid grid-cols-5 gap-2">
                  {["🔥", "🍔", "💀", "🤡", "😂", "🚀", "💯", "👑", "👀", "⚡", "🕶️", "💥", "🧢", "💩", "✨"].map(
                    (em) => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => handleAddSticker(em)}
                        className="tap-target flex items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] text-2xl hover:bg-[var(--surface-hover)]"
                      >
                        {em}
                      </button>
                    ),
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
                  Shapes & Bubbles
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleAddShape("speech-bubble")}
                    className={`${btnSecondary} !min-h-11 text-xs`}
                  >
                    💬 Speech Bubble
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddShape("arrow")}
                    className={`${btnSecondary} !min-h-11 text-xs`}
                  >
                    ➔ Pointing Arrow
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddShape("star")}
                    className={`${btnSecondary} !min-h-11 text-xs`}
                  >
                    ★ Star Accent
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddShape("rectangle")}
                    className={`${btnSecondary} !min-h-11 text-xs`}
                  >
                    ▭ Highlight Box
                  </button>
                </div>
              </div>
            </div>
          )}

          {mobileTab === "aspect" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {(["1:1", "4:5", "16:9", "original"] as const).map((asp) => (
                  <button
                    key={asp}
                    type="button"
                    onClick={() => {
                      handleAspectChange(asp);
                      setMobileTab(null);
                    }}
                    className={`tap-target flex items-center justify-center rounded-xl border p-3 text-sm font-bold transition ${
                      state.aspectRatio === asp
                        ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
                        : "border-[var(--border-subtle)] bg-[var(--surface-base)] text-[var(--text-secondary)]"
                    }`}
                  >
                    {asp === "1:1" && "Square (1:1)"}
                    {asp === "4:5" && "Portrait (4:5)"}
                    {asp === "16:9" && "Widescreen (16:9)"}
                    {asp === "original" && "Original Aspect"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mobileTab === "layers" && (
            <LayerList
              layers={state.layers}
              selectedLayerId={state.selectedLayerId}
              onSelectLayer={(id) => {
                setHistory((h) => ({
                  ...h,
                  present: { ...h.present, selectedLayerId: id },
                }));
                setMobileTab("properties");
              }}
              onMoveUp={(id) => commitState(reorderLayer(state, id, "up"))}
              onMoveDown={(id) => commitState(reorderLayer(state, id, "down"))}
              onDuplicate={(id) => commitState(duplicateLayer(state, id))}
              onDelete={(id) => commitState(removeLayer(state, id))}
              onToggleLock={(id) => commitState(toggleLockLayer(state, id))}
              onToggleHide={(id) => commitState(toggleHideLayer(state, id))}
            />
          )}

          {mobileTab === "properties" && (
            <LayerPropertyPanel
              layer={selectedLayer}
              onUpdateLayer={handleUpdateActiveLayer}
              onDeleteLayer={() => {
                if (selectedLayer) {
                  commitState(removeLayer(state, selectedLayer.id));
                  setMobileTab("layers");
                }
              }}
            />
          )}

          {mobileTab === "export" && (
            <ExportPanel
              canvasWidth={state.width}
              canvasHeight={state.height}
              onGenerateBlob={handleGenerateBlob}
              defaultTitle="Meme Creation"
              autoTag="meme"
            />
          )}
        </div>
      }
    >
      {/* Central Interactive Canvas Stage */}
      <div
        className={`relative flex items-center justify-center transition-all ${
          isDragOver ? "ring-4 ring-[var(--accent-primary)] ring-offset-4" : ""
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: "center center",
        }}
      >
        {/* The Core Rendered HTML5 Canvas */}
        <canvas
          ref={canvasRef}
          width={state.width}
          height={state.height}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onDoubleClick={handleDoubleClick}
          className="touch-none rounded-xl border border-[var(--border-subtle)] bg-[#141210] shadow-2xl"
          data-testid="meme-canvas"
          aria-label="Meme Maker Canvas Editor. Tap or click to select and edit layers."
        />

        {/* Drag-over overlay */}
        {isDragOver && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-[var(--surface-base)]/80 backdrop-blur-xs">
            <span className="rounded-xl border border-[var(--accent-primary)] bg-[var(--surface-raised)] px-4 py-2 text-sm font-bold text-[var(--accent-primary)] shadow-lg">
              Drop image to load into Meme Maker
            </span>
          </div>
        )}
      </div>
    </ToolShell>
  );
}
