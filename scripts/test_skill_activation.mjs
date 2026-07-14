import fs from "node:fs";
import {
  parseSkillActivation,
  parseEffectSlot,
  isSkillCompatible,
  mergeActivations,
  formatActivationTagLabels,
  branchMatchesFilter,
  collectPlanSkillIds,
  getIncompatibleSkillIds,
  applyIncrementalFilterExclusions,
  applyFullFilterExclusions,
  skillFiltersEqual,
} from "../app/js/skillActivation.js";

function assertEq(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
  console.log(`OK ${label}`);
}

function assertTrue(value, label) {
  if (!value) throw new Error(`${label}: expected true`);
  console.log(`OK ${label}`);
}

function assertFalse(value, label) {
  if (value) throw new Error(`${label}: expected false`);
  console.log(`OK ${label}`);
}

// スロット内 AND: precondition & condition
const slotBranches = parseEffectSlot(
  "phase>=2&order_rate<=50",
  "ground_type==2&distance_type==3"
);
assertEq(
  slotBranches,
  [{ grounds: ["dirt"], distances: ["mid"], styles: [] }],
  "precondition+condition AND"
);

// 同一軸 OR
const distOr = parseSkillActivation(
  "",
  "distance_type==1@distance_type==2",
  "",
  ""
);
assertTrue(
  distOr.branches.some(
    (b) => b.distances.length === 1 && b.distances[0] === "short"
  ),
  "distance OR branch short"
);
assertTrue(
  distOr.branches.some(
    (b) => b.distances.length === 1 && b.distances[0] === "mile"
  ),
  "distance OR branch mile"
);

// クロス軸 OR: (芝) @ (ダート & 短) — フラット化バグ回避
const crossOr = parseSkillActivation(
  "",
  "ground_type==1@ground_type==2&distance_type==1",
  "",
  ""
);
assertTrue(
  isSkillCompatible(crossOr, { ground: "turf", distance: "mid" }),
  "芝+中: 芝分岐で互換"
);
assertFalse(
  isSkillCompatible(crossOr, { ground: "dirt", distance: "mid" }),
  "ダート+中: 非互換"
);
assertTrue(
  isSkillCompatible(crossOr, { ground: "dirt", distance: "short" }),
  "ダート+短: 互換"
);

// 制約なし
const universal = parseSkillActivation("", "", "", "");
assertTrue(
  isSkillCompatible(universal, { ground: "turf", distance: "mid", style: "senko" }),
  "制約なしは常に互換"
);

// 作戦のみ
const styleOnly = parseSkillActivation("", "running_style==2", "", "");
assertFalse(
  isSkillCompatible(styleOnly, { style: "nige" }),
  "先行のみ → 逃げで非互換"
);
assertTrue(
  isSkillCompatible(styleOnly, { style: "senko" }),
  "先行のみ → 先行で互換"
);

// 2スロット OR
const twoSlots = parseSkillActivation(
  "",
  "distance_type==3",
  "",
  "distance_type==4"
);
assertTrue(
  isSkillCompatible(twoSlots, { distance: "mid" }),
  "slot1 mid"
);
assertTrue(
  isSkillCompatible(twoSlots, { distance: "long" }),
  "slot2 long"
);
assertFalse(
  isSkillCompatible(twoSlots, { distance: "short" }),
  "short は非互換"
);

// タグ表示
const tags = formatActivationTagLabels({
  grounds: ["dirt"],
  distances: ["mid"],
  styles: ["senko"],
});
assertEq(tags, ["ダート", "中", "先行"], "tag labels");

// チェーン OR マージ
const merged = mergeActivations([
  { branches: [{ grounds: ["turf"], distances: [], styles: [] }], tags: {} },
  { branches: [{ grounds: [], distances: ["short"], styles: [] }], tags: {} },
]);
assertTrue(
  merged.branches.some((b) => b.grounds.includes("turf")),
  "merge turf branch"
);
assertTrue(
  merged.branches.some((b) => b.distances.includes("short")),
  "merge short branch"
);

// 絞込未選択
assertTrue(isSkillCompatible(styleOnly, {}), "filter empty");

// skillFiltersEqual
assertTrue(
  skillFiltersEqual({ ground: "turf", distance: "", style: "nige" }, {
    ground: "turf",
    distance: "",
    style: "nige",
  }),
  "skillFiltersEqual same"
);
assertFalse(
  skillFiltersEqual({ ground: "turf" }, { ground: "dirt" }),
  "skillFiltersEqual diff ground"
);

// collectPlanSkillIds
const sampleRows = [
  { skillId: 1, isInherit: false },
  { skillId: 2, isInherit: false },
  { skillId: null, isInherit: false },
  { skillId: 99, isInherit: true },
];
assertEq(
  [...collectPlanSkillIds(sampleRows)].sort(),
  [1, 2],
  "collectPlanSkillIds"
);

// 増分絞込: 新規 skillId のみ除外
const dirtOnly = parseSkillActivation("", "ground_type==2", "", "");
const skillById = new Map([
  [10, { id: 10, activation: dirtOnly }],
  [20, { id: 20, activation: universal }],
  [30, { id: 30, activation: dirtOnly }],
]);
const excluded = new Set();
const prevIds = new Set([10]);
const rows = [
  { skillId: 10, isInherit: false, chainSkillIds: [10] },
  { skillId: 20, isInherit: false, chainSkillIds: [20] },
  { skillId: 30, isInherit: false, chainSkillIds: [30] },
];
applyIncrementalFilterExclusions(
  excluded,
  rows,
  prevIds,
  { ground: "turf" },
  skillById
);
assertTrue(excluded.has(30), "incremental: new incompatible skill");
assertFalse(excluded.has(20), "incremental: new compatible skill untouched");
assertFalse(excluded.has(10), "incremental: existing skill untouched");

// 増分絞込: 一覧外の除外 ID を prune
excluded.add(999);
applyIncrementalFilterExclusions(
  excluded,
  rows,
  prevIds,
  { ground: "turf" },
  skillById
);
assertFalse(excluded.has(999), "incremental: prune orphan excluded id");

// 全置換絞込
const excludedFull = new Set([1, 2, 3]);
const fullRows = [
  { skillId: 10, isInherit: false, chainSkillIds: [10] },
  { skillId: 20, isInherit: false, chainSkillIds: [20] },
];
applyFullFilterExclusions(
  excludedFull,
  fullRows,
  { ground: "turf" },
  skillById
);
assertEq([...excludedFull].sort(), [10], "full filter: only incompatible ids");

console.log("skillActivation tests passed");

// 実データ spot check
const skills = JSON.parse(fs.readFileSync("./data/skills.json", "utf8"));
const suna = skills.find((s) => s.name === "砂塵慣れ");
const chukyo = skills.find((s) => s.name === "中距離直線○");
if (suna?.activation) {
  assertFalse(
    isSkillCompatible(suna.activation, { ground: "turf" }),
    "砂塵慣れは芝で非互換"
  );
  assertTrue(
    isSkillCompatible(suna.activation, { ground: "dirt" }),
    "砂塵慣れはダートで互換"
  );
}
if (chukyo?.activation) {
  assertTrue(
    isSkillCompatible(chukyo.activation, { distance: "mid" }),
    "中距離直線○は中距離で互換"
  );
  assertFalse(
    isSkillCompatible(chukyo.activation, { distance: "short" }),
    "中距離直線○は短距離で非互換"
  );
}
console.log("skillActivation real-data spot checks passed");
