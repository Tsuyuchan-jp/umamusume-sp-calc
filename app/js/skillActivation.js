/** バ場・距離・作戦の発動条件タグと絞込マッチ */

const GROUND_MAP = { 1: "turf", 2: "dirt" };
const DISTANCE_MAP = { 1: "short", 2: "mile", 3: "mid", 4: "long" };
const STYLE_MAP = { 1: "nige", 2: "senko", 3: "sashi", 4: "oikomi" };

const KEY_TO_AXIS = {
  ground_type: "grounds",
  distance_type: "distances",
  running_style: "styles",
};

const AXIS_ORDER = {
  grounds: ["turf", "dirt"],
  distances: ["short", "mile", "mid", "long"],
  styles: ["nige", "senko", "sashi", "oikomi"],
};

export const GROUND_LABELS = { turf: "芝", dirt: "ダート" };
export const DISTANCE_LABELS = {
  short: "短",
  mile: "マイル",
  mid: "中",
  long: "長",
};
export const STYLE_LABELS = {
  nige: "逃げ",
  senko: "先行",
  sashi: "差し",
  oikomi: "追込",
};

/** @typedef {{ grounds?: string[], distances?: string[], styles?: string[] }} ActivationBranch */
/** @typedef {{ branches: ActivationBranch[], tags: ActivationBranch }} SkillActivation */

function emptyBranch() {
  return { grounds: [], distances: [], styles: [] };
}

function mapConditionValue(key, value) {
  if (key === "ground_type") return GROUND_MAP[value] ?? null;
  if (key === "distance_type") return DISTANCE_MAP[value] ?? null;
  if (key === "running_style") return STYLE_MAP[value] ?? null;
  return null;
}

/**
 * AND 分岐1本をパース（== のみ・対象キーのみ）
 * @param {string} branchStr
 * @returns {ActivationBranch}
 */
export function parseAndBranch(branchStr) {
  const branch = emptyBranch();
  if (!branchStr?.trim()) return branch;

  for (const part of branchStr.split("&")) {
    const trimmed = part.trim();
    const m = trimmed.match(/^([a-z_]+)==(\d+)$/);
    if (!m) continue;
    const axis = KEY_TO_AXIS[m[1]];
    if (!axis) continue;
    const mapped = mapConditionValue(m[1], Number(m[2]));
    if (mapped && !branch[axis].includes(mapped)) {
      branch[axis].push(mapped);
    }
  }
  return branch;
}

/**
 * 条件文字列を OR 分岐配列へ
 * @param {string} expr
 * @returns {ActivationBranch[]}
 */
export function parseOrBranches(expr) {
  if (!expr?.trim()) return [emptyBranch()];
  return expr.split("@").map((part) => parseAndBranch(part));
}

/**
 * 2分岐を AND 結合（同一軸は和集合）
 * @param {ActivationBranch} a
 * @param {ActivationBranch} b
 */
export function andBranches(a, b) {
  const out = emptyBranch();
  for (const axis of ["grounds", "distances", "styles"]) {
    out[axis] = [...new Set([...(a[axis] || []), ...(b[axis] || [])])];
  }
  return out;
}

/**
 * 効果スロット内: precondition & condition
 * @param {string|null|undefined} precondition
 * @param {string|null|undefined} condition
 */
export function parseEffectSlot(precondition, condition) {
  const hasPre = Boolean(precondition?.trim());
  const hasCond = Boolean(condition?.trim());
  if (!hasPre && !hasCond) return [];

  const preBranches = hasPre ? parseOrBranches(precondition) : [emptyBranch()];
  const condBranches = hasCond ? parseOrBranches(condition) : [emptyBranch()];
  const merged = [];
  for (const p of preBranches) {
    for (const c of condBranches) {
      merged.push(andBranches(p, c));
    }
  }
  return merged;
}

function branchKey(branch) {
  const parts = ["grounds", "distances", "styles"].map((axis) => {
    const vals = [...(branch[axis] || [])].sort();
    return `${axis}:${vals.join(",")}`;
  });
  return parts.join("|");
}

function dedupeBranches(branches) {
  const seen = new Set();
  const out = [];
  for (const b of branches) {
    const key = branchKey(b);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(b);
  }
  return out;
}

function sortAxisValues(axis, values) {
  const order = AXIS_ORDER[axis] || [];
  return [...values].sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

/**
 * 分岐配列から表示用 tags を生成
 * @param {ActivationBranch[]} branches
 */
export function branchesToTags(branches) {
  const tags = emptyBranch();
  for (const b of branches) {
    for (const axis of ["grounds", "distances", "styles"]) {
      for (const v of b[axis] || []) {
        if (!tags[axis].includes(v)) tags[axis].push(v);
      }
    }
  }
  for (const axis of ["grounds", "distances", "styles"]) {
    tags[axis] = sortAxisValues(axis, tags[axis]);
  }
  return tags;
}

/**
 * skill_data の4条件文字列から activation を生成
 * @param {string} precondition1
 * @param {string} condition1
 * @param {string} precondition2
 * @param {string} condition2
 * @returns {SkillActivation}
 */
export function parseSkillActivation(
  precondition1,
  condition1,
  precondition2,
  condition2
) {
  let branches = [];
  for (const [pre, cond] of [
    [precondition1, condition1],
    [precondition2, condition2],
  ]) {
    branches.push(...parseEffectSlot(pre, cond));
  }

  if (branches.length === 0) {
    return { branches: [emptyBranch()], tags: emptyBranch() };
  }

  branches = dedupeBranches(branches);
  return { branches, tags: branchesToTags(branches) };
}

/**
 * 複数 activation を OR 結合（チェーン合算行用）
 * @param {SkillActivation[]} activations
 */
export function mergeActivations(activations) {
  let branches = [];
  for (const act of activations) {
    if (!act?.branches?.length) continue;
    branches.push(...act.branches);
  }
  if (branches.length === 0) {
    return { branches: [emptyBranch()], tags: emptyBranch() };
  }
  branches = dedupeBranches(branches);
  return { branches, tags: branchesToTags(branches) };
}

/**
 * 表示行（最上段 skillId）の activation のみ。レギュ互換・条件バッジ用。
 * チェーン下位は OR 結合しない（白「シンパシー」等で金行のレギュが緩まない）。
 * @param {number} skillId
 * @param {number[]} [_chainSkillIds] 互換のため残す（未使用）
 * @param {Map<number, object>} skillById
 */
export function getDisplayActivation(skillId, _chainSkillIds, skillById) {
  const skill = skillById.get(skillId);
  if (!skill?.activation) {
    return { branches: [emptyBranch()], tags: emptyBranch() };
  }
  return skill.activation;
}

/**
 * 1分岐が絞込と互換か
 * @param {ActivationBranch} branch
 * @param {{ ground?: string, distance?: string, style?: string }} filter
 */
export function branchMatchesFilter(branch, filter) {
  if (filter.ground && branch.grounds?.length && !branch.grounds.includes(filter.ground)) {
    return false;
  }
  if (
    filter.distance &&
    branch.distances?.length &&
    !branch.distances.includes(filter.distance)
  ) {
    return false;
  }
  if (filter.style && branch.styles?.length && !branch.styles.includes(filter.style)) {
    return false;
  }
  return true;
}

/**
 * @param {SkillActivation} activation
 * @param {{ ground?: string, distance?: string, style?: string }} filter
 */
export function isSkillCompatible(activation, filter) {
  const active =
    Boolean(filter.ground) || Boolean(filter.distance) || Boolean(filter.style);
  if (!active) return true;

  const branches = activation?.branches?.length
    ? activation.branches
    : [emptyBranch()];

  return branches.some((branch) => branchMatchesFilter(branch, filter));
}

/**
 * バッジ表示用ラベル
 * @param {ActivationBranch} tags
 * @returns {string[]}
 */
export function formatActivationTagLabels(tags) {
  if (!tags) return [];
  const labels = [];
  for (const g of tags.grounds || []) {
    if (GROUND_LABELS[g]) labels.push(GROUND_LABELS[g]);
  }
  for (const d of tags.distances || []) {
    if (DISTANCE_LABELS[d]) labels.push(DISTANCE_LABELS[d]);
  }
  for (const s of tags.styles || []) {
    if (STYLE_LABELS[s]) labels.push(STYLE_LABELS[s]);
  }
  return labels;
}

/** 制約タグが1つも無いか */
export function hasActivationConstraints(tags) {
  if (!tags) return false;
  return (
    (tags.grounds?.length ?? 0) > 0 ||
    (tags.distances?.length ?? 0) > 0 ||
    (tags.styles?.length ?? 0) > 0
  );
}

/** 絞込が有効か */
export function isSkillFilterActive(filter) {
  return Boolean(filter.ground || filter.distance || filter.style);
}

/** 絞込状態が同一か */
export function skillFiltersEqual(a, b) {
  return (
    (a.ground || "") === (b.ground || "") &&
    (a.distance || "") === (b.distance || "") &&
    (a.style || "") === (b.style || "")
  );
}

/** plan 行から skillId 集合（継承固有除く） */
export function collectPlanSkillIds(rows) {
  const ids = new Set();
  for (const row of rows) {
    if (!row.isInherit && row.skillId != null) ids.add(row.skillId);
  }
  return ids;
}

/**
 * 絞込で非互換な skillId
 * @param {object[]} rows
 * @param {{ ground?: string, distance?: string, style?: string }} filter
 * @param {Map<number, object>} skillById
 */
export function getIncompatibleSkillIds(rows, filter, skillById) {
  const out = new Set();
  if (!isSkillFilterActive(filter)) return out;

  for (const row of rows) {
    if (row.isInherit || row.skillId == null) continue;
    const activation = getDisplayActivation(
      row.skillId,
      row.chainSkillIds || [row.skillId],
      skillById
    );
    if (!isSkillCompatible(activation, filter)) {
      out.add(row.skillId);
    }
  }
  return out;
}

/**
 * 手動除外から一覧に無い skillId を除去
 * @param {Set<number>} manualExcluded
 * @param {object[]} rows
 * @returns {Set<number>} 現在の skillId 集合
 */
export function pruneManualExclusions(manualExcluded, rows) {
  const currentIds = collectPlanSkillIds(rows);
  for (const sid of [...manualExcluded]) {
    if (!currentIds.has(sid)) manualExcluded.delete(sid);
  }
  return currentIds;
}

/**
 * 表示・合計用の除外 = 手動 ∪ レギュ非互換
 * @param {Set<number>} manualExcluded
 * @param {object[]} rows
 * @param {{ ground?: string, distance?: string, style?: string }} filter
 * @param {Map<number, object>} skillById
 * @returns {Set<number>}
 */
export function getEffectiveExcludedSkillIds(
  manualExcluded,
  rows,
  filter,
  skillById
) {
  const effective = new Set(manualExcluded);
  for (const sid of getIncompatibleSkillIds(rows, filter, skillById)) {
    effective.add(sid);
  }
  return effective;
}

/**
 * 一覧外の除外 ID を掃除し、新規 skillId にのみ絞込除外を加算
 * @deprecated 手動／レギュ合成モデルでは getEffectiveExcludedSkillIds を使用
 * @param {Set<number>} excludedSkillIds
 * @param {object[]} rows
 * @param {Set<number>} previousSkillIds
 * @param {{ ground?: string, distance?: string, style?: string }} filter
 * @param {Map<number, object>} skillById
 * @returns {Set<number>} 現在の skillId 集合
 */
export function applyIncrementalFilterExclusions(
  excludedSkillIds,
  rows,
  previousSkillIds,
  filter,
  skillById
) {
  const currentIds = collectPlanSkillIds(rows);
  for (const sid of [...excludedSkillIds]) {
    if (!currentIds.has(sid)) excludedSkillIds.delete(sid);
  }
  if (!isSkillFilterActive(filter)) return currentIds;

  for (const row of rows) {
    if (row.isInherit || row.skillId == null) continue;
    if (previousSkillIds.has(row.skillId)) continue;
    const activation = getDisplayActivation(
      row.skillId,
      row.chainSkillIds || [row.skillId],
      skillById
    );
    if (!isSkillCompatible(activation, filter)) {
      excludedSkillIds.add(row.skillId);
    }
  }
  return currentIds;
}

/**
 * 確定済み絞込に基づき excludedSkillIds を全置換
 * @param {Set<number>} excludedSkillIds
 * @param {object[]} rows
 * @param {{ ground?: string, distance?: string, style?: string }} filter
 * @param {Map<number, object>} skillById
 */
export function applyFullFilterExclusions(excludedSkillIds, rows, filter, skillById) {
  excludedSkillIds.clear();
  for (const sid of getIncompatibleSkillIds(rows, filter, skillById)) {
    excludedSkillIds.add(sid);
  }
}
