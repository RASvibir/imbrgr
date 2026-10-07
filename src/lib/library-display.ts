import { STUDIO_AUTO_LIBRARY_LABEL } from "@/lib/library-constants";

export function isStudioAutoLibraryLabel(label: string | null | undefined): boolean {
  return label === STUDIO_AUTO_LIBRARY_LABEL;
}

/** User-visible caption for a library save row (never internal markers). */
export function librarySaveCaption(params: {
  label: string | null | undefined;
  autoSaved: boolean;
  mediaTitle?: string | null;
  altText?: string | null;
}): string | null {
  if (params.autoSaved || isStudioAutoLibraryLabel(params.label)) {
    const title = params.mediaTitle?.trim() || params.altText?.trim();
    return title || null;
  }
  const manual = params.label?.trim();
  if (manual && !isStudioAutoLibraryLabel(manual)) return manual;
  return params.mediaTitle?.trim() || params.altText?.trim() || null;
}
