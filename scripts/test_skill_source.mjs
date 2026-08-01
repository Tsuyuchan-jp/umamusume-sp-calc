import {
  formatSourceKindLabel,
  getPrimarySourceKind,
  mergeSourceInto,
  sortPlanRows,
} from "../app/js/skillSource.js";
import { resolveHintLevels } from "../app/js/hintResolve.js";

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
assertEq(formatSourceKindLabel("owned"), "所持", "種別ラベル 所持");

assertEq(
  getPrimarySourceKind([
    { kind: "event", label: "A", hintLevel: 3 },
    { kind: "training", label: "B", hintLevel: 5 },
  ]),
  "training",
  "代表種別は優先順がいちばん高いもの"
);

const merged = [];
mergeSourceInto(merged, { kind: "training", label: "たづな", hintLevel: 3 });
mergeSourceInto(merged, { kind: "training", label: "たづな", hintLevel: 5 });
mergeSourceInto(merged, { kind: "event", label: "X", hintLevel: 2 });
assertEq(merged.length, 2, "kind+label でユニーク");
assertEq(merged[0].hintLevel, 5, "同一由来は高い Lv を残す");

const map = resolveHintLevels([
  { skillId: 1, hintLevel: 3, kind: "owned", label: "ウマ娘A" },
  { skillId: 1, hintLevel: 5, kind: "training", label: "サポカB" },
  { skillId: 1, hintLevel: 5, kind: "training", label: "サポカB" },
]);
const entry = map.get(1);
assertEq(entry.hintLevel, 5, "hintResolve max");
assertEq(entry.sources.length, 2, "hintResolve sources 件数");
assertTruthy(
  entry.sources.some((s) => s.kind === "training" && s.label === "サポカB"),
  "hintResolve にトレヒント由来"
);

const rows = [
  {
    name: "あ",
    cost: 100,
    sources: [{ kind: "event", label: "E", hintLevel: 2 }],
  },
  {
    name: "い",
    cost: 300,
    sources: [{ kind: "training", label: "T", hintLevel: 5 }],
  },
  {
    name: "う",
    cost: 200,
    sources: [{ kind: "owned", label: "O", hintLevel: 3 }],
  },
  {
    name: "継承固有 × 2",
    cost: 400,
    isInherit: true,
    sources: [{ kind: "inherit", label: "汎用", hintLevel: 1 }],
  },
];

const byName = sortPlanRows(rows, "name");
assertEq(byName.map((r) => r.name).join(","), "あ,い,う,継承固有 × 2", "名前順＋継承末尾");

const byKind = sortPlanRows(rows, "kind");
assertEq(
  byKind.map((r) => r.name).join(","),
  "い,う,あ,継承固有 × 2",
  "由来種別順（トレ→所持→イベント）＋継承末尾"
);

const byCost = sortPlanRows(rows, "cost");
assertEq(
  byCost.map((r) => r.name).join(","),
  "い,う,あ,継承固有 × 2",
  "必要SP降順＋継承末尾"
);

console.log("skillSource / hintResolve tests passed");
