"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
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
  allowReveal = true,
}: {
  media: MediaThumbFields;
  variant?: "sm" | "md" | "full";
  className?: string;
  alt?: string;
  allowReveal?: boolean;
}) {
  const { src, width, height } = pickMediaSrc(media, variant);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const bg = media.placeholderCss ?? "var(--surface-sunken)";

  const isMature = Boolean(media.mature);
  const shouldBlur = isMature && !revealed;

  const syncLoaded = useCallback(() => {
    markLoaded(imgRef.current, setLoaded);
  }, []);

  useLayoutEffect(() => {
    syncLoaded();
  }, [src, syncLoaded]);

  const setImgRef = useCallback(
    (el: HTMLImageElement | null) => {
      imgRef.current = el;
      markLoaded(el, setLoaded);
    },
    [],
  );

  return (
    <span className="relative block h-full w-full overflow-hidden" style={{ backgroundColor: bg }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={setImgRef}
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
        className={`h-full w-full object-cover transition-all duration-300 ${
          loaded || failed ? "opacity-100" : "opacity-0"
        } ${shouldBlur ? "scale-110 blur-2xl brightness-75 filter" : ""} ${className ?? ""}`}
      />

      {shouldBlur ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/60 p-3 text-center backdrop-blur-md transition-opacity">
          <span className="text-xl">🔞</span>
          <span className="mt-1 text-xs font-bold uppercase tracking-wider text-white">18+ Mature</span>
          {allowReveal ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setRevealed(true);
              }}
              className="mt-2 rounded-full border border-white/30 bg-white/20 px-3 py-1 text-[11px] font-semibold text-white shadow backdrop-blur-md transition hover:bg-white/30"
            >
              Click to View
            </button>
          ) : null}
        </div>
      ) : null}
    </span>
  );
}
