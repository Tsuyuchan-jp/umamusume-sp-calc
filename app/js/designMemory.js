/**
 * 設計メモリ（localStorage）。1エントリ = 1 designSnapshot。
 */

export const DESIGN_MEMORY_STORAGE_KEY = "umamusume-sp-calc.designMemory.v1";
export const DESIGN_MEMORY_MAX_ENTRIES = 20;

/**
 * @param {Storage} [storage]
 * @returns {{ entries: object[] }}
 */
function readStore(storage) {
  try {
    const raw = storage.getItem(DESIGN_MEMORY_STORAGE_KEY);
    if (!raw) return { entries: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.entries)) return { entries: [] };
    return { entries: parsed.entries };
  } catch {
    return { entries: [] };
  }
}

/**
 * @param {Storage} storage
 * @param {{ entries: object[] }} store
 */
function writeStore(storage, store) {
  storage.setItem(DESIGN_MEMORY_STORAGE_KEY, JSON.stringify(store));
}

/**
 * @param {Storage} [storage]
 * @returns {object[]} 新しい順
 */
export function listEntries(storage = globalThis.localStorage) {
  const { entries } = readStore(storage);
  return [...entries].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

/**
 * @param {string} id
 * @param {Storage} [storage]
 * @returns {object|null}
 */
export function getEntry(id, storage = globalThis.localStorage) {
  return readStore(storage).entries.find((e) => e.id === id) ?? null;
}

/**
 * @param {object} params
 * @param {string} params.name
 * @param {object} params.snapshot
 * @param {number|null} [params.totalSp]
 * @param {Storage} [storage]
 * @returns {object} 保存したエントリ
 */
export function saveEntry(
  { name, snapshot, totalSp = null },
  storage = globalThis.localStorage
) {
  const trimmed = String(name || "").trim() || "無題の設計";
  const store = readStore(storage);
  const entry = {
    id: `mem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    name: trimmed,
    updatedAt: Date.now(),
    totalSp: totalSp == null || Number.isNaN(Number(totalSp)) ? null : Number(totalSp),
    snapshot,
  };
  store.entries.push(entry);
  // 上限超過時は最古（updatedAt 最小）を削除
  while (store.entries.length > DESIGN_MEMORY_MAX_ENTRIES) {
    let oldestIdx = 0;
    for (let i = 1; i < store.entries.length; i++) {
      if ((store.entries[i].updatedAt || 0) < (store.entries[oldestIdx].updatedAt || 0)) {
        oldestIdx = i;
      }
    }
    store.entries.splice(oldestIdx, 1);
  }
  writeStore(storage, store);
  return entry;
}

/**
 * @param {string} id
 * @param {Storage} [storage]
 * @returns {boolean}
 */
export function deleteEntry(id, storage = globalThis.localStorage) {
  const store = readStore(storage);
  const next = store.entries.filter((e) => e.id !== id);
  if (next.length === store.entries.length) return false;
  writeStore(storage, { entries: next });
  return true;
}
