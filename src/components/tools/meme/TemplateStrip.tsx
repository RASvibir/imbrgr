"use client";

import React, { useRef } from "react";
import { MEME_TEMPLATES, type MemeTemplate } from "@/lib/tools/meme-templates";

interface TemplateStripProps {
  onSelectTemplate: (template: MemeTemplate) => void;
  onUploadImage: (file: File) => void;
}

export function TemplateStrip({ onSelectTemplate, onUploadImage }: TemplateStripProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadImage(file);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-3">
      {/* Upload button & Quick paste prompt */}
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="tap-target flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--accent-primary)]/60 bg-[var(--accent-primary)]/10 px-3 py-2 text-xs font-semibold text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <span>📁</span>
          <span>Upload Image or GIF</span>
        </button>
      </div>

      <div className="text-[11px] text-[var(--text-muted)] text-center">
        Tip: You can also drag & drop or paste (<kbd className="rounded bg-[var(--surface-sunken)] px-1 py-0.5 border border-[var(--border-subtle)]">Ctrl+V</kbd>) anywhere.
      </div>

      {/* Built-in Original Template Strip */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
          Original Meme Formats
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {MEME_TEMPLATES.map((tmpl) => (
            <button
              key={tmpl.id}
              type="button"
              onClick={() => onSelectTemplate(tmpl)}
              className="group relative flex flex-col items-center overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-1.5 text-left transition hover:border-[var(--accent-primary)] hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              aria-label={`Use template: ${tmpl.name}`}
            >
              <div className="aspect-square w-full overflow-hidden rounded-lg bg-[var(--surface-sunken)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={tmpl.svgDataUrl}
                  alt={tmpl.name}
                  className="h-full w-full object-contain transition duration-200 group-hover:scale-105"
                  loading="lazy"
                />
              </div>
              <span className="mt-1.5 w-full truncate text-center text-[11px] font-semibold text-[var(--text-primary)]">
                {tmpl.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
