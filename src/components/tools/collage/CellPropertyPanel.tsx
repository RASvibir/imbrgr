"use client";

import React, { useRef } from "react";
import {
  type CollageCellState,
  PHOTO_FILTERS,
} from "@/lib/tools/collage-render";
import { FUN_FILTERS } from "@/lib/fun-filters";
import { btnSecondary } from "@/lib/ui/button-classes";

interface CellPropertyPanelProps {
  cell: CollageCellState;
  cellIndex: number;
  totalCells: number;
  allCells: CollageCellState[];
  onUpdateTransform: (
    updater: (prev: CollageCellState["transform"]) => CollageCellState["transform"],
  ) => void;
  onReplaceMedia: (file: File) => void;
  onRemoveMedia: () => void;
  onSwapWithCell: (targetCellId: string) => void;
}

export function CellPropertyPanel({
  cell,
  cellIndex,
  totalCells,
  allCells,
  onUpdateTransform,
  onReplaceMedia,
  onRemoveMedia,
  onSwapWithCell,
}: CellPropertyPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const tf = cell.transform;

  const handleRotate = () => {
    onUpdateTransform((prev) => ({
      ...prev,
      rotation: (prev.rotation + 90) % 360,
    }));
  };

  const handleFlipH = () => {
    onUpdateTransform((prev) => ({
      ...prev,
      flipH: !prev.flipH,
    }));
  };

  const handleFlipV = () => {
    onUpdateTransform((prev) => ({
      ...prev,
      flipV: !prev.flipV,
    }));
  };

  const handleReset = () => {
    onUpdateTransform((prev) => ({
      ...prev,
      pan: { x: 0, y: 0 },
      zoom: 1,
      rotation: 0,
      flipH: false,
      flipV: false,
      filterId: "none",
      filterIntensity: 1,
    }));
  };

  return (
    <div className="space-y-4 text-xs" data-testid="cell-property-panel">
      {/* Header Info */}
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent-primary)] text-[10px] font-bold text-[var(--on-accent)]">
            {cellIndex + 1}
          </span>
          <span className="font-bold text-[var(--text-primary)]">
            Cell #{cellIndex + 1} of {totalCells}
          </span>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="tap-target text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          title="Reset position, zoom and rotation"
        >
          Reset adjustments
        </button>
      </div>

      {/* Media Replacement & Removal */}
      <div className="space-y-2">
        <label className="block font-semibold text-[var(--text-secondary)]">
          Photo Source
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onReplaceMedia(file);
                e.target.value = "";
              }
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`${btnSecondary} tap-target flex-1 !min-h-9 text-xs`}
          >
            📷 {cell.media ? "Replace Media" : "Upload Media"}
          </button>
          {cell.media && (
            <button
              type="button"
              onClick={onRemoveMedia}
              className="tap-target inline-flex !min-h-9 items-center justify-center rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 text-xs font-semibold text-[var(--danger)] hover:bg-[var(--danger)]/20"
            >
              🗑️ Clear
            </button>
          )}
        </div>
      </div>

      {/* Quick Swap with another cell */}
      {totalCells > 1 && (
        <div>
          <label className="mb-1 block font-semibold text-[var(--text-secondary)]">
            Swap Position with Cell
          </label>
          <div className="flex flex-wrap gap-1.5">
            {allCells.map((c, i) => {
              if (c.id === cell.id) return null;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSwapWithCell(c.id)}
                  className="tap-target inline-flex items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-2.5 py-1 text-xs hover:border-[var(--accent-primary)] hover:bg-[var(--surface-hover)]"
                >
                  ⇄ Cell #{i + 1}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Rotation & Flip Controls */}
      <div className="space-y-1.5">
        <label className="block font-semibold text-[var(--text-secondary)]">
          Orientation & Flip
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleRotate}
            className={`${btnSecondary} tap-target flex-1 !min-h-9 text-xs`}
            title="Rotate 90 degrees clockwise"
          >
            🔄 Rotate 90° ({tf.rotation}°)
          </button>
          <button
            type="button"
            onClick={handleFlipH}
            className={`${btnSecondary} tap-target !min-h-9 px-3 text-xs ${
              tf.flipH ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10" : ""
            }`}
            title="Flip Horizontally"
          >
            ↔️ Flip H
          </button>
          <button
            type="button"
            onClick={handleFlipV}
            className={`${btnSecondary} tap-target !min-h-9 px-3 text-xs ${
              tf.flipV ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10" : ""
            }`}
            title="Flip Vertically"
          >
            ↕️ Flip V
          </button>
        </div>
      </div>

      {/* Pan & Zoom Controls */}
      <div className="space-y-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3">
        <div>
          <div className="flex items-center justify-between font-semibold text-[var(--text-secondary)]">
            <span>Crop Zoom</span>
            <span>{tf.zoom.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={tf.zoom}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              onUpdateTransform((prev) => ({ ...prev, zoom: val }));
            }}
            className="mt-1.5 w-full accent-[var(--accent-primary)]"
            aria-label="Cell crop zoom"
          />
        </div>

        <div>
          <div className="flex items-center justify-between font-semibold text-[var(--text-secondary)]">
            <span>Horizontal Pan</span>
            <span>{Math.round(tf.pan.x * 100)}%</span>
          </div>
          <input
            type="range"
            min={-1}
            max={1}
            step={0.02}
            value={tf.pan.x}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              onUpdateTransform((prev) => ({
                ...prev,
                pan: { ...prev.pan, x: val },
              }));
            }}
            className="mt-1.5 w-full accent-[var(--accent-primary)]"
            aria-label="Horizontal pan"
          />
        </div>

        <div>
          <div className="flex items-center justify-between font-semibold text-[var(--text-secondary)]">
            <span>Vertical Pan</span>
            <span>{Math.round(tf.pan.y * 100)}%</span>
          </div>
          <input
            type="range"
            min={-1}
            max={1}
            step={0.02}
            value={tf.pan.y}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              onUpdateTransform((prev) => ({
                ...prev,
                pan: { ...prev.pan, y: val },
              }));
            }}
            className="mt-1.5 w-full accent-[var(--accent-primary)]"
            aria-label="Vertical pan"
          />
        </div>
      </div>

      {/* Photo Filters */}
      <div className="space-y-2">
        <label className="block font-semibold text-[var(--text-secondary)]">
          Photo Filter Presets
        </label>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {PHOTO_FILTERS.map((f) => {
            const isSelected = tf.filterId === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() =>
                  onUpdateTransform((prev) => ({
                    ...prev,
                    filterId: f.id,
                  }))
                }
                className={`tap-target rounded-lg border px-2 py-1.5 text-center transition ${
                  isSelected
                    ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/15 font-bold text-[var(--accent-primary)]"
                    : "border-[var(--border-subtle)] bg-[var(--surface-base)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* imbrgr Fun Filters */}
      <div className="space-y-2">
        <label className="block font-semibold text-[var(--accent-primary)]">
          🍔 imbrgr Fun Burger Filters
        </label>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {FUN_FILTERS.map((f) => {
            const isSelected = tf.filterId === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() =>
                  onUpdateTransform((prev) => ({
                    ...prev,
                    filterId: f.id,
                  }))
                }
                className={`tap-target flex flex-col items-center rounded-xl border p-2 text-center transition ${
                  isSelected
                    ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/15 font-bold text-[var(--accent-primary)] shadow-[var(--shadow-ember)]"
                    : "border-[var(--border-subtle)] bg-[var(--surface-base)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
                }`}
              >
                <span className="text-xl">{f.emoji}</span>
                <span className="mt-1 line-clamp-1 font-semibold text-[11px] text-[var(--text-primary)]">
                  {f.label}
                </span>
                {f.animated && (
                  <span className="rounded bg-[var(--accent-primary)]/20 px-1 py-0.2 text-[9px] font-bold text-[var(--accent-primary)]">
                    ⚡ Animated
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter Intensity slider if filter is active */}
      {tf.filterId && tf.filterId !== "none" && (
        <div>
          <div className="flex items-center justify-between font-semibold text-[var(--text-secondary)]">
            <span>Filter Intensity</span>
            <span>{Math.round((tf.filterIntensity ?? 1) * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={tf.filterIntensity ?? 1}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              onUpdateTransform((prev) => ({ ...prev, filterIntensity: val }));
            }}
            className="mt-1.5 w-full accent-[var(--accent-primary)]"
            aria-label="Filter intensity"
          />
        </div>
      )}
    </div>
  );
}
