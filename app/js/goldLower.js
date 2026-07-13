import { calcSkillCost } from "./spCost.js";

/**
 * 金スキル取得コスト（下位未取得想定）
 * 実機検証: cost(白)+cost(金)
 * @param {object} skill - skills.json の1件
 * @param {Map<number, object>} skillById
 * @param {Map<number, { hintLevel: number }>} hintMap
 * @param {boolean} fastLearner
 */
export function calcAcquisitionCost(skill, skillById, hintMap, fastLearner) {
  const hint = hintMap.get(skill.id)?.hintLevel ?? 0;

  if (skill.upperSkillId) {
    // 白スキル単体
    return {
      cost: calcSkillCost(skill.baseSp, hint, fastLearner),
      displaySkillId: skill.id,
      includesLower: false,
    };
  }

  if (skill.lowerSkillId) {
    const lower = skillById.get(skill.lowerSkillId);
    if (!lower) {
      return {
        cost: calcSkillCost(skill.baseSp, hint, fastLearner),
        displaySkillId: skill.id,
        includesLower: false,
      };
    }
    const lowerHint = hintMap.get(lower.id)?.hintLevel ?? 0;
    const total =
      calcSkillCost(lower.baseSp, lowerHint, fastLearner) +
      calcSkillCost(skill.baseSp, hint, fastLearner);
    return {
      cost: total,
      displaySkillId: skill.id,
      includesLower: true,
      lowerSkillId: lower.id,
      lowerCost: calcSkillCost(lower.baseSp, lowerHint, fastLearner),
      goldOnlyCost: calcSkillCost(skill.baseSp, hint, fastLearner),
    };
  }

  return {
    cost: calcSkillCost(skill.baseSp, hint, fastLearner),
    displaySkillId: skill.id,
    includesLower: false,
  };
}

/**
 * 一覧表示用: 金がある場合は白を除外
 * @param {number[]} skillIds
 * @param {Map<number, object>} skillById
 */
export function filterDisplaySkills(skillIds, skillById) {
  const set = new Set(skillIds);
  const goldLowerIds = new Set();
  for (const id of skillIds) {
    const s = skillById.get(id);
    if (s?.lowerSkillId && set.has(s.lowerSkillId)) {
      goldLowerIds.add(s.lowerSkillId);
    }
  }
  return skillIds.filter((id) => !goldLowerIds.has(id));
}
