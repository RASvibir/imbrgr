import { IMAGE_MIME, MAX_IMAGE_BYTES, validateUploadMime } from "@/lib/validation";

export function validateLandingImageFile(file: File): string | null {
  const mime = file.type || "application/octet-stream";
  if (!mime.startsWith("image/") || !validateUploadMime(mime) || !IMAGE_MIME.has(mime)) {
    return "That file isn't an image we can use — try JPG, PNG, GIF, or WebP.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return "That image is too big to upload here.";
  }
  return null;
}
