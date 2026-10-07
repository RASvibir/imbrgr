import { IMAGE_MIME, MAX_IMAGE_BYTES, validateUploadMime } from "@/lib/validation";

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
