import sharp from "sharp";
import { prisma } from "@/lib/db";
import { newShortId } from "@/lib/ids";
import { extForMime, imageMeta } from "@/lib/media-process";
import { deleteMediaStorage } from "@/lib/media-storage";
import { deleteObject, getStoredObjectSize, newStorageKey, putObject } from "@/lib/storage";
import {
  addAnonymousStorage,
  addUserStorage,
  assertAnonymousCanStore,
  assertUserCanStore,
  removeUserStorage,
} from "@/lib/storage-quota";
import { hashDeleteToken, newDeleteToken } from "@/lib/anon-delete";
import { resolveRootMediaId } from "@/lib/media-root";
import { normalizeVisibility, type Visibility } from "@/lib/visibility";
import { MAX_VIDEO_DURATION_SEC, VIDEO_MIME, validateUploadMime } from "@/lib/validation";
import { probeVideoDurationSec } from "@/lib/video-duration";
import { generateImageThumbnails } from "@/lib/thumbnails";

export async function prepareUploadBuffer(buffer: Buffer, mime: string, opts?: { losslessPng?: boolean }) {
  if (!validateUploadMime(mime)) throw new Error(`Unsupported type: ${mime}`);

  if (VIDEO_MIME.has(mime)) {
    const dur = probeVideoDurationSec(buffer, mime);
    if (dur != null && dur > MAX_VIDEO_DURATION_SEC) {
      throw new Error(`Video too long (max ${MAX_VIDEO_DURATION_SEC}s)`);
    }
    return { buffer, mime };
  }

  if (mime.startsWith("image/") && mime !== "image/gif") {
    if (opts?.losslessPng || mime === "image/png") {
      const out = await sharp(buffer).rotate().withMetadata({ exif: undefined }).png({ compressionLevel: 6 }).toBuffer();
      return { buffer: out, mime: "image/png" };
    }
    const out = await sharp(buffer).rotate().withMetadata({ exif: undefined }).jpeg({ quality: 92 }).toBuffer();
    return { buffer: out, mime: "image/jpeg" };
  }

  return { buffer, mime };
}

export async function processAndStoreUpload(params: {
  buffer: Buffer;
  mime: string;
  userId: string | null;
  voterKey: string | null;
  aiGenerated?: boolean;
  aiEdited?: boolean;
  aiPrompt?: string;
  losslessPng?: boolean;
  parentMediaId?: string;
  postId?: string;
  sortOrder?: number;
  visibility?: Visibility;
  altText?: string;
  mature?: boolean;
}) {
  const { userId, voterKey } = params;
  const { buffer: out, mime: outMime } = await prepareUploadBuffer(params.buffer, params.mime, {
    losslessPng: params.losslessPng,
  });

  if (userId) await assertUserCanStore(userId, out.byteLength);
  else if (voterKey) await assertAnonymousCanStore(voterKey, out.byteLength);
  else throw new Error("Sign in or use anonymous session");

  const key = newStorageKey(extForMime(outMime));
  await putObject(key, out, outMime);

  let width: number | null = null;
  let height: number | null = null;
  let thumbSmKey: string | null = null;
  let thumbMdKey: string | null = null;
  let placeholderCss: string | null = null;
  if (outMime.startsWith("image/")) {
    try {
      const meta = await imageMeta(out);
      width = meta.width;
      height = meta.height;
      const thumbs = await generateImageThumbnails(out);
      thumbSmKey = thumbs.thumbSmKey;
      thumbMdKey = thumbs.thumbMdKey;
      placeholderCss = thumbs.placeholderCss;
    } catch {
      /* ignore */
    }
  }

  const anonToken = !userId && voterKey ? newDeleteToken() : null;
  const rootFromParent = await resolveRootMediaId(params.parentMediaId);
  const media = await prisma.media.create({
    data: {
      shortId: newShortId(),
      userId,
      voterKey: userId ? null : voterKey,
      visibility: normalizeVisibility(params.visibility ?? "PUBLIC"),
      altText: params.altText,
      mature: params.mature ?? false,
      deleteTokenHash: anonToken ? hashDeleteToken(anonToken) : null,
      postId: params.postId,
      parentMediaId: params.parentMediaId,
      rootMediaId: rootFromParent,
      sortOrder: params.sortOrder ?? 0,
      storageKey: key,
      mimeType: outMime,
      byteSize: out.byteLength,
      width,
      height,
      thumbSmKey,
      thumbMdKey,
      placeholderCss,
      aiGenerated: params.aiGenerated ?? false,
      aiEdited: params.aiEdited ?? false,
      aiPrompt: params.aiPrompt,
    },
  });

  if (userId) await addUserStorage(userId, out.byteLength);
  else if (voterKey) await addAnonymousStorage(voterKey, out.byteLength);

  if (!rootFromParent) {
    await prisma.media.update({ where: { id: media.id }, data: { rootMediaId: media.id } });
  }

  return Object.assign(media, { deleteToken: anonToken, rootMediaId: rootFromParent ?? media.id });
}

export async function replaceMediaInPlace(params: {
  mediaId: string;
  userId: string | null;
  voterKey: string | null;
  buffer: Buffer;
  mime: string;
  allowLockedRoot?: boolean;
}) {
  const media = await prisma.media.findUnique({ where: { id: params.mediaId } });
  if (!media) throw new Error("Not found");
  const root = media.rootMediaId ?? media.id;
  if (media.id === root && !params.allowLockedRoot) {
    throw new Error("The original image is locked — save a new version instead.");
  }

  const { buffer: out, mime: outMime } = await prepareUploadBuffer(params.buffer, params.mime);
  const delta = out.byteLength - media.byteSize;
  if (params.userId) {
    if (delta > 0) await assertUserCanStore(params.userId, delta);
  } else if (params.voterKey) {
    if (delta > 0) await assertAnonymousCanStore(params.voterKey, delta);
  } else {
    throw new Error("Sign in or use anonymous session");
  }

  const key = newStorageKey(extForMime(outMime));
  await putObject(key, out, outMime);

  let width: number | null = null;
  let height: number | null = null;
  if (outMime.startsWith("image/")) {
    try {
      const meta = await imageMeta(out);
      width = meta.width;
      height = meta.height;
    } catch {
      /* ignore */
    }
  }

  await deleteMediaStorage(media);
  await prisma.media.update({
    where: { id: media.id },
    data: {
      storageKey: key,
      mimeType: outMime,
      byteSize: out.byteLength,
      width,
      height,
      thumbSmKey: null,
      thumbMdKey: null,
      placeholderCss: null,
    },
  });

  if (params.userId) {
    if (delta > 0) await addUserStorage(params.userId, delta);
    else if (delta < 0) await removeUserStorage(params.userId, -delta);
  } else if (params.voterKey) {
    const { addAnonymousStorage, removeAnonymousStorage } = await import("@/lib/storage-quota");
    if (delta > 0) await addAnonymousStorage(params.voterKey, delta);
    else if (delta < 0) await removeAnonymousStorage(params.voterKey, -delta);
  }

  return media;
}

export async function storeUserProfileImage(params: {
  userId: string;
  kind: "avatar" | "banner";
  buffer: Buffer;
  mime: string;
}) {
  const user = await prisma.user.findUnique({ where: { id: params.userId } });
  if (!user) throw new Error("Not found");

  const { buffer: out, mime: outMime } = await prepareUploadBuffer(params.buffer, params.mime);

  const oldKey = params.kind === "avatar" ? user.avatarKey : user.bannerKey;
  const oldBytes = oldKey ? await getStoredObjectSize(oldKey) : 0;
  const delta = out.byteLength - oldBytes;
  if (delta > 0) await assertUserCanStore(params.userId, delta);

  if (oldKey) {
    await deleteObject(oldKey);
  }

  const key = newStorageKey(extForMime(outMime));
  await putObject(key, out, outMime);

  if (delta > 0) await addUserStorage(params.userId, delta);
  else if (delta < 0) await removeUserStorage(params.userId, -delta);

  await prisma.user.update({
    where: { id: params.userId },
    data: params.kind === "avatar" ? { avatarKey: key } : { bannerKey: key },
  });

  return { storageKey: key };
}
