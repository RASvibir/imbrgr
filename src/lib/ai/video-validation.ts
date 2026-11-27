import type { ZodError } from "zod";
import { getVideoLimits, type VideoMode } from "@/lib/ai/video-limits";

export type VideoValidationResult = {
  message: string;
  fields: Record<string, string>;
};

function mapIssueMessage(
  path: string,
  code: string,
  fallbackMessage: string,
  mode: VideoMode,
): string {
  switch (path) {
    case "prompt":
      if (code === "too_small") return "Prompt must be at least 3 characters.";
      if (code === "too_big") return "Prompt must be 500 characters or fewer.";
      return "Please enter a prompt between 3 and 500 characters.";
    case "durationSec": {
      const limits = getVideoLimits(mode);
      const label = mode === "gif" ? "GIFs" : "videos";
      return `Duration must be between ${limits.minSec} and ${limits.maxSec} seconds for ${label}.`;
    }
    case "aspectRatio":
      return "Aspect ratio must be 16:9, 9:16, or 1:1.";
    case "mode":
      return "Clip mode must be video or gif.";
    case "motion":
      return "Please select a valid camera motion.";
    case "characterMotion":
      return "Please select a valid subject motion.";
    case "style":
      return "Style must be 40 characters or fewer.";
    case "preset":
      return "Improve preset must be polish, motion, or variants.";
    default:
      return fallbackMessage || "Please check your video settings and try again.";
  }
}

/** Map zod validation issues into field-specific user messages. */
export function formatVideoValidationErrors(
  error: ZodError,
  rawMode?: unknown,
): VideoValidationResult {
  const mode: VideoMode = rawMode === "gif" ? "gif" : "video";
  const fields: Record<string, string> = {};
  const messages: string[] = [];

  for (const issue of error.issues) {
    const field = issue.path.length > 0 ? String(issue.path[0]) : "request";
    const msg = mapIssueMessage(field, issue.code, issue.message, mode);
    if (!fields[field]) {
      fields[field] = msg;
    }
    if (!messages.includes(msg)) {
      messages.push(msg);
    }
  }

  return {
    message: messages.join(" ") || "Please check your video settings and try again.",
    fields,
  };
}
