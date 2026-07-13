import fs from "node:fs";
import { calcSkillCost } from "../app/js/spCost.js";
import { calcAcquisitionCost } from "../app/js/goldLower.js";
import { buildSkillPlan } from "../app/js/aggregate.js";
import {
  getDeckLinkCharacterIds,
  resolveLinkSkill,
} from "../app/js/scenarioLink.js";

function assertEq(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
  console.log(`OK ${label}: ${actual}`);
}

function assertTruthy(value, label) {
  if (!value) throw new Error(`${label}: expected truthy, got ${value}`);
  console.log(`OK ${label}`);
}

function assertFalsy(value, label) {
  if (value) throw new Error(`${label}: expected falsy, got ${value}`);
  console.log(`OK ${label}`);
}

// --- コスト式 ---
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

// --- 実データ統合テスト ---
const skills = JSON.parse(fs.readFileSync("./data/skills.json", "utf8"));
const supports = JSON.parse(fs.readFileSync("./data/supports.json", "utf8"));
const characters = JSON.parse(fs.readFileSync("./data/characters.json", "utf8"));
const events = JSON.parse(fs.readFileSync("./data/events.json", "utf8"));
const scenario = JSON.parse(fs.readFileSync("./data/scenarios/toresenken.json", "utf8"));

const top = characters.find((c) => c.name === "[万福龍湯伝・頂]ナリタトップロード");
const young = supports.find((s) => s.title === "Innovator");
const tazuna = supports.find((s) => s.title === "一杯のノスタルジア");
const dotou = supports.find((s) => s.name.includes("その執念は怒濤が如く"));

assertTruthy(top, "デフォルト育成ウマ娘");
assertTruthy(young, "デフォルト ヤング");
assertTruthy(tazuna, "デフォルト たづな");
assertTruthy(dotou, "ドトウサポカ");

function defaultEventChoices() {
  return Object.fromEntries(
    (events.events || [])
      .filter((e) => e.selection === "single")
      .map((e) => [e.id, e.defaultChoiceId ?? "none"])
  );
}

function makePlan(supportIds) {
  return buildSkillPlan({
    skills,
    supports,
    characters,
    events,
    scenario,
    characterId: top.id,
    supportIds,
    excludedSkillIds: new Set(),
    fastLearner: false,
    inheritEnabled: false,
    inheritCount: 4,
    inheritHintLevel: 3,
    inheritBaseSp: 200,
    enabledEventIds: new Set(),
    eventChoiceIds: defaultEventChoices(),
    enabledScenarioEntryIds: new Set(["link_dotou"]),
    seniorRmjChoiceId: "ramen_yokubari",
  });
}

const defaultPlan = makePlan([young.id, tazuna.id]);
assertEq(defaultPlan.unresolved.length, 0, "デフォルト未解決スキル");
assertEq(defaultPlan.total, 4173, "デフォルト合計SP");

const jichu = defaultPlan.rows.find((r) => r.name === "時中の妙");
assertTruthy(jichu, "時中の妙が結果に含まれる");
assertEq(jichu.cost, 256, "時中の妙 cost");
assertEq(jichu.includesLower, true, "時中の妙 includesLower");
assertFalsy(defaultPlan.rows.find((r) => r.name === "中盤巧者"), "中盤巧者は金行に統合され非表示");

// 下位由来が金行に併記される
assertTruthy(
  jichu.sources.some((s) => s.includes("たづな")),
  "時中の妙に下位（たづな）由来が併記"
);

const ore = defaultPlan.rows.find((r) => r.name === "折れない心");
assertTruthy(ore, "デフォルトリンクは折れない心（白）");
assertEq(ore.cost, 162, "折れない心 cost");
assertFalsy(defaultPlan.rows.find((r) => r.name === "ネバーギブアップ"), "ネバーギブアップは非表示");

// ドトウ編成でリンク金に切替
const dotouPlan = makePlan([dotou.id, young.id, tazuna.id]);
const never = dotouPlan.rows.find((r) => r.name === "ネバーギブアップ");
assertTruthy(never, "ドトウ編成でネバーギブアップ");
assertEq(never.cost, 342, "ネバーギブアップ cost");
assertEq(never.includesLower, true, "ネバーギブアップ includesLower");
assertFalsy(dotouPlan.rows.find((r) => r.name === "折れない心"), "折れない心は非表示");

// scenarioLink 単体
const supportById = new Map(supports.map((s) => [s.id, s]));
const deckIds = getDeckLinkCharacterIds(top.id, [young.id, tazuna.id], supportById);
const linkDotou = scenario.linkSkills.find((e) => e.id === "link_dotou");
assertEq(resolveLinkSkill(linkDotou, deckIds).skillName, "折れない心", "リンク白解決");

const deckWithDotou = getDeckLinkCharacterIds(top.id, [dotou.id, young.id, tazuna.id], supportById);
assertEq(
  resolveLinkSkill(linkDotou, deckWithDotou).skillName,
  "ネバーギブアップ",
  "リンク金解決"
);

console.log("全テスト通過");
