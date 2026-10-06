import sharp from "sharp";
import { fetchWithTimeout } from "@/lib/fetch-timeout";

export type ImageGenParams = {
  prompt: string;
  width: number;
  height: number;
  seed?: number;
  model?: string;
  safe?: boolean;
};

export type ImageGenResult = {
  buffer: Buffer;
  mimeType: string;
  provider: string;
  seed: number;
};

export interface ImageProvider {
  name: string;
  generate(params: ImageGenParams): Promise<ImageGenResult>;
}

function pollinationsBaseUrl(): string {
  const key = process.env.POLLINATIONS_API_KEY;
  if (key) return "https://gen.pollinations.ai";
  return "https://image.pollinations.ai";
}

function buildPollinationsUrl(params: ImageGenParams, seed: number, model: string): string {
  const base = pollinationsBaseUrl();
  const q = new URLSearchParams({
    width: String(params.width),
    height: String(params.height),
    model,
    seed: String(seed),
  });
  if (params.safe) q.set("safe", "true");
  const key = process.env.POLLINATIONS_API_KEY;
  if (key) q.set("key", key);

  if (base.includes("gen.pollinations.ai")) {
    return `${base}/image/${encodeURIComponent(params.prompt)}?${q}`;
  }
  q.set("nologo", "true");
  return `${base}/prompt/${encodeURIComponent(params.prompt)}?${q}`;
}

async function toLosslessPng(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer).png({ compressionLevel: 6 }).toBuffer();
}

function fetchTimeoutMs(): number {
  const n = Number.parseInt(process.env.IMAGE_GEN_FETCH_TIMEOUT_MS ?? "45000", 10);
  return Number.isFinite(n) && n > 5_000 ? n : 45_000;
}

function maxAttempts(): number {
  const n = Number.parseInt(process.env.IMAGE_GEN_MAX_ATTEMPTS ?? "3", 10);
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 5) : 3;
}

const RETRY_MODELS = ["flux", "flux", "turbo"] as const;

export class PollinationsProvider implements ImageProvider {
  name = "pollinations";

  async generate(params: ImageGenParams): Promise<ImageGenResult> {
    const seed =
      params.seed != null && params.seed >= 0
        ? params.seed
        : Math.floor(Math.random() * 2_147_483_647);

    const headers: Record<string, string> = {};
    if (process.env.POLLINATIONS_API_KEY) {
      headers.Authorization = `Bearer ${process.env.POLLINATIONS_API_KEY}`;
    }

    const attempts = maxAttempts();
    const timeoutMs = fetchTimeoutMs();
    let lastStatus = 0;

    for (let attempt = 0; attempt < attempts; attempt++) {
      const attemptSeed = seed + attempt * 7919;
      const model = params.model ?? RETRY_MODELS[attempt % RETRY_MODELS.length];
      const url = buildPollinationsUrl(params, attemptSeed, model);
      try {
        const res = await fetchWithTimeout(url, { headers, timeoutMs });
        lastStatus = res.status;
        if (!res.ok) {
          if (res.status >= 500 && attempt < attempts - 1) {
            await sleep(400 * (attempt + 1));
            continue;
          }
          throw new Error(`image_gen_http_${res.status}`);
        }
        const raw = Buffer.from(await res.arrayBuffer());
        if (raw.length < 256) {
          throw new Error("image_gen_empty");
        }
        const png = await toLosslessPng(raw);
        return { buffer: png, mimeType: "image/png", provider: this.name, seed: attemptSeed };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "image_gen_failed";
        if ((msg === "upstream_timeout" || msg.startsWith("image_gen_")) && attempt < attempts - 1) {
          await sleep(400 * (attempt + 1));
          continue;
        }
        if (msg === "upstream_timeout") throw new Error("image_gen_timeout");
        throw e instanceof Error ? e : new Error("image_gen_failed");
      }
    }

    throw new Error(lastStatus >= 500 ? `image_gen_http_${lastStatus}` : "image_gen_failed");
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export const defaultImageProvider: ImageProvider = new PollinationsProvider();
