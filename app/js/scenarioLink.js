/**
 * シナリオリンク（シニア9月前半）の白/金ヒント解決。
 *
 * - 常にラジオ1択。選んだリンクにつきヒントは1スキルのみ。
 * - デフォルトは白。リンク対象キャラが育成ウマ娘または6枠サポカにいれば金。
 * - requiresLinkCharacterIds は OR（いずれか1人いれば金）。
 */

/**
 * 育成ウマ娘カード ID → chara_id（例: 105801 → 1058）
 * @param {number} cardId
 * @returns {number|null}
 */
export function trainingCharaId(cardId) {
  if (cardId == null || !Number.isFinite(cardId)) return null;
  return Math.floor(Number(cardId) / 100);
}

/**
 * リンク条件のキャラ ID 一覧
 * @param {object} linkEntry
 * @returns {number[]}
 */
export function getLinkRequiredCharacterIds(linkEntry) {
  if (linkEntry.requiresLinkCharacterIds?.length) {
    return linkEntry.requiresLinkCharacterIds.map(Number);
  }
  if (linkEntry.requiresLinkCharacterId != null) {
    return [Number(linkEntry.requiresLinkCharacterId)];
  }
  return [];
}

/**
 * 育成ウマ娘 ∪ サポカ6枠 の chara_id 集合
 * @param {number} characterCardId
 * @param {number[]} supportIds
 * @param {Map<number, object>} supportById
 * @returns {Set<number>}
 */
export function getDeckLinkCharacterIds(characterCardId, supportIds, supportById) {
  const ids = new Set();
  const charaId = trainingCharaId(characterCardId);
  if (charaId != null) ids.add(charaId);
  for (const sid of supportIds || []) {
    if (sid == null) continue;
    const cid = supportById.get(sid)?.characterId;
    if (cid != null) ids.add(Number(cid));
  }
  return ids;
}

/**
 * リンク対象キャラが編成内にいるか（複数 ID は OR）
 * @param {object} linkEntry
 * @param {Set<number>} deckCharacterIds
 * @returns {boolean}
 */
export function isLinkCharacterPresent(linkEntry, deckCharacterIds) {
  const required = getLinkRequiredCharacterIds(linkEntry);
  if (required.length === 0) return false;
  return required.some((id) => deckCharacterIds.has(id));
}

/**
 * 編成に応じて白 or 金の1スキルを返す
 * @param {object} linkEntry
 * @param {Set<number>} deckCharacterIds
 * @returns {object|null} { skillId?, skillName, hintLevel }
 */
export function resolveLinkSkill(linkEntry, deckCharacterIds) {
  const withLink = isLinkCharacterPresent(linkEntry, deckCharacterIds);
  const skill = withLink ? linkEntry.skillWithLink : linkEntry.skillWithoutLink;
  return skill || null;
}
