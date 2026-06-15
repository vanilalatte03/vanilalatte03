import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getCharacterSpriteDir } from "./characters";
import { Mood, Species, Stage } from "./types";

export const DEFAULT_SPECIES: Species = "yuki";

// Display labels for species/stage moved to i18n.ts so they can be localized.

interface SpriteSpec {
  file: string;
  /** Render width/height in the card, in SVG units. */
  displaySize: number;
}

export interface SpriteAsset extends SpriteSpec {
  href: string;
}

// We embed the "@3x" variants: ~192px, display-optimized PNGs (~8-10KB each).
// They are crisp at our ~158px display size and keep pet.svg ~20x smaller than
// the full-resolution source sprites.
const VARIANT_SUFFIX = "@3x";

const STAGE_SPRITES: Record<Stage, SpriteSpec> = {
  egg: { file: "egg.png", displaySize: 96 },
  baby: { file: "baby.png", displaySize: 118 },
  child: { file: "child.png", displaySize: 136 },
  teen: { file: "teen.png", displaySize: 150 },
  adult: { file: "adult.png", displaySize: 158 },
};

const ADULT_MOOD_SPRITES: Record<Mood, SpriteSpec> = {
  happy: { file: "adult-happy.png", displaySize: 158 },
  hungry: { file: "adult-hungry.png", displaySize: 158 },
  sick: { file: "adult-sick.png", displaySize: 158 },
};

const STAGE_MOOD_SPRITES: Partial<Record<Stage, Partial<Record<Mood, SpriteSpec>>>> = {
  baby: {
    hungry: { file: "baby-hungry.png", displaySize: 126 },
    sick: { file: "baby-sick.png", displaySize: 126 },
  },
  child: {
    hungry: { file: "child-hungry.png", displaySize: 142 },
    sick: { file: "child-sick.png", displaySize: 142 },
  },
  teen: {
    hungry: { file: "teen-hungry.png", displaySize: 154 },
    sick: { file: "teen-sick.png", displaySize: 154 },
  },
};

const GHOST_SPRITE: SpriteSpec = { file: "ghost.png", displaySize: 158 };

const dataUriCache = new Map<string, string>();

function variantFile(file: string): string {
  return file.replace(/\.png$/, `${VARIANT_SUFFIX}.png`);
}

function spriteDataUri(species: Species, file: string): string {
  const cacheKey = `${species}:${file}`;
  const cached = dataUriCache.get(cacheKey);
  if (cached) return cached;

  const path = join(getCharacterSpriteDir(species), variantFile(file));
  if (!existsSync(path)) {
    throw new Error(`Missing sprite asset: ${path}`);
  }

  const encoded = readFileSync(path).toString("base64");
  const href = `data:image/png;base64,${encoded}`;
  dataUriCache.set(cacheKey, href);
  return href;
}

export function spriteFor(stage: Stage, species: Species, mood: Mood, ghost = false): SpriteAsset {
  const spec =
    ghost && stage !== "egg"
      ? GHOST_SPRITE
      : stage === "adult"
        ? ADULT_MOOD_SPRITES[mood]
        : STAGE_MOOD_SPRITES[stage]?.[mood] ?? STAGE_SPRITES[stage];

  return {
    ...spec,
    href: spriteDataUri(species, spec.file),
  };
}
