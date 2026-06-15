import { existsSync, readFileSync } from "node:fs";
import { getCharacter } from "./characters";
import { DEFAULT_SPECIES } from "./sprites";
import { CommitchiConfig, EconomyConfig, Language, Species, ThresholdConfig, Theme } from "./types";

export const CONFIG_PATH = "commitchi.config.json";

export const DEFAULT_CONFIG: CommitchiConfig = {
  petName: "Mochi",
  character: DEFAULT_SPECIES,
  language: "ko",
  theme: "winter",
  economy: {
    feedPerContrib: 12,
    decayPerDay: 22,
    happinessDecayPerDay: 5,
    staminaDecayPerDay: 4,
    startFullness: 60,
  },
  thresholds: {
    hungryFullness: 45,
    sickFullness: 15,
    neglectDays: 4,
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readSection(
  source: Record<string, unknown>,
  key: string
): Record<string, unknown> | undefined {
  if (!(key in source)) return undefined;
  const value = source[key];
  if (!isRecord(value)) throw new Error(`${CONFIG_PATH}: ${key} must be an object.`);
  return value;
}

function readPetName(source: Record<string, unknown>): string {
  const key = "petName" in source ? "petName" : "name";
  if (!(key in source)) return DEFAULT_CONFIG.petName;

  const value = source[key];
  if (typeof value !== "string") throw new Error(`${CONFIG_PATH}: ${key} must be a string.`);
  const name = value.trim();
  if (!name) throw new Error(`${CONFIG_PATH}: ${key} must not be empty.`);
  if (name.length > 24) throw new Error(`${CONFIG_PATH}: ${key} must be 24 characters or fewer.`);
  return name;
}

function readCharacter(source: Record<string, unknown>): Species {
  if (!("character" in source)) return DEFAULT_CONFIG.character;

  const value = source.character;
  if (typeof value !== "string") throw new Error(`${CONFIG_PATH}: character must be a string.`);

  const character = value.trim();
  if (!character) throw new Error(`${CONFIG_PATH}: character must not be empty.`);

  try {
    getCharacter(character);
  } catch (error) {
    if (error instanceof Error && error.message.includes(`unknown character "${character}"`)) {
      throw new Error(
        `${CONFIG_PATH}: character "${character}" is not a registered character (see catalog.json).`
      );
    }
    throw error;
  }

  return character;
}

function readTheme(source: Record<string, unknown>): Theme {
  if (!("theme" in source)) return DEFAULT_CONFIG.theme;
  if (source.theme !== "winter") {
    throw new Error(`${CONFIG_PATH}: theme must be "winter".`);
  }
  return source.theme;
}

function readLanguage(source: Record<string, unknown>): Language {
  if (!("language" in source)) return DEFAULT_CONFIG.language;
  if (source.language !== "ko" && source.language !== "en") {
    throw new Error(`${CONFIG_PATH}: language must be "ko" or "en".`);
  }
  return source.language;
}

function readNumber(
  section: Record<string, unknown> | undefined,
  key: string,
  fallback: number,
  options: { min: number; max: number; integer?: boolean }
): number {
  if (!section || !(key in section)) return fallback;
  const value = section[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${CONFIG_PATH}: ${key} must be a finite number.`);
  }
  if (options.integer && !Number.isInteger(value)) {
    throw new Error(`${CONFIG_PATH}: ${key} must be an integer.`);
  }
  if (value < options.min || value > options.max) {
    throw new Error(`${CONFIG_PATH}: ${key} must be between ${options.min} and ${options.max}.`);
  }
  return value;
}

function readEconomy(source: Record<string, unknown>): EconomyConfig {
  const economy = readSection(source, "economy");
  return {
    feedPerContrib: readNumber(economy, "feedPerContrib", DEFAULT_CONFIG.economy.feedPerContrib, {
      min: 0,
      max: 100,
    }),
    decayPerDay: readNumber(economy, "decayPerDay", DEFAULT_CONFIG.economy.decayPerDay, {
      min: 0,
      max: 100,
    }),
    happinessDecayPerDay: readNumber(
      economy,
      "happinessDecayPerDay",
      DEFAULT_CONFIG.economy.happinessDecayPerDay,
      {
        min: 0,
        max: 100,
      }
    ),
    staminaDecayPerDay: readNumber(
      economy,
      "staminaDecayPerDay",
      DEFAULT_CONFIG.economy.staminaDecayPerDay,
      {
        min: 0,
        max: 100,
      }
    ),
    startFullness: readNumber(economy, "startFullness", DEFAULT_CONFIG.economy.startFullness, {
      min: 0,
      max: 100,
    }),
  };
}

function readThresholds(source: Record<string, unknown>): ThresholdConfig {
  const thresholds = readSection(source, "thresholds");
  const result = {
    hungryFullness: readNumber(
      thresholds,
      "hungryFullness",
      DEFAULT_CONFIG.thresholds.hungryFullness,
      { min: 0, max: 100 }
    ),
    sickFullness: readNumber(
      thresholds,
      "sickFullness",
      DEFAULT_CONFIG.thresholds.sickFullness,
      { min: 0, max: 100 }
    ),
    neglectDays: readNumber(thresholds, "neglectDays", DEFAULT_CONFIG.thresholds.neglectDays, {
      min: 1,
      max: 365,
      integer: true,
    }),
  };

  if (result.sickFullness > result.hungryFullness) {
    throw new Error(`${CONFIG_PATH}: sickFullness must be less than or equal to hungryFullness.`);
  }

  return result;
}

export function loadConfig(path = CONFIG_PATH): CommitchiConfig {
  if (!existsSync(path)) return DEFAULT_CONFIG;

  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!isRecord(parsed)) throw new Error(`${path}: root value must be an object.`);

  return {
    petName: readPetName(parsed),
    character: readCharacter(parsed),
    language: readLanguage(parsed),
    theme: readTheme(parsed),
    economy: readEconomy(parsed),
    thresholds: readThresholds(parsed),
  };
}
