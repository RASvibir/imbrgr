import { pixabayProvider } from "./pixabay";
import { pexelsProvider } from "./pexels";
import type { StockProvider } from "./types";

export function selectStockProvider(
  env: Record<string, string | undefined> = process.env,
): StockProvider | null {
  const preferred = env.STOCK_PROVIDER;
  if (preferred === "pexels" && pexelsProvider.isConfigured()) {
    return pexelsProvider;
  }
  if (preferred === "pixabay" && pixabayProvider.isConfigured()) {
    return pixabayProvider;
  }
  // Default detection: Pixabay if key present, else Pexels
  if (pixabayProvider.isConfigured()) return pixabayProvider;
  if (pexelsProvider.isConfigured()) return pexelsProvider;
  return null;
}
