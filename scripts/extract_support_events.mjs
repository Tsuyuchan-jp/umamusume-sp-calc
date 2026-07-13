/**
 * 優先37サポカのイベントを mdb + U-tools から抽出し events.extracted.json を生成する。
 *
 * 使い方:
 *   node scripts/extract_support_events.mjs [--mdb path] [--cache-only] [--no-fetch]
 *   npm run extract:events
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatEventLabel } from "./format_event_choice_labels.mjs";
import { normalizeEventSelection } from "./event_selection.mjs";
import {
  collectChoiceSkillHints,
  eventHasSkillHints,
  fetchUtoolsEvents,
} from "./utools_parse.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");

const DEFAULT_MDB_CANDIDATES = [
  path.join(process.env.USERPROFILE || "", "AppData/LocalLow/Cygames/umamusume/master/master.mdb"),
  "D:/DMM/umamusumeDMM/Umamusume/umamusume_Data/Persistent/master/master.mdb",
  "D:/Umamusume/umamusume_Data/Persistent/master/master.mdb",
];

const TEXT_STORY_NAME = 181;

function parseArgs(argv) {
  const opts = {
    mdb: null,
    cacheOnly: false,
    noFetch: false,
    only: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--mdb") opts.mdb = argv[++i];
    else if (a === "--cache-only") opts.cacheOnly = true;
    else if (a === "--no-fetch") opts.noFetch = true;
    else if (a === "--only") opts.only = Number(argv[++i]);
    else if (a === "--help") {
      console.log(`usage: node scripts/extract_support_events.mjs [--mdb path] [--cache-only] [--only id]`);
      process.exit(0);
    }
  }
  return opts;
}

function resolveMdb(cliPath) {
  if (cliPath && fs.existsSync(cliPath)) return cliPath;
  for (const p of DEFAULT_MDB_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function loadJson(relPath, fallback = null) {
  const p = path.join(DATA_DIR, relPath);
  if (!fs.existsSync(p)) return fallback;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function loadPrioritySupports(eventsDoc, supports) {
  if (eventsDoc.prioritySupports?.length) {
    return eventsDoc.prioritySupports.map((p) => ({
      id: p.id,
      supportNameMatch: p.title,
      name: p.name,
    }));
  }
  return (eventsDoc.prioritySupportNames || []).map((display) => {
    const m = display.match(/^\[([^\]]+)\]/);
    const title = m ? m[1] : display;
    const hit = supports.find((s) => s.title === title || s.name.includes(`[${title}]`));
    if (!hit) throw new Error(`supports.json に無い優先サポカ: ${display}`);
    return { id: hit.id, supportNameMatch: title, name: hit.name };
  });
}

function loadStoryNameMap(db) {
  const rows = db
    .prepare('SELECT "index", text FROM text_data WHERE category = ?')
    .all(TEXT_STORY_NAME);
  const map = new Map();
  for (const r of rows) map.set(String(r.index), r.text);
  return map;
}

function skillNameNormalize(name) {
  return String(name || "").replace(/◯/g, "○").trim();
}

function buildSkillLookup(skills) {
  const byId = new Map(skills.map((s) => [s.id, s]));
  const byName = new Map(skills.map((s) => [skillNameNormalize(s.name), s]));
  return { byId, byName };
}

function resolveSkillHint(hint, lookup) {
  const fromId = lookup.byId.get(hint.skillId);
  const skillName = skillNameNormalize(fromId?.name);
  return {
    skillName,
    hintLevel: hint.hintLevel,
    skillId: hint.skillId,
  };
}

/** choice の skillId 列から fingerprint（安定 choice id 用） */
function choiceSkillFingerprint(skills) {
  return (skills || [])
    .map((s) => `${s.skillId}:${s.hintLevel}`)
    .sort()
    .join("+");
}

function stableChoiceId(utoolsChoiceId, skills) {
  const tail = String(utoolsChoiceId).slice(-3);
  const fp = choiceSkillFingerprint(skills).slice(0, 24).replace(/[^a-zA-Z0-9+]/g, "");
  return fp ? `c${tail}_${fp}` : `c${tail}`;
}

function stableEventId(supportCardId, storyId) {
  return `evt_${supportCardId}_${storyId}`;
}

function sumBaseSp(skills, lookup) {
  return (skills || []).reduce((sum, s) => {
    const row = lookup.byId.get(s.skillId);
    return sum + (row?.baseSp ?? 0);
  }, 0);
}

function pickDefaultChoiceId(choices, lookup, overrideId) {
  if (overrideId && choices.some((c) => c.id === overrideId)) return overrideId;
  let best = null;
  let bestSp = -1;
  for (const c of choices) {
    const sp = sumBaseSp(c.skills, lookup);
    if (sp > bestSp) {
      bestSp = sp;
      best = c.id;
    }
  }
  return best ?? choices[0]?.id;
}

function stripInternalFields(evt) {
  const out = { ...evt };
  for (const key of Object.keys(out)) {
    if (key.startsWith("_")) delete out[key];
  }
  if (out.choices) {
    out.choices = out.choices.map((c) => {
      const co = { ...c };
      for (const key of Object.keys(co)) {
        if (key.startsWith("_")) delete co[key];
      }
      return co;
    });
  }
  return out;
}

function convertUtoolsEvent(rawEvent, ctx) {
  const { supportCardId, supportNameMatch, lookup, storyNames, defaultOverrides } = ctx;
  if (!eventHasSkillHints(rawEvent)) return null;

  const storyId = String(rawEvent.id);
  const mdbTitle = storyNames.get(storyId);
  const eventTitle = mdbTitle || rawEvent.title || storyId;

  const choices = [];
  for (const c of rawEvent.choices || []) {
    const hints = collectChoiceSkillHints(c);
    if (!hints.length) continue;
    const skills = hints.map((h) => resolveSkillHint(h, lookup));
    choices.push({
      id: stableChoiceId(c.id, skills),
      label: c.text || "",
      skills,
      _utoolsChoiceId: c.id,
    });
  }
  if (!choices.length) return null;

  const eventId = stableEventId(supportCardId, storyId);
  let evt = {
    id: eventId,
    supportNameMatch,
    label: formatEventLabel(supportNameMatch, eventTitle),
    choices,
    defaultChoiceId: pickDefaultChoiceId(choices, lookup, defaultOverrides[eventId]),
    _storyId: storyId,
    _utoolsTitle: rawEvent.title,
  };

  evt = normalizeEventSelection(evt);
  return evt;
}

async function loadRawUtools(cachePath, opts, priorityList) {
  if (opts.cacheOnly) {
    if (!fs.existsSync(cachePath)) {
      throw new Error(`--cache-only ですが ${cachePath} がありません`);
    }
    return JSON.parse(fs.readFileSync(cachePath, "utf8"));
  }

  const cached = fs.existsSync(cachePath)
    ? JSON.parse(fs.readFileSync(cachePath, "utf8"))
    : null;
  const byId = new Map((cached?.supports || []).map((s) => [s.supportCardId, s]));

  const supports = [];
  for (const p of priorityList) {
    if (opts.only && p.id !== opts.only) continue;
    if (opts.noFetch && byId.has(p.id)) {
      supports.push(byId.get(p.id));
      continue;
    }
    console.log(`fetch U-tools: ${p.id} ${p.supportNameMatch}`);
    supports.push(await fetchUtoolsEvents(p.id));
  }
  return { fetchedAt: new Date().toISOString(), supports };
}

async function main() {
  const opts = parseArgs(process.argv);
  const mdbPath = resolveMdb(opts.mdb);
  if (!mdbPath) {
    console.error("master.mdb が見つかりません（--mdb で指定）");
    process.exit(1);
  }

  const eventsDoc = loadJson("events.json");
  const supports = loadJson("supports.json", []);
  const skills = loadJson("skills.json", []);
  const defaultOverridesDoc = loadJson("events.default-overrides.json", { overrides: {} });
  const defaultOverrides = defaultOverridesDoc.overrides || {};

  let priorityList = loadPrioritySupports(eventsDoc, supports);
  if (opts.only) priorityList = priorityList.filter((p) => p.id === opts.only);

  const db = new DatabaseSync(mdbPath, { readOnly: true });
  const storyNames = loadStoryNameMap(db);
  db.close();

  const lookup = buildSkillLookup(skills);
  const cachePath = path.join(DATA_DIR, "events.raw.utools.json");

  let rawDoc;
  try {
    rawDoc = await loadRawUtools(cachePath, opts, loadPrioritySupports(eventsDoc, supports));
  } catch (e) {
    console.error("U-tools 取得失敗:", e.message);
    process.exit(2);
  }

  if (!opts.cacheOnly && !opts.noFetch) {
    fs.writeFileSync(cachePath, JSON.stringify(rawDoc, null, 2), "utf8");
    console.log("wrote raw cache:", cachePath);
  }

  const events = [];
  const warnings = [];
  const rawById = new Map((rawDoc.supports || []).map((s) => [s.supportCardId, s]));

  for (const p of priorityList) {
    const raw = rawById.get(p.id);
    if (!raw) {
      warnings.push({ supportCardId: p.id, message: "U-tools raw 無し" });
      continue;
    }
    for (const utoolsEvt of raw.events || []) {
      try {
        const converted = convertUtoolsEvent(utoolsEvt, {
          supportCardId: p.id,
          supportNameMatch: p.supportNameMatch,
          lookup,
          storyNames,
          defaultOverrides,
        });
        if (converted) events.push(stripInternalFields(converted));
      } catch (e) {
        warnings.push({
          supportCardId: p.id,
          storyId: utoolsEvt.id,
          title: utoolsEvt.title,
          message: e.message,
        });
      }
    }
  }

  events.sort((a, b) =>
    a.supportNameMatch.localeCompare(b.supportNameMatch, "ja") ||
    a.id.localeCompare(b.id)
  );

  const autoCount = events.filter((e) => e.selection === "auto").length;
  const singleCount = events.filter((e) => e.selection === "single").length;

  const outDoc = {
    version: 2,
    description: "U-tools + mdb から抽出（Phase A 生成物・手メンテ events.json は未置換）",
    extractedAt: new Date().toISOString(),
    source: {
      mdb: mdbPath,
      utoolsCache: "data/events.raw.utools.json",
      priorityCount: priorityList.length,
    },
    stats: { total: events.length, auto: autoCount, single: singleCount },
    warnings,
    events,
  };

  const outPath = path.join(DATA_DIR, "events.extracted.json");
  fs.writeFileSync(outPath, JSON.stringify(outDoc, null, 2), "utf8");
  console.log(`wrote ${outPath}: ${events.length} events (auto ${autoCount} / single ${singleCount})`);
  if (warnings.length) console.warn("warnings:", warnings.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
