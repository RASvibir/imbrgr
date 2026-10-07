import sharp from "sharp";

/** Lightweight local tweak when cloud image-edit is unavailable. */
export async function simpleImageEdit(buffer: Buffer, instruction: string): Promise<Buffer> {
  const lower = instruction.toLowerCase();
  let pipeline = sharp(buffer).rotate();

  if (lower.includes("warm") || lower.includes("sunset") || lower.includes("golden")) {
    pipeline = pipeline.modulate({ brightness: 1.05, saturation: 1.15, hue: 8 });
  }
  if (lower.includes("cool") || lower.includes("blue")) {
    pipeline = pipeline.modulate({ brightness: 1.02, saturation: 0.95, hue: -10 });
  }
  if (lower.includes("bright")) {
    pipeline = pipeline.modulate({ brightness: 1.12 });
  }
  if (lower.includes("dark") || lower.includes("dim")) {
    pipeline = pipeline.modulate({ brightness: 0.88 });
  }
  if (lower.includes("pop") || lower.includes("vivid")) {
    pipeline = pipeline.modulate({ brightness: 1.06, saturation: 1.25 });
  }
  if (lower.includes("color") || lower.includes("balance")) {
    pipeline = pipeline.modulate({ brightness: 1.03, saturation: 1.08 });
  }
  if (lower.includes("sharp")) {
    pipeline = pipeline.sharpen();
  }
  if (lower.includes("blur") || lower.includes("soft")) {
    pipeline = pipeline.blur(0.6);
  }

  return pipeline.png().toBuffer();
}
