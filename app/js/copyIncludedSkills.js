/**
 * 結果一覧の「含める」ON 行を外部ツール向けに整形・コピーする pure 関数群。
 */

/**
 * コピー対象の表示行（継承固有は除外）
 * @param {Array<{ skillId: number|null, excluded?: boolean, isInherit?: boolean }>} rows
 */
export function getIncludedSkillRows(rows) {
  return rows.filter(
    (row) => !row.isInherit && row.skillId != null && !row.excluded
  );
}

/**
 * 含める ON のスキル名をカンマ区切り1行に整形
 * @param {Array<{ name: string, skillId: number|null, excluded?: boolean, isInherit?: boolean }>} rows
 * @returns {string}
 */
export function formatIncludedSkillNames(rows) {
  return getIncludedSkillRows(rows)
    .map((row) => row.name)
    .join(", ");
}

/**
 * クリップボードへテキストを書き込む（失敗時は textarea フォールバック）
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // execCommand へフォールバック
    }
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
