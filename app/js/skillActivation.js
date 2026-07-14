/** 馬場・距離・作戦の発動条件タグと絞込マッチ */

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
 * @param {number} skillId
 * @param {number[]} chainSkillIds
 * @param {Map<number, object>} skillById
 */
export function getDisplayActivation(skillId, chainSkillIds, skillById) {
  const ids = chainSkillIds?.length ? chainSkillIds : [skillId];
  const activations = ids
    .map((id) => skillById.get(id)?.activation)
    .filter(Boolean);
  if (activations.length === 0) {
    return { branches: [emptyBranch()], tags: emptyBranch() };
  }
  return mergeActivations(activations);
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
