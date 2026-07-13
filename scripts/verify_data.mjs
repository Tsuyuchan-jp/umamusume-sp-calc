import fs from "node:fs";

const supports = JSON.parse(fs.readFileSync("./data/supports.json", "utf8"));
const skills = JSON.parse(fs.readFileSync("./data/skills.json", "utf8"));
const chars = JSON.parse(fs.readFileSync("./data/characters.json", "utf8"));
const scenario = JSON.parse(fs.readFileSync("./data/scenarios/toresenken.json", "utf8"));

const keys = [
  "ノスタルジア",
  "怒濤",
  "サトノダイヤモンド",
  "タップダンス",
  "アグネスデジタル",
  "デアリングハート",
  "フォーエバーヤング",
  "ファインモーション",
  "エアグルーヴ",
  "トウカイテイオー",
  "エイシンフラッシュ",
];

for (const k of keys) {
  const hits = supports.filter((s) => s.name.includes(k)).slice(0, 3);
  console.log(k, "=>", hits.map((h) => `${h.id}:${h.name}`).join(" | ") || "NONE");
}

for (const n of ["強者の証", "さらなる高みへ", "お先に失礼っ！", "中盤巧者", "ネバーギブアップ"]) {
  const s = skills.find((x) => x.name === n);
  console.log(
    n,
    s
      ? { id: s.id, baseSp: s.baseSp, lower: s.lowerSkillId, upper: s.upperSkillId }
      : "NONE"
  );
}

console.log("chars sample:", chars.slice(0, 5).map((c) => `${c.id}:${c.name}`));
console.log(
  "scenario resolved:",
  scenario.linkSkills.map((e) => ({
    id: e.id,
    skills: e.skills.map((s) => `${s.skillName}:${s.skillId ?? "?"}`),
  }))
);

// SP formula check from verification
function cost(base, lv, fl = false) {
  const d = [0, 0.1, 0.2, 0.3, 0.35, 0.4][lv] + (fl ? 0.1 : 0);
  return Math.floor(base * Math.max(0, 1 - d));
}
const white = skills.find((s) => s.name === "さらなる高みへ");
const gold = skills.find((s) => s.name === "強者の証");
if (white && gold) {
  const a = cost(white.baseSp, 0);
  const c = cost(gold.baseSp, 2);
  const b = a + c;
  console.log("verify", { whiteBase: white.baseSp, goldBase: gold.baseSp, A: a, C: c, B: b, expect: { A: 170, B: 306, C: 136 } });
}
