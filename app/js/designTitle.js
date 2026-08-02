/**
 * 編成タイトル（画面上の入力欄）の既定・育成変更時の更新ルール
 */

import { characterBaseName } from "./cardAssets.js";

/**
 * 育成ウマ娘の表示名から編成タイトルの初期値（称号除去の名前のみ）
 * @param {string} characterFullName
 * @returns {string}
 */
export function defaultDesignTitleFromCharacterName(characterFullName) {
  return characterBaseName(characterFullName);
}

/**
 * 育成変更時: 空、または直前の自動名と同じときだけ新育成名へ更新（手編集は維持）
 * @param {string} currentTitle
 * @param {string} previousBaseName
 * @param {string} nextBaseName
 * @returns {string}
 */
export function resolveDesignTitleOnCharacterChange(
  currentTitle,
  previousBaseName,
  nextBaseName
) {
  const cur = String(currentTitle || "").trim();
  const prev = String(previousBaseName || "").trim();
  const next = String(nextBaseName || "").trim();
  if (!cur || (prev && cur === prev)) {
    return next;
  }
  return cur;
}
