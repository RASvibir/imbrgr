import sharp from "sharp";

export type ConvertFormat = "jpeg" | "png" | "webp" | "avif";

const MIME: Record<ConvertFormat, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
};

export async function convertImageBuffer(
  input: Buffer,
  opts: {
    format: ConvertFormat;
    quality?: number;
    maxWidth?: number;
    maxHeight?: number;
  },
): Promise<{ buffer: Buffer; mime: string }> {
  let pipeline = sharp(input).rotate().withMetadata({ exif: undefined });
  if (opts.maxWidth || opts.maxHeight) {
    pipeline = pipeline.resize({
      width: opts.maxWidth,
      height: opts.maxHeight,
      fit: "inside",
      withoutEnlargement: true,
    });
  }
  const quality = Math.min(100, Math.max(1, opts.quality ?? 85));
  let buffer: Buffer;
  switch (opts.format) {
    case "png":
      buffer = await pipeline.png({ compressionLevel: 6 }).toBuffer();
      break;
    case "webp":
      buffer = await pipeline.webp({ quality }).toBuffer();
      break;
    case "avif":
      buffer = await pipeline.avif({ quality }).toBuffer();
      break;
    default:
      buffer = await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
  }
  return { buffer, mime: MIME[opts.format] };
}

export async function autoEnhanceBuffer(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .withMetadata({ exif: undefined })
    .normalize()
    .modulate({ brightness: 1.04, saturation: 1.06 })
    .sharpen()
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
}
