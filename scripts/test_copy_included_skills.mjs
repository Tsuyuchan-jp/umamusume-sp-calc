import {
  formatIncludedSkillNames,
  getIncludedSkillRows,
} from "../app/js/copyIncludedSkills.js";

function assertEq(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
  console.log(`OK ${label}`);
}

const rows = [
  { skillId: 1, name: "スキルA", excluded: false },
  { skillId: 2, name: "スキルB", excluded: true },
  { skillId: 3, name: "スキルC", excluded: false },
  { skillId: null, name: "継承固有 × 4", isInherit: true },
];

assertEq(getIncludedSkillRows(rows).length, 2, "継承と除外行を除いた件数");
assertEq(
  formatIncludedSkillNames(rows),
  "スキルA, スキルC",
  "カンマ区切りで ON 行のみ"
);
assertEq(formatIncludedSkillNames([]), "", "空配列は空文字");
assertEq(
  formatIncludedSkillNames([{ skillId: 10, name: "単独", excluded: false }]),
  "単独",
  "1件でもカンマなし"
);

console.log("test_copy_included_skills: all passed");
