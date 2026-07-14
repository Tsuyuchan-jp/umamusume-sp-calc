#!/usr/bin/env node
/**
 * 既存 skills.json に activation フィールドだけ付与する（他 data は触らない）
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseSkillActivation } from "../app/js/skillActivation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SKILLS_PATH = path.join(ROOT, "data", "skills.json");

const DEFAULT_CANDIDATES = [
  path.join(process.env.USERPROFILE || "", "AppData/LocalLow/Cygames/umamusume/master/master.mdb"),
  "D:/DMM/umamusumeDMM/Umamusume/umamusume_Data/Persistent/master/master.mdb",
  "D:/Umamusume/umamusume_Data/Persistent/master/master.mdb",
];

function resolveMdb(cliPath) {
  if (cliPath && fs.existsSync(cliPath)) return cliPath;
  for (const p of DEFAULT_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const emptyActivation = () => ({
  branches: [{ grounds: [], distances: [], styles: [] }],
  tags: { grounds: [], distances: [], styles: [] },
});

function main() {
  const args = process.argv.slice(2);
  let cliMdb = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--mdb" && args[i + 1]) cliMdb = args[++i];
  }

  const mdbPath = resolveMdb(cliMdb);
  if (!mdbPath) {
    console.error("エラー: master.mdb が見つかりません。");
    process.exit(1);
  }

  const skills = JSON.parse(fs.readFileSync(SKILLS_PATH, "utf8"));
  const db = new DatabaseSync(mdbPath, { readOnly: true });
  const condById = new Map();

  for (const row of db
    .prepare(
      `SELECT id, precondition_1, condition_1, precondition_2, condition_2 FROM skill_data`
    )
    .all()) {
    condById.set(
      Number(row.id),
      parseSkillActivation(
        row.precondition_1,
        row.condition_1,
        row.precondition_2,
        row.condition_2
      )
    );
  }
  db.close();

  let patched = 0;
  for (const skill of skills) {
    skill.activation = condById.get(skill.id) ?? emptyActivation();
    if (condById.has(skill.id)) patched++;
  }

  fs.writeFileSync(SKILLS_PATH, JSON.stringify(skills, null, 2), "utf8");
  console.log(`skills.json: ${skills.length} 件（activation 付与: ${patched} 件）`);
}

main();
