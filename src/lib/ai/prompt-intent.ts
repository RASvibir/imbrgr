/**
 * Pure intent-preservation analysis for video prompt assistance.
 * Extracts concrete terms, numbers, colors, and negations from a prompt and
 * verifies that an improved prompt keeps the user's original intent.
 */

const STOP_WORDS = new Set([
  "a", "an", "the",
  "i", "me", "my", "we", "our", "you", "your", "he", "him", "his", "she", "her",
  "it", "its", "they", "them", "their", "this", "that", "these", "those",
  "in", "on", "at", "to", "for", "of", "with", "by", "from", "into", "onto",
  "over", "under", "above", "below", "through", "across", "around", "near",
  "beside", "between", "behind", "inside", "outside", "up", "down", "off",
  "out", "about", "against", "during", "before", "after", "as", "until",
  "and", "or", "but", "nor", "yet", "so", "while", "when", "where", "if",
  "than", "because", "although", "though",
  "is", "am", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did",
  "will", "would", "can", "could", "should", "may", "might", "must",
  "some", "any", "many", "much", "more", "most", "all", "both", "each",
  "every", "few", "several", "other", "another", "such",
  "very", "just", "really", "quite", "too", "also", "even", "still",
  "then", "there", "here", "now", "only",
  "no", "not", "without", "never",
]);

const NEGATION_FILLERS = new Set(["a", "an", "the", "any", "more", "much", "other"]);

const KEEP_TRAILING_S = new Set(["lens", "bus", "gas", "plus", "chaos", "iris", "glass", "moss", "grass"]);

export const COLOR_WORDS = new Set([
  "red", "crimson", "scarlet", "burgundy", "maroon",
  "pink", "rose", "magenta", "coral", "salmon",
  "orange", "amber", "peach", "tangerine",
  "yellow", "gold", "golden", "lemon",
  "green", "emerald", "lime", "olive", "mint", "sage",
  "teal", "turquoise", "cyan", "aqua",
  "blue", "navy", "cobalt", "indigo", "azure",
  "purple", "violet", "lavender", "plum", "lilac",
  "brown", "tan", "beige", "cream", "ivory", "bronze", "copper", "rust", "ochre",
  "white", "silver", "gray", "grey", "charcoal", "slate",
  "black", "obsidian", "ebony",
]);

const NUMBER_WORD_TO_DIGIT: Record<string, string> = {
  zero: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
  eleven: "11",
  twelve: "12",
  thirteen: "13",
  fourteen: "14",
  fifteen: "15",
  sixteen: "16",
  seventeen: "17",
  eighteen: "18",
  nineteen: "19",
  twenty: "20",
  thirty: "30",
  forty: "40",
  fifty: "50",
  sixty: "60",
  seventy: "70",
  eighty: "80",
  ninety: "90",
  hundred: "100",
  thousand: "1000",
  million: "1000000",
};

export type PromptNegation = {
  phrase: string;
  negator: "no" | "without" | "not";
  targets: string[];
  targetStems: string[];
};

export type ExtractedAnchors = {
  terms: string[];
  stems: string[];
  numbers: string[];
  colors: string[];
  negations: PromptNegation[];
};

export type VerifyIntentResult = {
  ok: boolean;
  missing: string[];
  added: string[];
  preserved: string[];
};

/** Light, deterministic English stemmer for content terms. */
export function stemWord(raw: string): string {
  const w = raw.toLowerCase().trim();
  if (!w || /\d/.test(w) || w.length <= 3) return w;
  if (KEEP_TRAILING_S.has(w)) return w;

  let s = w;
  if (s.endsWith("ies") && s.length > 4) {
    s = `${s.slice(0, -3)}y`;
  } else if (/(ches|shes|xes|zes|sses|nses)$/.test(s) && s.length > 4) {
    s = s.slice(0, -2);
  } else if (s.endsWith("ses") && s.length > 4) {
    s = s.slice(0, -2);
  } else if (s.endsWith("s") && !s.endsWith("ss") && !s.endsWith("us") && !s.endsWith("is") && s.length > 3) {
    s = s.slice(0, -1);
  }

  if (s.endsWith("ing") && s.length > 5) {
    s = s.slice(0, -3);
    if (/([bcdfghjklmnpqrstvwxyz])\1$/.test(s) && !/(ss|ll|ff|zz)$/.test(s)) {
      s = s.slice(0, -1);
    }
  } else if (s.endsWith("ed") && s.length > 4) {
    s = s.slice(0, -2);
    if (/([bcdfghjklmnpqrstvwxyz])\1$/.test(s) && !/(ss|ll|ff|zz)$/.test(s)) {
      s = s.slice(0, -1);
    }
  } else if (s.endsWith("ly") && s.length > 5) {
    s = s.slice(0, -2);
  }

  if (s.endsWith("e") && s.length > 4 && !/(ee|oe|ye|ue)$/.test(s)) {
    s = s.slice(0, -1);
  }

  return s;
}

type Token = {
  raw: string;
  lower: string;
  clauseIndex: number;
};

function tokenizeClauses(prompt: string): Token[] {
  const clauses = prompt.split(/[,.;!?]+/);
  const tokens: Token[] = [];
  clauses.forEach((clause, clauseIndex) => {
    const matches = clause.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) ?? [];
    for (const raw of matches) {
      const cleaned = raw.replace(/^['’-]+|['’-]+$/g, "");
      if (!cleaned) continue;
      tokens.push({ raw: cleaned, lower: cleaned.toLowerCase(), clauseIndex });
    }
  });
  return tokens;
}

function normalizeNumberToken(lower: string): string | null {
  if (/^\d+(?:\.\d+)?$/.test(lower)) return lower;
  if (lower in NUMBER_WORD_TO_DIGIT) return NUMBER_WORD_TO_DIGIT[lower]!;
  return null;
}

function isNegator(lower: string): lower is "no" | "without" | "not" {
  return lower === "no" || lower === "without" || lower === "not";
}

/**
 * Extract content terms, numbers, colors, and negations from a prompt.
 * Negated target tokens are kept in `negations` rather than positive `terms`/`colors`.
 */
export function extractAnchors(prompt: string): ExtractedAnchors {
  const tokens = tokenizeClauses(prompt);
  const negatedIndices = new Set<number>();
  const negations: PromptNegation[] = [];
  const seenNegationKeys = new Set<string>();

  for (let i = 0; i < tokens.length; i += 1) {
    const tok = tokens[i]!;
    if (!isNegator(tok.lower)) continue;

    let j = i + 1;
    while (
      j < tokens.length &&
      tokens[j]!.clauseIndex === tok.clauseIndex &&
      NEGATION_FILLERS.has(tokens[j]!.lower)
    ) {
      negatedIndices.add(j);
      j += 1;
    }

    const targets: string[] = [];
    const targetStems: string[] = [];
    if (j < tokens.length && tokens[j]!.clauseIndex === tok.clauseIndex) {
      const first = tokens[j]!;
      if (!STOP_WORDS.has(first.lower)) {
        negatedIndices.add(j);
        targets.push(first.lower);
        targetStems.push(stemWord(first.lower));

        const next = tokens[j + 1];
        if (
          next &&
          next.clauseIndex === tok.clauseIndex &&
          COLOR_WORDS.has(first.lower) &&
          !STOP_WORDS.has(next.lower) &&
          !/(ing|ed)$/.test(next.lower)
        ) {
          negatedIndices.add(j + 1);
          targets.push(next.lower);
          targetStems.push(stemWord(next.lower));
        }
      }
    }

    if (targets.length > 0) {
      const key = targetStems.join(" ");
      if (!seenNegationKeys.has(key)) {
        seenNegationKeys.add(key);
        negations.push({
          phrase: `${tok.lower} ${targets.join(" ")}`,
          negator: tok.lower,
          targets,
          targetStems,
        });
      }
      negatedIndices.add(i);
    }
  }

  const numbers: string[] = [];
  const seenNumbers = new Set<string>();
  const colors: string[] = [];
  const seenColors = new Set<string>();
  const terms: string[] = [];
  const stems: string[] = [];
  const seenTermStems = new Set<string>();

  for (let i = 0; i < tokens.length; i += 1) {
    if (negatedIndices.has(i)) continue;
    const tok = tokens[i]!;
    const num = normalizeNumberToken(tok.lower);
    if (num !== null) {
      if (!seenNumbers.has(num)) {
        seenNumbers.add(num);
        numbers.push(num);
      }
      continue;
    }

    if (STOP_WORDS.has(tok.lower)) continue;

    if (COLOR_WORDS.has(tok.lower)) {
      if (!seenColors.has(tok.lower)) {
        seenColors.add(tok.lower);
        colors.push(tok.lower);
      }
      continue;
    }

    if (tok.lower.length < 2) continue;
    const stem = stemWord(tok.lower);
    if (!seenTermStems.has(stem)) {
      seenTermStems.add(stem);
      terms.push(tok.lower);
      stems.push(stem);
    }
  }

  return { terms, stems, numbers, colors, negations };
}

function stemMatchesPool(origStem: string, targetStems: string[], targetTerms: string[]): boolean {
  if (targetStems.includes(origStem)) return true;
  if (origStem.length >= 5) {
    return targetTerms.some((t) => t.startsWith(origStem));
  }
  return false;
}

function negationPreservedInText(
  origNeg: PromptNegation,
  imprAnchors: ExtractedAnchors,
  improvedLower: string,
): boolean {
  const imprNegStems = new Set(imprAnchors.negations.flatMap((n) => n.targetStems));
  if (origNeg.targetStems.every((s) => imprNegStems.has(s))) return true;

  // Allow common equivalents like "never X" or "X-free" / "free of X".
  return origNeg.targetStems.every((stem) => {
    const escaped = stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const prefixRe = new RegExp(`\\b(?:no|without|not|never|free\\s+of)\\b[^,.;!?]*\\b${escaped}\\w*`, "i");
    const suffixRe = new RegExp(`\\b${escaped}\\w*-free\\b`, "i");
    return prefixRe.test(improvedLower) || suffixRe.test(improvedLower);
  });
}

/**
 * Verify that `improved` preserves the user's original intent:
 * - 100% of numbers preserved
 * - 100% of negations preserved
 * - >= 85% of other anchors (colors + content terms) preserved by stem match
 */
export function verifyIntent(original: string, improved: string): VerifyIntentResult {
  const origTrimmed = original.trim();
  const imprTrimmed = improved.trim();

  if (!origTrimmed) {
    const imprEmpty = !imprTrimmed;
    const imprAnchors = imprEmpty ? null : extractAnchors(imprTrimmed);
    return {
      ok: imprEmpty,
      missing: [],
      added: imprAnchors ? [...imprAnchors.colors, ...imprAnchors.terms] : [],
      preserved: [],
    };
  }

  if (!imprTrimmed) {
    const origAnchors = extractAnchors(origTrimmed);
    return {
      ok: false,
      missing: [
        ...origAnchors.numbers,
        ...origAnchors.negations.map((n) => n.phrase),
        ...origAnchors.colors,
        ...origAnchors.terms,
      ],
      added: [],
      preserved: [],
    };
  }

  const orig = extractAnchors(origTrimmed);
  const impr = extractAnchors(imprTrimmed);
  const imprLower = imprTrimmed.toLowerCase();

  const missing: string[] = [];
  const preserved: string[] = [];

  let allNumbersKept = true;
  for (const num of orig.numbers) {
    if (impr.numbers.includes(num)) {
      preserved.push(num);
    } else {
      allNumbersKept = false;
      missing.push(num);
    }
  }

  let allNegationsKept = true;
  for (const neg of orig.negations) {
    if (negationPreservedInText(neg, impr, imprLower)) {
      preserved.push(neg.phrase);
    } else {
      allNegationsKept = false;
      missing.push(neg.phrase);
    }
  }

  const imprPositiveStems = [...impr.colors.map(stemWord), ...impr.stems];
  const imprPositiveTerms = [...impr.colors, ...impr.terms];

  const otherOrigEntries: { label: string; stem: string }[] = [
    ...orig.colors.map((c) => ({ label: c, stem: stemWord(c) })),
    ...orig.terms.map((t, idx) => ({ label: t, stem: orig.stems[idx]! })),
  ];

  // Very short prompts made exclusively of stopwords (e.g. "go on") fall back to raw token match.
  if (orig.numbers.length === 0 && orig.negations.length === 0 && otherOrigEntries.length === 0) {
    const origTokens = tokenizeClauses(origTrimmed).map((t) => t.lower);
    const imprTokens = new Set(tokenizeClauses(imprTrimmed).map((t) => t.lower));
    const missingRaw = origTokens.filter((t) => !imprTokens.has(t));
    const keptRaw = origTokens.filter((t) => imprTokens.has(t));
    return {
      ok: missingRaw.length === 0,
      missing: missingRaw,
      added: [...impr.colors, ...impr.terms],
      preserved: keptRaw,
    };
  }

  let preservedOtherCount = 0;
  for (const entry of otherOrigEntries) {
    if (stemMatchesPool(entry.stem, imprPositiveStems, imprPositiveTerms)) {
      preservedOtherCount += 1;
      preserved.push(entry.label);
    } else {
      missing.push(entry.label);
    }
  }

  const otherRatio =
    otherOrigEntries.length === 0 ? 1 : preservedOtherCount / otherOrigEntries.length;

  const ok = allNumbersKept && allNegationsKept && otherRatio >= 0.85;

  const origAllStems = [
    ...orig.colors.map(stemWord),
    ...orig.stems,
    ...orig.negations.flatMap((n) => n.targetStems),
  ];
  const origAllTerms = [
    ...orig.colors,
    ...orig.terms,
    ...orig.negations.flatMap((n) => n.targets),
  ];

  const added: string[] = [];
  const seenAdded = new Set<string>();
  const addUnique = (val: string) => {
    const key = val.toLowerCase();
    if (!seenAdded.has(key)) {
      seenAdded.add(key);
      added.push(val);
    }
  };

  for (const num of impr.numbers) {
    if (!orig.numbers.includes(num)) addUnique(num);
  }
  for (const neg of impr.negations) {
    const origNegStems = new Set(orig.negations.flatMap((n) => n.targetStems));
    if (!neg.targetStems.every((s) => origNegStems.has(s))) {
      addUnique(neg.phrase);
    }
  }
  for (const color of impr.colors) {
    const stem = stemWord(color);
    if (!stemMatchesPool(stem, origAllStems, origAllTerms)) addUnique(color);
  }
  for (let i = 0; i < impr.terms.length; i += 1) {
    const term = impr.terms[i]!;
    const stem = impr.stems[i]!;
    if (!stemMatchesPool(stem, origAllStems, origAllTerms)) addUnique(term);
  }

  return { ok, missing, added, preserved };
}
