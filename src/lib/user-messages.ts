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
  if (
    lower.includes("generation failed") ||
    lower.includes("pollinations") ||
    lower.includes("gemini") ||
    lower.includes("image_gen") ||
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
  guestBanner:
    "You're browsing as a guest. Create a free account to keep images private and save more to your gallery.",
  generateWorking: "Plating your image…",
  generateCta: "Cook up image",
  enhancePrompt: "Sprinkle extra detail on my description",
  aiAssistantBlurb: "Describe a tweak or tap a chip — preview first, then keep what you like.",
  applyAiEdit: "Apply change",
  publishCta: "Serve to gallery",
  publishSuccess: "It's live on the gallery — nice and hot.",
  settingsSaved: "Saved — looking good.",
  imageReady: "Ready in the studio.",
  guestDeleteHint:
    "Save this secret code somewhere safe — you'll need it to remove this guest upload later.",
} as const;
