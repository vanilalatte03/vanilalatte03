import { Activity, Species, Stage } from "./types";
import { DEFAULT_SPECIES } from "./sprites";

/** Age in days at which each stage begins. */
const STAGE_THRESHOLDS: { stage: Stage; days: number }[] = [
  { stage: "egg", days: 0 },
  { stage: "baby", days: 1 },
  { stage: "child", days: 3 },
  { stage: "teen", days: 7 },
  { stage: "adult", days: 14 },
];

export function stageFor(ageDays: number): Stage {
  let result: Stage = "egg";
  for (const { stage, days } of STAGE_THRESHOLDS) {
    if (ageDays >= days) result = stage;
  }
  return result;
}

/** Whole days until the next stage, or null if already adult. */
export function daysToNextStage(ageDays: number): number | null {
  for (const { days } of STAGE_THRESHOLDS) {
    if (ageDays < days) return Math.ceil(days - ageDays);
  }
  return null;
}

function stageRank(stage: Stage): number {
  return STAGE_THRESHOLDS.findIndex((entry) => entry.stage === stage);
}

export function laterStage(a: Stage, b: Stage): Stage {
  return stageRank(a) >= stageRank(b) ? a : b;
}

/** Parked hook for future special/limited character selection rules. */
export function pickSpecies(_a: Activity, _neglectDays: number): Species {
  return DEFAULT_SPECIES;
}

export interface Evolution {
  stage: Stage;
  /** Active character id. */
  species: Species;
  /** Whether the active character should render as its ghost variant. */
  isGhost: boolean;
  /** Character id frozen at adulthood; "" until then. */
  lockedSpecies: Species | "";
}

/**
 * Resolve the pet's stage, active character, and neglect variant for this tick.
 *
 * Rules:
 *  - Stage advances purely with age.
 *  - Before adulthood, config.character is the active character.
 *  - At adulthood, the current active character is locked.
 *  - After adulthood, the lock wins over later config changes.
 */
export function resolveEvolution(
  a: Activity,
  ageDays: number,
  prevLocked: Species | "",
  neglectDays: number,
  activeCharacter: Species
): Evolution {
  const stage = stageFor(ageDays);
  const neglected = a.daysSinceLastContribution >= neglectDays;

  if (prevLocked) {
    return { stage, species: prevLocked, isGhost: neglected, lockedSpecies: prevLocked };
  }

  const candidate = activeCharacter;

  if (stage === "adult") {
    return { stage, species: candidate, isGhost: neglected, lockedSpecies: candidate };
  }

  return { stage, species: candidate, isGhost: neglected, lockedSpecies: "" };
}
