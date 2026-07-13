import fs from "node:fs";
import { calcSkillCost } from "../app/js/spCost.js";

const supports = JSON.parse(fs.readFileSync("./data/supports.json", "utf8"));
const skills = JSON.parse(fs.readFileSync("./data/skills.json", "utf8"));
const chars = JSON.parse(fs.readFileSync("./data/characters.json", "utf8"));
const events = JSON.parse(fs.readFileSync("./data/events.json", "utf8"));
const scenario = JSON.parse(fs.readFileSync("./data/scenarios/toresenken.json", "utf8"));

const skillById = new Map(skills.map((s) => [s.id, s]));
const nameToId = new Map(skills.map((s) => [s.name, s.id]));
const errors = [];

function fail(msg) {
  errors.push(msg);
  console.error("FAIL:", msg);
}

function ok(msg) {
  console.log("OK:", msg);
}

function checkSkillRef(sk, context) {
  if (sk.skillId == null) {
    fail(`${context}: skillId 欠落 (${sk.skillName})`);
    return;
  }
  const s = skillById.get(sk.skillId);
  if (!s) {
    fail(`${context}: skillId ${sk.skillId} が skills.json に無い (${sk.skillName})`);
    return;
  }
  if (sk.skillName && s.name !== sk.skillName) {
    fail(
      `${context}: 名前不一致 skillId=${sk.skillId} JSON="${sk.skillName}" mdb="${s.name}"`
    );
  }
  if (sk.hintLevel == null || sk.hintLevel < 0 || sk.hintLevel > 5) {
    fail(`${context}: 不正 hintLevel ${sk.hintLevel} (${sk.skillName})`);
  }
}

// lower/upper 参照切れ
let missingLower = 0;
let missingUpper = 0;
for (const s of skills) {
  if (s.lowerSkillId != null && !skillById.has(s.lowerSkillId)) {
    missingLower++;
    if (missingLower <= 3) fail(`skills: lowerSkillId ${s.lowerSkillId} 欠落 (${s.name})`);
  }
  if (s.upperSkillId != null && !skillById.has(s.upperSkillId)) {
    missingUpper++;
    if (missingUpper <= 3) fail(`skills: upperSkillId ${s.upperSkillId} 欠落 (${s.name})`);
  }
}
ok(`lower/upper 参照切れ: lower=${missingLower} upper=${missingUpper}`);

let negativeLinked = 0;
for (const s of skills) {
  if (s.groupRate < 0 && (s.lowerSkillId != null || s.upperSkillId != null)) {
    negativeLinked++;
    if (negativeLinked <= 3) {
      fail(`skills: group_rate<0 がリンク済み (${s.name})`);
    }
  }
}
ok(`group_rate<0 未リンク: ${negativeLinked} 件`);

// events.json
const supportNameMatches = new Set();
for (const evt of events.events || []) {
  if (evt.supportNameMatch) {
    supportNameMatches.add(evt.supportNameMatch);
    const hits = supports.filter((s) => s.name.includes(evt.supportNameMatch));
    if (hits.length === 0) {
      fail(`event ${evt.id}: supportNameMatch "${evt.supportNameMatch}" に一致するサポカ無し`);
    } else if (hits.length > 1) {
      fail(
        `event ${evt.id}: supportNameMatch "${evt.supportNameMatch}" が ${hits.length} 件一致（曖昧）`
      );
    }
  }
  for (const sk of evt.skills || []) checkSkillRef(sk, `event ${evt.id}`);
  for (const c of evt.choices || []) {
    for (const sk of c.skills || []) checkSkillRef(sk, `event ${evt.id}/${c.id}`);
  }
  if (evt.selection === "single" && !evt.defaultChoiceId) {
    fail(`event ${evt.id}: single なのに defaultChoiceId 無し`);
  }
}
ok(`events: ${(events.events || []).length} 件, supportNameMatch ${supportNameMatches.size} 種`);

// toresenken.json
for (const entry of scenario.linkSkills || []) {
  checkSkillRef(entry.skillWithoutLink, `link ${entry.id} without`);
  checkSkillRef(entry.skillWithLink, `link ${entry.id} with`);
}
for (const entry of scenario.scenarioAutoSkills || []) {
  for (const sk of entry.skills || []) checkSkillRef(sk, `auto ${entry.id}`);
}
for (const c of scenario.seniorRmjChoice?.choices || []) {
  for (const sk of c.skills || []) checkSkillRef(sk, `rmj ${c.id}`);
}
ok("scenario: skillId 検証完了");

// 優先サポカ名の存在確認（従来の出力）
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
  if (!hits.length) fail(`優先サポカキー "${k}" に一致なし`);
}

// 金白検証例
const white = skills.find((s) => s.name === "さらなる高みへ");
const gold = skills.find((s) => s.name === "強者の証");
if (!white || !gold) {
  fail("強者の証 / さらなる高みへ が skills.json に無い");
} else {
  const a = calcSkillCost(white.baseSp, 0);
  const c = calcSkillCost(gold.baseSp, 2);
  const b = a + c;
  console.log("verify", { whiteBase: white.baseSp, goldBase: gold.baseSp, A: a, C: c, B: b });
  if (a !== 170 || c !== 136 || b !== 306) {
    fail(`金白検証例が期待値と不一致: A=${a} C=${c} B=${b}`);
  } else {
    ok("金白検証例: 306");
  }
}

// meta.json 件数
const meta = JSON.parse(fs.readFileSync("./data/meta.json", "utf8"));
if (meta.skillCount !== skills.length) {
  fail(`meta.skillCount ${meta.skillCount} != skills.length ${skills.length}`);
}
if (meta.supportCount !== supports.length) {
  fail(`meta.supportCount ${meta.supportCount} != supports.length ${supports.length}`);
}
if (meta.characterCount !== chars.length) {
  fail(`meta.characterCount ${meta.characterCount} != chars.length ${chars.length}`);
}
if (meta.source?.includes("Users") || meta.source?.includes("Documents")) {
  fail(`meta.source に個人パスが含まれる: ${meta.source}`);
}
ok(`meta: skills=${meta.skillCount} supports=${meta.supportCount} chars=${meta.characterCount}`);

if (errors.length > 0) {
  console.error(`\n検証失敗: ${errors.length} 件`);
  process.exit(1);
}
console.log("\n全検証通過");
