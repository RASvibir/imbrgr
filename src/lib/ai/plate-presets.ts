/**
 * Shippable animation presets for still “plates” (images on the video timeline)
 * and subject-motion starters for AI video.
 *
 * Public labels are imbrgr creative-tooling only — no game / product pitch.
 */

import {
  CHARACTER_MOTIONS,
  isCharacterMotion,
  type CharacterMotion,
} from "@/lib/ai/character-motion";
import { CAMERA_MOTIONS, type CameraMotion } from "@/lib/ai/video-provider";

export type PlatePresetKind = "character" | "camera-loop";

export type PlatePresetId =
  | CharacterMotion
  | "pan-loop"
  | "zoom-loop"
  | "orbit-loop";

export type PlatePreset = {
  id: PlatePresetId;
  label: string;
  description: string;
  kind: PlatePresetKind;
  characterMotion?: CharacterMotion;
  /** Ken Burns / camera move applied to still plates. */
  cameraMotion?: CameraMotion;
  /** When true, still-plate camera progress ping-pongs instead of one-shot. */
  motionLoop?: boolean;
};

export const PLATE_PRESETS: PlatePreset[] = [
  ...CHARACTER_MOTIONS.map(
    (m): PlatePreset => ({
      id: m.id,
      label: m.label,
      description: m.description,
      kind: "character",
      characterMotion: m.id,
      // Soft push keeps stills alive while the AI prompt carries subject motion.
      cameraMotion: "pulse",
      motionLoop: true,
    }),
  ),
  {
    id: "pan-loop",
    label: "Pan Loop",
    description: "Repeating lateral sweep for still plates",
    kind: "camera-loop",
    cameraMotion: "pan-right",
    motionLoop: true,
  },
  {
    id: "zoom-loop",
    label: "Zoom Loop",
    description: "Repeating push and pull for still plates",
    kind: "camera-loop",
    cameraMotion: "zoom-in",
    motionLoop: true,
  },
  {
    id: "orbit-loop",
    label: "Orbit Loop",
    description: "Repeating gentle orbital drift",
    kind: "camera-loop",
    cameraMotion: "orbit",
    motionLoop: true,
  },
];

const BY_ID = new Map(PLATE_PRESETS.map((p) => [p.id, p]));

export function isPlatePresetId(value: string | undefined | null): value is PlatePresetId {
  return Boolean(value && BY_ID.has(value as PlatePresetId));
}

export function resolvePlatePreset(value: string | undefined | null): PlatePreset | undefined {
  if (!value) return undefined;
  return BY_ID.get(value as PlatePresetId);
}

const CAMERA_IDS = new Set(CAMERA_MOTIONS.map((m) => m.id));

export function isCameraMotionId(value: string | undefined | null): value is CameraMotion {
  return Boolean(value && CAMERA_IDS.has(value as CameraMotion));
}

/**
 * Resolve a `?preset=` studio deep-link into camera / character / loop flags.
 * Plate presets win over raw camera ids when both could match (they don't today).
 */
export function resolveStudioVideoPreset(preset: string | undefined | null): {
  plate?: PlatePreset;
  cameraMotion?: CameraMotion;
  characterMotion?: CharacterMotion;
  motionLoop?: boolean;
  style?: string;
} {
  if (!preset) return {};
  const plate = resolvePlatePreset(preset);
  if (plate) {
    return {
      plate,
      cameraMotion: plate.cameraMotion,
      characterMotion: plate.characterMotion,
      motionLoop: plate.motionLoop,
    };
  }
  if (isCameraMotionId(preset)) {
    return { cameraMotion: preset };
  }
  if (isCharacterMotion(preset)) {
    return { characterMotion: preset };
  }
  return {};
}
