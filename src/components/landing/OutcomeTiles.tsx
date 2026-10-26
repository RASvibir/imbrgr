"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import { OUTCOME_TOOLS, type OutcomeTool } from "./landing-tools";
import { btnPrimary } from "@/lib/ui/button-classes";

export type PreviewKind = "meme" | "gif" | "collage" | "filter" | "ar" | "ai";

const CANVAS_PREVIEW_KIND_MAP: Record<string, PreviewKind> = {
  meme: "meme",
  gif: "gif",
  collage: "collage",
  style: "filter",
  ar: "ar",
  ai: "ai",
};

export function getCanvasPreviewKind(tool: OutcomeTool): PreviewKind {
  return CANVAS_PREVIEW_KIND_MAP[tool.id] ?? "ai";
}

export function OutcomeTiles() {
  return (
    <section
      className="mt-16 sm:mt-24"
      aria-label="Creative Outcomes"
      data-testid="outcome-tiles-section"
    >
      <div data-testid="home-tools-grid">
        <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-1 text-xs font-semibold text-[var(--accent-primary)]">
              <span>⚡</span>
              <span>Fast, Lightweight &amp; Local</span>
            </div>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-4xl">
              What do you want to create?
            </h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)] sm:text-base">
              No learning curve. Choose an outcome and jump straight into live editing.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/studio?tab=video"
              data-testid="home-video-studio-cta"
              className="tap-target inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-sunken)] px-3.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)]"
            >
              <span>🎬</span>
              <span>Video Studio</span>
            </Link>
            <Link
              href="/tools"
              data-testid="home-see-all-tools"
              className="tap-target inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--accent-primary)]/40 bg-[var(--accent-primary)]/10 px-3.5 py-1.5 text-xs font-semibold text-[var(--accent-primary)] transition hover:bg-[var(--accent-primary)]/20"
            >
              <span>See all tools</span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>

        <div
          className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
          data-testid="home-popular-tools-row"
        >
          {OUTCOME_TOOLS.map((tool) => (
            <OutcomeTile key={tool.id} tool={tool} />
          ))}
        </div>
      </div>
    </section>
  );
}

function OutcomeTile({ tool }: { tool: OutcomeTool }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewKind = getCanvasPreviewKind(tool);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = (canvas.width = 360);
    const h = (canvas.height = 200);

    let animId: number;
    let isVisible = false;
    let startTime = performance.now();

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
        if (isVisible && !prefersReducedMotion && !animId) {
          startTime = performance.now();
          animId = requestAnimationFrame(loop);
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(canvas);

    const loop = (now: number) => {
      if (isVisible) {
        const t = (now - startTime) / 1000;
        ctx.clearRect(0, 0, w, h);
        drawToolPreview(ctx, previewKind, w, h, prefersReducedMotion ? 0 : t);
      }
      if (!prefersReducedMotion && isVisible) {
        animId = requestAnimationFrame(loop);
      }
    };

    // Draw initial static frame immediately
    drawToolPreview(ctx, previewKind, w, h, 0);

    return () => {
      cancelAnimationFrame(animId);
      observer.disconnect();
    };
  }, [previewKind]);

  return (
    <div
      className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] transition duration-200 hover:-translate-y-1 hover:border-[var(--accent-primary)] hover:shadow-[var(--shadow-ember)]"
      data-testid={`outcome-tile-${tool.id}`}
    >
      <div>
        {/* Canvas animated preview header */}
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-[var(--surface-sunken)]">
          <canvas
            ref={canvasRef}
            className="h-full w-full object-cover"
            aria-label={`${tool.outcome} procedural animated preview`}
          />
          {tool.badge ? (
            <span className="absolute top-3 left-3 rounded-md bg-[var(--surface-base)]/85 px-2.5 py-1 text-[11px] font-semibold text-[var(--accent-primary)] backdrop-blur">
              {tool.badge}
            </span>
          ) : null}
        </div>

        {/* Content body */}
        <div className="p-5 sm:p-6">
          <h3 className="text-lg font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition">
            {tool.outcome}
          </h3>
          <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">
            {tool.promise}
          </p>
        </div>
      </div>

      {/* Primary Action Button */}
      <div className="p-5 pt-0 sm:p-6 sm:pt-0">
        <Link
          href={`${tool.href}?from=landing`}
          className={`${btnPrimary} w-full`}
          aria-label={`${tool.cta} - ${tool.outcome}`}
          data-testid={`home-launch-${tool.id}`}
        >
          {tool.cta} →
        </Link>
      </div>
    </div>
  );
}

/** Procedural lightweight canvas preview for each tool kind */
function drawToolPreview(
  ctx: CanvasRenderingContext2D,
  kind: PreviewKind,
  w: number,
  h: number,
  t: number,
) {
  // Background
  ctx.fillStyle = "#161311";
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;

  switch (kind) {
    case "meme": {
      // Meme format: image with animated bouncing meme text
      const bounce = Math.sin(t * 3) * 4;

      // Card placeholder background
      ctx.fillStyle = "#26201c";
      ctx.beginPath();
      ctx.roundRect(cx - 100, cy - 65, 200, 130, 10);
      ctx.fill();

      // Mini burger icon
      ctx.font = "32px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🍔", cx, cy + 6);

      // Top meme text
      ctx.font = '900 16px Impact, "Arial Black", sans-serif';
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#000000";
      ctx.fillStyle = "#ffffff";
      ctx.strokeText("WHEN YOU DROP IT", cx, cy - 40 + bounce);
      ctx.fillText("WHEN YOU DROP IT", cx, cy - 40 + bounce);

      // Bottom meme text
      ctx.strokeText("AND IT JUST COOKS", cx, cy + 46 - bounce);
      ctx.fillText("AND IT JUST COOKS", cx, cy + 46 - bounce);
      break;
    }

    case "gif": {
      // Looping GIF: film frames with rolling animation
      const offset = (t * 60) % 80;
      ctx.fillStyle = "#1f1b18";
      ctx.fillRect(0, cy - 45, w, 90);

      // Film sprockets
      ctx.fillStyle = "#3d3530";
      for (let x = -80 + offset; x < w + 80; x += 30) {
        ctx.fillRect(x, cy - 40, 14, 10);
        ctx.fillRect(x, cy + 30, 14, 10);
      }

      // Animated rotating burger
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 2);
      ctx.font = "36px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🍔", 0, 0);
      ctx.restore();

      // Loop badge
      ctx.fillStyle = "#f97316";
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`LOOP 0.8s ⟳`, w - 16, h - 16);
      break;
    }

    case "collage": {
      // Split photos sliding into grid
      const gap = 4;
      const splitX = cx + Math.sin(t * 1.5) * 15;

      // Left panel
      ctx.fillStyle = "#ea580c";
      ctx.beginPath();
      ctx.roundRect(cx - 100, cy - 55, splitX - (cx - 100) - gap, 110, 8);
      ctx.fill();

      // Right top panel
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.roundRect(splitX + gap, cy - 55, cx + 100 - splitX - gap, 52, 8);
      ctx.fill();

      // Right bottom panel
      ctx.fillStyle = "#f43f5e";
      ctx.beginPath();
      ctx.roundRect(splitX + gap, cy + 3, cx + 100 - splitX - gap, 52, 8);
      ctx.fill();

      // Icons in panels
      ctx.font = "20px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🍟", (cx - 100 + splitX) / 2, cy);
      ctx.fillText("🥤", (splitX + cx + 100) / 2, cy - 29);
      ctx.fillText("🍔", (splitX + cx + 100) / 2, cy + 29);
      break;
    }

    case "filter": {
      // Split wipe filter demo
      const wipeX = cx - 90 + ((t * 80) % 180);

      // Normal side
      ctx.fillStyle = "#3b82f6";
      ctx.beginPath();
      ctx.roundRect(cx - 90, cy - 55, 180, 110, 8);
      ctx.fill();

      // Flame-grilled side (clipped by wipeX)
      ctx.save();
      ctx.beginPath();
      ctx.rect(wipeX, cy - 55, cx + 90 - wipeX, 110);
      ctx.clip();

      const flameGrad = ctx.createLinearGradient(0, cy - 55, 0, cy + 55);
      flameGrad.addColorStop(0, "#f97316");
      flameGrad.addColorStop(1, "#dc2626");
      ctx.fillStyle = flameGrad;
      ctx.fillRect(cx - 90, cy - 55, 180, 110);

      // Scanline grid
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.lineWidth = 1;
      for (let y = cy - 55; y < cy + 55; y += 4) {
        ctx.beginPath();
        ctx.moveTo(cx - 90, y);
        ctx.lineTo(cx + 90, y);
        ctx.stroke();
      }
      ctx.restore();

      // Center subject
      ctx.font = "32px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🍔", cx, cy);

      // Wipe divider line
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(wipeX, cy - 55);
      ctx.lineTo(wipeX, cy + 55);
      ctx.stroke();
      break;
    }

    case "ar": {
      // Realtime face AR tracking
      ctx.fillStyle = "#1e1b18";
      ctx.beginPath();
      ctx.roundRect(cx - 90, cy - 55, 180, 110, 8);
      ctx.fill();

      // Face silhouette
      ctx.fillStyle = "#f5ebe3";
      ctx.font = "40px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("😎", cx, cy + 8);

      // Animated burger hat floating on head
      const hatBob = Math.sin(t * 4) * 3;
      ctx.font = "24px sans-serif";
      ctx.fillText("🍔", cx, cy - 26 + hatBob);

      // AR Reticle
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(cx - 45, cy - 25, 90, 68);
      ctx.setLineDash([]);

      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 9px monospace";
      ctx.fillText("TRACKING: 99.8%", cx, cy + 50);
      break;
    }

    case "ai": {
      // AI kitchen: glowing ember constellations & magic particles
      const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 90);
      grad.addColorStop(0, "rgba(249, 115, 22, 0.35)");
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Swirling particles
      for (let i = 0; i < 12; i++) {
        const angle = t * 1.5 + (i * Math.PI * 2) / 12;
        const radius = 35 + Math.sin(t * 3 + i) * 12;
        const px = cx + Math.cos(angle) * radius;
        const py = cy + Math.sin(angle) * radius;

        ctx.fillStyle = i % 2 === 0 ? "#fbbf24" : "#f43f5e";
        ctx.beginPath();
        ctx.arc(px, py, 2.5 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }

      // Sparkling AI center flame
      ctx.font = "32px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("✨", cx, cy);
      break;
    }
  }
}
