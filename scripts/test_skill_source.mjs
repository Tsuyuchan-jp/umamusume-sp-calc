import {
  formatSourceKindLabel,
  mergeSourceInto,
  rowKindSortKey,
  buildSupportOrderMap,
  sortPlanRows,
} from "../app/js/skillSource.js";
import { resolveHintLevels } from "../app/js/hintResolve.js";
import {
  formatTrainingSourceLabel,
  formatEventLabel,
  stripEventNamePrefix,
} from "../app/js/supportShortName.js";

function assertEq(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
  console.log(`OK ${label}`);
}

function assertTruthy(v, label) {
  if (!v) throw new Error(`${label}: expected truthy`);
  console.log(`OK ${label}`);
}

assertEq(formatSourceKindLabel("training"), "トレヒント", "種別ラベル トレヒント");
assertEq(formatSourceKindLabel("owned"), "育成ウマ娘", "種別ラベル 育成ウマ娘");

assertEq(
  formatTrainingSourceLabel({
    type: "speed",
    title: "刀光散らしてClash！",
    characterName: "タップダンスシチー",
  }),
  "スピタップ",
  "トレヒント略称 スピタップ"
);
assertEq(
  formatTrainingSourceLabel({
    type: "friend",
    title: "一杯のノスタルジア",
    characterName: "駿川たづな",
  }),
  "友人たづな",
  "トレヒント略称 友人たづな"
);

assertEq(
  formatEventLabel("刀光散らしてClash！", "心のカギは", "speed"),
  "スピタップ 心のカギは",
  "イベント label スピタップ"
);
assertEq(
  formatEventLabel("その執念は怒濤が如く", "スタドトウ 覇王と共に歩む道", "stamina"),
  "スタドトウ 覇王と共に歩む道",
  "イベント label 冪等"
);
assertEq(
  stripEventNamePrefix("友人たづな クラシック正月", "一杯のノスタルジア", "friend"),
  "クラシック正月",
  "イベント名のプレフィックス除去"
);

const merged = [];
mergeSourceInto(merged, {
  kind: "training",
  label: "たづな",
  hintLevel: 3,
  supportId: 10,
});
mergeSourceInto(merged, {
  kind: "training",
  label: "たづな",
  hintLevel: 5,
  supportId: 10,
});
mergeSourceInto(merged, { kind: "event", label: "X", hintLevel: 2, supportId: 10 });
assertEq(merged.length, 2, "kind+label でユニーク");
assertEq(merged[0].hintLevel, 5, "同一由来は高い Lv を残す");
assertEq(merged[0].supportId, 10, "supportId を保持");

const map = resolveHintLevels([
  { skillId: 1, hintLevel: 3, kind: "owned", label: "ウマ娘A" },
  {
    skillId: 1,
    hintLevel: 5,
    kind: "training",
    label: "サポカB",
    supportId: 99,
  },
  {
    skillId: 1,
    hintLevel: 5,
    kind: "training",
    label: "サポカB",
    supportId: 99,
  },
]);
const entry = map.get(1);
assertEq(entry.hintLevel, 5, "hintResolve max");
assertEq(entry.sources.length, 2, "hintResolve sources 件数");
assertTruthy(
  entry.sources.some(
    (s) => s.kind === "training" && s.label === "サポカB" && s.supportId === 99
  ),
  "hintResolve にトレヒント由来+supportId"
);

const supportIds = [11, 22, null, null, null, null];
const order = buildSupportOrderMap(supportIds);
assertEq(order.get(11), 0, "枠順 左が0");
assertEq(order.get(22), 1, "枠順 次が1");

assertEq(
  rowKindSortKey(
    { sources: [{ kind: "owned", label: "C", hintLevel: 3 }] },
    order
  ).join(","),
  "0,0,0",
  "育成ウマ娘キー"
);
assertEq(
  rowKindSortKey(
    {
      sources: [
        { kind: "event", label: "E2", hintLevel: 2, supportId: 22 },
        { kind: "training", label: "T1", hintLevel: 5, supportId: 11 },
      ],
    },
    order
  ).join(","),
  "1,0,0",
  "複数由来は最小キー（枠1トレ）"
);

const rows = [
  {
    name: "あ",
    skillId: 300,
    cost: 100,
    sources: [{ kind: "event", label: "E1", hintLevel: 2, supportId: 11 }],
  },
  {
    name: "い",
    skillId: 100,
    cost: 300,
    sources: [{ kind: "training", label: "T2", hintLevel: 5, supportId: 22 }],
  },
  {
    name: "う",
    skillId: 200,
    cost: 200,
    sources: [{ kind: "owned", label: "O", hintLevel: 3 }],
  },
  {
    name: "え",
    skillId: 150,
    cost: 50,
    sources: [{ kind: "training", label: "T1", hintLevel: 5, supportId: 11 }],
  },
  {
    name: "お",
    skillId: 250,
    cost: 80,
    sources: [{ kind: "scenario", label: "S", hintLevel: 1 }],
  },
  {
    name: "継承固有 × 2",
    cost: 400,
    isInherit: true,
    sources: [{ kind: "inherit", label: "汎用", hintLevel: 1 }],
  },
];

const byName = sortPlanRows(rows, "name");
assertEq(
  byName.map((r) => r.name).join(","),
  "あ,い,う,え,お,継承固有 × 2",
  "名前順＋継承末尾"
);

const byKind = sortPlanRows(rows, "kind", { supportIds });
assertEq(
  byKind.map((r) => r.name).join(","),
  "う,え,あ,い,お,継承固有 × 2",
  "由来種別（育成→枠1トレ→枠1イベ→枠2トレ→シナリオ）＋継承末尾"
);

const byCost = sortPlanRows(rows, "cost");
assertEq(
  byCost.map((r) => r.name).join(","),
  "い,う,あ,お,え,継承固有 × 2",
  "必要SP降順＋継承末尾"
);

const byId = sortPlanRows(rows, "skillId");
assertEq(
  byId.map((r) => r.name).join(","),
  "い,え,う,お,あ,継承固有 × 2",
  "スキルID昇順＋継承末尾"
);

console.log("skillSource / hintResolve tests passed");
