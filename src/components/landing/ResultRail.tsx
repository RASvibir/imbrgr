"use client";

import React, { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { putFile } from "@/lib/landing/handoff";
import { applyFunFilter } from "@/lib/fun-filters";
import {
  calculateMemeLayout,
  calculateCollageSlices,
  buildToolUrl,
} from "@/lib/landing/rail-transforms";

interface ResultRailProps {
  file: File;
  imageEl: HTMLImageElement;
  onClear?: () => void;
}

export function ResultRail({ file, imageEl, onClear }: ResultRailProps) {
  const [handoffId, setHandoffId] = useState<string | null>(null);
  const [activeFilterId, setActiveFilterId] = useState<string>("flame-grilled");
  const [, startTransition] = useTransition();

  // Canvas refs
  const memeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const gifCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const collageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const filterCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const arCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Store file in client-side handoff storage
  useEffect(() => {
    let cancelled = false;
    putFile(file).then((id) => {
      if (!cancelled) setHandoffId(id);
    });
    return () => {
      cancelled = true;
    };
  }, [file]);

  // 1. Render Meme Preview
  useEffect(() => {
    const canvas = memeCanvasRef.current;
    if (!canvas || !imageEl.complete) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = (canvas.width = 400);
    const h = (canvas.height = 400);

    // Draw image cover
    drawImageCover(ctx, imageEl, w, h);

    // Darken slight top and bottom for text contrast
    const topFade = ctx.createLinearGradient(0, 0, 0, 90);
    topFade.addColorStop(0, "rgba(0,0,0,0.6)");
    topFade.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = topFade;
    ctx.fillRect(0, 0, w, 90);

    const bottomFade = ctx.createLinearGradient(0, h - 90, 0, h);
    bottomFade.addColorStop(0, "rgba(0,0,0,0)");
    bottomFade.addColorStop(1, "rgba(0,0,0,0.65)");
    ctx.fillStyle = bottomFade;
    ctx.fillRect(0, h - 90, w, 90);

    // Calculate and draw meme text
    const layout = calculateMemeLayout(w, h, "DROP IT, SEE IT", "COOKED IN 10s");
    ctx.font = `900 ${layout.fontSize}px Impact, "Arial Black", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Top text
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = layout.strokeWidth * 2;
    ctx.strokeText(layout.topText, w / 2, layout.topY);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(layout.topText, w / 2, layout.topY);

    // Bottom text
    ctx.strokeText(layout.bottomText, w / 2, layout.bottomY);
    ctx.fillText(layout.bottomText, w / 2, layout.bottomY);
  }, [imageEl]);

  // 2. Render Looping GIF Preview (lightweight rAF loop)
  useEffect(() => {
    const canvas = gifCanvasRef.current;
    if (!canvas || !imageEl.complete) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = (canvas.width = 400);
    const h = (canvas.height = 400);

    let animId: number;
    const startTime = performance.now();
    let isVisible = true;

    // Pause when offscreen
    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
    });
    observer.observe(canvas);

    // Check prefers-reduced-motion
    const prefersReducedMotion =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderFrame = (now: number) => {
      if (isVisible) {
        const elapsed = (now - startTime) / 1000;
        const progress = prefersReducedMotion ? 0 : (elapsed % 1.6) / 1.6;

        ctx.clearRect(0, 0, w, h);
        ctx.save();

        // Subtle pulse zoom & tilt
        const scale = prefersReducedMotion
          ? 1
          : 1 + Math.sin(progress * Math.PI * 2) * 0.04;
        const tilt = prefersReducedMotion
          ? 0
          : Math.sin(progress * Math.PI * 2) * 0.02;

        ctx.translate(w / 2, h / 2);
        ctx.scale(scale, scale);
        ctx.rotate(tilt);
        ctx.translate(-w / 2, -h / 2);

        drawImageCover(ctx, imageEl, w, h);
        ctx.restore();

        // GIF loop indicator overlay
        ctx.save();
        ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
        ctx.beginPath();
        ctx.roundRect(14, h - 42, 100, 28, 8);
        ctx.fill();

        ctx.fillStyle = "#fbbf24";
        ctx.font = "bold 12px monospace";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText("▶ LOOPING", 24, h - 28);

        // Progress bar along bottom
        ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
        ctx.fillRect(0, h - 4, w, 4);
        ctx.fillStyle = "#f97316";
        ctx.fillRect(0, h - 4, w * progress, 4);
        ctx.restore();
      }

      if (!prefersReducedMotion) {
        animId = requestAnimationFrame(renderFrame);
      }
    };

    animId = requestAnimationFrame(renderFrame);

    return () => {
      cancelAnimationFrame(animId);
      observer.disconnect();
    };
  }, [imageEl]);

  // 3. Render Collage Preview
  useEffect(() => {
    const canvas = collageCanvasRef.current;
    if (!canvas || !imageEl.complete) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = (canvas.width = 400);
    const h = (canvas.height = 400);

    ctx.fillStyle = "#141210";
    ctx.fillRect(0, 0, w, h);

    const slices = calculateCollageSlices(w, h, 6);

    for (const s of slices) {
      ctx.save();
      // Clip panel
      ctx.beginPath();
      ctx.roundRect(s.dx, s.dy, s.dw, s.dh, 8);
      ctx.clip();

      // Draw partition
      drawImageCover(ctx, imageEl, s.dw, s.dh, s.dx, s.dy);

      // Panel subtle inner shadow & border
      ctx.strokeStyle = "rgba(251, 191, 36, 0.3)";
      ctx.lineWidth = 2;
      ctx.strokeRect(s.dx, s.dy, s.dw, s.dh);
      ctx.restore();
    }
  }, [imageEl]);

  // 4. Render Fun Filter Preview
  useEffect(() => {
    const canvas = filterCanvasRef.current;
    if (!canvas || !imageEl.complete) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const w = (canvas.width = 400);
    const h = (canvas.height = 400);

    drawImageCover(ctx, imageEl, w, h);

    try {
      const imgData = ctx.getImageData(0, 0, w, h);
      applyFunFilter(imgData, activeFilterId, { timeSec: 0.5, intensity: 1 });
      ctx.putImageData(imgData, 0, 0);
    } catch {
      // Graceful fallback if tainted canvas
    }
  }, [imageEl, activeFilterId]);

  // 5. Render AR Effect Frame
  useEffect(() => {
    const canvas = arCanvasRef.current;
    if (!canvas || !imageEl.complete) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = (canvas.width = 400);
    const h = (canvas.height = 400);

    drawImageCover(ctx, imageEl, w, h);

    // Overlay AR Cyber/Flame HUD
    ctx.save();

    // 1. AR Corner reticles
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 3;
    const bracketSize = 28;
    const pad = 24;

    // Top-left
    ctx.beginPath();
    ctx.moveTo(pad, pad + bracketSize);
    ctx.lineTo(pad, pad);
    ctx.lineTo(pad + bracketSize, pad);
    ctx.stroke();

    // Top-right
    ctx.beginPath();
    ctx.moveTo(w - pad - bracketSize, pad);
    ctx.lineTo(w - pad, pad);
    ctx.lineTo(w - pad, pad + bracketSize);
    ctx.stroke();

    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(pad, h - pad - bracketSize);
    ctx.lineTo(pad, h - pad);
    ctx.lineTo(pad + bracketSize, h - pad);
    ctx.stroke();

    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(w - pad - bracketSize, h - pad);
    ctx.lineTo(w - pad, h - pad);
    ctx.lineTo(w - pad, h - pad - bracketSize);
    ctx.stroke();

    // 2. Center Face Target Box & Crosshair
    const boxW = 160;
    const boxH = 170;
    const bx = (w - boxW) / 2;
    const by = (h - boxH) / 2 - 10;

    ctx.strokeStyle = "rgba(251, 191, 36, 0.75)";
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(bx, by, boxW, boxH, 16);
    ctx.stroke();
    ctx.setLineDash([]);

    // Facial landmark dots (AR tracking points)
    ctx.fillStyle = "#38bdf8";
    const landmarks = [
      [bx + 45, by + 55], // left eye
      [bx + 115, by + 55], // right eye
      [bx + 80, by + 90], // nose
      [bx + 55, by + 125], // mouth left
      [bx + 105, by + 125], // mouth right
    ];
    for (const [lx, ly] of landmarks) {
      ctx.beginPath();
      ctx.arc(lx, ly, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Chef Burger Hat on Top (cute AR sticker effect)
    const hatY = by - 40;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(bx + 80, hatY, 40, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ea580c";
    ctx.fillRect(bx + 50, hatY + 12, 60, 10);

    // 4. AR Status Badges
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.beginPath();
    ctx.roundRect(pad, pad, 120, 26, 6);
    ctx.fill();

    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(pad + 12, pad + 13, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 11px monospace";
    ctx.fillText("REC ● 00:01:24", pad + 24, pad + 17);

    // Bottom AR pill
    ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    ctx.beginPath();
    ctx.roundRect(w - 175 - pad, h - 32 - pad, 175, 28, 6);
    ctx.fill();

    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 11px monospace";
    ctx.fillText("FACE_TRACK: 100% FX", w - 165 - pad, h - 14 - pad);

    ctx.restore();
  }, [imageEl]);

  return (
    <section
      className="mt-8 space-y-6"
      aria-label="Instant Result Rail"
      data-testid="result-rail"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-primary)]/10 px-3 py-1 text-xs font-semibold text-[var(--accent-primary)]">
            <span>✨</span>
            <span>Instant Client-Side Results</span>
          </div>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Pick your favorite outcome to edit
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Rendered right in your browser. Click any card to customize it in full.
          </p>
        </div>

        {onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="tap-target inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
          >
            ↺ Try another image
          </button>
        ) : null}
      </div>

      {/* Grid of Result Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {/* Card 1: Meme Maker */}
        <ResultCard
          href={buildToolUrl("/tools/meme", handoffId)}
          title="Meme Maker"
          badge="Top Pick"
          description="Bold typography & captions"
          testId="result-card-meme"
        >
          <canvas
            ref={memeCanvasRef}
            className="h-full w-full object-cover"
            aria-label="Meme outcome preview"
          />
        </ResultCard>

        {/* Card 2: Looping GIF */}
        <ResultCard
          href={buildToolUrl("/tools/gif", handoffId)}
          title="Looping GIF"
          badge="Motion"
          description="Endless smooth animation"
          testId="result-card-gif"
        >
          <canvas
            ref={gifCanvasRef}
            className="h-full w-full object-cover"
            aria-label="Looping GIF animation preview"
          />
        </ResultCard>

        {/* Card 3: Photo Collage */}
        <ResultCard
          href={buildToolUrl("/tools/collage", handoffId)}
          title="Combine Photos"
          badge="Grid"
          description="Sleek multi-angle arrangement"
          testId="result-card-collage"
        >
          <canvas
            ref={collageCanvasRef}
            className="h-full w-full object-cover"
            aria-label="Collage partition preview"
          />
        </ResultCard>

        {/* Card 4: Fun Filter */}
        <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] transition duration-200 hover:border-[var(--accent-primary)] hover:shadow-[var(--shadow-ember)] focus-within:ring-2 focus-within:ring-[var(--ring)]">
          <Link
            href={buildToolUrl("/tools/filters", handoffId)}
            className="flex-1 focus:outline-none"
            data-testid="result-card-filter"
            aria-label="Open filter tool with this style"
          >
            <div className="relative aspect-square w-full overflow-hidden bg-[var(--surface-sunken)]">
              <canvas
                ref={filterCanvasRef}
                className="h-full w-full object-cover"
                aria-label="Filtered style preview"
              />
              <div className="absolute top-3 left-3 rounded-md bg-[var(--surface-base)]/80 px-2 py-0.5 text-xs font-semibold text-[var(--accent-primary)] backdrop-blur">
                Fun FX
              </div>
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)]">
                Style & Shader
              </h3>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                Flame-grilled, cheese melt, & VHS
              </p>
            </div>
          </Link>

          {/* Interactive filter switcher */}
          <div className="flex gap-1 border-t border-[var(--border-subtle)] bg-[var(--surface-sunken)]/60 px-3 py-2">
            {[
              { id: "flame-grilled", label: "🔥 Flame" },
              { id: "cheese-melt", label: "🧀 Melt" },
              { id: "deep-fried", label: "🍟 Fried" },
              { id: "pixel-patty", label: "👾 Pixel" },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  startTransition(() => setActiveFilterId(f.id));
                }}
                className={`flex-1 rounded px-1.5 py-1 text-[11px] font-medium transition ${
                  activeFilterId === f.id
                    ? "bg-[var(--accent-primary)] text-[var(--on-accent)] font-semibold"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Card 5: AR Effect */}
        <ResultCard
          href={buildToolUrl("/tools/ar", handoffId)}
          title="Face AR & Hats"
          badge="Realtime"
          description="Face tracking & stickers"
          testId="result-card-ar"
        >
          <canvas
            ref={arCanvasRef}
            className="h-full w-full object-cover"
            aria-label="AR face effect preview"
          />
        </ResultCard>
      </div>
    </section>
  );
}

function ResultCard({
  href,
  title,
  badge,
  description,
  children,
  testId,
}: {
  href: string;
  title: string;
  badge: string;
  description: string;
  children: React.ReactNode;
  testId: string;
}) {
  return (
    <Link
      href={href}
      data-testid={testId}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] transition duration-200 hover:-translate-y-1 hover:border-[var(--accent-primary)] hover:shadow-[var(--shadow-ember)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-[var(--surface-sunken)]">
        {children}
        <div className="absolute top-3 left-3 rounded-md bg-[var(--surface-base)]/80 px-2 py-0.5 text-xs font-semibold text-[var(--accent-primary)] backdrop-blur">
          {badge}
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
          <span className="rounded-xl bg-[var(--accent-primary)] px-3 py-1.5 text-xs font-bold text-[var(--on-accent)] shadow-lg">
            Open in Tool →
          </span>
        </div>
      </div>
      <div className="flex flex-1 flex-col justify-between p-4">
        <div>
          <h3 className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)]">
            {title}
          </h3>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            {description}
          </p>
        </div>
        <div className="mt-3 flex items-center text-xs font-semibold text-[var(--accent-primary)]">
          <span>Customize</span>
          <span className="ml-1 transition-transform group-hover:translate-x-1">
            →
          </span>
        </div>
      </div>
    </Link>
  );
}

/** Utility to draw an HTMLImageElement centered and cropped (object-fit: cover) */
function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  targetW: number,
  targetH: number,
  targetX = 0,
  targetY = 0,
) {
  const nw = img.naturalWidth || img.width || targetW;
  const nh = img.naturalHeight || img.height || targetH;

  const targetRatio = targetW / targetH;
  const imgRatio = nw / nh;

  let sx = 0;
  let sy = 0;
  let sw = nw;
  let sh = nh;

  if (imgRatio > targetRatio) {
    // Image is wider than target
    sw = nh * targetRatio;
    sx = (nw - sw) / 2;
  } else {
    // Image is taller than target
    sh = nw / targetRatio;
    sy = (nh - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, targetX, targetY, targetW, targetH);
}
