"use client";

import React, { useCallback, useRef, useState } from "react";
import { ToolShell } from "@/components/tools/ToolShell";
import { ExportPanel, type ExportFormat, type ExportScale } from "@/components/tools/ExportPanel";
import { CollageCanvas } from "./CollageCanvas";
import { CollageLayoutPicker } from "./CollageLayoutPicker";
import { CollageControls } from "./CollageControls";
import { CellPropertyPanel } from "./CellPropertyPanel";
import {
  type CollageState,
  createInitialCollageState,
  renderCollage,
} from "@/lib/tools/collage-render";
import { type CollageLayoutTemplate } from "@/lib/tools/collage-layouts";
import { encodeGif } from "@/lib/gif/encode";
import { exportFramesToWebM } from "@/lib/gif/webm-export";
import { btnPrimary, btnSecondary } from "@/lib/ui/button-classes";
import { useToolHandoff } from "@/lib/landing/use-tool-handoff";
import { LoadedFromDropChip, HandoffExpiredNote } from "@/components/landing/HandoffNotice";

interface HistoryState {
  past: CollageState[];
  present: CollageState;
  future: CollageState[];
}

type SidebarTab = "layouts" | "controls" | "cell" | "export";
type MobileTab = SidebarTab | null;

export function CollageBuilder() {
  // Undo/Redo history stack
  const [history, setHistory] = useState<HistoryState>(() => ({
    past: [],
    present: createInitialCollageState("grid-2x2"),
    future: [],
  }));

  const state = history.present;
  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  // Selected cell for editing
  const [selectedCellId, setSelectedCellId] = useState<string | null>("c1");

  // Navigation tab state (desktop & mobile)
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("layouts");
  const [mobileTab, setMobileTab] = useState<MobileTab>(null);

  // Canvas zoom
  const [zoom, setZoom] = useState<number>(1);

  // Status message toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Encoding progress
  const [encodingProgress, setEncodingProgress] = useState<number | null>(null);

  // Canvas refs and image cache
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const getImageMap = useCallback(() => imageCacheRef.current, []);

  // Show status toast
  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((current) => (current === msg ? null : current));
    }, 4000);
  }, []);

  // Helper to commit state changes to undo history
  const commitState = useCallback(
    (nextStateOrUpdater: CollageState | ((prev: CollageState) => CollageState)) => {
      setHistory((prev) => {
        const next =
          typeof nextStateOrUpdater === "function"
            ? nextStateOrUpdater(prev.present)
            : nextStateOrUpdater;
        return {
          past: [...prev.past.slice(-25), prev.present],
          present: next,
          future: [],
        };
      });
    },
    [],
  );

  // Undo / Redo actions
  const handleUndo = useCallback(() => {
    setHistory((prev) => {
      if (prev.past.length === 0) return prev;
      const previous = prev.past[prev.past.length - 1];
      const newPast = prev.past.slice(0, prev.past.length - 1);
      return {
        past: newPast,
        present: previous,
        future: [prev.present, ...prev.future],
      };
    });
  }, []);

  const handleRedo = useCallback(() => {
    setHistory((prev) => {
      if (prev.future.length === 0) return prev;
      const next = prev.future[0];
      const newFuture = prev.future.slice(1);
      return {
        past: [...prev.past, prev.present],
        present: next,
        future: newFuture,
      };
    });
  }, []);

  // Reset collage
  const handleReset = useCallback(() => {
    commitState(createInitialCollageState(state.layoutId));
    showToast("Reset collage to default.");
  }, [commitState, state.layoutId, showToast]);

  // Pre-load an image URL into cache
  const loadMediaToCache = useCallback(
    (url: string, onLoaded?: () => void) => {
      if (!url || imageCacheRef.current.has(url)) {
        onLoaded?.();
        return;
      }
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        imageCacheRef.current.set(url, img);
        onLoaded?.();
      };
      img.src = url;
    },
    [],
  );

  // Switch layout template
  const handleSelectLayout = useCallback(
    (template: CollageLayoutTemplate) => {
      const currentCells = state.cells;
      const newCells = template.cells.map((c, i) => {
        const existing = currentCells[i];
        return {
          id: c.id,
          media: existing?.media,
          transform: existing?.transform ?? {
            pan: { x: 0, y: 0 },
            zoom: 1,
            rotation: 0,
            flipH: false,
            flipV: false,
            filterId: "none",
            filterIntensity: 1,
          },
        };
      });

      commitState({
        ...state,
        layoutId: template.id,
        cells: newCells,
      });

      setSelectedCellId(template.cells[0]?.id ?? null);
      showToast(`Applied ${template.name} layout.`);
    },
    [commitState, state, showToast],
  );

  // Upload/Assign media to a cell
  const handleUploadToCell = useCallback(
    (cellId: string, file: File) => {
      const url = URL.createObjectURL(file);
      const isVideo = file.type.startsWith("video/");
      const isGif = file.type === "image/gif";

      loadMediaToCache(url, () => {
        const nextCells = state.cells.map((c) => {
          if (c.id !== cellId) return c;
          return {
            ...c,
            media: {
              url,
              file,
              type: isVideo ? ("video" as const) : isGif ? ("gif" as const) : ("image" as const),
              naturalWidth: 1200,
              naturalHeight: 1200,
            },
          };
        });

        // Automatically toggle animate mode if video or GIF added
        const shouldAnimate = isVideo || isGif || state.animate;

        commitState({
          ...state,
          cells: nextCells,
          animate: shouldAnimate,
        });

        setSelectedCellId(cellId);
        showToast(`Loaded ${file.name} into Cell.`);
      });
    },
    [commitState, loadMediaToCache, state, showToast],
  );

  // Handoff integration from landing
  const { isLoadedFromDrop, fileName, isExpired, clearHandoff, dismissExpired } = useToolHandoff({
    onFileLoaded: (file) => {
      const targetId = selectedCellId || state.cells[0]?.id || "c1";
      handleUploadToCell(targetId, file);
    },
    onClear: () => {
      handleReset();
    },
  });

  // Swap two cells
  const handleSwapCells = useCallback(
    (cellIdA: string, cellIdB: string) => {
      const cellA = state.cells.find((c) => c.id === cellIdA);
      const cellB = state.cells.find((c) => c.id === cellIdB);
      if (!cellA || !cellB) return;

      const nextCells = state.cells.map((c) => {
        if (c.id === cellIdA) {
          return {
            ...c,
            media: cellB.media,
            transform: { ...cellB.transform },
          };
        }
        if (c.id === cellIdB) {
          return {
            ...c,
            media: cellA.media,
            transform: { ...cellA.transform },
          };
        }
        return c;
      });

      commitState({
        ...state,
        cells: nextCells,
      });

      showToast("Swapped cells.");
    },
    [commitState, state, showToast],
  );

  // Pan cell
  const handlePanCell = useCallback(
    (cellId: string, deltaPan: { x: number; y: number }) => {
      const nextCells = state.cells.map((c) => {
        if (c.id !== cellId) return c;
        return {
          ...c,
          transform: {
            ...c.transform,
            pan: {
              x: Math.min(1, Math.max(-1, c.transform.pan.x + deltaPan.x)),
              y: Math.min(1, Math.max(-1, c.transform.pan.y + deltaPan.y)),
            },
          },
        };
      });
      // Do not push every mousemove delta to past history; update state directly
      setHistory((prev) => ({
        ...prev,
        present: { ...prev.present, cells: nextCells },
      }));
    },
    [state.cells],
  );

  // Zoom cell
  const handleZoomCell = useCallback((cellId: string, nextZoom: number) => {
    setHistory((prev) => {
      const nextCells = prev.present.cells.map((c) => {
        if (c.id !== cellId) return c;
        return {
          ...c,
          transform: {
            ...c.transform,
            zoom: nextZoom,
          },
        };
      });
      return {
        ...prev,
        present: { ...prev.present, cells: nextCells },
      };
    });
  }, []);

  // Generate Export Blob (Static image, Animated GIF, or WebM Video)
  const handleGenerateExportBlob = useCallback(
    async (
      format: ExportFormat,
      quality: number,
      scale: ExportScale,
    ): Promise<Blob | null> => {
      // 1. Static Image Export (PNG, JPEG, WebP)
      if (format === "png" || format === "jpeg" || format === "webp") {
        const offscreen = document.createElement("canvas");
        await renderCollage(offscreen, state, {
          scale,
          imageMap: imageCacheRef.current,
        });

        const mime =
          format === "jpeg"
            ? "image/jpeg"
            : format === "webp"
              ? "image/webp"
              : "image/png";

        return new Promise<Blob | null>((resolve) => {
          offscreen.toBlob(
            (blob) => resolve(blob),
            mime,
            quality / 100,
          );
        });
      }

      // 2. Animated GIF Export via src/lib/gif/encode.ts
      if (format === "gif") {
        setEncodingProgress(10);
        const fps = 10;
        const totalDurationSec = 1.6;
        const totalFrames = Math.round(fps * totalDurationSec);
        const frames: ImageData[] = [];

        const offscreen = document.createElement("canvas");
        const ctx = offscreen.getContext("2d");
        if (!ctx) throw new Error("Could not initialize offscreen context");

        for (let i = 0; i < totalFrames; i++) {
          const t = i / fps;
          await renderCollage(offscreen, state, {
            timeSec: t,
            scale: Math.min(1, scale),
            imageMap: imageCacheRef.current,
          });

          const imgData = ctx.getImageData(0, 0, offscreen.width, offscreen.height);
          frames.push(imgData);
          setEncodingProgress(10 + Math.round((i / totalFrames) * 40));
        }

        const gifBlob = await encodeGif(frames, {
          delay: Math.round(1000 / fps),
          paletteSize: 256,
          loopCount: 0,
          onProgress: (_curr, _tot, percent) => {
            setEncodingProgress(50 + Math.round((percent / 100) * 50));
          },
        });

        setEncodingProgress(null);
        return gifBlob;
      }

      // 3. WebM Video Export via src/lib/gif/webm-export.ts
      if (format === "webm") {
        setEncodingProgress(10);
        const fps = 15;
        const totalDurationSec = 2;
        const totalFrames = Math.round(fps * totalDurationSec);
        const frames: ImageData[] = [];

        const offscreen = document.createElement("canvas");
        const ctx = offscreen.getContext("2d");
        if (!ctx) throw new Error("Could not initialize offscreen context");

        for (let i = 0; i < totalFrames; i++) {
          const t = i / fps;
          await renderCollage(offscreen, state, {
            timeSec: t,
            scale: Math.min(1, scale),
            imageMap: imageCacheRef.current,
          });

          const imgData = ctx.getImageData(0, 0, offscreen.width, offscreen.height);
          frames.push(imgData);
        }

        const webmBlob = await exportFramesToWebM(frames, fps, {
          onProgress: (percent) => setEncodingProgress(percent),
        });

        setEncodingProgress(null);
        return webmBlob;
      }

      return null;
    },
    [state],
  );

  // Quick download helper for header button
  const handleQuickDownload = async () => {
    try {
      showToast("Rendering collage for download…");
      const blob = await handleGenerateExportBlob("png", 92, 1);
      if (!blob) throw new Error("Failed to render collage");

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `imbrgr-collage-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("Downloaded Collage Builder collage!");
    } catch {
      showToast("Download failed. Please try again.");
    }
  };

  const selectedCell = state.cells.find((c) => c.id === selectedCellId) || state.cells[0];
  const selectedCellIndex = state.cells.findIndex((c) => c.id === selectedCellId);

  return (
    <ToolShell
      title="Collage Builder"
      badge="Collage Grid"
      description="Combine multiple photos into beautiful grids, side-by-side comparisons, polaroid stacks, and social story collages."
      canUndo={canUndo}
      canRedo={canRedo}
      onUndo={handleUndo}
      onRedo={handleRedo}
      zoom={zoom}
      onZoomIn={() => setZoom((z) => Math.min(2, z + 0.1))}
      onZoomOut={() => setZoom((z) => Math.max(0.5, z - 0.1))}
      onResetZoom={() => setZoom(1)}
      headerActions={
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {isLoadedFromDrop && (
            <LoadedFromDropChip fileName={fileName} onClear={clearHandoff} />
          )}
          {isExpired && (
            <HandoffExpiredNote onDismiss={dismissExpired} />
          )}

          {/* Quick Download Button */}
          <button
            type="button"
            data-testid="tool-download-btn"
            onClick={handleQuickDownload}
            className={`${btnPrimary} tap-target !min-h-9 !px-3 text-xs font-semibold`}
            title="Download PNG Collage"
          >
            💾 <span className="ml-1 hidden sm:inline">Download</span>
          </button>

          {/* Quick Save to Library Button */}
          <button
            type="button"
            data-testid="tool-save-btn"
            onClick={() => {
              setSidebarTab("export");
              setMobileTab("export");
              showToast("Opened Export & Library Save panel.");
            }}
            className={`${btnSecondary} tap-target !min-h-9 !px-3 text-xs`}
            title="Save to imbrgr Library"
          >
            📚 <span className="ml-1 hidden sm:inline">Save</span>
          </button>

          {/* Quick Post to Gallery Button */}
          <button
            type="button"
            data-testid="tool-post-btn"
            onClick={() => {
              setSidebarTab("export");
              setMobileTab("export");
              showToast("Opened Gallery Publishing panel.");
            }}
            className={`${btnSecondary} tap-target !min-h-9 !px-3 text-xs border-[var(--accent-primary)]/40 text-[var(--accent-primary)] font-semibold`}
            title="Post to imbrgr Gallery"
          >
            🔥 <span className="ml-1 hidden sm:inline">Post</span>
          </button>
        </div>
      }
      sidebar={
        <div className="space-y-4">
          {/* Desktop Tab Selector */}
          <div className="flex rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-1">
            <button
              type="button"
              onClick={() => setSidebarTab("layouts")}
              className={`tap-target flex-1 rounded-lg py-1.5 text-center text-xs font-medium transition ${
                sidebarTab === "layouts"
                  ? "bg-[var(--accent-primary)] text-[var(--on-accent)] font-semibold shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              📐 Layouts
            </button>
            <button
              type="button"
              onClick={() => setSidebarTab("controls")}
              className={`tap-target flex-1 rounded-lg py-1.5 text-center text-xs font-medium transition ${
                sidebarTab === "controls"
                  ? "bg-[var(--accent-primary)] text-[var(--on-accent)] font-semibold shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              🎨 Spacing & FX
            </button>
            <button
              type="button"
              onClick={() => setSidebarTab("cell")}
              className={`tap-target flex-1 rounded-lg py-1.5 text-center text-xs font-medium transition ${
                sidebarTab === "cell"
                  ? "bg-[var(--accent-primary)] text-[var(--on-accent)] font-semibold shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              🖼️ Cell #{selectedCellIndex >= 0 ? selectedCellIndex + 1 : 1}
            </button>
            <button
              type="button"
              onClick={() => setSidebarTab("export")}
              className={`tap-target flex-1 rounded-lg py-1.5 text-center text-xs font-medium transition ${
                sidebarTab === "export"
                  ? "bg-[var(--accent-primary)] text-[var(--on-accent)] font-semibold shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              🚀 Export
            </button>
          </div>

          {/* Sidebar Tab Contents */}
          {sidebarTab === "layouts" && (
            <CollageLayoutPicker
              currentLayoutId={state.layoutId}
              onSelectLayout={handleSelectLayout}
            />
          )}

          {sidebarTab === "controls" && (
            <CollageControls
              state={state}
              onChange={commitState}
              onReset={handleReset}
            />
          )}

          {sidebarTab === "cell" && selectedCell && (
            <CellPropertyPanel
              cell={selectedCell}
              cellIndex={selectedCellIndex >= 0 ? selectedCellIndex : 0}
              totalCells={state.cells.length}
              allCells={state.cells}
              onUpdateTransform={(updater) => {
                const nextCells = state.cells.map((c) => {
                  if (c.id !== selectedCell.id) return c;
                  return { ...c, transform: updater(c.transform) };
                });
                commitState({ ...state, cells: nextCells });
              }}
              onReplaceMedia={(file) => handleUploadToCell(selectedCell.id, file)}
              onRemoveMedia={() => {
                const nextCells = state.cells.map((c) => {
                  if (c.id !== selectedCell.id) return c;
                  return { ...c, media: undefined };
                });
                commitState({ ...state, cells: nextCells });
                showToast("Cleared photo from cell.");
              }}
              onSwapWithCell={(targetId) => handleSwapCells(selectedCell.id, targetId)}
            />
          )}

          {sidebarTab === "export" && (
            <ExportPanel
              canvasWidth={1080}
              canvasHeight={1080}
              onGenerateBlob={handleGenerateExportBlob}
              defaultTitle="Collage Creation"
              autoTag="collage"
              allowedFormats={
                state.animate
                  ? ["png", "jpeg", "webp", "gif", "webm"]
                  : ["png", "jpeg", "webp"]
              }
              customFilePrefix="imbrgr-collage"
              progressPercent={encodingProgress}
            />
          )}
        </div>
      }
      mobileToolbar={
        <div className="flex items-center justify-around gap-1 text-xs">
          <button
            type="button"
            onClick={() => setMobileTab("layouts")}
            className="tap-target flex flex-col items-center justify-center p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <span className="text-base">📐</span>
            <span className="text-[10px] font-medium">Layouts</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("controls")}
            className="tap-target flex flex-col items-center justify-center p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <span className="text-base">🎨</span>
            <span className="text-[10px] font-medium">Spacing</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("cell")}
            className="tap-target flex flex-col items-center justify-center p-1 text-[var(--accent-primary)] font-bold"
          >
            <span className="text-base">🖼️</span>
            <span className="text-[10px]">Cell FX</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("export")}
            className="tap-target flex flex-col items-center justify-center p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <span className="text-base">🚀</span>
            <span className="text-[10px] font-medium">Export</span>
          </button>
        </div>
      }
      isMobileDrawerOpen={mobileTab !== null}
      mobileDrawerTitle={
        mobileTab === "layouts"
          ? "Choose Collage Layout"
          : mobileTab === "controls"
            ? "Spacing & Background"
            : mobileTab === "cell"
              ? `Cell #${selectedCellIndex >= 0 ? selectedCellIndex + 1 : 1} Adjustments`
              : "Export & Publish"
      }
      onCloseMobileDrawer={() => setMobileTab(null)}
      mobileDrawerContent={
        <div className="p-4 overflow-y-auto max-h-[75vh]">
          {mobileTab === "layouts" && (
            <CollageLayoutPicker
              currentLayoutId={state.layoutId}
              onSelectLayout={(tmpl) => {
                handleSelectLayout(tmpl);
                setMobileTab(null);
              }}
            />
          )}

          {mobileTab === "controls" && (
            <CollageControls
              state={state}
              onChange={commitState}
              onReset={handleReset}
            />
          )}

          {mobileTab === "cell" && selectedCell && (
            <CellPropertyPanel
              cell={selectedCell}
              cellIndex={selectedCellIndex >= 0 ? selectedCellIndex : 0}
              totalCells={state.cells.length}
              allCells={state.cells}
              onUpdateTransform={(updater) => {
                const nextCells = state.cells.map((c) => {
                  if (c.id !== selectedCell.id) return c;
                  return { ...c, transform: updater(c.transform) };
                });
                commitState({ ...state, cells: nextCells });
              }}
              onReplaceMedia={(file) => handleUploadToCell(selectedCell.id, file)}
              onRemoveMedia={() => {
                const nextCells = state.cells.map((c) => {
                  if (c.id !== selectedCell.id) return c;
                  return { ...c, media: undefined };
                });
                commitState({ ...state, cells: nextCells });
                showToast("Cleared photo from cell.");
              }}
              onSwapWithCell={(targetId) => handleSwapCells(selectedCell.id, targetId)}
            />
          )}

          {mobileTab === "export" && (
            <ExportPanel
              canvasWidth={1080}
              canvasHeight={1080}
              onGenerateBlob={handleGenerateExportBlob}
              defaultTitle="Collage Creation"
              autoTag="collage"
              allowedFormats={
                state.animate
                  ? ["png", "jpeg", "webp", "gif", "webm"]
                  : ["png", "jpeg", "webp"]
              }
              customFilePrefix="imbrgr-collage"
              progressPercent={encodingProgress}
            />
          )}
        </div>
      }
    >
      {/* Toast Notification Banner */}
      {toastMsg && (
        <div
          data-testid="tool-status-toast"
          role="status"
          aria-live="polite"
          className="fixed top-16 left-1/2 -translate-x-1/2 z-50 rounded-xl border border-[var(--accent-primary)]/40 bg-[var(--surface-raised)]/95 px-4 py-2 text-xs font-semibold text-[var(--accent-primary)] shadow-xl backdrop-blur-md"
        >
          {toastMsg}
        </div>
      )}

      {/* Main Canvas Component */}
      <CollageCanvas
        state={state}
        selectedCellId={selectedCellId}
        onSelectCell={(id) => {
          setSelectedCellId(id);
          setSidebarTab("cell");
        }}
        onSwapCells={handleSwapCells}
        onUploadToCell={handleUploadToCell}
        onPanCell={handlePanCell}
        onZoomCell={handleZoomCell}
        zoom={zoom}
        canvasRef={canvasRef}
        getImageMap={getImageMap}
      />
    </ToolShell>
  );
}
