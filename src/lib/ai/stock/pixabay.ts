import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { newStorageKey, putObject } from "@/lib/storage";
import type { StockProvider, StockSearchOptions, StockVideoClip } from "./types";

type PixabayVideoSize = {
  url: string;
  width: number;
  height: number;
  size: number;
  thumbnail?: string;
};

type PixabayHit = {
  id: number;
  pageURL?: string;
  type?: string;
  tags?: string;
  duration: number;
  videos: {
    large?: PixabayVideoSize;
    medium?: PixabayVideoSize;
    small?: PixabayVideoSize;
    tiny?: PixabayVideoSize;
  };
};

type PixabayResponse = {
  total: number;
  totalHits: number;
  hits: PixabayHit[];
};

type CacheEntry = {
  clip: StockVideoClip | null;
  expiresAt: number;
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours requirement per Pixabay API terms
const queryCache = new Map<string, CacheEntry>();

export function clearPixabayCache(): void {
  queryCache.clear();
}

/** Picks small or tiny 720p/1080p MP4 for fast download and optimal canvas performance */
function pickVideoSize(hit: PixabayHit): PixabayVideoSize | null {
  return hit.videos.small || hit.videos.tiny || hit.videos.medium || hit.videos.large || null;
}

function matchesAspectRatio(size: PixabayVideoSize, target?: "16:9" | "9:16" | "1:1"): boolean {
  if (!target) return true;
  if (target === "9:16") return size.height > size.width;
  if (target === "16:9") return size.width > size.height;
  return true;
}

async function downloadAndStore(
  videoUrl: string,
  thumbUrl?: string,
  timeoutMs = 15_000,
): Promise<{ storedVideoUrl: string; storedThumbUrl?: string }> {
  const vRes = await fetchWithTimeout(videoUrl, { timeoutMs });
  if (!vRes.ok) throw new Error(`stock_download_http_${vRes.status}`);
  const vBuf = Buffer.from(await vRes.arrayBuffer());

  const videoKey = newStorageKey("mp4");
  const storedVideo = await putObject(videoKey, vBuf, "video/mp4");

  let storedThumbUrl: string | undefined;
  if (thumbUrl) {
    try {
      const tRes = await fetchWithTimeout(thumbUrl, { timeoutMs: 5_000 });
      if (tRes.ok) {
        const tBuf = Buffer.from(await tRes.arrayBuffer());
        const thumbKey = newStorageKey("jpg");
        const storedThumb = await putObject(thumbKey, tBuf, "image/jpeg");
        storedThumbUrl = storedThumb.url;
      }
    } catch {
      // Thumbnail download failure is non-fatal
    }
  }

  return { storedVideoUrl: storedVideo.url, storedThumbUrl };
}

export const pixabayProvider: StockProvider = {
  name: "pixabay",
  isConfigured: () => Boolean(process.env.PIXABAY_API_KEY),
  async searchVideo(query: string, options?: StockSearchOptions): Promise<StockVideoClip | null> {
    const apiKey = process.env.PIXABAY_API_KEY;
    if (!apiKey) return null;

    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return null;

    const cacheKey = `${normalizedQuery}:${options?.aspectRatio ?? "any"}`;
    const cached = queryCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.clip;
    }

    const endpoint = new URL("https://pixabay.com/api/videos/");
    endpoint.searchParams.set("key", apiKey);
    endpoint.searchParams.set("q", normalizedQuery);
    endpoint.searchParams.set("safesearch", "true");
    endpoint.searchParams.set("per_page", "5");

    try {
      const res = await fetchWithTimeout(endpoint.toString(), {
        timeoutMs: options?.timeoutMs ?? 10_000,
      });

      if (res.status === 429) {
        console.warn("[imbrgr/pixabay] rate limit exceeded (429)");
        return null;
      }

      if (!res.ok) {
        console.warn(`[imbrgr/pixabay] API returned ${res.status}`);
        return null;
      }

      const data = (await res.json()) as PixabayResponse;
      if (!data.hits || data.hits.length === 0) {
        queryCache.set(cacheKey, { clip: null, expiresAt: Date.now() + CACHE_TTL_MS });
        return null;
      }

      // Find hit matching aspect ratio preference, or fallback to first hit with a video
      let selectedHit: PixabayHit | null = null;
      let selectedSize: PixabayVideoSize | null = null;

      for (const hit of data.hits) {
        const size = pickVideoSize(hit);
        if (size && matchesAspectRatio(size, options?.aspectRatio)) {
          selectedHit = hit;
          selectedSize = size;
          break;
        }
      }

      if (!selectedHit || !selectedSize) {
        selectedHit = data.hits[0];
        selectedSize = pickVideoSize(selectedHit);
      }

      if (!selectedHit || !selectedSize || !selectedSize.url) {
        queryCache.set(cacheKey, { clip: null, expiresAt: Date.now() + CACHE_TTL_MS });
        return null;
      }

      const { storedVideoUrl, storedThumbUrl } = await downloadAndStore(
        selectedSize.url,
        selectedSize.thumbnail,
        options?.timeoutMs ?? 15_000,
      );

      const clip: StockVideoClip = {
        id: `pixabay-${selectedHit.id}`,
        provider: "pixabay",
        url: storedVideoUrl,
        thumbnailUrl: storedThumbUrl || selectedSize.thumbnail,
        durationSec: selectedHit.duration,
        width: selectedSize.width,
        height: selectedSize.height,
        sourceUrl: selectedSize.url,
      };

      queryCache.set(cacheKey, { clip, expiresAt: Date.now() + CACHE_TTL_MS });
      return clip;
    } catch (err) {
      console.warn("[imbrgr/pixabay] stock query error", err);
      return null;
    }
  },
};
