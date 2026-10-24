"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  type CollageState,
  renderCollage,
} from "@/lib/tools/collage-render";
import {
  computeCellRects,
  calculateCollageDimensions,
  getTemplateById,
} from "@/lib/tools/collage-layouts";

interface CollageCanvasProps {
  state: CollageState;
  selectedCellId: string | null;
  onSelectCell: (cellId: string) => void;
  onSwapCells: (cellIdA: string, cellIdB: string) => void;
  onUploadToCell: (cellId: string, file: File) => void;
  onPanCell: (cellId: string, deltaPan: { x: number; y: number }) => void;
  onZoomCell: (cellId: string, zoom: number) => void;
  zoom: number; // Viewport zoom scale (e.g. 0.8, 1, 1.2)
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  getImageMap: () => Map<string, HTMLImageElement>;
}

export function CollageCanvas({
  state,
  selectedCellId,
  onSelectCell,
  onSwapCells,
  onUploadToCell,
  onPanCell,
  onZoomCell,
  zoom,
  canvasRef,
  getImageMap,
}: CollageCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hiddenFileInputRef = useRef<HTMLInputElement | null>(null);
  const targetCellForUploadRef = useRef<string | null>(null);

  // Drag-and-drop state for swapping cells or dropping OS files
  const [draggedCellId, setDraggedCellId] = useState<string | null>(null);
  const [dragOverCellId, setDragOverCellId] = useState<string | null>(null);

  // Pan interaction state inside cell
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number; cellId: string }>({
    x: 0,
    y: 0,
    cellId: "",
  });

  const { width: targetW, height: targetH } = calculateCollageDimensions(
    state.aspectRatio,
    state.customWidth,
    state.customHeight,
    1200,
  );

  // Compute cell positions on the stage
  const template = getTemplateById(state.layoutId);
  const normalizedCells =
    state.layoutId === "freeform"
      ? state.cells.map(
          (c, i) =>
            c.customRect ??
            template.cells[i] ?? {
              id: c.id,
              x: 0.1 * i,
              y: 0.1 * i,
              width: 0.45,
              height: 0.45,
            },
        )
      : template.cells;

  const cellRects = computeCellRects(normalizedCells, {
    collageWidth: targetW,
    collageHeight: targetH,
    padding: state.padding,
    gap: state.gap,
    cornerRadius: state.cornerRadius,
  });

  // Re-render canvas whenever collage state changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    void renderCollage(canvas, state, {
      scale: 1,
      imageMap: getImageMap(),
    });
  }, [state, canvasRef, getImageMap]);

  // Handle file picker selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetCellId = targetCellForUploadRef.current;
    if (file && targetCellId) {
      onUploadToCell(targetCellId, file);
    }
    e.target.value = "";
  };

  const triggerUploadForCell = (cellId: string) => {
    targetCellForUploadRef.current = cellId;
    hiddenFileInputRef.current?.click();
  };

  // Pointer event handlers for panning inside a cell
  const handlePointerDown = (e: React.PointerEvent, cellId: string) => {
    onSelectCell(cellId);
    isPanningRef.current = true;
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      cellId,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPanningRef.current) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    panStartRef.current.x = e.clientX;
    panStartRef.current.y = e.clientY;

    const cellId = panStartRef.current.cellId;
    if (!cellId) return;

    // Convert pixel movement to normalized delta
    const normalizedDx = dx / (targetW * 0.3);
    const normalizedDy = dy / (targetH * 0.3);
    onPanCell(cellId, { x: normalizedDx, y: normalizedDy });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isPanningRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture already lost
    }
  };

  // Wheel zoom inside selected cell
  const handleWheel = useCallback(
    (e: React.WheelEvent, cellId: string) => {
      e.preventDefault();
      const currentCell = state.cells.find((c) => c.id === cellId);
      if (!currentCell) return;
      const currentZoom = currentCell.transform.zoom;
      const delta = -e.deltaY * 0.002;
      const nextZoom = Math.min(3, Math.max(1, currentZoom + delta));
      onZoomCell(cellId, nextZoom);
    },
    [state.cells, onZoomCell],
  );

  return (
    <div
      ref={containerRef}
      className="relative flex items-center justify-center select-none"
      style={{
        transform: `scale(${zoom})`,
        transformOrigin: "center center",
        transition: "transform 0.15s ease-out",
      }}
      data-testid="collage-canvas-stage"
    >
      <input
        ref={hiddenFileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Main Canvas rendering container */}
      <div
        className="relative overflow-hidden rounded-2xl shadow-2xl transition-all"
        style={{
          width: `${targetW}px`,
          height: `${targetH}px`,
          maxWidth: "85vw",
          maxHeight: "75vh",
          aspectRatio: `${targetW} / ${targetH}`,
        }}
      >
        {/* The underlying high-resolution Canvas */}
        <canvas
          ref={canvasRef}
          width={targetW}
          height={targetH}
          className="absolute inset-0 h-full w-full object-contain"
          data-testid="collage-canvas"
        />

        {/* Interactive Cell Overlay Layer */}
        {cellRects.map((rect, idx) => {
          const cellState = state.cells.find((c) => c.id === rect.id);
          const isSelected = selectedCellId === rect.id;
          const isDragOver = dragOverCellId === rect.id;
          const isBeingDragged = draggedCellId === rect.id;
          const hasMedia = Boolean(cellState?.media?.url);

          // Calculate normalized percentage coordinates for overlay
          const leftPct = (rect.x / targetW) * 100;
          const topPct = (rect.y / targetH) * 100;
          const widthPct = (rect.width / targetW) * 100;
          const heightPct = (rect.height / targetH) * 100;

          return (
            <div
              key={rect.id}
              role="button"
              tabIndex={0}
              aria-label={`Collage Cell #${idx + 1} (${hasMedia ? "populated" : "empty"})`}
              aria-pressed={isSelected}
              draggable={hasMedia}
              onDragStart={(e) => {
                setDraggedCellId(rect.id);
                e.dataTransfer.setData("text/plain", rect.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
                if (dragOverCellId !== rect.id) {
                  setDragOverCellId(rect.id);
                }
              }}
              onDragLeave={() => {
                if (dragOverCellId === rect.id) {
                  setDragOverCellId(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverCellId(null);

                // 1. Check for files dropped from OS
                const files = e.dataTransfer.files;
                if (files && files.length > 0) {
                  onUploadToCell(rect.id, files[0]);
                  return;
                }

                // 2. Check for internal cell drag to swap
                const sourceCellId =
                  draggedCellId || e.dataTransfer.getData("text/plain");
                if (sourceCellId && sourceCellId !== rect.id) {
                  onSwapCells(sourceCellId, rect.id);
                }
                setDraggedCellId(null);
              }}
              onDragEnd={() => {
                setDraggedCellId(null);
                setDragOverCellId(null);
              }}
              onClick={() => {
                onSelectCell(rect.id);
                if (!hasMedia) {
                  triggerUploadForCell(rect.id);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectCell(rect.id);
                  if (!hasMedia) triggerUploadForCell(rect.id);
                }
              }}
              onPointerDown={(e) => {
                if (hasMedia) {
                  handlePointerDown(e, rect.id);
                }
              }}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onWheel={(e) => handleWheel(e, rect.id)}
              style={{
                left: `${leftPct}%`,
                top: `${topPct}%`,
                width: `${widthPct}%`,
                height: `${heightPct}%`,
                borderRadius: rect.shape === "circle" ? "50%" : `${rect.cornerRadius}px`,
                transform: rect.rotation ? `rotate(${rect.rotation}deg)` : undefined,
                zIndex: rect.zIndex || (isSelected ? 20 : 10),
              }}
              className={`absolute cursor-pointer transition-colors focus-visible:outline-none ${
                isSelected
                  ? "ring-2 ring-[var(--accent-primary)] ring-offset-2 ring-offset-black/50"
                  : "hover:ring-1 hover:ring-white/40"
              } ${isDragOver ? "bg-[var(--accent-primary)]/30 ring-2 ring-[var(--accent-primary)]" : ""} ${
                isBeingDragged ? "opacity-40" : ""
              }`}
            >
              {/* Empty Cell Action Prompt */}
              {!hasMedia && (
                <div className="flex h-full w-full flex-col items-center justify-center p-2 text-center text-white/80 transition hover:text-white">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-base font-bold shadow-sm backdrop-blur-sm">
                    +
                  </span>
                  <span className="mt-1 text-[11px] font-medium tracking-tight">
                    Add Photo
                  </span>
                </div>
              )}

              {/* Cell Header Badge with drag-to-swap handle */}
              {hasMedia && (
                <div className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white/90 backdrop-blur-sm opacity-0 hover:opacity-100 transition-opacity">
                  <span title="Drag to swap with another cell">⇄ Cell #{idx + 1}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
