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

export type MotionTransform = {
  scale: number;
  translateXPercent: number;
  translateYPercent: number;
  rotateDeg: number;
  alpha: number;
};

export function computeMotionTransform(motion?: CameraMotion, progress = 0): MotionTransform {
  const p = Math.max(0, Math.min(1, progress));
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
      // Smooth Ken Burns zoom in from 1.0 to 1.25
      return { ...base, scale: 1.0 + 0.25 * p };
    case "zoom-out":
      // Pull back from 1.25 to 1.0
      return { ...base, scale: 1.25 - 0.25 * p };
    case "pan-right":
      // Pan camera from left to right (translate image right to left)
      return { ...base, scale: 1.15, translateXPercent: (1 - 2 * p) * 5 };
    case "pan-left":
      return { ...base, scale: 1.15, translateXPercent: (2 * p - 1) * 5 };
    case "orbit":
      // Subtle 3D rotational drift
      return {
        ...base,
        scale: 1.1 + 0.05 * Math.sin(p * Math.PI),
        rotateDeg: Math.sin(p * Math.PI * 2) * 1.5,
      };
    case "pulse":
      // Rhythmic heartbeat/bass pulse
      const wave = Math.abs(Math.sin(p * Math.PI * 4));
      return { ...base, scale: 1.0 + 0.08 * wave };
    case "dramatic":
      // Dolly zoom effect (scale in while zooming)
      return { ...base, scale: 1.0 + 0.3 * Math.pow(p, 1.5) };
    default:
      return base;
  }
}
