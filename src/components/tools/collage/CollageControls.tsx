"use client";

import React from "react";
import {
  type CollageState,
  BACKGROUND_GRADIENT_PRESETS,
} from "@/lib/tools/collage-render";
import { type CollageAspect } from "@/lib/tools/collage-layouts";
import { btnSecondary } from "@/lib/ui/button-classes";

interface CollageControlsProps {
  state: CollageState;
  onChange: (updater: (prev: CollageState) => CollageState) => void;
  onReset: () => void;
}

const COLOR_SWATCHES = [
  "#141210", // Ember Deep Dark
  "#1c1412", // Ember Charcoal
  "#262220", // Warm Gray
  "#ffffff", // Pure White
  "#000000", // Pure Black
  "#ea580c", // Ember Orange
  "#fbbf24", // Ember Amber
  "#f43f5e", // Ember Rose
  "#db2777", // Magenta
  "#4f46e5", // Indigo
  "#0f766e", // Teal
];

const ASPECT_OPTIONS: { id: CollageAspect; label: string; desc: string }[] = [
  { id: "1:1", label: "1:1", desc: "Square" },
  { id: "4:5", label: "4:5", desc: "Portrait" },
  { id: "9:16", label: "9:16", desc: "Story/Reel" },
  { id: "16:9", label: "16:9", desc: "Landscape" },
  { id: "custom", label: "Custom", desc: "Dimensions" },
];

export function CollageControls({ state, onChange, onReset }: CollageControlsProps) {
  const hasUploadedMedia = state.cells.some((c) => Boolean(c.media?.url));

  return (
    <div className="space-y-5 text-xs">
      {/* 1. Canvas Aspect Ratio */}
      <div className="space-y-2">
        <label className="block font-semibold text-[var(--text-secondary)]">
          Canvas Aspect Ratio
        </label>
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
          {ASPECT_OPTIONS.map((opt) => {
            const isSelected = state.aspectRatio === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() =>
                  onChange((prev) => ({
                    ...prev,
                    aspectRatio: opt.id,
                  }))
                }
                className={`tap-target flex flex-col items-center justify-center rounded-xl border p-2 text-center transition ${
                  isSelected
                    ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/15 font-bold text-[var(--accent-primary)] shadow-sm"
                    : "border-[var(--border-subtle)] bg-[var(--surface-base)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                }`}
              >
                <span className="text-xs font-bold">{opt.label}</span>
                <span className="text-[10px] text-[var(--text-muted)]">{opt.desc}</span>
              </button>
            );
          })}
        </div>

        {/* Custom Dimensions input */}
        {state.aspectRatio === "custom" && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <label className="text-[11px] text-[var(--text-muted)]">Width (px)</label>
              <input
                type="number"
                min={300}
                max={4000}
                value={state.customWidth}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 1080;
                  onChange((prev) => ({ ...prev, customWidth: val }));
                }}
                className="mt-0.5 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] px-2.5 py-1.5 text-xs text-[var(--text-primary)]"
              />
            </div>
            <div>
              <label className="text-[11px] text-[var(--text-muted)]">Height (px)</label>
              <input
                type="number"
                min={300}
                max={4000}
                value={state.customHeight}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 1080;
                  onChange((prev) => ({ ...prev, customHeight: val }));
                }}
                className="mt-0.5 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] px-2.5 py-1.5 text-xs text-[var(--text-primary)]"
              />
            </div>
          </div>
        )}
      </div>

      {/* 2. Spacing: Outer Padding, Inner Gap & Corner Radius */}
      <div className="space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3.5">
        <h4 className="font-bold text-[var(--text-primary)]">Layout Spacing & Corners</h4>

        <div>
          <div className="flex items-center justify-between font-semibold text-[var(--text-secondary)]">
            <span>Outer Padding</span>
            <span>{state.padding}px</span>
          </div>
          <input
            type="range"
            min={0}
            max={60}
            step={2}
            value={state.padding}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              onChange((prev) => ({ ...prev, padding: val }));
            }}
            className="mt-1.5 w-full accent-[var(--accent-primary)]"
            aria-label="Outer padding"
          />
        </div>

        <div>
          <div className="flex items-center justify-between font-semibold text-[var(--text-secondary)]">
            <span>Inner Gap Between Photos</span>
            <span>{state.gap}px</span>
          </div>
          <input
            type="range"
            min={0}
            max={40}
            step={2}
            value={state.gap}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              onChange((prev) => ({ ...prev, gap: val }));
            }}
            className="mt-1.5 w-full accent-[var(--accent-primary)]"
            aria-label="Inner gap"
          />
        </div>

        <div>
          <div className="flex items-center justify-between font-semibold text-[var(--text-secondary)]">
            <span>Corner Rounding</span>
            <span>{state.cornerRadius}px</span>
          </div>
          <input
            type="range"
            min={0}
            max={50}
            step={2}
            value={state.cornerRadius}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              onChange((prev) => ({ ...prev, cornerRadius: val }));
            }}
            className="mt-1.5 w-full accent-[var(--accent-primary)]"
            aria-label="Corner rounding"
          />
        </div>
      </div>

      {/* 3. Collage Border */}
      <div className="space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3.5">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-[var(--text-primary)]">Collage Outer Frame Border</h4>
          <span className="font-mono text-xs">{state.borderWidth}px</span>
        </div>

        <input
          type="range"
          min={0}
          max={24}
          step={1}
          value={state.borderWidth}
          onChange={(e) => {
            const val = parseInt(e.target.value);
            onChange((prev) => ({ ...prev, borderWidth: val }));
          }}
          className="w-full accent-[var(--accent-primary)]"
          aria-label="Outer frame border width"
        />

        {state.borderWidth > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-[var(--text-muted)]">Border Color:</label>
            <input
              type="color"
              value={state.borderColor}
              onChange={(e) => {
                const val = e.target.value;
                onChange((prev) => ({ ...prev, borderColor: val }));
              }}
              className="h-7 w-12 cursor-pointer rounded border border-[var(--border-subtle)] bg-transparent"
              aria-label="Border color"
            />
            <span className="font-mono text-xs text-[var(--text-muted)]">
              {state.borderColor}
            </span>
          </div>
        )}
      </div>

      {/* 4. Canvas Background (Solid, Gradient, Blurred Photo) */}
      <div className="space-y-3">
        <label className="block font-semibold text-[var(--text-secondary)]">
          Canvas Background
        </label>

        {/* Style tabs: Solid / Gradient / Blurred Photo */}
        <div className="flex rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-1">
          <button
            type="button"
            onClick={() =>
              onChange((prev) => ({
                ...prev,
                background: { type: "solid", color: "#141210" },
              }))
            }
            className={`tap-target flex-1 rounded-lg py-1.5 text-center text-xs font-medium transition ${
              state.background.type === "solid"
                ? "bg-[var(--accent-primary)] text-[var(--on-accent)] font-semibold shadow-sm"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Solid Color
          </button>
          <button
            type="button"
            onClick={() =>
              onChange((prev) => ({
                ...prev,
                background: {
                  type: "gradient",
                  presetId: "ember",
                  stops: ["#ea580c", "#fbbf24"],
                  angle: 135,
                },
              }))
            }
            className={`tap-target flex-1 rounded-lg py-1.5 text-center text-xs font-medium transition ${
              state.background.type === "gradient"
                ? "bg-[var(--accent-primary)] text-[var(--on-accent)] font-semibold shadow-sm"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Gradient
          </button>
          <button
            type="button"
            onClick={() =>
              onChange((prev) => ({
                ...prev,
                background: { type: "blur" },
              }))
            }
            className={`tap-target flex-1 rounded-lg py-1.5 text-center text-xs font-medium transition ${
              state.background.type === "blur"
                ? "bg-[var(--accent-primary)] text-[var(--on-accent)] font-semibold shadow-sm"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Blurred Photo
          </button>
        </div>

        {/* Solid Background Controls */}
        {state.background.type === "solid" && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {COLOR_SWATCHES.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  onClick={() =>
                    onChange((prev) => ({
                      ...prev,
                      background: { type: "solid", color: swatch },
                    }))
                  }
                  style={{ backgroundColor: swatch }}
                  className={`tap-target h-7 w-7 rounded-full border transition hover:scale-110 ${
                    state.background.type === "solid" && state.background.color === swatch
                      ? "ring-2 ring-[var(--accent-primary)] ring-offset-2 ring-offset-[var(--surface-base)]"
                      : "border-white/20"
                  }`}
                  aria-label={`Select solid background color ${swatch}`}
                />
              ))}
              <label
                className="tap-target relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-dashed border-[var(--border-strong)] bg-[var(--surface-sunken)] hover:border-[var(--accent-primary)]"
                title="Custom color picker"
              >
                <span className="text-[10px]">🎨</span>
                <input
                  type="color"
                  value={state.background.color}
                  onChange={(e) => {
                    const color = e.target.value;
                    onChange((prev) => ({
                      ...prev,
                      background: { type: "solid", color },
                    }));
                  }}
                  className="sr-only"
                  aria-label="Custom background color"
                />
              </label>
            </div>
          </div>
        )}

        {/* Gradient Presets */}
        {state.background.type === "gradient" && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {BACKGROUND_GRADIENT_PRESETS.map((p) => {
              const isSelected =
                state.background.type === "gradient" &&
                state.background.presetId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() =>
                    onChange((prev) => ({
                      ...prev,
                      background: {
                        type: "gradient",
                        presetId: p.id,
                        stops: p.stops,
                        angle: p.angle,
                      },
                    }))
                  }
                  className={`tap-target flex items-center gap-2 rounded-xl border p-2 text-left transition ${
                    isSelected
                      ? "border-[var(--accent-primary)] ring-1 ring-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                      : "border-[var(--border-subtle)] bg-[var(--surface-base)] hover:bg-[var(--surface-hover)]"
                  }`}
                >
                  <div
                    className="h-6 w-6 shrink-0 rounded-lg shadow-sm"
                    style={{
                      background: `linear-gradient(${p.angle}deg, ${p.stops[0]}, ${p.stops[1]})`,
                    }}
                  />
                  <span className="text-xs font-semibold text-[var(--text-primary)]">
                    {p.name}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Blurred Photo Notice */}
        {state.background.type === "blur" && (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3 text-[11px] text-[var(--text-secondary)]">
            {hasUploadedMedia ? (
              <p>
                ✨ Beautiful soft focus: using your collage photos blurred to create an ambient backdrop.
              </p>
            ) : (
              <p className="text-[var(--accent-primary)]">
                💡 Upload photos into your collage cells to see the ambient blurred photo background in action!
              </p>
            )}
          </div>
        )}
      </div>

      {/* 5. Animated Collage Mode */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3.5">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={state.animate}
            onChange={(e) => {
              const checked = e.target.checked;
              onChange((prev) => ({ ...prev, animate: checked }));
            }}
            className="mt-0.5 h-4 w-4 rounded border-[var(--border-strong)] accent-[var(--accent-primary)]"
          />
          <div>
            <span className="block font-bold text-[var(--text-primary)]">
              ⚡ Animate Collage Output
            </span>
            <span className="mt-0.5 block text-[11px] text-[var(--text-secondary)]">
              Enables animated GIF and WebM video export. Plays videos, animated GIFs, and motion fun filters (Flame-Grilled, Jelly Wobble, etc.).
            </span>
          </div>
        </label>
      </div>

      {/* 6. Reset Button */}
      <div className="pt-2 border-t border-[var(--border-subtle)]">
        <button
          type="button"
          onClick={onReset}
          className={`${btnSecondary} tap-target w-full text-xs text-[var(--danger)] hover:bg-[var(--danger)]/10 hover:border-[var(--danger)]/30`}
        >
          ↺ Reset Collage to Default
        </button>
      </div>
    </div>
  );
}
