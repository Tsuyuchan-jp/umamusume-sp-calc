/**
 * events.json の優先サポカから、ユーザー／開発者向け一覧を生成する。
 *
 * 出力:
 *   data/priority-supports.json  — 機械可読（id・レア・タイプ付き）
 *   docs/PRIORITY_SUPPORTS.md    — 人間可読（同内容の表）
 *
 * 使い方:
 *   node scripts/render_priority_supports.mjs
 *   npm run render:priority-supports
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const DOCS_DIR = path.join(ROOT, "docs");

const TYPE_LABELS = {
  speed: "スピード",
  stamina: "スタミナ",
  power: "パワー",
  guts: "根性",
  wit: "賢さ",
  friend: "友人",
};

function loadJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, rel), "utf8"));
}

/** prioritySupportNames の表示名（スペース区切り） */
function toDisplayName(entry, fallback) {
  if (!entry.characterName) return fallback;
  return `[${entry.title}] ${entry.characterName}`;
}

function buildEntries(eventsDoc, supportsById) {
  const names = eventsDoc.prioritySupportNames || [];
  const rows = eventsDoc.prioritySupports || [];
  if (rows.length !== names.length) {
    throw new Error(
      `prioritySupports(${rows.length}) と prioritySupportNames(${names.length}) の件数が一致しません`
    );
  }

  return rows.map((row, index) => {
    const sup = supportsById.get(row.id);
    if (!sup) {
      throw new Error(`supports.json に id=${row.id} (${row.title}) がありません`);
    }
    if (sup.title !== row.title && !sup.name.includes(`[${row.title}]`)) {
      console.warn(`警告: id=${row.id} の title が events と supports で不一致 (${row.title} / ${sup.title})`);
    }
    return {
      no: index + 1,
      id: row.id,
      displayName: names[index] || toDisplayName(row, row.name),
      title: row.title,
      name: row.name,
      characterName: sup.characterName || "",
      rarity: sup.rarity || "",
      type: sup.type || "",
      typeLabel: TYPE_LABELS[sup.type] || sup.type || "",
      supportNameMatch: row.title,
    };
  });
}

function renderMarkdown(doc) {
  const count = doc.count;
  const lines = [
    `# イベント対応サポカ一覧（${count}種）`,
    "",
    "サポカイベントのスキルヒントが **このツールで計上される** 対象カードの一覧です。",
    `トレヒントは全サポカ対応ですが、**イベント由来スキルはこの${count}枚のみ**です。`,
    "",
    "- **利用者**: 下の表で手持ちデッキが対象か確認できます。アプリ内の「※サポカイベントについて」にも同じ名前が表示されます。",
    "- **開発者**: [data/priority-supports.json](../data/priority-supports.json) が機械可読の正本エクスポートです。元データは `data/events.json` の `prioritySupports` / `prioritySupportIds`。",
    "",
    `生成: \`npm run render:priority-supports\`（${doc.generatedAt} 時点・${doc.count}件）`,
    "",
    "## 一覧",
    "",
    "| # | 表示名 | カードID | レア | タイプ |",
    "|---|--------|----------|------|--------|",
  ];

  for (const s of doc.supports) {
    lines.push(`| ${s.no} | ${s.displayName} | ${s.id} | ${s.rarity} | ${s.typeLabel} |`);
  }

  lines.push(
    "",
    "## 開発者向けメモ",
    "",
    "| 項目 | 場所 |",
    "|------|------|",
    "| フィルタ・id 照合 | `events.json` → `prioritySupportIds` |",
    "| イベント紐付け | `events.json` → `events[].supportNameMatch`（= `title`） |",
    "| UI 表示名 | `events.json` → `prioritySupportNames` |",
    "| 再生成 | `npm run bind-priority` のあと、または `npm run apply:events` のあと `npm run render:priority-supports` |",
    "",
    "同名別衣装の誤判定を避けるため、フィルタは **id のみ** で照合します（名前マッチは使いません）。",
    ""
  );

  return lines.join("\n");
}

function main() {
  const eventsDoc = loadJson("events.json");
  const supports = loadJson("supports.json");
  const supportsById = new Map(supports.map((s) => [s.id, s]));

  const entries = buildEntries(eventsDoc, supportsById);
  const ids = eventsDoc.prioritySupportIds || [];
  const entryIds = entries.map((e) => e.id);
  if (ids.length !== entryIds.length || ids.some((id, i) => id !== entryIds[i])) {
    throw new Error("prioritySupportIds と prioritySupports の並び／内容が一致しません");
  }

  const generatedAt = new Date().toISOString();
  const jsonDoc = {
    version: 1,
    description:
      "イベントスキルヒント対応サポカ（events.json から生成。手編集しない）",
    source: "data/events.json",
    generatedAt,
    count: entries.length,
    supports: entries,
  };

  const jsonPath = path.join(DATA_DIR, "priority-supports.json");
  const mdPath = path.join(DOCS_DIR, "PRIORITY_SUPPORTS.md");

  fs.writeFileSync(jsonPath, JSON.stringify(jsonDoc, null, 2) + "\n", "utf8");
  fs.writeFileSync(mdPath, renderMarkdown(jsonDoc), "utf8");

  console.log(`wrote ${path.relative(ROOT, jsonPath)} (${entries.length}件)`);
  console.log(`wrote ${path.relative(ROOT, mdPath)}`);
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main();
}

export { main as renderPrioritySupports };
