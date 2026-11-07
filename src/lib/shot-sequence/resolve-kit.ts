import { prisma } from "@/lib/db";
import { ownsKitRow } from "@/lib/kit-access";
import { buildKitPromptExtras } from "@/lib/kit-prompt";
import type { Actor } from "@/lib/request-identity";

/** Resolve an owned kit by shortId, or null when clearing / absent. */
export async function resolveOwnedKitShortId(
  actor: Actor,
  kitShortId: string | null | undefined,
): Promise<{ ok: true; kitShortId: string | null } | { ok: false; error: string; status: number }> {
  if (kitShortId == null || kitShortId === "") {
    return { ok: true, kitShortId: null };
  }
  const kit = await prisma.characterKit.findUnique({
    where: { shortId: kitShortId.trim() },
    select: { shortId: true, userId: true, voterKey: true },
  });
  if (!kit || !ownsKitRow(kit, actor)) {
    return { ok: false, error: "Character kit not found", status: 404 };
  }
  return { ok: true, kitShortId: kit.shortId };
}

/** Server-side kit prompt fragment for export / handoff. */
export async function kitPromptForSequence(kitShortId: string | null): Promise<{
  fragment: string;
  stylePreset?: string;
}> {
  if (!kitShortId) return { fragment: "" };
  const kit = await prisma.characterKit.findUnique({
    where: { shortId: kitShortId },
    select: { name: true, styleLock: true, paletteJson: true, stylePreset: true },
  });
  if (!kit) return { fragment: "" };
  return buildKitPromptExtras(kit);
}
