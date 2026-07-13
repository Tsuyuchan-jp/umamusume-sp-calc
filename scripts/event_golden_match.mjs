/**
 * ゴールデン比較・Phase B 置換で共有する突合キー生成
 */
import { SHORT_NAME_BY_MATCH } from "./format_event_choice_labels.mjs";

/** イベント表示名を突合用に正規化（短縮名除去・括弧注記除去） */
export function normalizeEventName(label, supportNameMatch) {
  let name = String(label || "").trim();
  const short = SHORT_NAME_BY_MATCH[supportNameMatch];
  if (short && name.startsWith(`${short} `)) {
    name = name.slice(short.length + 1).trim();
  }
  name = name.replace(/（[^）]*）/g, "").replace(/\([^)]*\)/g, "").trim();
  return name.normalize("NFKC");
}

function skillKey(sk) {
  const id = sk.skillId != null ? `id:${sk.skillId}` : `name:${sk.skillName}`;
  return `${id}\0${sk.hintLevel}`;
}

export function skillsSignature(skills) {
  return (skills || [])
    .map(skillKey)
    .sort()
    .join("|");
}

/** auto / single 双方のスキル集合シグネチャ */
export function eventSkillPayload(evt) {
  if (evt.selection === "single") {
    return (evt.choices || [])
      .filter((c) => (c.skills || []).length > 0)
      .map((c) => skillsSignature(c.skills))
      .sort()
      .join("||");
  }
  return skillsSignature(evt.skills);
}

export function payloadsEqual(a, b) {
  return eventSkillPayload(a) === eventSkillPayload(b) && a.selection === b.selection;
}

function makeKey(supportNameMatch, suffix) {
  return `${supportNameMatch}\0${suffix}`;
}

/** 手メンテイベント一覧を name / skill キーで索引化 */
export function indexHandEvents(events) {
  const byName = new Map();
  const bySkill = new Map();
  const all = [];

  for (const evt of events) {
    const nameKey = makeKey(
      evt.supportNameMatch,
      normalizeEventName(evt.label, evt.supportNameMatch)
    );
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

/** 抽出イベントに対応する手メンテエントリを探す（未マッチなら null） */
export function findHandMatch(ext, handIndex) {
  const nameKey = makeKey(
    ext.supportNameMatch,
    normalizeEventName(ext.label, ext.supportNameMatch)
  );
  let candidates = handIndex.byName.get(nameKey);
  if (candidates?.length) {
    const exact = candidates.find((c) => payloadsEqual(c.evt, ext));
    return { hand: exact ?? candidates[0], matchKey: "name", exact: !!exact };
  }

  const skillKeyStr = makeKey(ext.supportNameMatch, eventSkillPayload(ext));
  candidates = handIndex.bySkill.get(skillKeyStr);
  if (candidates?.length) {
    const exact = candidates.find((c) => payloadsEqual(c.evt, ext));
    return { hand: exact ?? candidates[0], matchKey: "skill", exact: !!exact };
  }
  return null;
}

/** single イベントの choice id 対応（スキル集合で突合） */
export function mapChoiceAliases(handEvt, extEvt) {
  const aliases = {};
  if (handEvt.selection !== "single" || extEvt.selection !== "single") {
    return aliases;
  }
  const extBySig = new Map();
  for (const c of extEvt.choices || []) {
    extBySig.set(skillsSignature(c.skills), c.id);
  }
  for (const hc of handEvt.choices || []) {
    const sig = skillsSignature(hc.skills);
    const newId = extBySig.get(sig);
    if (newId && newId !== hc.id) {
      aliases[hc.id] = newId;
    }
  }
  return aliases;
}
