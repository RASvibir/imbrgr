"use client";

import React from "react";
import {
  MEME_FONTS,
  type MemeLayer,
  type MemeShapeType,
  type MemeTextLayer,
  type MemeStickerLayer,
  type MemeShapeLayer,
} from "@/lib/tools/meme-render";

interface LayerPropertyPanelProps {
  layer: MemeLayer | null;
  onUpdateLayer: (patch: Partial<MemeLayer>) => void;
  onDeleteLayer: () => void;
}

const COLOR_SWATCHES = [
  "#ffffff",
  "#fbbf24", // ember amber
  "#f97316", // ember orange
  "#ef4444", // red
  "#22c55e", // green
  "#06b6d4", // cyan
  "#141210", // dark charcoal
];

const POPULAR_EMOJIS = [
  "🔥", "🍔", "💀", "🤡", "😂", "🚀", "💯", "👑", "👀", "⚡",
  "🕶️", "💥", "🧢", "💩", "🐱", "🐶", "🍕", "🎯", "🚨", "✨",
];

const SHAPE_OPTIONS: { id: MemeShapeType; label: string; icon: string }[] = [
  { id: "speech-bubble", label: "Speech Bubble", icon: "💬" },
  { id: "arrow", label: "Arrow", icon: "➔" },
  { id: "rectangle", label: "Box", icon: "▭" },
  { id: "circle", label: "Circle", icon: "◯" },
  { id: "star", label: "Star", icon: "★" },
];

export function LayerPropertyPanel({
  layer,
  onUpdateLayer,
  onDeleteLayer,
}: LayerPropertyPanelProps) {
  if (!layer) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border-subtle)] p-6 text-center text-xs text-[var(--text-muted)]">
        Click or tap any layer on the canvas to customize its properties.
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="layer-property-panel">
      {/* Header with layer name & delete button */}
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--surface-raised)] border border-[var(--border-subtle)] text-xs font-bold">
            {layer.type === "text" && "T"}
            {layer.type === "image" && "🖼️"}
            {layer.type === "sticker" && (layer as MemeStickerLayer).emoji}
            {layer.type === "shape" && "◼️"}
          </span>
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
            {layer.name}
          </h3>
        </div>

        <button
          type="button"
          onClick={onDeleteLayer}
          className="tap-target inline-flex !min-h-7 items-center justify-center rounded-lg px-2 text-xs font-medium text-[var(--danger)] hover:bg-[var(--danger)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          aria-label="Delete this layer"
        >
          🗑️ Delete
        </button>
      </div>

      {/* 1. TEXT LAYER CONTROLS */}
      {layer.type === "text" && (
        <div className="space-y-3.5">
          {/* Text Content Area */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)]">
              Text
            </label>
            <textarea
              value={(layer as MemeTextLayer).text}
              onChange={(e) => onUpdateLayer({ text: e.target.value })}
              rows={2}
              className="mt-1 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface-base)] p-2.5 text-xs text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              placeholder="Enter text..."
              aria-label="Text layer content"
            />
          </div>

          {/* Font Stack & All Caps */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                Font
              </label>
              <select
                value={(layer as MemeTextLayer).fontFamily}
                onChange={(e) => onUpdateLayer({ fontFamily: e.target.value })}
                className="tap-target mt-1 w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface-base)] px-2.5 text-xs font-medium text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                aria-label="Font family"
              >
                {MEME_FONTS.map((f) => (
                  <option key={f.id} value={f.stack}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                Text Style
              </label>
              <button
                type="button"
                onClick={() =>
                  onUpdateLayer({ allCaps: !(layer as MemeTextLayer).allCaps })
                }
                className={`tap-target mt-1 flex w-full items-center justify-center rounded-xl border text-xs font-bold transition ${
                  (layer as MemeTextLayer).allCaps
                    ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
                    : "border-[var(--border-strong)] bg-[var(--surface-base)] text-[var(--text-secondary)]"
                } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]`}
                aria-label="Toggle all caps"
              >
                {(layer as MemeTextLayer).allCaps ? "ALL CAPS ON" : "Normal Caps"}
              </button>
            </div>
          </div>

          {/* Font Size & Alignment */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-secondary)]">
                <span>Font Size</span>
                <span>{(layer as MemeTextLayer).fontSize}px</span>
              </div>
              <input
                type="range"
                min={16}
                max={96}
                value={(layer as MemeTextLayer).fontSize}
                onChange={(e) => onUpdateLayer({ fontSize: Number(e.target.value) })}
                className="mt-2 w-full accent-[var(--accent-primary)]"
                aria-label="Font size"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                Alignment
              </label>
              <div className="mt-1 flex items-center rounded-xl border border-[var(--border-strong)] bg-[var(--surface-base)] p-0.5">
                {(["left", "center", "right"] as const).map((align) => (
                  <button
                    key={align}
                    type="button"
                    onClick={() => onUpdateLayer({ align })}
                    className={`tap-target flex-1 rounded-lg text-xs font-bold capitalize transition ${
                      (layer as MemeTextLayer).align === align
                        ? "bg-[var(--accent-primary)] text-[var(--on-accent)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                    } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]`}
                    aria-label={`Align ${align}`}
                  >
                    {align[0].toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Fill Color */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-secondary)]">
              <span>Text Color</span>
              <span className="font-mono text-[10px]">{(layer as MemeTextLayer).fillColor}</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <input
                type="color"
                value={(layer as MemeTextLayer).fillColor}
                onChange={(e) => onUpdateLayer({ fillColor: e.target.value })}
                className="h-8 w-8 cursor-pointer rounded-lg border border-[var(--border-strong)] bg-transparent p-0.5"
                aria-label="Pick text fill color"
              />
              <div className="flex flex-1 items-center gap-1 overflow-x-auto">
                {COLOR_SWATCHES.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => onUpdateLayer({ fillColor: hex })}
                    style={{ backgroundColor: hex }}
                    className="tap-target h-6 w-6 shrink-0 rounded-full border border-[var(--border-strong)] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                    aria-label={`Set color ${hex}`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Stroke (Outline) */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-secondary)]">
              <span>Outline Width</span>
              <span>{(layer as MemeTextLayer).strokeWidth}px</span>
            </div>
            <input
              type="range"
              min={0}
              max={16}
              value={(layer as MemeTextLayer).strokeWidth}
              onChange={(e) => onUpdateLayer({ strokeWidth: Number(e.target.value) })}
              className="mt-1.5 w-full accent-[var(--accent-primary)]"
              aria-label="Stroke width"
            />
            <div className="mt-1.5 flex items-center gap-1.5">
              <input
                type="color"
                value={(layer as MemeTextLayer).strokeColor}
                onChange={(e) => onUpdateLayer({ strokeColor: e.target.value })}
                className="h-8 w-8 cursor-pointer rounded-lg border border-[var(--border-strong)] bg-transparent p-0.5"
                aria-label="Pick stroke color"
              />
              <span className="text-[11px] text-[var(--text-muted)]">Stroke color</span>
            </div>
          </div>

          {/* Shadow Toggle */}
          <div className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-2">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">
              Drop Shadow
            </span>
            <input
              type="checkbox"
              checked={(layer as MemeTextLayer).shadow}
              onChange={(e) => onUpdateLayer({ shadow: e.target.checked })}
              className="rounded accent-[var(--accent-primary)] h-4 w-4"
              aria-label="Toggle drop shadow"
            />
          </div>
        </div>
      )}

      {/* 2. STICKER LAYER CONTROLS */}
      {layer.type === "sticker" && (
        <div className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
              Select Emoji
            </label>
            <div className="grid grid-cols-5 gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-base)] p-2">
              {POPULAR_EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => onUpdateLayer({ emoji: em })}
                  className={`tap-target flex items-center justify-center rounded-lg text-lg hover:bg-[var(--surface-hover)] ${
                    (layer as MemeStickerLayer).emoji === em
                      ? "bg-[var(--accent-primary)]/20 border border-[var(--accent-primary)]"
                      : ""
                  }`}
                  aria-label={`Select emoji sticker ${em}`}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-secondary)]">
              <span>Size</span>
              <span>{Math.round(layer.width)}px</span>
            </div>
            <input
              type="range"
              min={40}
              max={240}
              value={layer.width}
              onChange={(e) => {
                const s = Number(e.target.value);
                onUpdateLayer({ width: s, height: s });
              }}
              className="mt-1.5 w-full accent-[var(--accent-primary)]"
              aria-label="Sticker size"
            />
          </div>
        </div>
      )}

      {/* 3. SHAPE LAYER CONTROLS */}
      {layer.type === "shape" && (
        <div className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
              Shape Type
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {SHAPE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onUpdateLayer({ shape: opt.id })}
                  className={`tap-target flex items-center gap-2 rounded-xl border px-2.5 text-xs font-semibold transition ${
                    (layer as MemeShapeLayer).shape === opt.id
                      ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
                      : "border-[var(--border-subtle)] bg-[var(--surface-base)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                  }`}
                >
                  <span>{opt.icon}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Fill Color */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-secondary)]">
              <span>Shape Fill</span>
              <span className="font-mono text-[10px]">{(layer as MemeShapeLayer).fillColor}</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <input
                type="color"
                value={(layer as MemeShapeLayer).fillColor}
                onChange={(e) => onUpdateLayer({ fillColor: e.target.value })}
                className="h-8 w-8 cursor-pointer rounded-lg border border-[var(--border-strong)] bg-transparent p-0.5"
                aria-label="Pick shape fill color"
              />
              <div className="flex flex-1 items-center gap-1 overflow-x-auto">
                {COLOR_SWATCHES.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => onUpdateLayer({ fillColor: hex })}
                    style={{ backgroundColor: hex }}
                    className="tap-target h-6 w-6 shrink-0 rounded-full border border-[var(--border-strong)] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                    aria-label={`Set shape fill color ${hex}`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Stroke Width */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-secondary)]">
              <span>Border Width</span>
              <span>{(layer as MemeShapeLayer).strokeWidth}px</span>
            </div>
            <input
              type="range"
              min={0}
              max={16}
              value={(layer as MemeShapeLayer).strokeWidth}
              onChange={(e) => onUpdateLayer({ strokeWidth: Number(e.target.value) })}
              className="mt-1.5 w-full accent-[var(--accent-primary)]"
              aria-label="Shape stroke width"
            />
          </div>
        </div>
      )}

      {/* 4. COMMON TRANSFORM CONTROLS (Rotation, Opacity) */}
      <div className="space-y-3 border-t border-[var(--border-subtle)] pt-3">
        {/* Rotation */}
        <div>
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-secondary)]">
            <span>Rotation</span>
            <span>{Math.round(layer.rotation)}°</span>
          </div>
          <input
            type="range"
            min={0}
            max={360}
            value={layer.rotation}
            onChange={(e) => onUpdateLayer({ rotation: Number(e.target.value) })}
            className="mt-1.5 w-full accent-[var(--accent-primary)]"
            aria-label="Layer rotation"
          />
        </div>

        {/* Opacity */}
        <div>
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-secondary)]">
            <span>Opacity</span>
            <span>{Math.round(layer.opacity * 100)}%</span>
          </div>
          <input
            type="range"
            min={10}
            max={100}
            value={Math.round(layer.opacity * 100)}
            onChange={(e) => onUpdateLayer({ opacity: Number(e.target.value) / 100 })}
            className="mt-1.5 w-full accent-[var(--accent-primary)]"
            aria-label="Layer opacity"
          />
        </div>
      </div>
    </div>
  );
}
