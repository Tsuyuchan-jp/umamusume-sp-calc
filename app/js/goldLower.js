import { calcSkillCost } from "./spCost.js";

/**
 * グループ内の最下位スキル（○ / 白）まで辿る
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
    if (!lower) break;
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

  // rarity 1: ルートから白帯が続く間のヒントの max
  const root = getChainRoot(skill, skillById);
  let maxLv = 0;
  let cur = root;
  const seen = new Set();
  while (cur && cur.rarity === 1) {
    if (seen.has(cur.id)) break;
    seen.add(cur.id);
    const lv = hintMap.get(cur.id)?.hintLevel ?? 0;
    if (lv > maxLv) maxLv = lv;
    if (cur.upperSkillId == null) break;
    const up = skillById.get(cur.upperSkillId);
    if (!up || up.rarity !== 1) break;
    cur = up;
  }
  return maxLv;
}

/**
 * skill 以下（自身含む）の下位チェーンを根→自身の順で返す
 * @param {object} skill
 * @param {Map<number, object>} skillById
 */
export function getLowerChain(skill, skillById) {
  const chain = [];
  let cur = skill;
  const seen = new Set();
  while (cur) {
    if (seen.has(cur.id)) break;
    seen.add(cur.id);
    chain.push(cur);
    if (cur.lowerSkillId == null) break;
    cur = skillById.get(cur.lowerSkillId);
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
 * 金（rarity2）への自動繰り上げはしない。
 * @param {number[]} skillIds
 * @param {Map<number, object>} skillById
 * @returns {number[]}
 */
export function filterDisplaySkills(skillIds, skillById) {
  const ids = new Set(skillIds);

  // ○ → ◎ のみ自動追加（直上かつ rarity 1）
  for (const id of [...ids]) {
    const s = skillById.get(id);
    if (!s?.upperSkillId) continue;
    const up = skillById.get(s.upperSkillId);
    if (up && up.rarity === 1) {
      ids.add(up.id);
    }
  }

  // グループ内により上位が計画にある行は隠す
  return [...ids].filter((id) => {
    let cur = skillById.get(id);
    const seen = new Set();
    while (cur?.upperSkillId != null) {
      if (seen.has(cur.id)) break;
      seen.add(cur.id);
      if (ids.has(cur.upperSkillId)) return false;
      cur = skillById.get(cur.upperSkillId);
    }
    return true;
  });
}
