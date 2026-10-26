export type StockVideoClip = {
  id: string;
  provider: "pixabay" | "pexels" | string;
  url: string; // The saved URL (local /api/media/file/... or blob)
  thumbnailUrl?: string;
  durationSec: number;
  width: number;
  height: number;
  sourceUrl?: string; // Direct provider URL before download
};

export interface StockSearchOptions {
  aspectRatio?: "16:9" | "9:16" | "1:1";
  durationSec?: number;
  timeoutMs?: number;
}

export interface StockProvider {
  name: string;
  isConfigured(): boolean;
  searchVideo(query: string, options?: StockSearchOptions): Promise<StockVideoClip | null>;
}
