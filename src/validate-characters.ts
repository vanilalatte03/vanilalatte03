import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getCharacterSpriteDir, listCharacters, RegisteredCharacter } from "./characters";
import { spriteFor } from "./sprites";
import { Mood, Stage } from "./types";

/**
 * CI gate for community character contributions. Validates the *technical contract*
 * only — it cannot judge art style, originality, or appropriateness (that is the
 * human review gate; see MODERATION.md). Reuses the runtime registry + sprite
 * resolver so "what CI checks" and "what the renderer needs" never drift apart.
 *
 * Run: npm run validate:characters
 */

const STAGES: Stage[] = ["egg", "baby", "child", "teen", "adult"];
const MOODS: Mood[] = ["happy", "hungry", "sick"];

/** @3x PNGs embed at ~158px; these bounds just catch obviously wrong assets. */
const MAX_PNG_BYTES = 80 * 1024;
const MAX_PNG_DIMENSION = 320;
const MIN_PNG_DIMENSION = 32;

const PNG_SIGNATURE = "89504e470d0a1a0a";

interface PngInfo {
  width: number;
  height: number;
  /** PNG color type: 0 gray, 2 RGB, 3 palette, 4 gray+alpha, 6 RGBA. */
  colorType: number;
}

function readPngInfo(buffer: Buffer): PngInfo | null {
  if (buffer.length < 26 || buffer.subarray(0, 8).toString("hex") !== PNG_SIGNATURE) {
    return null;
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    colorType: buffer.readUInt8(25),
  };
}

/** Resolve every sprite the renderer can request, so a missing @3x asset fails here. */
function checkRequiredSprites(character: RegisteredCharacter): string[] {
  const errors: string[] = [];
  const resolve = (stage: Stage, mood: Mood, ghost: boolean) => {
    try {
      spriteFor(stage, character.id, mood, ghost);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  };

  for (const stage of STAGES) {
    for (const mood of MOODS) resolve(stage, mood, false);
  }
  // Ghost (neglect) variant uses the character's ghost sprite for non-egg stages.
  resolve("adult", "sick", true);

  return errors;
}

function checkPngAssets(character: RegisteredCharacter): string[] {
  const errors: string[] = [];
  const dir = getCharacterSpriteDir(character.id);
  const pngs = readdirSync(dir).filter((name) => name.endsWith("@3x.png"));

  for (const file of pngs) {
    const buffer = readFileSync(join(dir, file));
    const where = `${character.id}/${file}`;

    if (buffer.length > MAX_PNG_BYTES) {
      errors.push(`${where}: ${(buffer.length / 1024).toFixed(1)}KB exceeds ${MAX_PNG_BYTES / 1024}KB cap.`);
    }

    const info = readPngInfo(buffer);
    if (!info) {
      errors.push(`${where}: not a valid PNG.`);
      continue;
    }
    if (info.colorType === 0 || info.colorType === 2) {
      errors.push(`${where}: needs an alpha channel (transparent background); got opaque PNG color type ${info.colorType}.`);
    }
    if (
      info.width > MAX_PNG_DIMENSION ||
      info.height > MAX_PNG_DIMENSION ||
      info.width < MIN_PNG_DIMENSION ||
      info.height < MIN_PNG_DIMENSION
    ) {
      errors.push(
        `${where}: ${info.width}x${info.height}px is outside the ${MIN_PNG_DIMENSION}–${MAX_PNG_DIMENSION}px range.`
      );
    }
  }

  return errors;
}

function main(): void {
  // listCharacters() loads + validates catalog.json and every character.json
  // (id↔folder, license, dex-number order/uniqueness, manifest↔catalog cross-ref).
  let characters: RegisteredCharacter[];
  try {
    characters = listCharacters();
  } catch (error) {
    console.error(`✗ registry: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  const failures: string[] = [];
  for (const character of characters) {
    const errors = [...checkRequiredSprites(character), ...checkPngAssets(character)];
    if (errors.length === 0) {
      console.log(`✓ #${character.number} ${character.id} (${character.displayName})`);
    } else {
      console.error(`✗ #${character.number} ${character.id}`);
      for (const message of errors) console.error(`    - ${message}`);
      failures.push(...errors);
    }
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} problem(s) found across ${characters.length} character(s).`);
    process.exit(1);
  }
  console.log(`\nAll ${characters.length} character(s) passed the technical contract.`);
}

main();
