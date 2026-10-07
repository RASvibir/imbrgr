"use client";

import { useState } from "react";
import { pickMediaSrc, type MediaThumbFields } from "@/lib/media-display";

export function PostMediaImage({
  media,
  variant = "md",
  className,
  alt = "",
}: {
  media: MediaThumbFields;
  variant?: "sm" | "md" | "full";
  className?: string;
  alt?: string;
}) {
  const { src, width, height } = pickMediaSrc(media, variant);
  const [loaded, setLoaded] = useState(false);
  const bg = media.placeholderCss ?? "var(--surface-sunken)";

  return (
    <span className="relative block h-full w-full overflow-hidden" style={{ backgroundColor: bg }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        width={width ?? undefined}
        height={height ?? undefined}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={`h-full w-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"} ${className ?? ""}`}
      />
    </span>
  );
}
