/**
 * スキルごとのヒントLvを解決（max）
 * @typedef {{ skillId: number, hintLevel: number, source: string }} SkillHintEntry
 */

/**
 * @param {SkillHintEntry[]} entries
 * @returns {Map<number, { hintLevel: number, sources: string[] }>}
 */
export function resolveHintLevels(entries) {
  const map = new Map();
  for (const e of entries) {
    const id = e.skillId;
    if (!id) continue;
    const cur = map.get(id) || { hintLevel: 0, sources: [] };
    if (e.hintLevel > cur.hintLevel) {
      cur.hintLevel = e.hintLevel;
    }
    if (!cur.sources.includes(e.source)) {
      cur.sources.push(e.source);
    }
    map.set(id, cur);
  }
  return map;
}
