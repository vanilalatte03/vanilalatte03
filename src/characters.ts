import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export const CATALOG_PATH = "catalog.json";
export const CHARACTER_MANIFEST_FILE = "character.json";

const SPRITE_ROOT = join(process.cwd(), "assets", "sprites");
const CHARACTER_ID_PATTERN = /^[a-z][a-z0-9-]*$/;
const CHARACTER_LICENSE = "CC-BY-4.0";

export interface CharacterManifest {
  id: string;
  displayName: string;
  ghostName: string;
  author: string;
  license: typeof CHARACTER_LICENSE;
}

export interface CatalogEntry {
  number: number;
  id: string;
}

export interface CharacterCatalog {
  characters: CatalogEntry[];
}

export interface RegisteredCharacter {
  number: number;
  id: string;
  displayName: string;
  ghostName: string;
  author: string;
  license: typeof CHARACTER_LICENSE;
  spriteDir: string;
  manifest: CharacterManifest;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readJson(path: string): unknown {
  if (!existsSync(path)) throw new Error(`${path}: file is required.`);

  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`${path}: invalid JSON (${error.message}).`);
    }
    throw error;
  }
}

function readRequiredString(source: Record<string, unknown>, path: string, key: string): string {
  const value = source[key];
  if (typeof value !== "string") throw new Error(`${path}: ${key} must be a string.`);

  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${path}: ${key} must not be empty.`);
  if (trimmed.length > 64) throw new Error(`${path}: ${key} must be 64 characters or fewer.`);
  return trimmed;
}

function readCharacterId(source: Record<string, unknown>, path: string): string {
  const id = readRequiredString(source, path, "id");
  if (!CHARACTER_ID_PATTERN.test(id)) {
    throw new Error(
      `${path}: id must start with a lowercase letter and contain only lowercase letters, numbers, or hyphens.`
    );
  }
  return id;
}

function readLicense(source: Record<string, unknown>, path: string): typeof CHARACTER_LICENSE {
  const license = readRequiredString(source, path, "license");
  if (license !== CHARACTER_LICENSE) {
    throw new Error(`${path}: license must be "${CHARACTER_LICENSE}".`);
  }
  return license;
}

export function validateCharacterManifest(
  value: unknown,
  path = CHARACTER_MANIFEST_FILE,
  expectedId?: string
): CharacterManifest {
  if (!isRecord(value)) throw new Error(`${path}: root value must be an object.`);

  const id = readCharacterId(value, path);
  if (expectedId && id !== expectedId) {
    throw new Error(`${path}: id must match folder name "${expectedId}".`);
  }

  return {
    id,
    displayName: readRequiredString(value, path, "displayName"),
    ghostName: readRequiredString(value, path, "ghostName"),
    author: readRequiredString(value, path, "author"),
    license: readLicense(value, path),
  };
}

function readCatalogEntry(value: unknown, path: string, index: number): CatalogEntry {
  const entryPath = `${path}: characters[${index}]`;
  if (!isRecord(value)) throw new Error(`${entryPath} must be an object.`);

  const number = value.number;
  if (typeof number !== "number" || !Number.isInteger(number) || number < 1) {
    throw new Error(`${entryPath}.number must be a positive integer.`);
  }

  return {
    number,
    id: readCharacterId(value, `${entryPath}.id`),
  };
}

export function validateCatalog(value: unknown, path = CATALOG_PATH): CharacterCatalog {
  if (!isRecord(value)) throw new Error(`${path}: root value must be an object.`);

  const characters = value.characters;
  if (!Array.isArray(characters)) throw new Error(`${path}: characters must be an array.`);
  if (characters.length === 0) throw new Error(`${path}: characters must not be empty.`);

  const ids = new Set<string>();
  let prevNumber = 0;
  const entries = characters.map((entry, index) => {
    const parsed = readCatalogEntry(entry, path, index);
    // Numbers must strictly increase: gaps are allowed (a retired number leaves a
    // permanent gap and is never reused — see MODERATION.md), but order/uniqueness hold.
    if (parsed.number <= prevNumber) {
      throw new Error(
        `${path}: characters[${index}].number (${parsed.number}) must be greater than the previous entry (${prevNumber}); numbers are ordered, unique, and never reused.`
      );
    }
    prevNumber = parsed.number;

    if (ids.has(parsed.id)) throw new Error(`${path}: duplicate character id "${parsed.id}".`);
    ids.add(parsed.id);
    return parsed;
  });

  return { characters: entries };
}

function loadCatalog(path = CATALOG_PATH): CharacterCatalog {
  return validateCatalog(readJson(path), path);
}

function discoverManifestIds(): string[] {
  if (!existsSync(SPRITE_ROOT)) return [];

  return readdirSync(SPRITE_ROOT)
    .filter((id) => {
      const spriteDir = join(SPRITE_ROOT, id);
      return statSync(spriteDir).isDirectory() && existsSync(join(spriteDir, CHARACTER_MANIFEST_FILE));
    })
    .sort();
}

function loadCharacter(entry: CatalogEntry): RegisteredCharacter {
  const spriteDir = join(SPRITE_ROOT, entry.id);
  if (!existsSync(spriteDir) || !statSync(spriteDir).isDirectory()) {
    throw new Error(`${CATALOG_PATH}: character "${entry.id}" must map to ${spriteDir}.`);
  }

  const manifestPath = join(spriteDir, CHARACTER_MANIFEST_FILE);
  const manifest = validateCharacterManifest(readJson(manifestPath), manifestPath, entry.id);

  return {
    number: entry.number,
    id: manifest.id,
    displayName: manifest.displayName,
    ghostName: manifest.ghostName,
    author: manifest.author,
    license: manifest.license,
    spriteDir,
    manifest,
  };
}

function loadCharacterRegistry(): Map<string, RegisteredCharacter> {
  const catalog = loadCatalog();
  const catalogIds = new Set(catalog.characters.map((entry) => entry.id));

  for (const manifestId of discoverManifestIds()) {
    if (!catalogIds.has(manifestId)) {
      throw new Error(
        `${CATALOG_PATH}: assets/sprites/${manifestId}/${CHARACTER_MANIFEST_FILE} is missing a catalog entry.`
      );
    }
  }

  return new Map(catalog.characters.map((entry) => [entry.id, loadCharacter(entry)]));
}

let registryCache: Map<string, RegisteredCharacter> | null = null;

function getRegistry(): Map<string, RegisteredCharacter> {
  registryCache ??= loadCharacterRegistry();
  return registryCache;
}

export function listCharacters(): RegisteredCharacter[] {
  return [...getRegistry().values()];
}

export function getCharacter(id: string): RegisteredCharacter {
  const character = getRegistry().get(id);
  if (!character) throw new Error(`${CATALOG_PATH}: unknown character "${id}".`);
  return character;
}

export function getCharacterSpriteDir(id: string): string {
  return getCharacter(id).spriteDir;
}
