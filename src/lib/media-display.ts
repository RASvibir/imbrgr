import { mediaUrl } from "@/lib/urls";

export type MediaThumbFields = {
  storageKey: string;
  mimeType: string;
  width?: number | null;
  height?: number | null;
  thumbSmKey?: string | null;
  thumbMdKey?: string | null;
  placeholderCss?: string | null;
};

export function pickMediaSrc(
  media: MediaThumbFields,
  variant: "sm" | "md" | "full" = "md",
): { src: string; width?: number | null; height?: number | null } {
  if (!media.mimeType.startsWith("image/")) {
    return { src: mediaUrl(media.storageKey, media.mimeType), width: media.width, height: media.height };
  }
  if (variant === "sm" && media.thumbSmKey) {
    return { src: mediaUrl(media.thumbSmKey, "image/webp"), width: media.width, height: media.height };
  }
  if (variant !== "full" && media.thumbMdKey) {
    return { src: mediaUrl(media.thumbMdKey, "image/webp"), width: media.width, height: media.height };
  }
  return { src: mediaUrl(media.storageKey, media.mimeType), width: media.width, height: media.height };
}
