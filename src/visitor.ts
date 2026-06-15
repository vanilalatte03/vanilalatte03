import { appendFileSync, writeFileSync } from "node:fs";
import { loadConfig } from "./config";
import { getStrings, Strings } from "./i18n";
import { renderSVG } from "./render";
import {
  applyVisitorInteraction,
  getActivePet,
  loadState,
  saveState,
  setActivePet,
  VISITOR_ACTION_BONUS,
} from "./state";
import { VisitorAction } from "./types";

const RESULT_PATH = "interaction-result.json";

interface InteractionResultFile {
  recognized: boolean;
  changed: boolean;
  applied: boolean;
  action: VisitorAction | null;
  actor: string;
  comment: string;
}

function parseInteractionTitle(title: string): VisitorAction | null {
  const normalized = title.trim().toLowerCase().replace(/\s+/g, " ");
  if (normalized === "commitchi: feed") return "feed";
  if (normalized === "commitchi: play") return "play";
  return null;
}

function actionLabel(action: VisitorAction): string {
  return action === "feed" ? "Feed" : "Play";
}

function appliedComment(action: VisitorAction, actor: string, petName: string, s: Strings): string {
  const bonus = VISITOR_ACTION_BONUS[action];
  const label = s.visitor.statLabel;
  const parts =
    action === "feed"
      ? [`${label.fullness} +${bonus.fullness}`, `${label.happiness} +${bonus.happiness}`]
      : [`${label.happiness} +${bonus.happiness}`, `${label.fullness} +${bonus.fullness}`];
  if (bonus.stamina) parts.push(`${label.stamina} +${bonus.stamina}`);
  const stats = parts.join(", ");
  const intro = s.visitor.appliedIntro(action, actor, petName);

  return s.visitor.appliedComment(intro, stats);
}

function rateLimitedComment(actor: string, petName: string, s: Strings): string {
  return s.visitor.rateLimited(actor, petName);
}

function writeGithubOutputs(result: InteractionResultFile): void {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;

  appendFileSync(
    outputPath,
    [
      `recognized=${result.recognized}`,
      `changed=${result.changed}`,
      `applied=${result.applied}`,
      `action=${result.action ?? ""}`,
      "",
    ].join("\n")
  );
}

function writeResult(result: InteractionResultFile): void {
  writeFileSync(RESULT_PATH, JSON.stringify(result, null, 2) + "\n");
  writeGithubOutputs(result);
}

// Config-independent: this fires on every opened issue, so it must not depend on
// commitchi.config.json parsing (and the workflow never posts it anyway).
const IGNORED_COMMENT = "This issue title is not a Commitchi visitor action, so no pet state changed.";

function main(): void {
  const now = new Date();
  const title = process.env.ISSUE_TITLE ?? process.argv.slice(2).join(" ");
  const actor = (process.env.ISSUE_AUTHOR ?? process.env.GITHUB_ACTOR ?? "").trim();
  const action = parseInteractionTitle(title);

  // Parse the title before touching config: visitor.yml runs on every opened
  // issue, so an unrelated issue must take the ignore path even if the config
  // is malformed.
  if (!action) {
    const result: InteractionResultFile = {
      recognized: false,
      changed: false,
      applied: false,
      action: null,
      actor,
      comment: IGNORED_COMMENT,
    };
    writeResult(result);
    console.log("Ignored issue: title is not a Commitchi visitor action.");
    return;
  }

  if (!actor) throw new Error("ISSUE_AUTHOR or GITHUB_ACTOR is required for visitor actions.");

  const config = loadConfig();
  const s = getStrings(config.language);
  const save = loadState(now, config);
  const update = applyVisitorInteraction(getActivePet(save), action, actor, now, config);

  if (update.applied) {
    const next = setActivePet(save, update.state);
    saveState(next);
    writeFileSync("pet.svg", renderSVG(update.state, config, next.dex));
  }

  const result: InteractionResultFile = {
    recognized: true,
    changed: update.applied,
    applied: update.applied,
    action,
    actor: update.actor,
    comment: update.applied
      ? appliedComment(action, update.actor, update.state.name, s)
      : rateLimitedComment(update.actor, update.state.name, s),
  };

  writeResult(result);
  console.log(
    `${actionLabel(action)} interaction from @${update.actor}: ${update.reason}${
      update.applied ? "; wrote pet.svg + pet-state.json." : "."
    }`
  );
}

main();
