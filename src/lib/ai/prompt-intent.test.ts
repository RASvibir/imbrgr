import { describe, expect, it } from "vitest";
import { extractAnchors, stemWord, verifyIntent } from "./prompt-intent";

describe("stemWord", () => {
  it("stems plurals, -ing, -ed, and -ly consistently", () => {
    expect(stemWord("cats")).toBe("cat");
    expect(stemWord("cities")).toBe("city");
    expect(stemWord("running")).toBe("run");
    expect(stemWord("sizzling")).toBe("sizzl");
    expect(stemWord("sizzles")).toBe("sizzl");
    expect(stemWord("sizzle")).toBe("sizzl");
    expect(stemWord("walked")).toBe("walk");
    expect(stemWord("35mm")).toBe("35mm");
  });
});

describe("extractAnchors", () => {
  it("separates numbers, colors, negations, and content terms", () => {
    const anchors = extractAnchors("2 red cats without collars on a wooden table");
    expect(anchors.numbers).toEqual(["2"]);
    expect(anchors.colors).toEqual(["red"]);
    expect(anchors.negations).toHaveLength(1);
    expect(anchors.negations[0]).toMatchObject({
      negator: "without",
      targets: ["collars"],
    });
    expect(anchors.terms).toEqual(["cats", "wooden", "table"]);
  });
});

describe("verifyIntent", () => {
  it("requires negations to be kept", () => {
    const kept = verifyIntent(
      "burger without onions on a plate",
      "juicy burger without onions on a ceramic plate, warm rim light",
    );
    expect(kept.ok).toBe(true);
    expect(kept.missing).toEqual([]);
    expect(kept.preserved).toContain("without onions");

    const flipped = verifyIntent(
      "burger without onions on a plate",
      "juicy burger with crispy onions on a ceramic plate",
    );
    expect(flipped.ok).toBe(false);
    expect(flipped.missing).toContain("without onions");

    const dropped = verifyIntent(
      "street with no cars, not raining",
      "empty street at dusk, warm streetlights",
    );
    expect(dropped.ok).toBe(false);
    expect(dropped.missing).toEqual(expect.arrayContaining(["no cars", "not raining"]));
  });

  it("requires numbers to be kept and allows digit/word equivalence", () => {
    const wordToDigit = verifyIntent(
      "three glowing lanterns in an alley",
      "3 glowing lanterns swaying in a foggy alley, warm practical lighting",
    );
    expect(wordToDigit.ok).toBe(true);
    expect(wordToDigit.preserved).toContain("3");

    const droppedNum = verifyIntent(
      "2 surfers paddling toward a wave",
      "surfers paddling toward a glassy wave, golden hour",
    );
    expect(droppedNum.ok).toBe(false);
    expect(droppedNum.missing).toContain("2");

    const changedNum = verifyIntent(
      "2 surfers paddling toward a wave",
      "4 surfers paddling toward a glassy wave",
    );
    expect(changedNum.ok).toBe(false);
    expect(changedNum.missing).toContain("2");
  });

  it("keeps colors and rejects color swaps", () => {
    const kept = verifyIntent(
      "emerald dragon flying over mountains",
      "emerald dragon flying smoothly over misty mountains, golden sunlight, wide frame",
    );
    expect(kept.ok).toBe(true);
    expect(kept.preserved).toContain("emerald");
    expect(kept.added).toEqual(expect.arrayContaining(["smoothly", "misty", "golden", "sunlight"]));

    const swapped = verifyIntent(
      "emerald dragon flying",
      "green dragon soaring through clouds",
    );
    expect(swapped.ok).toBe(false);
    expect(swapped.missing).toContain("emerald");
  });

  it("rejects synonym drift", () => {
    const drift = verifyIntent(
      "sunset burger on a wooden table",
      "twilight sandwich on an oak desk, warm lighting",
    );
    expect(drift.ok).toBe(false);
    expect(drift.missing).toEqual(expect.arrayContaining(["sunset", "burger", "wooden", "table"]));
  });

  it("handles stem matches and compound prefixes like window -> windowsill", () => {
    const res = verifyIntent("cat window", "fluffy cat sitting on a sunny windowsill");
    expect(res.ok).toBe(true);
    expect(res.missing).toEqual([]);
  });

  it("handles empty and very short prompts safely", () => {
    expect(verifyIntent("", "")).toMatchObject({ ok: true, missing: [], preserved: [] });
    expect(verifyIntent("", "surprise neon dragon")).toMatchObject({ ok: false });

    const shortOk = verifyIntent("cat", "cat stretching in morning light");
    expect(shortOk.ok).toBe(true);
    expect(shortOk.preserved).toEqual(["cat"]);

    const shortFail = verifyIntent("cat", "feline stretching in morning light");
    expect(shortFail.ok).toBe(false);
    expect(shortFail.missing).toEqual(["cat"]);

    const stopOnlyFail = verifyIntent("go on", "purple elephant");
    expect(stopOnlyFail.ok).toBe(false);
  });

  it("allows up to 15% non-number/non-negation anchor omission", () => {
    // 7 other anchors: 6/7 = 85.7% >= 85% -> ok
    const seven = "vintage brass clock ticking beside dusty leather books";
    const sixKept = "vintage brass clock ticking beside leather books, warm lamp light";
    expect(verifyIntent(seven, sixKept).ok).toBe(true);

    // 5/7 = 71.4% < 85% -> rejected
    const fiveKept = "vintage brass clock ticking beside books, warm lamp light";
    expect(verifyIntent(seven, fiveKept).ok).toBe(false);
  });
});
