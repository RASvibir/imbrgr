import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { simpleImageEdit } from "./simple-image-edit";

describe("simpleImageEdit", () => {
  it("returns a png buffer", async () => {
    const src = await sharp({
      create: { width: 32, height: 32, channels: 3, background: "#888888" },
    })
      .png()
      .toBuffer();
    const out = await simpleImageEdit(src, "warmer light");
    expect(out.length).toBeGreaterThan(100);
  });
});
