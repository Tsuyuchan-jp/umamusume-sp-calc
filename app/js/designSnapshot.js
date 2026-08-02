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

const SUPPORT_SLOT_COUNT = 6;

/**
 * 復元前に育成／サポ ID を名簿と照合し、不正分を空にする。
 * @param {object} snapshot
 * @param {{ characters?: { id: number }[], supports?: { id: number }[] }} catalogs
 * @returns {{ snapshot: object, warnings: string[] }}
 */
export function sanitizeDesignSnapshot(snapshot, catalogs = {}) {
  if (!snapshot || snapshot.version !== 1) {
    return { snapshot, warnings: [] };
  }

  const charIds = new Set((catalogs.characters || []).map((c) => c.id));
  const supIds = new Set((catalogs.supports || []).map((s) => s.id));
  const warnings = [];

  const rawSupports = Array.isArray(snapshot.supportIds) ? snapshot.supportIds : [];
  const supportIds = [];
  for (let i = 0; i < SUPPORT_SLOT_COUNT; i++) {
    supportIds.push(i < rawSupports.length ? rawSupports[i] : null);
  }

  let characterId = snapshot.characterId ?? null;
  if (
    characterId != null &&
    charIds.size > 0 &&
    !charIds.has(characterId)
  ) {
    const fallback = catalogs.characters?.[0]?.id ?? null;
    warnings.push(
      `育成ウマ娘（ID ${characterId}）は見つからないため${fallback != null ? "先頭の育成ウマ娘" : "未選択"}にしました`
    );
    characterId = fallback;
  }

  const seenSupports = new Set();
  for (let i = 0; i < supportIds.length; i++) {
    const id = supportIds[i];
    if (id == null) continue;

    if (supIds.size > 0 && !supIds.has(id)) {
      warnings.push(`サポカ枠${i + 1}（ID ${id}）は見つからないため空にしました`);
      supportIds[i] = null;
      continue;
    }

    if (seenSupports.has(id)) {
      warnings.push(`サポカ（ID ${id}）が重複しているため枠${i + 1} を空にしました`);
      supportIds[i] = null;
      continue;
    }

    seenSupports.add(id);
  }

  return {
    snapshot: { ...snapshot, characterId, supportIds },
    warnings,
  };
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
  designTitle = "",
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
    designTitle: String(designTitle || "").trim(),
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
    designTitle: String(snapshot.designTitle || "").trim(),
  };
}
