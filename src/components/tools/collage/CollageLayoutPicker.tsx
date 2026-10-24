"use client";

import React, { useState } from "react";
import {
  COLLAGE_TEMPLATES,
  type CollageCategory,
  type CollageLayoutTemplate,
} from "@/lib/tools/collage-layouts";

interface CollageLayoutPickerProps {
  currentLayoutId: string;
  onSelectLayout: (template: CollageLayoutTemplate) => void;
}

export function CollageLayoutPicker({
  currentLayoutId,
  onSelectLayout,
}: CollageLayoutPickerProps) {
  const [selectedCategory, setSelectedCategory] = useState<CollageCategory>("all");
  const [filterCount, setFilterCount] = useState<number | "all">("all");

  const categories: { id: CollageCategory; label: string }[] = [
    { id: "all", label: "All Layouts" },
    { id: "grid", label: "Grids" },
    { id: "split", label: "Splits" },
    { id: "hero", label: "Hero + Thumbs" },
    { id: "filmstrip", label: "Filmstrip" },
    { id: "polaroid", label: "Polaroids" },
    { id: "circle", label: "Circles" },
    { id: "freeform", label: "Free-Form" },
  ];

  const counts: (number | "all")[] = ["all", 2, 3, 4, 5, 6, 7, 8, 9];

  const filteredTemplates = COLLAGE_TEMPLATES.filter((t) => {
    if (selectedCategory !== "all" && t.category !== selectedCategory) return false;
    if (filterCount !== "all" && t.cellCount !== filterCount) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Category Filter Pills */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
          Layout Style
        </label>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Layout categories">
          {categories.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setSelectedCategory(cat.id)}
                className={`tap-target inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
                  isActive
                    ? "bg-[var(--accent-primary)] text-[var(--on-accent)] font-semibold shadow-sm"
                    : "border border-[var(--border-subtle)] bg-[var(--surface-base)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Photo Count Quick Filter */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
          Number of Photos
        </label>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by photo count">
          {counts.map((c) => {
            const isActive = filterCount === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setFilterCount(c)}
                className={`tap-target inline-flex h-7 min-w-7 items-center justify-center rounded-md px-2 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
                  isActive
                    ? "bg-[var(--accent-primary)] text-[var(--on-accent)] font-bold"
                    : "border border-[var(--border-subtle)] bg-[var(--surface-base)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                {c === "all" ? "All" : `${c}`}
              </button>
            );
          })}
        </div>
      </div>

      {/* Template Grid Cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {filteredTemplates.map((template) => {
          const isSelected = template.id === currentLayoutId;
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => onSelectLayout(template)}
              aria-label={`Select layout: ${template.name} with ${template.cellCount} photos`}
              aria-pressed={isSelected}
              className={`tap-target group flex flex-col items-center rounded-xl border p-2 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
                isSelected
                  ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 shadow-[var(--shadow-ember)]"
                  : "border-[var(--border-subtle)] bg-[var(--surface-base)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
              }`}
            >
              {/* Miniature Layout Preview SVG */}
              <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-1">
                <svg
                  viewBox="0 0 100 100"
                  className="h-full w-full"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {template.cells.map((cell, idx) => {
                    const cx = cell.x * 100;
                    const cy = cell.y * 100;
                    const cw = cell.width * 100;
                    const ch = cell.height * 100;

                    if (cell.shape === "circle") {
                      const r = Math.min(cw, ch) / 2 - 2;
                      return (
                        <circle
                          key={cell.id}
                          cx={cx + cw / 2}
                          cy={cy + ch / 2}
                          r={Math.max(2, r)}
                          fill={isSelected ? "var(--accent-primary)" : "var(--border-strong)"}
                          fillOpacity={0.65 + (idx % 3) * 0.1}
                          stroke="var(--surface-base)"
                          strokeWidth="1.5"
                        />
                      );
                    }

                    if (cell.shape === "polaroid") {
                      return (
                        <g
                          key={cell.id}
                          transform={`rotate(${cell.rotation || 0} ${cx + cw / 2} ${cy + ch / 2})`}
                        >
                          <rect
                            x={cx + 1}
                            y={cy + 1}
                            width={Math.max(4, cw - 2)}
                            height={Math.max(4, ch - 2)}
                            rx="1.5"
                            fill="#ffffff"
                            stroke="rgba(0,0,0,0.15)"
                            strokeWidth="0.5"
                          />
                          <rect
                            x={cx + 2.5}
                            y={cy + 2.5}
                            width={Math.max(2, cw - 5)}
                            height={Math.max(2, ch * 0.7)}
                            fill={isSelected ? "var(--accent-primary)" : "var(--border-strong)"}
                            fillOpacity={0.7}
                          />
                        </g>
                      );
                    }

                    return (
                      <rect
                        key={cell.id}
                        x={cx + 1}
                        y={cy + 1}
                        width={Math.max(2, cw - 2)}
                        height={Math.max(2, ch - 2)}
                        rx="2"
                        fill={isSelected ? "var(--accent-primary)" : "var(--border-strong)"}
                        fillOpacity={0.6 + (idx % 4) * 0.1}
                        stroke="var(--surface-base)"
                        strokeWidth="1.5"
                      />
                    );
                  })}
                </svg>
              </div>

              <span className="mt-1.5 block line-clamp-1 text-xs font-semibold text-[var(--text-primary)]">
                {template.name}
              </span>
              <span className="text-[10px] text-[var(--text-muted)]">
                {template.cellCount} {template.cellCount === 1 ? "photo" : "photos"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
