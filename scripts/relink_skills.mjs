#!/usr/bin/env node
/**
 * skills.json の lower/upper リンクを再構築する。
 * group_rate < 0（× 等）は購入チェーンから除外する。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillsPath = path.join(__dirname, "..", "data", "skills.json");

const skills = JSON.parse(fs.readFileSync(skillsPath, "utf8"));
const byId = new Map(skills.map((s) => [s.id, s]));

for (const s of skills) {
  s.lowerSkillId = null;
  s.upperSkillId = null;
}

const groups = new Map();
for (const s of skills) {
  if (!groups.has(s.groupId)) groups.set(s.groupId, []);
  groups.get(s.groupId).push([s.groupRate, s.id]);
}

for (const members of groups.values()) {
  const purchasable = members.filter(([gr]) => gr >= 0).sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < purchasable.length; i++) {
    const skill = byId.get(purchasable[i][1]);
    if (i > 0) skill.lowerSkillId = purchasable[i - 1][1];
    if (i < purchasable.length - 1) skill.upperSkillId = purchasable[i + 1][1];
  }
}

fs.writeFileSync(skillsPath, JSON.stringify(skills, null, 2) + "\n", "utf8");

const negLinked = skills.filter(
  (s) => s.groupRate < 0 && (s.lowerSkillId != null || s.upperSkillId != null)
);
console.log(`skills.json: ${skills.length} 件, ×リンク残り: ${negLinked.length}`);
