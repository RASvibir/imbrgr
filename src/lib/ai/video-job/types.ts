import type { CharacterMotion } from "@/lib/ai/character-motion";
import type { CameraMotion } from "@/lib/ai/video-provider";
import type { VideoMode } from "@/lib/ai/video-limits";

export type ContinueMode = "extend" | "next-shot";
export type LastFrameSource = "client" | "server";

export type JobInput = {
  prompt: string;
  originalPrompt?: string;
  promptSource?: string;
  style?: string;
  aspectRatio: "16:9" | "9:16" | "1:1";
  mode: VideoMode;
  durationSec: number;
  motion: CameraMotion;
  characterMotion?: CharacterMotion;
  seed: number;
  mature: boolean;
  parentJobId?: string;
  continueMode?: ContinueMode;
};

export type JobShot = {
  durationSec: number;
  visualPrompt: string;
  motion: CameraMotion;
  caption?: string;
  stockQuery?: string;
  imageUrl?: string;
  videoUrl?: string;
  mediaType?: "image" | "video";
  sourceDurationSec?: number;
  creditName?: string;
  creditUrl?: string;
  remoteId?: string;
  startedAt?: number;
  lastFrame?: string;
  lastFrameSource?: LastFrameSource;
  seedImage?: string;
  seedImageSource?: LastFrameSource;
  backend?: "gpu" | "assembled";
  gpuRequestId?: string;
  fallbackReason?: string;
  frameChained?: boolean;
  continuationFallback?: string;
};

export type JobStatus = "queued" | "running" | "done" | "failed";

export type JobView = {
  id: string;
  status: JobStatus;
  mode: VideoMode;
  durationSec: number;
  mature: boolean;
  total: number;
  completed: number;
  canContinue: boolean;
  promptUsed?: string;
  promptSource?: string;
  captureTarget?: { shotIndex: number; videoUrl: string };
  continuationLabel?: string;
  error?: string;
  shots?: JobShot[];
};
