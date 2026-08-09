/** サポカ育成タイプの識別色（画像未配置時のプレースホルダ） */
export const SUPPORT_TYPE_STYLES = {
  speed: { label: "スピ", bg: "linear-gradient(160deg,#7ec8e8,#2a8fc4)", ink: "#0a2a3d" },
  stamina: { label: "スタ", bg: "linear-gradient(160deg,#f08a8a,#d04545)", ink: "#3d0a0a" },
  power: { label: "パワ", bg: "linear-gradient(160deg,#f5c06a,#e08820)", ink: "#3d2800" },
  guts: { label: "根性", bg: "linear-gradient(160deg,#f09cc0,#d04a82)", ink: "#3d0a22" },
  wit: { label: "賢さ", bg: "linear-gradient(160deg,#8fd99a,#3a9e4a)", ink: "#0a2d10" },
  friend: { label: "友人", bg: "linear-gradient(160deg,#f0d86a,#c9a020)", ink: "#3d3200" },
};

const DEFAULT_STYLE = {
  label: "?",
  bg: "linear-gradient(160deg,#c8cdd2,#8a9299)",
  ink: "#1c2420",
};

/** 画像 URL のキャッシュ回避（追加前の 404 が残るのを防ぐ。版上げ時に更新） */
const ASSET_CACHE_BUST = "1.0.5";

/** @param {string} [type] */
export function getSupportTypeStyle(type) {
  return SUPPORT_TYPE_STYLES[type] || DEFAULT_STYLE;
}

/**
 * app/ 配下ページから assets/ への相対 URL（絶対化してベースパス差を吸収）
 * @param {string} relFromApp 例: supports/30305.webp
 */
function assetUrl(relFromApp) {
  const rel = `../assets/${relFromApp}?v=${ASSET_CACHE_BUST}`;
  if (typeof window !== "undefined" && window.location?.href) {
    try {
      return new URL(rel, window.location.href).href;
    } catch {
      /* fall through */
    }
  }
  return rel;
}

/** サポカ画像 URL（無ければ onerror でプレースホルダ） */
export function supportImageUrl(supportId) {
  return assetUrl(`supports/${supportId}.webp`);
}

/** 育成ウマ娘画像 URL */
export function characterImageUrl(characterId) {
  return assetUrl(`characters/${characterId}.webp`);
}

/** カード表示用の短い名前 */
export function shortSupportLabel(support) {
  if (!support) return "";
  const name = support.characterName || support.name;
  return name.length > 8 ? `${name.slice(0, 7)}…` : name;
}

/** [衣装]キャラ → キャラ名のみ（由来バッジ用） */
export function characterBaseName(name) {
  const m = String(name || "").match(/^\[([^\]]+)\](.+)$/);
  return m ? m[2].trim() : String(name || "");
}

/** [衣装]キャラ → キャラ[衣装] の短縮 */
export function shortCharacterLabel(name) {
  const m = String(name).match(/^\[([^\]]+)\](.+)$/);
  if (!m) return name.length > 10 ? `${name.slice(0, 9)}…` : name;
  const display = `${m[2]}[${m[1]}]`;
  return display.length > 14 ? `${display.slice(0, 13)}…` : display;
}
