/**
 * 手メンテ events.json と events.extracted.json をゴールデン比較する。
 *
 * 使い方:
 *   node scripts/compare_events_golden.mjs
 *   npm run compare:events
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SHORT_NAME_BY_MATCH } from "./format_event_choice_labels.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");

/** 旧11種（実機確認済み）の supportNameMatch */
const OLD_11_MATCHES = new Set([
  "一杯のノスタルジア",
  "その執念は怒濤が如く",
  "永久の誓い、永久の輝き",
  "刀光散らしてClash！",
  "全てに挑む勇ましき者",
  "白に至る覚悟",
  "Innovator",
  "ゆかし、きらめきの旅路",
  "心覚えし、京の華",
  "天才的ユートピア",
  "Zirkus der Träume",
]);

function loadJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, rel), "utf8"));
}

function normalizeEventName(label, supportNameMatch) {
  let name = String(label || "").trim();
  const short = SHORT_NAME_BY_MATCH[supportNameMatch];
  if (short && name.startsWith(`${short} `)) {
    name = name.slice(short.length + 1).trim();
  }
  return name.normalize("NFKC");
}

function skillKey(sk) {
  const id = sk.skillId != null ? `id:${sk.skillId}` : `name:${sk.skillName}`;
  return `${id}\0${sk.hintLevel}`;
}

function skillsSignature(skills) {
  return (skills || [])
    .map(skillKey)
    .sort()
    .join("|");
}

function eventSkillPayload(evt) {
  if (evt.selection === "single") {
    return (evt.choices || [])
      .filter((c) => (c.skills || []).length > 0)
      .map((c) => skillsSignature(c.skills))
      .sort()
      .join("||");
  }
  return skillsSignature(evt.skills);
}

function payloadsEqual(a, b) {
  return eventSkillPayload(a) === eventSkillPayload(b) && a.selection === b.selection;
}

function makeKey(supportNameMatch, suffix) {
  return `${supportNameMatch}\0${suffix}`;
}

function indexHandEvents(events) {
  const byName = new Map();
  const bySkill = new Map();
  const all = [];

  for (const evt of events) {
    const nameKey = makeKey(evt.supportNameMatch, normalizeEventName(evt.label, evt.supportNameMatch));
    const skillKeyStr = makeKey(evt.supportNameMatch, eventSkillPayload(evt));
    const entry = { evt, nameKey, skillKey: skillKeyStr, matched: false };

    if (!byName.has(nameKey)) byName.set(nameKey, []);
    byName.get(nameKey).push(entry);

    if (!bySkill.has(skillKeyStr)) bySkill.set(skillKeyStr, []);
    bySkill.get(skillKeyStr).push(entry);

    all.push(entry);
  }
  return { byName, bySkill, all };
}

function pickBestHandMatch(candidates, extracted) {
  if (!candidates?.length) return null;
  const exact = candidates.find((c) => payloadsEqual(c.evt, extracted));
  if (exact) return { hand: exact, kind: "match" };
  return { hand: candidates[0], kind: "conflict" };
}

function summarizeEntry(evt, side) {
  return {
    side,
    id: evt.id,
    supportNameMatch: evt.supportNameMatch,
    label: evt.label,
    selection: evt.selection,
    skills: evt.skills,
    choices: evt.choices?.map((c) => ({ id: c.id, label: c.label, skills: c.skills })),
    skillPayload: eventSkillPayload(evt),
  };
}

function main() {
  const handDoc = loadJson("events.json");
  const extDoc = loadJson("events.extracted.json");
  const handEvents = handDoc.events || [];
  const extEvents = extDoc.events || [];

  const handIndex = indexHandEvents(handEvents);
  const results = [];
  const counts = { match: 0, conflict: 0, extracted_only: 0, hand_only: 0 };

  for (const ext of extEvents) {
    const nameKey = makeKey(ext.supportNameMatch, normalizeEventName(ext.label, ext.supportNameMatch));
    let picked = pickBestHandMatch(handIndex.byName.get(nameKey), ext);

    if (!picked) {
      const skillKeyStr = makeKey(ext.supportNameMatch, eventSkillPayload(ext));
      picked = pickBestHandMatch(handIndex.bySkill.get(skillKeyStr), ext);
    }

    if (!picked) {
      counts.extracted_only++;
      results.push({
        status: "extracted_only",
        extracted: summarizeEntry(ext, "extracted"),
      });
      continue;
    }

    picked.hand.matched = true;
    if (picked.kind === "match" && payloadsEqual(picked.hand.evt, ext)) {
      counts.match++;
      results.push({
        status: "match",
        hand: summarizeEntry(picked.hand.evt, "hand"),
        extracted: summarizeEntry(ext, "extracted"),
        matchKey: picked.hand.nameKey === nameKey ? "name" : "skill",
      });
    } else {
      counts.conflict++;
      results.push({
        status: "conflict",
        hand: summarizeEntry(picked.hand.evt, "hand"),
        extracted: summarizeEntry(ext, "extracted"),
        matchKey: picked.hand.nameKey === nameKey ? "name" : "skill",
      });
    }
  }

  const handOnly = [];
  for (const entry of handIndex.all) {
    if (!entry.matched) {
      counts.hand_only++;
      handOnly.push(summarizeEntry(entry.evt, "hand"));
    }
  }

  const old11 = { match: 0, conflict: 0, hand_only: 0, extracted_only: 0 };
  for (const r of results) {
    const match = r.hand?.supportNameMatch || r.extracted?.supportNameMatch;
    if (!OLD_11_MATCHES.has(match)) continue;
    old11[r.status]++;
  }
  old11.hand_only = handOnly.filter((h) => OLD_11_MATCHES.has(h.supportNameMatch)).length;

  const report = {
    comparedAt: new Date().toISOString(),
    handCount: handEvents.length,
    extractedCount: extEvents.length,
    counts,
    old11,
    old11Conflicts: results.filter(
      (r) => r.status === "conflict" && OLD_11_MATCHES.has(r.hand?.supportNameMatch)
    ),
    old11HandOnly: results.filter(
      (r) => r.status === "hand_only" && OLD_11_MATCHES.has(r.hand?.supportNameMatch)
    ),
    handOnly,
    results,
  };

  const outPath = path.join(DATA_DIR, "events.diff-report.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

  console.log("=== ゴールデン比較 ===");
  console.log(`手メンテ: ${handEvents.length} / 抽出: ${extEvents.length}`);
  console.log(`match: ${counts.match}`);
  console.log(`conflict: ${counts.conflict}`);
  console.log(`extracted_only: ${counts.extracted_only}`);
  console.log(`hand_only: ${counts.hand_only}`);
  console.log("--- 旧11種 ---");
  console.log(`match: ${old11.match} conflict: ${old11.conflict} hand_only: ${old11.hand_only} extracted_only: ${old11.extracted_only}`);
  console.log("report:", outPath);

  if (old11.conflict > 0) {
    console.log("\n旧11 conflict:");
    for (const r of report.old11Conflicts) {
      console.log(`  ${r.hand.label} (hand ${r.hand.id})`);
    }
  }
  if (old11.hand_only > 0) {
    console.log("\n旧11 hand_only:");
    for (const h of report.handOnly.filter((h) => OLD_11_MATCHES.has(h.supportNameMatch))) {
      console.log(`  ${h.label} (hand ${h.id})`);
    }
  }
}

main();
