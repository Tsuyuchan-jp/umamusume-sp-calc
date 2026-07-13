import { resolveHintLevels } from "./hintResolve.js";
import { calcAcquisitionCost, filterDisplaySkills } from "./goldLower.js";
import { calcSkillCost } from "./spCost.js";

const TRAINING_HINT = 5;
const CHARA_HINT = 3;

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
 * @param {Set<string>} params.enabledEventIds
 * @param {Set<string>} params.enabledScenarioEntryIds
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

  // ウマ娘所持・覚醒スキル（最大覚醒想定: 全ランク合算、ヒントLv3）
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
    if (!params.enabledEventIds.has(evt.id)) continue;
    const sup = params.supportIds
      .map((id) => supportById.get(id))
      .find((s) => s && s.name.includes(evt.supportNameMatch));
    if (!sup && evt.supportNameMatch) continue;
    for (const sk of evt.skills || []) {
      const skillId = sk.skillId ?? nameToId.get(sk.skillName);
      if (!skillId) continue;
      hintEntries.push({
        skillId,
        hintLevel: sk.hintLevel,
        source: `イベント: ${evt.label}`,
      });
    }
  }

  // シナリオ（全グループ平坦化）
  const scenarioGroups = [
    ...(params.scenario.linkSkills || []),
    ...(params.scenario.rmjSkills || []),
    ...(params.scenario.endSkills || []),
    ...(params.scenario.classicRmj || []),
  ];
  for (const entry of scenarioGroups) {
    if (!params.enabledScenarioEntryIds.has(entry.id)) continue;
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
