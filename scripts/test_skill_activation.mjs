import fs from "node:fs";
import {
  parseSkillActivation,
  parseEffectSlot,
  isSkillCompatible,
  mergeActivations,
  formatActivationTagLabels,
  branchMatchesFilter,
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
