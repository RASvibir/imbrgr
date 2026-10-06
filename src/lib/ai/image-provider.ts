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
};

export interface ImageProvider {
  name: string;
  generate(params: ImageGenParams): Promise<ImageGenResult>;
}

export class PollinationsProvider implements ImageProvider {
  name = "pollinations";

  async generate(params: ImageGenParams): Promise<ImageGenResult> {
    const q = new URLSearchParams({
      width: String(params.width),
      height: String(params.height),
      model: params.model ?? "flux",
      nologo: "true",
    });
    if (params.seed != null) q.set("seed", String(params.seed));
    if (params.safe) q.set("safe", "true");
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(params.prompt)}?${q}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`pollinations ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = res.headers.get("content-type") ?? "image/jpeg";
    return { buffer: buf, mimeType: mime.split(";")[0], provider: this.name };
  }
}

export const defaultImageProvider: ImageProvider = new PollinationsProvider();
