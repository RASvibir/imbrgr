import type { StockProvider, StockSearchOptions, StockVideoClip } from "./types";

/**
 * Pexels stock video provider stub.
 * Ready for activation as soon as Pexels resumes issuing free API keys.
 */
export const pexelsProvider: StockProvider = {
  name: "pexels",
  isConfigured: () => Boolean(process.env.PEXELS_API_KEY),
  async searchVideo(query: string, options?: StockSearchOptions): Promise<StockVideoClip | null> {
    void query;
    void options;
    if (!process.env.PEXELS_API_KEY) return null;
    throw new Error("pexels_provider_not_implemented");
  },
};
