"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { pickMediaSrc, type MediaThumbFields } from "@/lib/media-display";

function markLoaded(img: HTMLImageElement | null, setLoaded: (v: boolean) => void) {
  if (!img) return;
  if (img.complete && img.naturalWidth > 0) {
    setLoaded(true);
    return;
  }
}

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
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const bg = media.placeholderCss ?? "var(--surface-sunken)";

  const syncLoaded = useCallback(() => {
    markLoaded(imgRef.current, setLoaded);
  }, []);

  useEffect(() => {
    syncLoaded();
  }, [src, syncLoaded]);

  return (
    <span className="relative block h-full w-full overflow-hidden" style={{ backgroundColor: bg }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        width={width ?? undefined}
        height={height ?? undefined}
        loading="lazy"
        decoding="async"
        data-testid="post-media-image"
        onLoad={() => setLoaded(true)}
        onError={() => {
          setFailed(true);
          setLoaded(true);
        }}
        className={`h-full w-full object-cover transition-opacity duration-300 ${
          loaded || failed ? "opacity-100" : "opacity-0"
        } ${className ?? ""}`}
      />
    </span>
  );
}
