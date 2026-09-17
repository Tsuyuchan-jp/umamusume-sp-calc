/** ヒントLv別割引率 */
export const HINT_DISCOUNTS = [0, 0.1, 0.2, 0.3, 0.35, 0.4];

/**
 * スキル取得SP（切り捨て）
 * @param {number} baseSp
 * @param {number} hintLevel 0-5
 * @param {boolean|"none"|"studious"|"fast"|number} skillDiscount 状態による追加割引
 */
export function calcSkillCost(baseSp, hintLevel, skillDiscount = false) {
  const lv = Math.max(0, Math.min(5, hintLevel | 0));
  const stateDiscounts = { none: 0, studious: 0.04, fast: 0.1 };
  const specialDiscount =
    typeof skillDiscount === "number"
      ? skillDiscount
      : typeof skillDiscount === "string"
        ? (stateDiscounts[skillDiscount] ?? 0)
        : skillDiscount
          ? 0.1
          : 0;
  const discount = HINT_DISCOUNTS[lv] + specialDiscount;
  return Math.floor(baseSp * Math.max(0, 1 - discount));
}
