import {
  IMAGE_MIME,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  VIDEO_MIME,
  validateUploadMime,
} from "@/lib/validation";

function inferImageMime(file: File): string {
  if (file.type?.startsWith("image/")) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".gif")) return "image/gif";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".avif")) return "image/avif";
  return file.type || "application/octet-stream";
}

export function inferLandingMediaMime(file: File): string {
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

export function validateLandingImageFile(file: File): string | null {
  const mime = inferImageMime(file);
  if (!mime.startsWith("image/") || !validateUploadMime(mime) || !IMAGE_MIME.has(mime)) {
    return "That file isn't an image we can use — try JPG, PNG, GIF, or WebP.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return "That image is too big to upload here.";
  }
  return null;
}

export function validateLandingMediaFile(file: File, mode: "image" | "video" = "image"): string | null {
  if (mode === "image") {
    return validateLandingImageFile(file);
  }
  const mime = inferLandingMediaMime(file);
  if (!validateUploadMime(mime) || (!IMAGE_MIME.has(mime) && !VIDEO_MIME.has(mime))) {
    return "That file isn't a format we can use — try MP4, WebM, JPG, PNG, GIF, or WebP.";
  }
  const maxBytes = VIDEO_MIME.has(mime) ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size > maxBytes) {
    return VIDEO_MIME.has(mime)
      ? "That video is too big to upload here (max 100MB)."
      : "That image is too big to upload here.";
  }
  return null;
}
