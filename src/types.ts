export type Mood = "happy" | "hungry" | "sick";

/** UI language for everything the pet card and visitor comments render. */
export type Language = "ko" | "en";

export type Theme = "winter";

/** Registered character id. */
export type Species = string;

export type Stage = "egg" | "baby" | "child" | "teen" | "adult";

export type CelebrationKind = "evolution" | "streak" | "visitor";

export type VisitorAction = "feed" | "play";

export interface CelebrationMoment {
  kind: CelebrationKind;
  /** Stable id used so a one-time celebration does not repeat on every tick. */
  milestoneId: string;
  /** Short label rendered in the celebration badge. */
  title: string;
  /** One-line detail used in the card footer while the celebration is active. */
  detail: string;
}

/** Per-visitor issue-op rate limit state. */
export interface VisitorInteractionRecord {
  /** Date string (YYYY-MM-DD) of the visitor's most recent interaction. */
  lastInteractionDate: string;
  /** Total accepted interactions from this visitor. */
  totalInteractions: number;
  feedCount: number;
  playCount: number;
}

/** The pet's persistent memory. Lives in pet-state.json, accumulates across ticks. */
export interface PetState {
  /** User-chosen individual pet name, distinct from the fixed species label. */
  name: string;
  /** Active character id. */
  species: Species;
  /** Whether the active character is rendered as its neglect ghost variant. */
  isGhost: boolean;
  /** Character id frozen at adulthood. "" until the pet reaches the adult stage. */
  lockedSpecies: Species | "";
  stage: Stage;
  bornAt: string;
  lastTickAt: string;
  /** 0-100. Driven by commits, decays over time. */
  fullness: number;
  /** 0-100. Driven by collaborative work such as PRs, reviews, and issues. */
  happiness: number;
  /** 0-100. Driven by consistent activity; big bursts are less efficient. */
  stamina: number;
  mood: Mood;
  /** The milestone being celebrated on this rendered tick, if any. */
  celebration: CelebrationMoment | null;
  /** Stable milestone ids that have already been celebrated. */
  celebratedMilestones: string[];
  ageDays: number;
  /** Date string (YYYY-MM-DD) of the day we last counted contributions for. */
  lastDayDate: string;
  /** How many contributions on lastDayDate we have already fed the pet. */
  lastDayCounted: number;
  /** Issue-op visitor interactions keyed by lowercase GitHub login. */
  visitorInteractions: Record<string, VisitorInteractionRecord>;
}

export interface DexEntry {
  firstSeenAt: string;
  maxStage: Stage;
}

export interface SaveState {
  schemaVersion: 2;
  active: Species;
  pets: Record<Species, PetState>;
  dex: Record<Species, DexEntry>;
}

/** A snapshot of the user's GitHub activity: what the pet eats + how it evolves. */
export interface Activity {
  /** Most recent day in the contribution calendar (YYYY-MM-DD). */
  todayDate: string;
  /** Contribution count on todayDate. */
  todayCount: number;
  /** Total contributions in the trailing year. */
  totalThisYear: number;
  /** Whole days since the most recent day that had any contributions. 0 = today. */
  daysSinceLastContribution: number;
  /** Current consecutive-day contribution streak ending at the latest day. */
  streak: number;
  /** Fraction (0-1) of contributions that fall on Sat/Sun. */
  weekendRatio: number;
  /** Fraction (0-1) of work that is collaborative (PRs, reviews, issues). */
  collabRatio: number;
  /** Distinct primary languages across the user's repos. */
  languageCount: number;
}

export interface EconomyConfig {
  /** Fullness gained per new contribution. */
  feedPerContrib: number;
  /** Fullness lost per elapsed day. */
  decayPerDay: number;
  /** Happiness lost per elapsed day. */
  happinessDecayPerDay: number;
  /** Stamina lost per elapsed day. */
  staminaDecayPerDay: number;
  /** Fullness used when a pet is born without existing state. */
  startFullness: number;
}

export interface ThresholdConfig {
  /** At or below this lowest stat value, the pet is hungry. */
  hungryFullness: number;
  /** At or below this lowest stat value, or after neglectDays, the pet is sick. */
  sickFullness: number;
  /** Whole days without contributions before the pet becomes its ghost variant. */
  neglectDays: number;
}

export interface CommitchiConfig {
  /** User-chosen individual pet name. Character labels come from character.json. */
  petName: string;
  /** Active character id to raise until adulthood locks it. Defaults to Yuki. */
  character: Species;
  /** Language for all card text and visitor comments. Defaults to "ko". */
  language: Language;
  theme: Theme;
  economy: EconomyConfig;
  thresholds: ThresholdConfig;
}
