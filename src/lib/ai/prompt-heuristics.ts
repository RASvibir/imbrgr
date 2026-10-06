/** Cheap local checks — no LLM calls. */

const DETAIL_MARKERS =
  /\b(photorealistic|cinematic|8k|ultra\s*detailed|depth of field|bokeh|lighting|composition|texture|hdr)\b/i;

export function normalizePromptText(prompt: string): string {
  return prompt.replace(/\s+/g, " ").trim();
}

/** User prompt is already rich enough to skip LLM enhancement. */
export function shouldSkipEnhancement(prompt: string): boolean {
  const p = normalizePromptText(prompt);
  const words = p.split(/\s+/).filter(Boolean);
  if (words.length >= 28) return true;
  if (p.length >= 180) return true;
  const commas = (p.match(/,/g) ?? []).length;
  if (words.length >= 18 && commas >= 2) return true;
  if (DETAIL_MARKERS.test(p) && words.length >= 14) return true;
  return false;
}

/** Long or multi-constraint prompts — allow Gemini fallback after cheap tiers fail. */
export function isComplexPrompt(prompt: string): boolean {
  const p = normalizePromptText(prompt);
  const words = p.split(/\s+/).filter(Boolean);
  if (words.length > 40) return true;
  if (p.length > 320) return true;
  const sentences = p.split(/[.!?]+/).filter((s) => s.trim().length > 8);
  if (sentences.length >= 4) return true;
  const constraints = (p.match(/\b(and|with|without|except|but|while)\b/gi) ?? []).length;
  if (constraints >= 4 && words.length >= 22) return true;
  return false;
}
