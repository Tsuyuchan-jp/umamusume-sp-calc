/**
 * 前回セッションの自動保存／復元（メモリ一覧とは別キー）。
 * スナップショット形は designSnapshot と同じ。
 */

export const DESIGN_SESSION_STORAGE_KEY = "umamusume-sp-calc-session";

/**
 * @param {Storage} [storage]
 * @returns {object|null}
 */
export function loadSessionSnapshot(storage = globalThis.localStorage) {
  try {
    const raw = storage.getItem(DESIGN_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * @param {object} snapshot
 * @param {Storage} [storage]
 */
export function saveSessionSnapshot(snapshot, storage = globalThis.localStorage) {
  if (!snapshot || snapshot.version !== 1) return;
  try {
    storage.setItem(DESIGN_SESSION_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* quota 等は無視 */
  }
}
