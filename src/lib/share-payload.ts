import { useMemo } from "react";
import { buildShareCodes } from "@/lib/embed-codes";
import { postUrl } from "@/lib/urls";

export type SharePayload = ReturnType<typeof buildShareCodes>;

export type SharePayloadInput = {
  mediaShortId: string;
  storageKey: string;
  mimeType: string;
  title: string;
  postShortId?: string | null;
};

export function buildSharePayload(input: SharePayloadInput): SharePayload {
  const pagePath = input.postShortId ? postUrl(input.postShortId) : undefined;
  return buildShareCodes(
    input.mediaShortId,
    input.storageKey,
    input.mimeType,
    input.title,
    pagePath,
  );
}

export function useSharePayload(input: SharePayloadInput | null | undefined): SharePayload | null {
  return useMemo(() => {
    if (!input?.mediaShortId || !input.storageKey) return null;
    return buildSharePayload(input);
  }, [input?.mediaShortId, input?.storageKey, input?.mimeType, input?.title, input?.postShortId]);
}
