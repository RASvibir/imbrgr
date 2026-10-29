/**
 * Operations and transformations for the multi-track timeline.
 */

import type { CameraMotion } from "@/lib/ai/video-provider";
import type {
  AudioClip,
  EffectClip,
  TextOverlay,
  VisualClip,
} from "./timeline-types";

export function formatTimecode(seconds: number): string {
  const s = Math.max(0, seconds);
  const mins = Math.floor(s / 60);
  const secs = Math.floor(s % 60);
  const ms = Math.min(99, Math.round((s % 1) * 100));

  const mm = String(mins).padStart(2, "0");
  const ss = String(secs).padStart(2, "0");
  const ff = String(ms).padStart(2, "0");
  return `${mm}:${ss}.${ff}`;
}

export function splitClipAtTime(clip: VisualClip, splitTimeSec: number): [VisualClip, VisualClip] | null {
  if (splitTimeSec <= clip.startSec + 0.05 || splitTimeSec >= clip.endSec - 0.05) {
    return null;
  }

  const durationLeft = splitTimeSec - clip.startSec;

  const left: VisualClip = {
    ...clip,
    id: `${clip.id}-left-${Date.now()}`,
    endSec: splitTimeSec,
  };

  const right: VisualClip = {
    ...clip,
    id: `${clip.id}-right-${Date.now()}`,
    startSec: splitTimeSec,
    sourceStartSec: clip.sourceStartSec + durationLeft,
  };

  return [left, right];
}

export function trimClip(clip: VisualClip, newStartSec: number, newEndSec: number): VisualClip {
  const startSec = Math.max(0, Math.min(newStartSec, newEndSec - 0.1));
  const endSec = Math.max(startSec + 0.1, newEndSec);
  return {
    ...clip,
    startSec,
    endSec,
  };
}

export function calculateTimelineDuration(
  visualClips: VisualClip[],
  audioClips: AudioClip[] = [],
  textOverlays: TextOverlay[] = [],
  effectClips: EffectClip[] = [],
): number {
  let max = 2.0; // minimum 2s timeline
  for (const c of visualClips) if (c.endSec > max) max = c.endSec;
  for (const a of audioClips) if (a.endSec > max) max = a.endSec;
  for (const t of textOverlays) if (t.endSec > max) max = t.endSec;
  for (const e of effectClips) if (e.endSec > max) max = e.endSec;
  return Number(max.toFixed(2));
}

export function findActiveVisualClips(clips: VisualClip[], timeSec: number): VisualClip[] {
  return clips.filter((c) => timeSec >= c.startSec && timeSec < c.endSec);
}

export function findActiveTextOverlays(texts: TextOverlay[], timeSec: number): TextOverlay[] {
  return texts.filter((t) => timeSec >= t.startSec && timeSec < t.endSec);
}

export const UNDERLAY_TAIL_SEC = 0.04;

const ADJACENT_TOLERANCE_SEC = 0.05;

export function effectiveTransitionSec(clip: VisualClip): number {
  const raw = clip.transitionDurationSec;
  if (raw == null || !Number.isFinite(raw) || raw <= 0) return 0;
  return Math.min(raw, Math.max(0, clip.endSec - clip.startSec) / 2);
}

export function previousAdjacentClip(clips: VisualClip[], clip: VisualClip): VisualClip | null {
  let best: VisualClip | null = null;
  for (const other of clips) {
    if (other.id === clip.id) continue;
    if (Math.abs(other.endSec - clip.startSec) > ADJACENT_TOLERANCE_SEC) continue;
    if (!best || other.startSec > best.startSec) best = other;
  }
  return best;
}

export type TransitionState = { alpha: number; underlay: VisualClip | null };

/** Opacity of a clip at a moment, plus the clip whose last frame should be drawn beneath it during a dissolve. */
export function transitionState(clips: VisualClip[], clip: VisualClip, timeSec: number): TransitionState {
  const none: TransitionState = { alpha: 1, underlay: null };
  if (clip.transition !== "fade" && clip.transition !== "dissolve") return none;
  const dur = effectiveTransitionSec(clip);
  if (dur <= 0) return none;
  const into = timeSec - clip.startSec;
  if (into >= dur) return none;
  const alpha = Math.max(0, Math.min(1, into / dur));
  if (clip.transition === "fade") return { alpha, underlay: null };
  const prev = previousAdjacentClip(clips, clip);
  if (!prev) return none;
  if (timeSec >= prev.startSec && timeSec < prev.endSec) return none;
  return { alpha, underlay: prev };
}

export type MotionTransform = {
  scale: number;
  translateXPercent: number;
  translateYPercent: number;
  rotateDeg: number;
  alpha: number;
};

/** Smoothstep: camera moves ease in and out instead of sliding at a constant, robotic speed. */
function ease(p: number): number {
  return p * p * (3 - 2 * p);
}

/**
 * Camera move for a still image. Every move keeps scale high enough that translation and rotation never reveal
 * the image edges: |translate| <= (scale - 1) / 2 * 100 percent.
 */
export function computeMotionTransform(motion?: CameraMotion, progress = 0): MotionTransform {
  const p = Math.max(0, Math.min(1, progress));
  const e = ease(p);
  const base: MotionTransform = {
    scale: 1,
    translateXPercent: 0,
    translateYPercent: 0,
    rotateDeg: 0,
    alpha: 1,
  };

  if (!motion) return base;

  switch (motion) {
    case "zoom-in":
      return { ...base, scale: 1.0 + 0.35 * e };
    case "zoom-out":
      return { ...base, scale: 1.35 - 0.35 * e };
    case "pan-right":
      // Camera moves left to right, with a slight rise so it reads as a tracking shot rather than a slide.
      return { ...base, scale: 1.25, translateXPercent: (1 - 2 * e) * 9, translateYPercent: (0.5 - e) * 3 };
    case "pan-left":
      return { ...base, scale: 1.25, translateXPercent: (2 * e - 1) * 9, translateYPercent: (0.5 - e) * 3 };
    case "orbit":
      // Drift around the subject: gentle rotation plus a push, returning toward start.
      return {
        ...base,
        scale: 1.18 + 0.08 * Math.sin(p * Math.PI),
        rotateDeg: Math.sin(p * Math.PI * 2) * 2.5,
      };
    case "pulse": {
      const wave = Math.abs(Math.sin(p * Math.PI * 4));
      return { ...base, scale: 1.0 + 0.1 * wave };
    }
    case "dramatic":
      return { ...base, scale: 1.0 + 0.45 * Math.pow(e, 1.4) };
    default:
      return base;
  }
}
