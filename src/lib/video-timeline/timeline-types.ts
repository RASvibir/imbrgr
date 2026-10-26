/**
 * Multi-track Video Timeline Data Models
 * Inspired by OpenCut / pacNcap timeline paradigms.
 */

import type { CameraMotion } from "@/lib/ai/video-provider";
import type { PerformanceMode } from "@/lib/video-plugins/plugin-types";

export type TrackKind = "visual" | "audio" | "text" | "effect";

export type Track = {
  id: string;
  name: string;
  kind: TrackKind;
  muted?: boolean;
  locked?: boolean;
};

export type TransitionType = "none" | "fade" | "dissolve" | "wipe" | "zoom" | "glitch";

export type VisualClip = {
  id: string;
  trackId: string;
  assetId: string;
  url: string;
  name: string;
  kind: "video" | "image" | "gif";
  startSec: number; // Position on timeline
  endSec: number; // End position on timeline
  sourceStartSec: number; // Trim in-point from source
  sourceDurationSec: number; // Total length of source
  motion?: CameraMotion;
  transition?: TransitionType;
  transitionDurationSec?: number;
  mature?: boolean;
};

export type AudioClip = {
  id: string;
  trackId: string;
  assetId?: string;
  url: string;
  name: string;
  startSec: number;
  endSec: number;
  sourceStartSec?: number;
  sourceDurationSec?: number;
  volume: number; // 0 to 1
  muted?: boolean;
};

export type TextOverlay = {
  id: string;
  trackId: string;
  startSec: number;
  endSec: number;
  text: string;
  fontSize: number; // px at 1080p reference
  fontColor: string;
  bgColor?: string;
  xPercent: number; // 0 to 100
  yPercent: number; // 0 to 100
  style?: "bold" | "subtitle" | "cyber" | "minimal";
  animation?: "none" | "fade" | "pop";
};

export type EffectClip = {
  id: string;
  trackId: string;
  pluginId: string;
  name: string;
  startSec: number;
  endSec: number;
  params?: Record<string, unknown>;
};

export type TimelineProject = {
  id: string;
  title: string;
  aspectRatio: "16:9" | "9:16" | "1:1";
  canvasWidth: number;
  canvasHeight: number;
  fps: number;
  performanceMode: PerformanceMode;
  tracks: Track[];
  visualClips: VisualClip[];
  audioClips: AudioClip[];
  textOverlays: TextOverlay[];
  effectClips: EffectClip[];
};
