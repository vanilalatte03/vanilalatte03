import { writeFileSync } from "node:fs";
import { fetchActivity } from "./github";
import { applyTick, getActivePet, loadState, saveState, setActivePet } from "./state";
import { renderSVG } from "./render";
import { Activity } from "./types";
import { loadConfig } from "./config";

async function main() {
  const now = new Date();
  const config = loadConfig();
  const username = process.env.GH_USERNAME;
  const token = process.env.GH_TOKEN;

  let activity: Activity;
  if (username && token) {
    activity = await fetchActivity(username, token);
    console.log(
      `Fetched ${username}: today=${activity.todayDate} count=${activity.todayCount} streak=${activity.streak} langs=${activity.languageCount} collab=${activity.collabRatio.toFixed(2)} weekend=${activity.weekendRatio.toFixed(2)}`
    );
  } else {
    console.warn("No GH_USERNAME/GH_TOKEN set — running in DEMO mode with sample data.");
    activity = {
      todayDate: now.toISOString().slice(0, 10),
      todayCount: 3,
      totalThisYear: 412,
      daysSinceLastContribution: 0,
      streak: 4,
      weekendRatio: 0.2,
      collabRatio: 0.25,
      languageCount: 3,
    };
  }

  const save = loadState(now, config);
  const ticked = applyTick(getActivePet(save), activity, now, config);
  const next = setActivePet(save, ticked);
  saveState(next);
  writeFileSync("pet.svg", renderSVG(ticked, config, next.dex));
  const celebration = ticked.celebration ? ` · celebrating ${ticked.celebration.title}` : "";
  console.log(
    `Pet: ${ticked.stage}/${ticked.species} · ${ticked.mood} · fullness ${ticked.fullness}% · happiness ${ticked.happiness}% · stamina ${ticked.stamina}% · age ${ticked.ageDays}d${celebration}. Wrote pet.svg + pet-state.json.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
