/**
 * Phase B: events.extracted.json を events.json に反映する。
 *
 * - 抽出結果を正とする（U-tools + mdb）
 * - events.preserve.json の例外をマージ
 * - events.id-aliases.json に旧 id → 新 id を記録
 *
 * 使い方:
 *   node scripts/apply_extracted_events.mjs [--dry-run]
 *   npm run apply:events
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  findHandMatch,
  indexHandEvents,
  mapChoiceAliases,
  normalizeEventName,
} from "./event_golden_match.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");

function loadJson(rel, fallback = null) {
  const p = path.join(DATA_DIR, rel);
  if (!fs.existsSync(p)) {
    if (fallback != null) return fallback;
    throw new Error(`missing ${rel}`);
  }
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function stripPreserveMeta(evt) {
  const out = { ...evt };
  for (const k of Object.keys(out)) {
    if (k.startsWith("_")) delete out[k];
  }
  return out;
}

function parseArgs(argv) {
  return { dryRun: argv.includes("--dry-run") };
}

function main() {
  const { dryRun } = parseArgs(process.argv);
  const handDoc = loadJson("events.json");
  const extDoc = loadJson("events.extracted.json");
  const preserveDoc = loadJson("events.preserve.json", { events: [] });

  const handEvents = handDoc.events || [];
  const extracted = (extDoc.events || []).map((e) => ({ ...e }));
  const preserve = (preserveDoc.events || []).map(stripPreserveMeta);

  const handIndex = indexHandEvents(handEvents);
  const extractedIds = new Set(extracted.map((e) => e.id));

  const eventAliases = {};
  const choiceAliases = {};
  const replaced = [];

  for (const ext of extracted) {
    const hit = findHandMatch(ext, handIndex);
    if (hit) {
      hit.hand.matched = true;
      const oldId = hit.hand.evt.id;
      const newId = ext.id;
      if (oldId !== newId) {
        eventAliases[oldId] = newId;
      }
      const cMap = mapChoiceAliases(hit.hand.evt, ext);
      if (Object.keys(cMap).length) {
        choiceAliases[oldId] = cMap;
      }
      replaced.push({
        oldId,
        newId,
        label: ext.label,
        matchKey: hit.matchKey,
        payloadMatch: hit.exact,
      });
    }
  }

  const preserveAdded = [];
  for (const p of preserve) {
    if (extractedIds.has(p.id)) {
      console.warn(`preserve ${p.id} は抽出と id 衝突のためスキップ`);
      continue;
    }
    extracted.push(p);
    preserveAdded.push(p.id);
    const hit = handIndex.all.find((e) => e.evt.id === p.id);
    if (hit) hit.matched = true;
  }

  const dropped = handIndex.all
    .filter((e) => !e.matched)
    .map((e) => ({
      id: e.evt.id,
      supportNameMatch: e.evt.supportNameMatch,
      label: e.evt.label,
      reason: inferDropReason(e.evt.id),
    }));

  extracted.sort(
    (a, b) =>
      a.supportNameMatch.localeCompare(b.supportNameMatch, "ja") ||
      normalizeEventName(a.label, a.supportNameMatch).localeCompare(
        normalizeEventName(b.label, b.supportNameMatch),
        "ja"
      )
  );

  const autoCount = extracted.filter((e) => e.selection === "auto").length;
  const singleCount = extracted.filter((e) => e.selection === "single").length;

  const outDoc = {
    ...handDoc,
    description:
      "常用サポカのイベントスキル（U-tools+mdb 抽出正本・2026-07 Phase B）。selection: auto=編成時自動計上 / single=1択",
    events: extracted,
  };

  const aliasesDoc = {
    description: "Phase B 移行用: 旧 events.json id → 新 id（1バージョンのみ保持）",
    migratedAt: new Date().toISOString(),
    eventAliases,
    choiceAliases,
  };

  const report = {
    appliedAt: new Date().toISOString(),
    dryRun,
    stats: { total: extracted.length, auto: autoCount, single: singleCount },
    replacedCount: replaced.length,
    preserveAdded,
    dropped,
    replaced,
  };

  if (dryRun) {
    console.log("=== dry-run ===");
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  fs.writeFileSync(path.join(DATA_DIR, "events.json"), JSON.stringify(outDoc, null, 2), "utf8");
  fs.writeFileSync(
    path.join(DATA_DIR, "events.id-aliases.json"),
    JSON.stringify(aliasesDoc, null, 2),
    "utf8"
  );
  fs.writeFileSync(
    path.join(DATA_DIR, "events.apply-report.json"),
    JSON.stringify(report, null, 2),
    "utf8"
  );

  console.log(`applied events.json: ${extracted.length} (auto ${autoCount} / single ${singleCount})`);
  console.log(`aliases: ${Object.keys(eventAliases).length} events`);
  console.log(`preserved: ${preserveAdded.length}`);
  console.log(`dropped: ${dropped.length}`);
  if (dropped.length) {
    console.log("dropped:");
    for (const d of dropped) console.log(`  ${d.id} — ${d.reason}`);
  }
}

function inferDropReason(id) {
  const known = {
    evt_gran_seicho: "U-tools に該当イベント無し（GameWith 誤記疑い）",
    evt_fuji_sleight:
      "U-tools ではスライハンドにスキルヒント無し（手メンテ誤登録）",
  };
  return known[id] || "抽出・preserve に対応無し";
}

main();
