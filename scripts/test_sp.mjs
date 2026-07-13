import { calcSkillCost } from "../app/js/spCost.js";
import { calcAcquisitionCost } from "../app/js/goldLower.js";

function assertEq(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
  console.log(`OK ${label}: ${actual}`);
}

// ヒント割引
assertEq(calcSkillCost(170, 0), 170, "Lv0");
assertEq(calcSkillCost(170, 1), 153, "Lv1");
assertEq(calcSkillCost(170, 2), 136, "Lv2");
assertEq(calcSkillCost(170, 5), 102, "Lv5");
assertEq(calcSkillCost(170, 5, true), 85, "Lv5+切れ者");

// 実機検証: 強者の証 Lv2 + さらなる高みへ Lv0
const white = { id: 1, baseSp: 170, lowerSkillId: null, upperSkillId: 2 };
const gold = { id: 2, baseSp: 170, lowerSkillId: 1, upperSkillId: null };
const byId = new Map([
  [1, white],
  [2, gold],
]);
const hintMap = new Map([
  [1, { hintLevel: 0 }],
  [2, { hintLevel: 2 }],
]);
const acq = calcAcquisitionCost(gold, byId, hintMap, false);
assertEq(acq.cost, 306, "金直接購入B");
assertEq(acq.lowerCost, 170, "下位A");
assertEq(acq.goldOnlyCost, 136, "金のみC");

console.log("全テスト通過");
