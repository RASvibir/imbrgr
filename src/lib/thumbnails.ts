import sharp from "sharp";
import { extForMime } from "@/lib/media-process";
import { newStorageKey, putObject } from "@/lib/storage";

export const THUMB_SM_WIDTH = 320;
export const THUMB_MD_WIDTH = 800;

export type GeneratedThumbs = {
  thumbSmKey: string;
  thumbMdKey: string;
  thumbSmWidth: number;
  thumbSmHeight: number;
  thumbMdWidth: number;
  thumbMdHeight: number;
  placeholderCss: string;
};

async function resizeWebp(buffer: Buffer, width: number) {
  return sharp(buffer)
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
}

export async function generateImageThumbnails(buffer: Buffer): Promise<GeneratedThumbs> {
  const sm = await resizeWebp(buffer, THUMB_SM_WIDTH);
  const md = await resizeWebp(buffer, THUMB_MD_WIDTH);

  const smKey = newStorageKey(extForMime("image/webp"));
  const mdKey = newStorageKey(extForMime("image/webp"));
  await putObject(smKey, sm.data, "image/webp");
  await putObject(mdKey, md.data, "image/webp");

  const tiny = await sharp(buffer).rotate().resize(16, 16, { fit: "inside" }).raw().toBuffer();
  let r = 0;
  let g = 0;
  let b = 0;
  const pixels = tiny.length / 3;
  for (let i = 0; i < tiny.length; i += 3) {
    r += tiny[i]!;
    g += tiny[i + 1]!;
    b += tiny[i + 2]!;
  }
  r = Math.round(r / pixels);
  g = Math.round(g / pixels);
  b = Math.round(b / pixels);
  const placeholderCss = `rgb(${r},${g},${b})`;

  return {
    thumbSmKey: smKey,
    thumbMdKey: mdKey,
    thumbSmWidth: sm.info.width,
    thumbSmHeight: sm.info.height,
    thumbMdWidth: md.info.width,
    thumbMdHeight: md.info.height,
    placeholderCss,
  };
}
