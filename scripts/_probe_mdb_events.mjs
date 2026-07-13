/**
 * 設計レビュー用: master.mdb のイベント報酬経路を短く探査する（実装ではない）
 * 使い方: node scripts/_probe_mdb_events.mjs [mdbPath]
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const DEFAULT_CANDIDATES = [
  path.join(process.env.USERPROFILE || "", "AppData/LocalLow/Cygames/umamusume/master/master.mdb"),
  "D:/DMM/umamusumeDMM/Umamusume/umamusume_Data/Persistent/master/master.mdb",
];

function resolveMdb(cliPath) {
  if (cliPath && fs.existsSync(cliPath)) return cliPath;
  for (const p of DEFAULT_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const mdb = resolveMdb(process.argv[2]);
if (!mdb) {
  console.error("master.mdb が見つからない");
  process.exit(1);
}
console.log("mdb:", mdb);

const db = new DatabaseSync(mdb, { readOnly: true });

const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
  .all()
  .map((r) => r.name);

const keywords = [
  "story",
  "event",
  "choice",
  "reward",
  "hint",
  "gallery",
  "support",
  "single_mode",
];
const interesting = tables.filter((t) =>
  keywords.some((k) => t.toLowerCase().includes(k))
);
console.log("\n=== 関連テーブル候補 ===");
for (const t of interesting) {
  const n = db.prepare(`SELECT COUNT(*) AS c FROM "${t}"`).get().c;
  console.log(`${t}\t${n}`);
}

function dumpSchema(name) {
  if (!tables.includes(name)) {
    console.log(`(missing) ${name}`);
    return;
  }
  const cols = db.prepare(`PRAGMA table_info("${name}")`).all();
  console.log(`\n--- ${name} ---`);
  console.log(cols.map((c) => `${c.name}:${c.type}`).join(", "));
  const sample = db.prepare(`SELECT * FROM "${name}" LIMIT 3`).all();
  console.log("sample:", JSON.stringify(sample, null, 0).slice(0, 800));
}

console.log("\n=== スキーマ抜粋 ===");
for (const t of [
  "single_mode_story_data",
  "single_mode_event_contents",
  "single_mode_event_choice_reward",
  "single_mode_event_frame",
  "single_mode_event_production",
  "single_mode_hint_gain",
  "single_mode_reward_set",
  "single_mode_reward_item",
  "succession_event",
  "story_event_mission",
]) {
  dumpSchema(t);
}

// story 系テーブルをもう少し広く
console.log("\n=== story/event を含む全テーブル ===");
for (const t of tables.filter(
  (n) => /story|event_choice|event_content|reward/i.test(n)
)) {
  const cols = db.prepare(`PRAGMA table_info("${t}")`).all().map((c) => c.name);
  const n = db.prepare(`SELECT COUNT(*) AS c FROM "${t}"`).get().c;
  console.log(`${t} (${n}): ${cols.join(", ")}`);
}

// アストンマーチャン support_chara_id=1087
console.log("\n=== アストンマーチャン support_chara_id=1087 ===");
if (tables.includes("single_mode_story_data")) {
  const rows = db
    .prepare("SELECT * FROM single_mode_story_data WHERE support_chara_id = 1087")
    .all();
  console.log("story rows:", rows.length);
  console.log(JSON.stringify(rows, null, 2).slice(0, 2000));
}

// text_data category 181
console.log("\n=== text_data cat 181 (story names) sample for 801087* ===");
const names = db
  .prepare(
    `SELECT "index", text FROM text_data WHERE category = 181 AND "index" BETWEEN 801087000 AND 801087999`
  )
  .all();
console.log(names);

// hint_gain で story / event 紐付けがあるか
console.log("\n=== single_mode_hint_gain 列と type 分布 ===");
if (tables.includes("single_mode_hint_gain")) {
  const cols = db.prepare("PRAGMA table_info(single_mode_hint_gain)").all();
  console.log(cols.map((c) => c.name).join(", "));
  const types = db
    .prepare(
      "SELECT hint_gain_type, COUNT(*) AS c FROM single_mode_hint_gain GROUP BY hint_gain_type"
    )
    .all();
  console.log("types:", types);
  const sample1 = db
    .prepare("SELECT * FROM single_mode_hint_gain WHERE hint_gain_type != 0 LIMIT 10")
    .all();
  console.log("non-zero sample:", JSON.stringify(sample1).slice(0, 1500));
}

// choice reward 全件
console.log("\n=== single_mode_event_choice_reward 全件（小さいはず） ===");
if (tables.includes("single_mode_event_choice_reward")) {
  const all = db.prepare("SELECT * FROM single_mode_event_choice_reward").all();
  console.log("count:", all.length);
  console.log(JSON.stringify(all.slice(0, 5), null, 2));
}

// effect / gain っぽい列を持つテーブルを探索
console.log("\n=== skill/hint 関連列を持つ single_mode* ===");
for (const t of tables.filter((n) => n.startsWith("single_mode"))) {
  const cols = db.prepare(`PRAGMA table_info("${t}")`).all().map((c) => c.name);
  const hit = cols.filter((c) =>
    /skill|hint|choice|reward|effect|gain|story/i.test(c)
  );
  if (hit.length >= 2) {
    const n = db.prepare(`SELECT COUNT(*) AS c FROM "${t}"`).get().c;
    console.log(`${t} (${n}): ${hit.join(", ")}`);
  }
}

// support card 数と story 紐付け数
console.log("\n=== 規模感 ===");
if (tables.includes("support_card_data")) {
  console.log(
    "support_card_data:",
    db.prepare("SELECT COUNT(*) AS c FROM support_card_data").get().c
  );
}
if (tables.includes("single_mode_story_data")) {
  const sc = db
    .prepare(
      `SELECT COUNT(*) AS c FROM single_mode_story_data WHERE support_chara_id > 0`
    )
    .get().c;
  const distinct = db
    .prepare(
      `SELECT COUNT(DISTINCT support_chara_id) AS c FROM single_mode_story_data WHERE support_chara_id > 0`
    )
    .get().c;
  console.log("stories with support_chara_id>0:", sc, "distinct chara:", distinct);
}

// --- 追加探査: conclusion / reward / story_id 参照 ---
function schema(t) {
  if (!tables.includes(t)) {
    console.log(`(missing) ${t}`);
    return;
  }
  const cols = db.prepare(`PRAGMA table_info("${t}")`).all();
  console.log(`\n===${t}===`);
  console.log(cols.map((c) => `${c.name}:${c.type}`).join(", "));
  console.log("count", db.prepare(`SELECT COUNT(*) AS c FROM "${t}"`).get().c);
  console.log("sample", JSON.stringify(db.prepare(`SELECT * FROM "${t}" LIMIT 3`).all()));
}

for (const t of [
  "single_mode_event_conclusion",
  "single_mode_conclusion_set",
  "single_mode_story_condition_set",
  "single_mode_story_root",
  "single_mode_reward_set",
  "single_mode_event_production",
  "single_mode_event_cr_priority",
  "single_mode_event_item_detail",
]) {
  schema(t);
}

console.log("\n=== story_id 80108700x 参照探索 ===");
for (const t of tables) {
  const cols = db
    .prepare(`PRAGMA table_info("${t}")`)
    .all()
    .map((c) => c.name);
  const storyCols = cols.filter((c) => /story/i.test(c));
  for (const col of storyCols) {
    try {
      const c = db
        .prepare(
          `SELECT COUNT(*) AS c FROM "${t}" WHERE "${col}" IN (801087001,801087002,801087003)`
        )
        .get().c;
      if (c > 0) console.log(`${t}.${col}`, c);
    } catch {
      /* ignore */
    }
  }
}

// conclusion_set の値分布
if (tables.includes("single_mode_conclusion_set")) {
  console.log("\n=== conclusion_set 値レンジ ===");
  const cols = db
    .prepare("PRAGMA table_info(single_mode_conclusion_set)")
    .all()
    .map((c) => c.name);
  for (const col of cols) {
    if (col === "id") continue;
    try {
      const r = db
        .prepare(
          `SELECT MIN("${col}") mn, MAX("${col}") mx, COUNT(DISTINCT "${col}") d FROM single_mode_conclusion_set`
        )
        .get();
      console.log(col, r);
    } catch {
      /* ignore */
    }
  }
}

// event_conclusion と story
if (tables.includes("single_mode_event_conclusion")) {
  console.log("\n=== event_conclusion 全列サンプル多め ===");
  console.log(
    JSON.stringify(
      db.prepare("SELECT * FROM single_mode_event_conclusion LIMIT 10").all(),
      null,
      2
    ).slice(0, 4000)
  );
}

// reward_set に skill があるか
if (tables.includes("single_mode_reward_set")) {
  console.log("\n=== reward_set type 分布 ===");
  console.log(
    db
      .prepare(
        "SELECT reward_type, COUNT(*) c FROM single_mode_reward_set GROUP BY reward_type ORDER BY c DESC"
      )
      .all()
  );
  console.log(
    "sample",
    JSON.stringify(db.prepare("SELECT * FROM single_mode_reward_set LIMIT 15").all())
  );
}

// support イベント規模: event_category=4
if (tables.includes("single_mode_story_data")) {
  console.log("\n=== support story 規模 ===");
  console.log(
    "by event_category",
    db
      .prepare(
        `SELECT event_category, COUNT(*) c,
                COUNT(DISTINCT support_chara_id) chars,
                COUNT(DISTINCT support_card_id) cards
         FROM single_mode_story_data
         WHERE support_chara_id > 0 OR support_card_id > 0
         GROUP BY event_category`
      )
      .all()
  );
  const named = db
    .prepare(
      `SELECT COUNT(*) c FROM single_mode_story_data s
       JOIN text_data t ON t.category = 181 AND t."index" = s.story_id
       WHERE s.support_chara_id > 0`
    )
    .get().c;
  const total = db
    .prepare(
      `SELECT COUNT(*) c FROM single_mode_story_data WHERE support_chara_id > 0`
    )
    .get().c;
  console.log("support stories named/total", named, "/", total);
}

// tip: skill id が text 以外のどこかで story と共起するか（ヒューリスティック）
console.log("\n=== 任意整数列に skillId っぽい値が story 行と同居するかは断念（アセット側の可能性高）===");

if (tables.includes("single_mode_story_data")) {
  console.log("\n=== event_category=4 内訳 ===");
  console.log(
    db
      .prepare(
        `SELECT
           SUM(CASE WHEN support_card_id > 0 THEN 1 ELSE 0 END) AS by_card,
           SUM(CASE WHEN support_card_id = 0 AND support_chara_id > 0 THEN 1 ELSE 0 END) AS by_chara_only,
           COUNT(DISTINCT CASE WHEN support_card_id > 0 THEN support_card_id END) AS distinct_cards,
           COUNT(DISTINCT CASE WHEN support_chara_id > 0 THEN support_chara_id END) AS distinct_charas
         FROM single_mode_story_data
         WHERE event_category = 4`
      )
      .get()
  );
  console.log(
    "merchant conclusions",
    db
      .prepare(
        "SELECT * FROM single_mode_conclusion_set WHERE story_id IN (801087001,801087002,801087003)"
      )
      .all()
  );
}

db.close();
