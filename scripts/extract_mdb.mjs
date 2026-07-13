#!/usr/bin/env node
/**
 * master.mdb から data/*.json を生成する（Node.js / node:sqlite）
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");

const DEFAULT_CANDIDATES = [
  path.join(process.env.USERPROFILE || "", "AppData/LocalLow/Cygames/umamusume/master/master.mdb"),
  path.join(process.env.USERPROFILE || "", "Documents/google antigravity/umamusume-skill-emulator/master.mdb"),
  "D:/DMM/umamusumeDMM/Umamusume/umamusume_Data/Persistent/master/master.mdb",
  "D:/Umamusume/umamusume_Data/Persistent/master/master.mdb",
];

const TEXT_SKILL_NAME = 47;
const TEXT_SUPPORT_NAME = 75;
const TEXT_SUPPORT_VARIANT = 76;
const TEXT_SUPPORT_CHAR = 77;
const TEXT_CHAR_NAME = 6;

function resolveMdb(cliPath) {
  if (cliPath && fs.existsSync(cliPath)) return cliPath;
  for (const p of DEFAULT_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function loadTextMap(db, category) {
  const rows = db
    .prepare('SELECT "index", text FROM text_data WHERE category = ?')
    .all(category);
  const map = new Map();
  for (const r of rows) map.set(Number(r.index), r.text);
  return map;
}

function extractSkills(db) {
  const names = loadTextMap(db, TEXT_SKILL_NAME);
  const points = new Map();
  for (const r of db.prepare("SELECT id, need_skill_point FROM single_mode_skill_need_point").all()) {
    points.set(Number(r.id), Number(r.need_skill_point));
  }

  const groups = new Map();
  const skillsRaw = db
    .prepare("SELECT id, rarity, group_id, group_rate, icon_id FROM skill_data")
    .all();

  const skillRows = [];
  for (const row of skillsRaw) {
    const sid = Number(row.id);
    const gid = Number(row.group_id);
    const gr = Number(row.group_rate);
    if (!groups.has(gid)) groups.set(gid, []);
    groups.get(gid).push([gr, sid]);
    skillRows.push({
      id: sid,
      name: names.get(sid) || `skill_${sid}`,
      baseSp: points.get(sid) ?? 0,
      rarity: Number(row.rarity),
      groupId: gid,
      groupRate: gr,
      iconId: Number(row.icon_id),
      lowerSkillId: null,
      upperSkillId: null,
    });
  }

  const byId = new Map(skillRows.map((s) => [s.id, s]));
  for (const members of groups.values()) {
    members.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < members.length; i++) {
      const s = byId.get(members[i][1]);
      if (i > 0) s.lowerSkillId = members[i - 1][1];
      if (i < members.length - 1) s.upperSkillId = members[i + 1][1];
    }
  }

  return skillRows.sort((a, b) => a.id - b.id);
}

function extractSupports(db) {
  // category 75 が「[タイトル]キャラ名」の完成形
  const names = loadTextMap(db, TEXT_SUPPORT_NAME);
  const variants = loadTextMap(db, TEXT_SUPPORT_VARIANT);
  const chars = loadTextMap(db, TEXT_SUPPORT_CHAR);
  const rarityMap = { 1: "R", 2: "SR", 3: "SSR" };
  const typeMap = { 1: "speed", 2: "stamina", 3: "power", 4: "guts", 5: "wit", 6: "friend" };

  const hintsByCard = new Map();
  for (const row of db
    .prepare(
      `SELECT support_card_id, hint_value_1
       FROM single_mode_hint_gain
       WHERE hint_gain_type = 0
       ORDER BY support_card_id, hint_group`
    )
    .all()) {
    const cardId = Number(row.support_card_id);
    const skillId = Number(row.hint_value_1);
    if (!skillId) continue;
    if (!hintsByCard.has(cardId)) hintsByCard.set(cardId, []);
    const arr = hintsByCard.get(cardId);
    if (!arr.includes(skillId)) arr.push(skillId);
  }

  // effect type 17 = ヒントLvアップ。列名は版により異なるため pragma で確認
  const hintLvUp = new Map();
  const cols = db.prepare("PRAGMA table_info(support_card_effect_table)").all().map((c) => c.name);
  const limitCols = cols.filter((c) => /^limit_lv\d+$/.test(c));
  if (limitCols.length && cols.includes("type") && cols.includes("effect_table_id")) {
    const sql = `SELECT effect_table_id, ${limitCols.join(", ")} FROM support_card_effect_table WHERE type = 17`;
    for (const row of db.prepare(sql).all()) {
      const tableId = Number(row.effect_table_id);
      let max = 0;
      for (const c of limitCols) {
        const v = Number(row[c] || 0);
        if (v > max) max = v;
      }
      if (max > (hintLvUp.get(tableId) || 0)) hintLvUp.set(tableId, max);
    }
  }

  const supports = [];
  for (const row of db
    .prepare(
      `SELECT id, chara_id, rarity, command_id, support_card_type, effect_table_id
       FROM support_card_data ORDER BY id`
    )
    .all()) {
    const sid = Number(row.id);
    // 75 が無い場合のみ 76+77 で組み立て
    let display = names.get(sid);
    if (!display) {
      const variant = variants.get(sid) || "";
      const charName = chars.get(sid) || `support_${sid}`;
      display = variant ? `${variant}${charName}` : charName;
    }

    supports.push({
      id: sid,
      name: display,
      title: (variants.get(sid) || "").replace(/^\[|\]$/g, ""),
      characterName: chars.get(sid) || "",
      characterId: Number(row.chara_id),
      rarity: rarityMap[Number(row.rarity)] || String(row.rarity),
      commandId: Number(row.command_id),
      type: typeMap[Number(row.support_card_type)] || "unknown",
      hintSkillIds: hintsByCard.get(sid) || [],
      hintLevelUpMax: hintLvUp.get(Number(row.effect_table_id)) || 0,
      eventIds: [],
    });
  }
  return supports;
}

function extractCharacters(db) {
  const names = loadTextMap(db, TEXT_CHAR_NAME);
  const cardSets = new Map();
  for (const r of db.prepare("SELECT id, available_skill_set_id FROM card_data").all()) {
    cardSets.set(Number(r.id), Number(r.available_skill_set_id));
  }

  const setSkills = new Map();
  for (const row of db
    .prepare("SELECT available_skill_set_id, need_rank, skill_id FROM available_skill_set")
    .all()) {
    const setId = Number(row.available_skill_set_id);
    let rank = Number(row.need_rank);
    if (rank === 0) rank = 1;
    if (!setSkills.has(setId)) setSkills.set(setId, []);
    setSkills.get(setId).push([rank, Number(row.skill_id)]);
  }

  // card_data.id はカードID。名前は chara 名ではなくカード名の可能性あり。
  // text category 4 = カード名（variant込み）が一般的だが、まずは category 6 の index=chara_id ではなく
  // category 4 / 5 も試す。簡易: card id の text (category 4) を優先。
  const cardNames = loadTextMap(db, 4);
  const characters = [];
  for (const [cardId, setId] of [...cardSets.entries()].sort((a, b) => a[0] - b[0])) {
    const byRank = {};
    for (const [rank, skillId] of setSkills.get(setId) || []) {
      const key = String(rank);
      if (!byRank[key]) byRank[key] = [];
      byRank[key].push(skillId);
    }
    characters.push({
      id: cardId,
      name: cardNames.get(cardId) || names.get(cardId) || `chara_${cardId}`,
      skillsByAwakening: byRank,
    });
  }
  return characters;
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function resolveSkillIdsByName(skills, events, scenario) {
  const byName = new Map(skills.map((s) => [s.name, s.id]));
  const resolveList = (list) => {
    for (const entry of list || []) {
      for (const sk of entry.skills || []) {
        if (!sk.skillId && sk.skillName && byName.has(sk.skillName)) {
          sk.skillId = byName.get(sk.skillName);
        }
      }
    }
  };
  resolveList(events.events);
  resolveList(scenario.linkSkills);
  resolveList(scenario.rmjSkills);
  resolveList(scenario.endSkills);
  resolveList(scenario.classicRmj);
}

function main() {
  const args = process.argv.slice(2);
  let cliMdb = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--mdb" && args[i + 1]) cliMdb = args[++i];
  }

  const mdbPath = resolveMdb(cliMdb);
  if (!mdbPath) {
    console.error("エラー: master.mdb が見つかりません。--mdb でパスを指定してください。");
    process.exit(1);
  }

  console.log(`読み込み: ${mdbPath}`);
  const db = new DatabaseSync(mdbPath, { readOnly: true });

  const skills = extractSkills(db);
  const supports = extractSupports(db);
  const characters = extractCharacters(db);
  db.close();

  writeJson(path.join(DATA_DIR, "skills.json"), skills);
  writeJson(path.join(DATA_DIR, "supports.json"), supports);
  writeJson(path.join(DATA_DIR, "characters.json"), characters);
  writeJson(path.join(DATA_DIR, "meta.json"), {
    source: mdbPath,
    extractedAt: new Date().toISOString(),
    skillCount: skills.length,
    supportCount: supports.length,
    characterCount: characters.length,
  });

  // events / scenario の skillId を名前から補完
  const eventsPath = path.join(DATA_DIR, "events.json");
  const scenarioPath = path.join(DATA_DIR, "scenarios", "toresenken.json");
  if (fs.existsSync(eventsPath) && fs.existsSync(scenarioPath)) {
    const events = JSON.parse(fs.readFileSync(eventsPath, "utf8"));
    const scenario = JSON.parse(fs.readFileSync(scenarioPath, "utf8"));
    resolveSkillIdsByName(skills, events, scenario);
    writeJson(eventsPath, events);
    writeJson(scenarioPath, scenario);
  }

  console.log(`skills.json: ${skills.length} 件`);
  console.log(`supports.json: ${supports.length} 件`);
  console.log(`characters.json: ${characters.length} 件`);
}

main();
