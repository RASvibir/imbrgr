import sharp from "sharp";

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

function buildPollinationsUrl(params: ImageGenParams, seed: number): string {
  const base = pollinationsBaseUrl();
  const model = params.model ?? "flux";
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

export class PollinationsProvider implements ImageProvider {
  name = "pollinations";

  async generate(params: ImageGenParams): Promise<ImageGenResult> {
    const seed =
      params.seed != null && params.seed >= 0
        ? params.seed
        : Math.floor(Math.random() * 2_147_483_647);

    const url = buildPollinationsUrl(params, seed);
    const headers: Record<string, string> = {};
    if (process.env.POLLINATIONS_API_KEY) {
      headers.Authorization = `Bearer ${process.env.POLLINATIONS_API_KEY}`;
    }

    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`pollinations ${res.status}`);
    const raw = Buffer.from(await res.arrayBuffer());
    const png = await toLosslessPng(raw);
    return { buffer: png, mimeType: "image/png", provider: this.name, seed };
  }
}

export const defaultImageProvider: ImageProvider = new PollinationsProvider();
