import { z } from "zod";

export const IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
]);

export const VIDEO_MIME = new Set(["video/mp4", "video/webm"]);

export const ALLOWED_MIME = new Set([...IMAGE_MIME, ...VIDEO_MIME]);

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
export const MAX_VIDEO_DURATION_SEC = 60;

export function maxBytesForMime(mime: string): number {
  return VIDEO_MIME.has(mime) ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
}

export function validateUploadMime(mime: string): boolean {
  return ALLOWED_MIME.has(mime);
}

export const postInputSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(10000).optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
  visibility: z.enum(["PUBLIC", "UNLISTED", "HIDDEN"]).optional(),
});

export const commentInputSchema = z.object({
  body: z.string().min(1).max(5000),
  parentId: z.string().optional(),
});

export function parseTags(raw: string): string[] {
  return raw
    .split(/[,\s#]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 20);
}

export function slugifyTag(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}
