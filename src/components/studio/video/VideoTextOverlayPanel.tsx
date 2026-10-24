"use client";

import { useState } from "react";
import { btnPrimary } from "@/lib/ui/button-classes";
import type { TextOverlay } from "@/lib/video-timeline/timeline-types";

type Props = {
  textOverlays: TextOverlay[];
  currentTimeSec: number;
  onAddTextOverlay: (overlay: TextOverlay) => void;
  onRemoveTextOverlay: (id: string) => void;
  onUpdateTextOverlay: (id: string, patch: Partial<TextOverlay>) => void;
};

const STYLES: { id: TextOverlay["style"]; label: string; fontColor: string; bgColor: string }[] = [
  { id: "bold", label: "Bold Impact", fontColor: "#ffffff", bgColor: "rgba(0,0,0,0.6)" },
  { id: "subtitle", label: "Clean Subtitle", fontColor: "#ffea79", bgColor: "rgba(0,0,0,0.8)" },
  { id: "cyber", label: "Cyber Neon", fontColor: "#00ffff", bgColor: "rgba(10,10,25,0.7)" },
  { id: "minimal", label: "Minimal Lower-Third", fontColor: "#ffffff", bgColor: "transparent" },
];

export function VideoTextOverlayPanel({
  textOverlays,
  currentTimeSec,
  onAddTextOverlay,
  onRemoveTextOverlay,
  onUpdateTextOverlay,
}: Props) {
  const [newText, setNewText] = useState("Awesome Burger");
  const [selectedStyle, setSelectedStyle] = useState<TextOverlay["style"]>("bold");

  const handleAdd = () => {
    if (!newText.trim()) return;
    const styleDef = STYLES.find((s) => s.id === selectedStyle) ?? STYLES[0];
    const newOverlay: TextOverlay = {
      id: `text-${Date.now()}`,
      trackId: "track-text-1",
      startSec: currentTimeSec,
      endSec: currentTimeSec + 2.5,
      text: newText.trim(),
      fontSize: 36,
      fontColor: styleDef.fontColor,
      bgColor: styleDef.bgColor,
      xPercent: 50,
      yPercent: 80,
      style: selectedStyle,
      animation: "fade",
    };
    onAddTextOverlay(newOverlay);
    setNewText("");
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Add Text / Caption Overlay
        </label>
        <div className="mt-1 flex gap-2">
          <input
            type="text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Enter overlay text..."
            className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 py-2 text-sm outline-none focus:border-[var(--accent-primary)]"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!newText.trim()}
            className={`${btnPrimary} px-4 text-xs font-semibold`}
          >
            + Add
          </button>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-[var(--text-muted)]">
          Caption Style Preset
        </label>
        <div className="mt-1 grid grid-cols-2 gap-2">
          {STYLES.map((style) => (
            <button
              key={style.id}
              type="button"
              onClick={() => setSelectedStyle(style.id)}
              className={`rounded-lg border p-2 text-left transition ${
                selectedStyle === style.id
                  ? "border-[var(--accent-primary)] bg-[var(--accent-primary-subtle)] text-[var(--accent-primary)]"
                  : "border-[var(--border-subtle)] bg-[var(--surface-sunken)] hover:border-[var(--border-strong)]"
              }`}
            >
              <span className="text-xs font-semibold">{style.label}</span>
              <div
                className="mt-1 truncate rounded px-1.5 py-0.5 text-center text-[10px]"
                style={{ backgroundColor: style.bgColor, color: style.fontColor }}
              >
                Sample Text
              </div>
            </button>
          ))}
        </div>
      </div>

      {textOverlays.length > 0 ? (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Active Overlays ({textOverlays.length})
          </h4>
          <div className="mt-2 space-y-2 max-h-56 overflow-y-auto">
            {textOverlays.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-2.5 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    value={item.text}
                    onChange={(e) => onUpdateTextOverlay(item.id, { text: e.target.value })}
                    className="flex-1 rounded border border-[var(--border-subtle)] bg-[var(--surface-base)] px-2 py-1 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => onRemoveTextOverlay(item.id)}
                    className="text-[var(--danger)] hover:underline"
                  >
                    Delete
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-[var(--text-muted)]">
                  <label>
                    Start (s):
                    <input
                      type="number"
                      step={0.1}
                      min={0}
                      value={item.startSec}
                      onChange={(e) => onUpdateTextOverlay(item.id, { startSec: Number(e.target.value) })}
                      className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
                    />
                  </label>
                  <label>
                    End (s):
                    <input
                      type="number"
                      step={0.1}
                      min={0.1}
                      value={item.endSec}
                      onChange={(e) => onUpdateTextOverlay(item.id, { endSec: Number(e.target.value) })}
                      className="mt-0.5 w-full rounded border px-1.5 py-0.5 text-xs"
                    />
                  </label>
                  <label>
                    Y Position %:
                    <input
                      type="range"
                      min={10}
                      max={90}
                      value={item.yPercent}
                      onChange={(e) => onUpdateTextOverlay(item.id, { yPercent: Number(e.target.value) })}
                      className="mt-2 w-full"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
