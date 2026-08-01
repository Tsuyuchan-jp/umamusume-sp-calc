/**
 * スキルごとのヒントLvを解決（max）
 * @typedef {{ skillId: number, hintLevel: number, kind: string, label: string }} SkillHintEntry
 * @typedef {{ kind: string, label: string, hintLevel: number }} SkillSource
 */

/**
 * @param {SkillHintEntry[]} entries
 * @returns {Map<number, { hintLevel: number, sources: SkillSource[] }>}
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
    const existing = cur.sources.find(
      (s) => s.kind === e.kind && s.label === e.label
    );
    if (existing) {
      if (e.hintLevel > existing.hintLevel) {
        existing.hintLevel = e.hintLevel;
      }
    } else {
      cur.sources.push({
        kind: e.kind,
        label: e.label,
        hintLevel: e.hintLevel,
      });
    }
    map.set(id, cur);
  }
  return map;
}
