/**
 * 1設計（編成バリアント）の永続化境界。
 * メモリ／スクショはこの形を保存・復元する。
 */

/**
 * @param {Map|object} value
 * @returns {object}
 */
function toPlainEventChoiceIds(value) {
  if (value instanceof Map) return Object.fromEntries(value);
  return { ...(value || {}) };
}

/**
 * @param {object} value
 * @returns {Map<string, string>}
 */
function toEventChoiceMap(value) {
  return new Map(Object.entries(value || {}));
}

/**
 * @param {object} params
 * @param {object} params.ui - app の state.ui
 * @param {object} params.options - 切れ者・継承・トレヒント等
 * @param {Set<number>|number[]} params.excludedSkillIds
 * @param {object} params.committedSkillFilter
 */
export function captureDesignSnapshot({
  ui,
  options,
  excludedSkillIds,
  committedSkillFilter,
}) {
  return {
    version: 1,
    characterId: ui.characterId,
    supportIds: [...ui.supportIds],
    enabledEventIds: [...ui.enabledEventIds],
    eventChoiceIds: toPlainEventChoiceIds(ui.eventChoiceIds),
    scenarioLinkChoiceId: ui.scenarioLinkChoiceId,
    seniorRmjChoiceId: ui.seniorRmjChoiceId,
    options: { ...options },
    excludedSkillIds: [...excludedSkillIds],
    committedSkillFilter: { ...committedSkillFilter },
  };
}

/**
 * スナップショットから UI 状態へ復元。
 * ui を書き換えたうえ、非 ui フィールドを戻り値で返す。
 * @param {object} snapshot
 * @param {object} ui - 書き換え対象の state.ui
 * @returns {{ options: object, excludedSkillIds: number[], committedSkillFilter: object }|false}
 */
export function applyDesignSnapshot(snapshot, ui) {
  if (!snapshot || snapshot.version !== 1) return false;
  ui.characterId = snapshot.characterId;
  ui.supportIds = [...snapshot.supportIds];
  ui.enabledEventIds = new Set(snapshot.enabledEventIds || []);
  ui.eventChoiceIds = toEventChoiceMap(snapshot.eventChoiceIds);
  ui.scenarioLinkChoiceId = snapshot.scenarioLinkChoiceId;
  ui.seniorRmjChoiceId = snapshot.seniorRmjChoiceId;
  return {
    options: { ...(snapshot.options || {}) },
    excludedSkillIds: [...(snapshot.excludedSkillIds || [])],
    committedSkillFilter: { ...(snapshot.committedSkillFilter || {}) },
  };
}
