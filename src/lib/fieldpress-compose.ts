import {
  canOfferFieldPressLink,
  fieldpressComposeUrl,
  isSafeFieldPressImageUrl,
} from "@/lib/fieldpress";
import { fieldpressDraftComposeWithImageUrl, parseFieldPressDraftId } from "@/lib/fieldpress-draft";

export function resolveFieldPressComposeHref(input: {
  imageDirectUrl: string;
  visibility?: string | null;
  title?: string | null;
  draftId?: string | null;
}): string | null {
  if (!canOfferFieldPressLink(input.visibility)) return null;
  if (!isSafeFieldPressImageUrl(input.imageDirectUrl)) return null;
  const draft = parseFieldPressDraftId(input.draftId ?? null);
  if (draft) {
    return fieldpressDraftComposeWithImageUrl(draft, input.imageDirectUrl, input.title);
  }
  return fieldpressComposeUrl(input.imageDirectUrl, input.title);
}
