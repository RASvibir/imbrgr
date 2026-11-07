import { mediaUrl } from "@/lib/urls";
import { parseKitPalette } from "@/lib/kit-prompt";

type KitMedia = {
  shortId: string;
  storageKey: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  altText: string | null;
};

type KitRefRow = {
  id: string;
  role: string;
  sortOrder: number;
  note: string | null;
  media: KitMedia;
};

type KitRow = {
  shortId: string;
  name: string;
  description: string | null;
  styleLock: string | null;
  paletteJson: unknown;
  stylePreset: string | null;
  visibility: string;
  createdAt: Date;
  updatedAt: Date;
  coverMedia?: KitMedia | null;
  refs?: KitRefRow[];
  _count?: { refs: number };
};

function serializeMedia(m: KitMedia) {
  return {
    shortId: m.shortId,
    storageKey: m.storageKey,
    mimeType: m.mimeType,
    width: m.width,
    height: m.height,
    altText: m.altText,
    previewUrl: mediaUrl(m.storageKey, m.mimeType),
  };
}

export function serializeKit(kit: KitRow) {
  return {
    shortId: kit.shortId,
    name: kit.name,
    description: kit.description,
    styleLock: kit.styleLock,
    palette: parseKitPalette(kit.paletteJson),
    stylePreset: kit.stylePreset,
    visibility: kit.visibility,
    createdAt: kit.createdAt,
    updatedAt: kit.updatedAt,
    cover: kit.coverMedia ? serializeMedia(kit.coverMedia) : null,
    refCount: kit._count?.refs ?? kit.refs?.length ?? 0,
    refs: (kit.refs ?? []).map((r) => ({
      id: r.id,
      role: r.role,
      sortOrder: r.sortOrder,
      note: r.note,
      media: serializeMedia(r.media),
    })),
  };
}

export const kitMediaSelect = {
  shortId: true,
  storageKey: true,
  mimeType: true,
  width: true,
  height: true,
  altText: true,
} as const;
