"use client";

import React from "react";
import type { MemeLayer } from "@/lib/tools/meme-render";

interface LayerListProps {
  layers: MemeLayer[];
  selectedLayerId: string | null;
  onSelectLayer: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleLock: (id: string) => void;
  onToggleHide: (id: string) => void;
}

export function LayerList({
  layers,
  selectedLayerId,
  onSelectLayer,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  onToggleLock,
  onToggleHide,
}: LayerListProps) {
  // Display top layers at the top of the list (reverse z-order)
  const displayLayers = [...layers].reverse();

  if (layers.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border-subtle)] p-6 text-center text-xs text-[var(--text-muted)]">
        No layers yet. Add text, stickers, or shapes to begin!
      </div>
    );
  }

  return (
    <div className="space-y-1.5" role="list" aria-label="Canvas Layers">
      {displayLayers.map((layer, index) => {
        const isSelected = layer.id === selectedLayerId;
        const isTop = index === 0;
        const isBottom = index === displayLayers.length - 1;

        // Preview snippet
        let preview = layer.name;
        if (layer.type === "text") {
          preview = `"${layer.text.slice(0, 18)}${layer.text.length > 18 ? "…" : ""}"`;
        } else if (layer.type === "sticker") {
          preview = `${layer.emoji} Sticker`;
        } else if (layer.type === "shape") {
          preview = `${layer.shape} shape`;
        }

        return (
          <div
            key={layer.id}
            role="listitem"
            onClick={() => onSelectLayer(layer.id)}
            className={`group flex items-center justify-between rounded-xl border p-2 transition ${
              isSelected
                ? "border-[var(--accent-primary)] bg-[var(--surface-hover)] shadow-sm"
                : "border-[var(--border-subtle)] bg-[var(--surface-base)] hover:border-[var(--border-strong)]"
            }`}
          >
            {/* Left: Layer icon + label */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectLayer(layer.id);
              }}
              className="tap-target flex flex-1 items-center gap-2.5 truncate text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] rounded-lg px-1"
              aria-label={`Select layer: ${preview}`}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--surface-raised)] text-xs font-bold border border-[var(--border-subtle)]">
                {layer.type === "text" && "T"}
                {layer.type === "image" && "🖼️"}
                {layer.type === "sticker" && layer.emoji}
                {layer.type === "shape" && "◼️"}
              </span>

              <div className="min-w-0 flex-1 truncate">
                <p className="truncate text-xs font-semibold text-[var(--text-primary)]">
                  {layer.name}
                </p>
                <p className="truncate text-[10px] text-[var(--text-muted)]">
                  {preview}
                </p>
              </div>
            </button>

            {/* Right: Quick actions (Hide, Lock, Duplicate, Reorder, Delete) */}
            <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
              {/* Hide / Show */}
              <button
                type="button"
                onClick={() => onToggleHide(layer.id)}
                className={`tap-target inline-flex !min-h-8 !min-w-8 items-center justify-center rounded-lg text-xs transition ${
                  layer.visible
                    ? "text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]"
                    : "text-[var(--danger)] bg-[var(--surface-sunken)]"
                } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]`}
                title={layer.visible ? "Hide layer" : "Show layer"}
                aria-label={layer.visible ? "Hide layer" : "Show layer"}
              >
                {layer.visible ? "👁️" : "🚫"}
              </button>

              {/* Lock / Unlock */}
              <button
                type="button"
                onClick={() => onToggleLock(layer.id)}
                className={`tap-target inline-flex !min-h-8 !min-w-8 items-center justify-center rounded-lg text-xs transition ${
                  layer.locked
                    ? "text-[var(--accent-amber)] bg-[var(--surface-sunken)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]"
                } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]`}
                title={layer.locked ? "Unlock layer" : "Lock layer"}
                aria-label={layer.locked ? "Unlock layer" : "Lock layer"}
              >
                {layer.locked ? "🔒" : "🔓"}
              </button>

              {/* Reorder Up */}
              <button
                type="button"
                disabled={isTop}
                onClick={() => onMoveUp(layer.id)}
                className="tap-target inline-flex !min-h-8 !min-w-8 items-center justify-center rounded-lg text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)] disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                title="Move layer up"
                aria-label="Move layer up"
              >
                ▲
              </button>

              {/* Reorder Down */}
              <button
                type="button"
                disabled={isBottom}
                onClick={() => onMoveDown(layer.id)}
                className="tap-target inline-flex !min-h-8 !min-w-8 items-center justify-center rounded-lg text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)] disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                title="Move layer down"
                aria-label="Move layer down"
              >
                ▼
              </button>

              {/* Duplicate */}
              <button
                type="button"
                onClick={() => onDuplicate(layer.id)}
                className="tap-target inline-flex !min-h-8 !min-w-8 items-center justify-center rounded-lg text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                title="Duplicate layer"
                aria-label="Duplicate layer"
              >
                📋
              </button>

              {/* Delete */}
              <button
                type="button"
                onClick={() => onDelete(layer.id)}
                className="tap-target inline-flex !min-h-8 !min-w-8 items-center justify-center rounded-lg text-xs text-[var(--danger)] hover:bg-[var(--surface-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                title="Delete layer"
                aria-label="Delete layer"
              >
                🗑️
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
