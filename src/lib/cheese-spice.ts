/** Kitchen-themed engagement heat (food / ember — not a second unique counter). */

export const SPICE_LEVEL_MAX = 5;

/** Map spice score to 0–5 chili ticks for the meter. */
export function spiceLevel(spiceScore: number): number {
  if (spiceScore <= 0) return 0;
  if (spiceScore < 3) return 1;
  if (spiceScore < 8) return 2;
  if (spiceScore < 20) return 3;
  if (spiceScore < 50) return 4;
  return 5;
}

/** Cheese stretch / melt fill 0–100 for the gauge bar. */
export function cheeseMeltPercent(spiceScore: number): number {
  const level = spiceLevel(spiceScore);
  const within = spiceScore <= 0 ? 0 : Math.min(100, 12 + level * 16 + Math.min(spiceScore % 7, 6) * 2);
  return within;
}

export type SpiceKitchenLabel = {
  cheese: string;
  chili: string;
};

export function spiceKitchenCopy(level: number): SpiceKitchenLabel {
  switch (level) {
    case 0:
      return { cheese: "Cool counter", chili: "No chili yet" };
    case 1:
      return { cheese: "Warming up", chili: "Mild" };
    case 2:
      return { cheese: "Melty", chili: "Simmering" };
    case 3:
      return { cheese: "Good stretch", chili: "Medium" };
    case 4:
      return { cheese: "Bubbling", chili: "Hot plate" };
    default:
      return { cheese: "Full pull", chili: "Extra chili" };
  }
}

/** Spice delta for a view event (unique tally handled separately). */
export function spiceDeltaForView(isAnonymous: boolean, isRepeat: boolean): number {
  if (isRepeat) return 1;
  if (isAnonymous) return 1;
  return 0;
}
