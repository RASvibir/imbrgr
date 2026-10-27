import type { CameraMotion } from "@/lib/ai/video-provider";
import type { VideoMode } from "@/lib/ai/video-limits";

export type JobInput = {
  prompt: string;
  style?: string;
  aspectRatio: "16:9" | "9:16" | "1:1";
  mode: VideoMode;
  durationSec: number;
  motion: CameraMotion;
  seed: number;
  mature: boolean;
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
  error?: string;
  shots?: JobShot[];
};
