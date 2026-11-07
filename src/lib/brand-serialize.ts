import { mediaUrl } from "@/lib/urls";
import { parseKitPalette } from "@/lib/kit-prompt";
import { parseLogoSafeZone } from "@/lib/brand-prompt";

type BrandMedia = {
  shortId: string;
  storageKey: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  altText: string | null;
};

type BrandRow = {
  shortId: string;
  name: string;
  description: string | null;
  styleLock: string | null;
  paletteJson: unknown;
  typographyLock: string | null;
  stylePreset: string | null;
  logoSafeZone: string;
  visibility: string;
  createdAt: Date;
  updatedAt: Date;
  logoMedia?: BrandMedia | null;
};

function serializeMedia(m: BrandMedia) {
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

export function serializeBrandKit(kit: BrandRow) {
  return {
    shortId: kit.shortId,
    name: kit.name,
    description: kit.description,
    styleLock: kit.styleLock,
    palette: parseKitPalette(kit.paletteJson),
    typographyLock: kit.typographyLock,
    stylePreset: kit.stylePreset,
    logoSafeZone: parseLogoSafeZone(kit.logoSafeZone),
    visibility: kit.visibility,
    createdAt: kit.createdAt,
    updatedAt: kit.updatedAt,
    logo: kit.logoMedia ? serializeMedia(kit.logoMedia) : null,
  };
}

export const brandMediaSelect = {
  shortId: true,
  storageKey: true,
  mimeType: true,
  width: true,
  height: true,
  altText: true,
} as const;
