/**
 * 結果表の由来種別・並び替え用の純関数群
 */

/** @type {Record<string, string>} */
export const SOURCE_KIND_LABEL = {
  training: "トレヒント",
  owned: "所持",
  event: "イベント",
  scenario: "シナリオ",
  inherit: "継承",
};

/** 由来種別ソートの優先順（小さいほど先） */
export const SOURCE_KIND_ORDER = {
  training: 0,
  owned: 1,
  event: 2,
  scenario: 3,
  inherit: 4,
};

/**
 * @param {string} kind
 * @returns {string}
 */
export function formatSourceKindLabel(kind) {
  return SOURCE_KIND_LABEL[kind] || kind;
}

/**
 * 行の「代表種別」（優先順がいちばん高い＝数値が小さい kind）
 * @param {{ kind: string }[]} sources
 * @returns {string}
 */
export function getPrimarySourceKind(sources) {
  if (!sources?.length) return "inherit";
  let best = sources[0].kind;
  let bestOrder = SOURCE_KIND_ORDER[best] ?? 99;
  for (let i = 1; i < sources.length; i++) {
    const kind = sources[i].kind;
    const order = SOURCE_KIND_ORDER[kind] ?? 99;
    if (order < bestOrder) {
      best = kind;
      bestOrder = order;
    }
  }
  return best;
}

/**
 * チェーン由来を kind+label でユニーク結合（hintLevel は高い方）
 * @param {import("./hintResolve.js").SkillSource[]} list
 * @param {import("./hintResolve.js").SkillSource} src
 */
export function mergeSourceInto(list, src) {
  const existing = list.find(
    (s) => s.kind === src.kind && s.label === src.label
  );
  if (existing) {
    if (src.hintLevel > existing.hintLevel) {
      existing.hintLevel = src.hintLevel;
    }
    return;
  }
  list.push({
    kind: src.kind,
    label: src.label,
    hintLevel: src.hintLevel,
  });
}

/**
 * @param {"name"|"kind"|"cost"} mode
 * @param {object[]} rows
 * @returns {object[]}
 */
export function sortPlanRows(rows, mode = "name") {
  const normal = [];
  const inherit = [];
  for (const row of rows) {
    if (row.isInherit) inherit.push(row);
    else normal.push(row);
  }

  const byName = (a, b) => a.name.localeCompare(b.name, "ja");

  if (mode === "kind") {
    normal.sort((a, b) => {
      const ka = SOURCE_KIND_ORDER[getPrimarySourceKind(a.sources)] ?? 99;
      const kb = SOURCE_KIND_ORDER[getPrimarySourceKind(b.sources)] ?? 99;
      if (ka !== kb) return ka - kb;
      return byName(a, b);
    });
  } else if (mode === "cost") {
    normal.sort((a, b) => {
      const ca = Number(a.cost) || 0;
      const cb = Number(b.cost) || 0;
      if (ca !== cb) return cb - ca;
      return byName(a, b);
    });
  } else {
    normal.sort(byName);
  }

  return [...normal, ...inherit];
}
