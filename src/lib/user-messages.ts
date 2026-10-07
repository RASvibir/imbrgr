/** Map internal/API errors to warm consumer copy (ember voice). */
export function friendlyError(raw: string | undefined | null): string {
  const msg = (raw ?? "").trim();
  if (!msg) return "Something didn't quite work — give it another try.";
  const lower = msg.toLowerCase();
  if (lower.includes("daily ai limit") || lower.includes("guest ai limit") || lower.includes("ai limit")) {
    return "The kitchen's resting for today — swing by tomorrow, or sign in to keep cooking.";
  }
  if (lower.includes("too many requests") || lower.includes("slow down")) {
    return "We're plating as fast as we can — pause a moment and try again.";
  }
  if (lower.includes("quota") || lower.includes("storage")) {
    return "Your plate is full — free up space or sign in for a bigger serving.";
  }
  if (lower.includes("sign in required") || lower.includes("unauthorized")) {
    return "Sign in to save this to your account.";
  }
  if (lower.includes("anonymous uploads are temporarily disabled")) {
    return "Guest uploads are taking a quick break — try again soon or create an account.";
  }
  if (lower.includes("guest ai is temporarily disabled")) {
    return "Image magic is on a short break for guests — try again later or sign in.";
  }
  if (lower.includes("pollinations_edit") || lower.includes("gemini image edit")) {
    return "We couldn't apply that change — try different words or try again in a moment.";
  }
  if (lower.includes("not configured")) {
    return "Image magic isn't available here yet — try a quick chip or manual edit.";
  }
  if (
    lower.includes("generation failed") ||
    lower.includes("pollinations") ||
    lower.includes("gemini") ||
    lower.includes("image_gen") ||
    lower.includes("image_edit") ||
    /\b(4|5)\d{2}\b/.test(lower)
  ) {
    return "We couldn't finish that image — tweak your description and try again.";
  }
  if (lower.includes("upstream_timeout") || lower.includes("timeout")) {
    return "That took too long to finish — try a simpler description or try again in a moment.";
  }
  if (lower.includes("invalid") && lower.includes("prompt")) {
    return "Tell us a bit more about what you want to see (a few words at least).";
  }
  return msg.length > 120 ? "Something didn't quite work — give it another try." : msg;
}

export const COPY = {
  studioTagline: "Describe it, refine it, share it — images, served hot.",
  generateWorking: "Plating your image…",
  assistWorking: "Cooking up your change…",
  generateCta: "Cook up image",
  enhancePrompt: "Sprinkle extra detail on my description",
  aiAssistantBlurb: "Describe a tweak or tap a chip — preview first, then keep what you like.",
  applyAiEdit: "Apply change",
  publishCta: "Serve to gallery",
  publishSuccess: "It's live on the gallery — nice and hot.",
  settingsSaved: "Saved — looking good.",
  imageReady: "Ready in the studio.",
  galleryLivePublic: "It's on the gallery — you'll see it on Home and Hot.",
  gallerySavedPrivate: "Saved just for you — it won't show on the public gallery.",
  gallerySavedUnlisted: "Saved with a link — it won't appear on Home or Hot.",
  signInForPrivateGallery: "Sign in to keep images private or unlisted — guest uploads always go on the public gallery.",
  deleteAccountAlsoRemovePosts:
    "Also take down all my posts.",
  librarySave: "Save to my images",
  librarySaveToFolder: "Save to folder…",
  libraryDownload: "Download",
  libraryRevertOriginal: "Revert to original",
  studioKeepOriginal: "Keep original in my images",
  studioKeepOriginalHint:
    "When on, we automatically keep the first version in your images when you edit. When off, only your latest version is kept automatically—you can still save any version from the image menu.",
  librarySaved: "Saved to your images.",
  libraryAutoSavedChip: "Auto-saved",
  librarySavedToFolder: (name: string) => `Saved to folder “${name}”.`,
  guestDeleteHint:
    "Save this secret code somewhere safe — you'll need it to remove this guest upload later.",
} as const;
