/**
 * 結果表の由来種別・並び替え用の純関数群
 */

/** @type {Record<string, string>} */
export const SOURCE_KIND_LABEL = {
  training: "トレヒント",
  owned: "育成ウマ娘",
  event: "イベント",
  scenario: "シナリオ",
  inherit: "継承",
};

/**
 * @param {string} kind
 * @returns {string}
 */
export function formatSourceKindLabel(kind) {
  return SOURCE_KIND_LABEL[kind] || kind;
}

/**
 * 編成枠順マップ（左→右、空枠スキップ後の index）
 * @param {(number|null|undefined)[]} supportIds 長さ6想定
 * @returns {Map<number, number>} supportId → 枠順 index（0始まり）
 */
export function buildSupportOrderMap(supportIds) {
  const map = new Map();
  let order = 0;
  for (const id of supportIds || []) {
    if (id == null) continue;
    const n = Number(id);
    if (!Number.isFinite(n)) continue;
    // 同一 ID が複数枠にあればより左を採用
    if (!map.has(n)) {
      map.set(n, order);
      order += 1;
    }
  }
  return map;
}

/**
 * 由来1件のソートキー [group, slot, sub]
 * group: 0=育成ウマ娘, 1=サポカ, 2=シナリオ, 3=その他
 * sub: 0=トレ, 1=イベント
 * @param {{ kind: string, supportId?: number|null }} src
 * @param {Map<number, number>} supportOrder
 * @returns {[number, number, number]}
 */
export function sourceSortKey(src, supportOrder) {
  if (!src) return [3, 99, 0];
  if (src.kind === "owned") return [0, 0, 0];
  if (src.kind === "scenario") return [2, 0, 0];
  if (src.kind === "inherit") return [3, 0, 0];

  const sid = src.supportId != null ? Number(src.supportId) : NaN;
  const slot =
    Number.isFinite(sid) && supportOrder.has(sid)
      ? supportOrder.get(sid)
      : 99;

  if (src.kind === "training") return [1, slot, 0];
  if (src.kind === "event") return [1, slot, 1];
  return [3, 99, 0];
}

/**
 * 行の代表キー（複数由来は最小＝いちばん早い位置）
 * @param {{ sources?: object[] }} row
 * @param {Map<number, number>} supportOrder
 * @returns {[number, number, number]}
 */
export function rowKindSortKey(row, supportOrder) {
  const sources = row?.sources || [];
  if (!sources.length) return [3, 99, 0];
  let best = sourceSortKey(sources[0], supportOrder);
  for (let i = 1; i < sources.length; i++) {
    const k = sourceSortKey(sources[i], supportOrder);
    if (compareKey(k, best) < 0) best = k;
  }
  return best;
}

/** @param {[number, number, number]} a @param {[number, number, number]} b */
function compareKey(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

/**
 * チェーン由来を kind+label+skillId でユニーク結合（hintLevel は高い方）
 * skillId が違うなら別バッジ（金行で下位／金それぞれのヒントを区別するため）
 * @param {import("./hintResolve.js").SkillSource[]} list
 * @param {import("./hintResolve.js").SkillSource & { skillName?: string, skillId?: number }} src
 */
export function mergeSourceInto(list, src) {
  const existing = list.find(
    (s) =>
      s.kind === src.kind &&
      s.label === src.label &&
      (s.skillId ?? null) === (src.skillId ?? null)
  );
  if (existing) {
    if (src.hintLevel > existing.hintLevel) {
      existing.hintLevel = src.hintLevel;
    }
    if (existing.supportId == null && src.supportId != null) {
      existing.supportId = src.supportId;
    }
    if (!existing.skillName && src.skillName) {
      existing.skillName = src.skillName;
    }
    return;
  }
  const next = {
    kind: src.kind,
    label: src.label,
    hintLevel: src.hintLevel,
  };
  if (src.supportId != null) next.supportId = src.supportId;
  if (src.skillName) next.skillName = src.skillName;
  if (src.skillId != null) next.skillId = src.skillId;
  list.push(next);
}

/**
 * @param {"name"|"kind"|"cost"|"skillId"} mode
 * @param {object[]} rows
 * @param {{ supportIds?: (number|null)[] }} [opts]
 * @returns {object[]}
 */
export function sortPlanRows(rows, mode = "name", opts = {}) {
  const normal = [];
  const inherit = [];
  for (const row of rows) {
    if (row.isInherit) inherit.push(row);
    else normal.push(row);
  }

  const byName = (a, b) => a.name.localeCompare(b.name, "ja");
  const bySkillId = (a, b) => {
    const ia = Number(a.skillId) || 0;
    const ib = Number(b.skillId) || 0;
    if (ia !== ib) return ia - ib;
    return byName(a, b);
  };

  if (mode === "kind") {
    const supportOrder = buildSupportOrderMap(opts.supportIds || []);
    normal.sort((a, b) => {
      const cmp = compareKey(
        rowKindSortKey(a, supportOrder),
        rowKindSortKey(b, supportOrder)
      );
      if (cmp !== 0) return cmp;
      return bySkillId(a, b);
    });
  } else if (mode === "cost") {
    normal.sort((a, b) => {
      const ca = Number(a.cost) || 0;
      const cb = Number(b.cost) || 0;
      if (ca !== cb) return cb - ca;
      return bySkillId(a, b);
    });
  } else if (mode === "skillId") {
    normal.sort(bySkillId);
  } else {
    normal.sort(byName);
  }

  return [...normal, ...inherit];
}
