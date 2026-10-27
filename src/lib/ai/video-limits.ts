export type VideoMode = "gif" | "video";

export type VideoLimits = {
  minSec: number;
  maxSec: number;
  defaultSec: number;
  stepSec: number;
};

export const VIDEO_LIMITS: Record<VideoMode, VideoLimits> = {
  gif: { minSec: 1, maxSec: 4, defaultSec: 3, stepSec: 0.5 },
  video: { minSec: 5, maxSec: 13, defaultSec: 8, stepSec: 1 },
};

export function getVideoLimits(mode: VideoMode = "video"): VideoLimits {
  return VIDEO_LIMITS[mode];
}

export function clampVideoDuration(mode: VideoMode, sec: number | undefined): number {
  const { minSec, maxSec, defaultSec } = getVideoLimits(mode);
  const value = sec == null || !Number.isFinite(sec) ? defaultSec : sec;
  return Math.min(Math.max(value, minSec), maxSec);
}

export function isDurationValid(mode: VideoMode, sec: number): boolean {
  const { minSec, maxSec } = getVideoLimits(mode);
  return sec >= minSec && sec <= maxSec;
}
