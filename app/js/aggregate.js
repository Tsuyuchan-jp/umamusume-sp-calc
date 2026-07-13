import { resolveHintLevels } from "./hintResolve.js";
import { calcAcquisitionCost, filterDisplaySkills } from "./goldLower.js";
import { calcSkillCost } from "./spCost.js";
import {
  getDeckLinkCharacterIds,
  resolveLinkSkill,
} from "./scenarioLink.js";

const TRAINING_HINT = 5;
const CHARA_HINT = 3;

function isEventSupportInDeck(evt, supportIds, supportById) {
  if (!evt.supportNameMatch) return true;
  return supportIds
    .map((id) => supportById.get(id))
    .some((s) => s && s.name.includes(evt.supportNameMatch));
}

function appendEventSkills(hintEntries, skills, label, nameToId) {
  for (const sk of skills || []) {
    const skillId = sk.skillId ?? nameToId.get(sk.skillName);
    if (!skillId) continue;
    hintEntries.push({
      skillId,
      hintLevel: sk.hintLevel,
      source: `イベント: ${label}`,
    });
  }
}

/**
 * @param {object} params
 * @param {object[]} params.skills
 * @param {object[]} params.supports
 * @param {object[]} params.characters
 * @param {object} params.events
 * @param {object} params.scenario
 * @param {number} params.characterId
 * @param {number[]} params.supportIds 長さ6
 * @param {Set<number>} params.excludedSkillIds
 * @param {boolean} params.fastLearner
 * @param {boolean} params.inheritEnabled
 * @param {number} params.inheritCount 2-6
 * @param {number} params.inheritHintLevel 1-5
 * @param {number} params.inheritBaseSp default 200
 * @param {Set<string>} [params.enabledEventIds] selection=toggle 用（後方互換）
 * @param {Record<string, string|null>} [params.eventChoiceIds] selection=single の選択
 * @param {Set<string>} params.enabledScenarioEntryIds シナリオリンク選択 ID
 * @param {string} [params.seniorRmjChoiceId] シニア12月ラーメン選択
 */
export function buildSkillPlan(params) {
  const skillById = new Map(params.skills.map((s) => [s.id, s]));
  const supportById = new Map(params.supports.map((s) => [s.id, s]));
  const nameToId = new Map(params.skills.map((s) => [s.name, s.id]));

  const hintEntries = [];

  // サポカヒント
  for (const sid of params.supportIds) {
    const sup = supportById.get(sid);
    if (!sup) continue;
    for (const skillId of sup.hintSkillIds || []) {
      hintEntries.push({
        skillId,
        hintLevel: TRAINING_HINT,
        source: `サポカ: ${sup.name}`,
      });
    }
  }

  // 育成ウマ娘所持スキル（育成ウマ娘覚醒レベル最大想定: 全ランク合算、ヒントLv3）
  const chara = params.characters.find((c) => c.id === params.characterId);
  if (chara?.skillsByAwakening) {
    const seen = new Set();
    for (const skillIds of Object.values(chara.skillsByAwakening)) {
      for (const skillId of skillIds || []) {
        const id = Number(skillId);
        if (seen.has(id)) continue;
        seen.add(id);
        hintEntries.push({
          skillId: id,
          hintLevel: CHARA_HINT,
          source: `ウマ娘: ${chara.name}`,
        });
      }
    }
  }

  // イベント
  for (const evt of params.events.events || []) {
    if (!isEventSupportInDeck(evt, params.supportIds, supportById)) continue;

    const selection = evt.selection ?? "toggle";
    if (selection === "auto") {
      appendEventSkills(hintEntries, evt.skills, evt.label, nameToId);
    } else if (selection === "single") {
      const choiceId = params.eventChoiceIds?.[evt.id];
      if (!choiceId || choiceId === "none") continue;
      const choice = (evt.choices || []).find((c) => c.id === choiceId);
      if (choice) {
        appendEventSkills(hintEntries, choice.skills, `${evt.label}`, nameToId);
      }
    } else if (params.enabledEventIds?.has(evt.id)) {
      appendEventSkills(hintEntries, evt.skills, evt.label, nameToId);
    }
  }

  // シナリオリンク（選択1件・編成に応じて白 or 金の1スキルのみ）
  const deckLinkIds = getDeckLinkCharacterIds(
    params.characterId,
    params.supportIds,
    supportById
  );
  for (const entry of params.scenario.linkSkills || []) {
    if (!params.enabledScenarioEntryIds.has(entry.id)) continue;
    const sk = resolveLinkSkill(entry, deckLinkIds);
    if (!sk) continue;
    const skillId = sk.skillId ?? nameToId.get(sk.skillName);
    if (!skillId) continue;
    hintEntries.push({
      skillId,
      hintLevel: sk.hintLevel,
      source: `シナリオ: ${entry.label}`,
    });
  }

  // シナリオ自動計上（ガチ想定: クラシック大盛況・超盛況固定・育成終了）
  for (const entry of params.scenario.scenarioAutoSkills || []) {
    for (const sk of entry.skills || []) {
      const skillId = sk.skillId ?? nameToId.get(sk.skillName);
      if (!skillId) continue;
      hintEntries.push({
        skillId,
        hintLevel: sk.hintLevel,
        source: `シナリオ: ${entry.label}`,
      });
    }
  }

  // シニア12月 超盛況 ラーメン選択金
  const rmj = params.scenario.seniorRmjChoice;
  const rmjChoiceId =
    params.seniorRmjChoiceId ?? rmj?.defaultChoiceId ?? null;
  if (rmj && rmjChoiceId) {
    const choice = (rmj.choices || []).find((c) => c.id === rmjChoiceId);
    if (choice) {
      for (const sk of choice.skills || []) {
        const skillId = sk.skillId ?? nameToId.get(sk.skillName);
        if (!skillId) continue;
        hintEntries.push({
          skillId,
          hintLevel: sk.hintLevel,
          source: `シナリオ: ${choice.label}`,
        });
      }
    }
  }

  const hintMap = resolveHintLevels(hintEntries);
  const allSkillIds = [...hintMap.keys()];
  const displayIds = filterDisplaySkills(allSkillIds, skillById);

  const rows = [];
  let total = 0;

  for (const skillId of displayIds) {
    const skill = skillById.get(skillId);
    if (!skill) continue;
    const hint = hintMap.get(skillId);
    const acq = calcAcquisitionCost(skill, skillById, hintMap, params.fastLearner);
    const excluded = params.excludedSkillIds.has(skillId);
    if (!excluded) {
      total += acq.cost;
    }
    rows.push({
      skillId,
      name: skill.name,
      hintLevel: hint?.hintLevel ?? 0,
      sources: hint?.sources ?? [],
      baseSp: skill.baseSp,
      cost: acq.cost,
      includesLower: acq.includesLower,
      lowerSkillId: acq.lowerSkillId,
      lowerCost: acq.lowerCost,
      goldOnlyCost: acq.goldOnlyCost,
      rarity: skill.rarity,
      excluded,
    });
  }

  rows.sort((a, b) => a.name.localeCompare(b.name, "ja"));

  if (params.inheritEnabled && params.inheritCount > 0) {
    const inheritCost = calcSkillCost(
      params.inheritBaseSp,
      params.inheritHintLevel,
      params.fastLearner
    );
    total += inheritCost * params.inheritCount;
    rows.push({
      skillId: null,
      name: `継承固有 × ${params.inheritCount}`,
      hintLevel: params.inheritHintLevel,
      sources: ["継承固有（汎用）"],
      baseSp: params.inheritBaseSp,
      cost: inheritCost * params.inheritCount,
      isInherit: true,
    });
  }

  return { rows, total, hintMap };
}
