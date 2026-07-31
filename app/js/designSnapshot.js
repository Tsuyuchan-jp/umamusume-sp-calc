/**
 * 1設計（編成バリアント）の永続化境界。
 * 将来のメモリ／スクショはこの形を保存・復元する。
 */

/**
 * @param {object} params
 * @param {object} params.ui - app の state.ui
 * @param {object} params.options - 切れ者・継承・トレヒント等
 * @param {Set<number>} params.excludedSkillIds
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
    eventChoiceIds: { ...ui.eventChoiceIds },
    scenarioLinkChoiceId: ui.scenarioLinkChoiceId,
    seniorRmjChoiceId: ui.seniorRmjChoiceId,
    options: { ...options },
    excludedSkillIds: [...excludedSkillIds],
    committedSkillFilter: { ...committedSkillFilter },
  };
}

/**
 * スナップショットから UI 状態へ復元（メモリ機能用・将来）
 * @param {object} snapshot
 * @param {object} ui - 書き換え対象の state.ui
 */
export function applyDesignSnapshot(snapshot, ui) {
  if (!snapshot || snapshot.version !== 1) return false;
  ui.characterId = snapshot.characterId;
  ui.supportIds = [...snapshot.supportIds];
  ui.enabledEventIds = new Set(snapshot.enabledEventIds);
  ui.eventChoiceIds = { ...snapshot.eventChoiceIds };
  ui.scenarioLinkChoiceId = snapshot.scenarioLinkChoiceId;
  ui.seniorRmjChoiceId = snapshot.seniorRmjChoiceId;
  return true;
}
