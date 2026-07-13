import { calcSkillCost } from "./spCost.js";

/** 購入チェーンに含めるスキルか（group_rate < 0 の×等は除外） */
export function isChainMember(skill) {
  return skill != null && (skill.groupRate == null || skill.groupRate >= 0);
}

/**
 * グループ内の購入チェーン上の最下位まで辿る
 * @param {object} skill
 * @param {Map<number, object>} skillById
 */
export function getChainRoot(skill, skillById) {
  let cur = skill;
  const seen = new Set();
  while (cur?.lowerSkillId != null) {
    if (seen.has(cur.id)) break;
    seen.add(cur.id);
    const lower = skillById.get(cur.lowerSkillId);
    if (!isChainMember(lower)) break;
    cur = lower;
  }
  return cur;
}

/**
 * 表示・コスト用の実効ヒントLv
 * - 金（rarity 2）: 自身のヒント
 * - 白帯（rarity 1）: 同一グループの ○/◎ で共有（◎専用ヒントは無い。◎ ID のヒントも○準拠に合流）
 * @param {object} skill
 * @param {Map<number, object>} skillById
 * @param {Map<number, { hintLevel: number }>} hintMap
 */
export function getEffectiveHintLevel(skill, skillById, hintMap) {
  if (skill.rarity === 2) {
    return hintMap.get(skill.id)?.hintLevel ?? 0;
  }

  const root = getChainRoot(skill, skillById);
  let maxLv = 0;
  let cur = root;
  const seen = new Set();
  while (cur && cur.rarity === 1 && isChainMember(cur)) {
    if (seen.has(cur.id)) break;
    seen.add(cur.id);
    const lv = hintMap.get(cur.id)?.hintLevel ?? 0;
    if (lv > maxLv) maxLv = lv;
    if (cur.upperSkillId == null) break;
    const up = skillById.get(cur.upperSkillId);
    if (!up || up.rarity !== 1 || !isChainMember(up)) break;
    cur = up;
  }
  return maxLv;
}

/**
 * skill 以下（自身含む）の購入チェーンを根→自身の順で返す（×は含めない）
 * @param {object} skill
 * @param {Map<number, object>} skillById
 */
export function getLowerChain(skill, skillById) {
  const chain = [];
  let cur = skill;
  const seen = new Set();
  while (cur && isChainMember(cur)) {
    if (seen.has(cur.id)) break;
    seen.add(cur.id);
    chain.push(cur);
    if (cur.lowerSkillId == null) break;
    const lower = skillById.get(cur.lowerSkillId);
    if (!isChainMember(lower)) break;
    cur = lower;
  }
  chain.reverse();
  return chain;
}

/**
 * 取得コスト（下位未取得想定）。グループ内は根から表示スキルまで合算。
 * 実機: ○ヒントは◎にも適用。金は自身のヒント。
 * @param {object} skill - 表示対象（一覧の行）
 * @param {Map<number, object>} skillById
 * @param {Map<number, { hintLevel: number }>} hintMap
 * @param {boolean} fastLearner
 */
export function calcAcquisitionCost(skill, skillById, hintMap, fastLearner) {
  const chain = getLowerChain(skill, skillById);
  const chainCosts = chain.map((s) =>
    calcSkillCost(
      s.baseSp,
      getEffectiveHintLevel(s, skillById, hintMap),
      fastLearner
    )
  );
  const cost = chainCosts.reduce((a, b) => a + b, 0);
  const includesLower = chain.length > 1;
  const lowerCost = includesLower
    ? chainCosts.slice(0, -1).reduce((a, b) => a + b, 0)
    : undefined;
  const goldOnlyCost = includesLower
    ? chainCosts[chainCosts.length - 1]
    : undefined;

  return {
    cost,
    displaySkillId: skill.id,
    includesLower,
    chainSkillIds: chain.map((s) => s.id),
    chainCosts,
    lowerSkillId: skill.lowerSkillId ?? undefined,
    lowerCost,
    goldOnlyCost,
  };
}

/**
 * ○のみヒント時に rarity1 の直上（◎）へ繰り上げ、上位がある下位行は非表示。
 * 金（rarity2）への自動繰り上げはしない。×からの繰り上げはしない。
 * @param {number[]} skillIds
 * @param {Map<number, object>} skillById
 * @returns {number[]}
 */
export function filterDisplaySkills(skillIds, skillById) {
  const ids = new Set(skillIds);

  for (const id of [...ids]) {
    const s = skillById.get(id);
    if (!s?.upperSkillId || !isChainMember(s)) continue;
    const up = skillById.get(s.upperSkillId);
    if (up && up.rarity === 1 && isChainMember(up)) {
      ids.add(up.id);
    }
  }

  return [...ids].filter((id) => {
    const skill = skillById.get(id);
    if (!skill || !isChainMember(skill)) return true;
    let cur = skill;
    const seen = new Set();
    while (cur?.upperSkillId != null) {
      if (seen.has(cur.id)) break;
      seen.add(cur.id);
      const up = skillById.get(cur.upperSkillId);
      if (!up || !isChainMember(up)) break;
      if (ids.has(cur.upperSkillId)) return false;
      cur = up;
    }
    return true;
  });
}
