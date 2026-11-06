import {
  IMAGE_MIME,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  VIDEO_MIME,
  validateUploadMime,
} from "@/lib/validation";

export function inferUploadMime(file: File): string {
  if (file.type && (file.type.startsWith("image/") || file.type.startsWith("video/"))) {
    return file.type;
  }
  const name = file.name.toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".gif")) return "image/gif";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".avif")) return "image/avif";
  if (name.endsWith(".mp4")) return "video/mp4";
  if (name.endsWith(".webm")) return "video/webm";
  return file.type || "application/octet-stream";
}

/** Client-side preflight for stack upload — mirrors server mime/size gates. */
export function validateStackUploadFile(file: File): string | null {
  const mime = inferUploadMime(file);
  if (!validateUploadMime(mime) || (!IMAGE_MIME.has(mime) && !VIDEO_MIME.has(mime))) {
    return "That file isn't a format we can host — try JPG, PNG, GIF, WebP, MP4, or WebM.";
  }
  const max = VIDEO_MIME.has(mime) ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size > max) {
    return VIDEO_MIME.has(mime)
      ? "That video is too big (max 100 MB)."
      : "That image is too big (max 20 MB).";
  }
  if (file.size === 0) {
    return "That file looks empty — try another one.";
  }
  return null;
}
