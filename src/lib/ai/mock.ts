import sharp from "sharp";

export function aiMockEnabled(): boolean {
  return process.env.AI_MOCK === "true" || process.env.NODE_ENV === "test";
}

export async function mockImageBuffer(): Promise<Buffer> {
  return sharp({
    create: { width: 512, height: 512, channels: 3, background: "#ff6b2c" },
  })
    .png()
    .toBuffer();
}
