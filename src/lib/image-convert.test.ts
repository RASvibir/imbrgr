import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { convertImageBuffer } from "./image-convert";

describe("convertImageBuffer", () => {
  it("converts to webp with resize", async () => {
    const src = await sharp({
      create: { width: 200, height: 100, channels: 3, background: "#ff6600" },
    })
      .png()
      .toBuffer();
    const { buffer, mime } = await convertImageBuffer(src, {
      format: "webp",
      quality: 80,
      maxWidth: 100,
    });
    expect(mime).toBe("image/webp");
    const meta = await sharp(buffer).metadata();
    expect(meta.width).toBeLessThanOrEqual(100);
  });
});
