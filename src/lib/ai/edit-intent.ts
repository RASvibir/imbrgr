const LOCAL_ADJUSTMENT =
  /\b(brighten|brighter|darken|darker|dimmer|dim|sharpen|sharper|blur|soften|softer|contrast|saturat|vivid|pop|warm(er)?|cool(er)?|golden|color balance)\b/i;

const CONTENT_OR_STYLE =
  /\b(add|remove|delete|erase|replace|swap|insert|include|put|give|change|turn into|restyle|transform|reimagin|style of|look like|looks like|outfit|background|fairy|fairies|person|people|animal|object|text|logo|hat|sky|tree|flower|car|building)\b/i;

/** Fast local sharp tweaks only when the instruction is clearly a simple adjustment. */
export function shouldUseLocalImageEdit(instruction: string): boolean {
  const t = instruction.trim();
  if (t.length < 3) return false;
  if (LOCAL_ADJUSTMENT.test(t) && !CONTENT_OR_STYLE.test(t)) return true;
  if (CONTENT_OR_STYLE.test(t)) return false;
  return LOCAL_ADJUSTMENT.test(t);
}
