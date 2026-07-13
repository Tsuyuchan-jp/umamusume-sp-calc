/** ヒントLv別割引率 */
export const HINT_DISCOUNTS = [0, 0.1, 0.2, 0.3, 0.35, 0.4];

/**
 * スキル取得SP（切り捨て）
 * @param {number} baseSp
 * @param {number} hintLevel 0-5
 * @param {boolean} fastLearner 切れ者
 */
export function calcSkillCost(baseSp, hintLevel, fastLearner = false) {
  const lv = Math.max(0, Math.min(5, hintLevel | 0));
  const discount = HINT_DISCOUNTS[lv] + (fastLearner ? 0.1 : 0);
  return Math.floor(baseSp * Math.max(0, 1 - discount));
}
