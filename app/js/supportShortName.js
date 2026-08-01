/**
 * サポカの表示用短縮名（イベント label・トレヒント由来の正本）
 * support.title / supportNameMatch → 略称
 *
 * 当アプリではタップダンスシチーを「タップ」と呼称する。
 * デッキ表記は「タイプ略＋キャラ略」（例: スピタップ / スタドトウ / 友人たづな）。
 */
import { SUPPORT_TYPE_STYLES } from "./cardAssets.js";

export const SHORT_NAME_BY_MATCH = {
  一杯のノスタルジア: "たづな",
  その執念は怒濤が如く: "ドトウ",
  "永久の誓い、永久の輝き": "ダイヤ",
  "刀光散らしてClash！": "タップ",
  全てに挑む勇ましき者: "デジタル",
  白に至る覚悟: "ハート",
  Innovator: "ヤング",
  "ゆかし、きらめきの旅路": "ファイン",
  "心覚えし、京の華": "グルーヴ",
  天才的ユートピア: "テイオー",
  "Zirkus der Träume": "フラッシュ",
  "スマイル・エバーアフター": "グラン",
  "賑やかな未来を乗せて走れ！": "チヨノ",
  単焦点でつかまえて: "マーチャン",
  白に至る純真: "タクト",
  "響け、二人の凱歌": "マルシュ",
  星跨ぐメッセージ: "ネオ",
  吉兆招福チョコ来たる: "フクキタル",
  私のためのショッピング: "キング",
  "故郷に錦を飾るんでい！": "イナリ",
  ぬくもりのノエル: "フェノーメノ",
  "激録！爆走トナカイ事件": "ゴルシ",
  無機の闘志: "ブルボン",
  決意のフローラ: "カレン",
  壇上より魔法を込めて: "フジ",
  Inseparable: "ルビー",
  "カルストンライトオ、猫です": "ライトオ",
  氷結晶の静域: "アドマイヤ",
  気まぐれ渡り星: "ステイ",
  Tranquillo: "ドゥラ",
  水面のプリンシパル: "バリア",
  瞳に闘志を胸に勝利の渇望を: "ライアン",
  白き稲妻の如く: "タマモ",
  "Unveiled Dream": "ライン",
  無垢の白妙: "タクト",
  誘うは夢心地: "ドリーム",
  世界を変える眼差し: "アーモンド",
  "両手いっぱい、小倉愛": "ネイチャ",
  巻頭カラーの夏: "キセキ",
  夏空チルタイム: "アーモンド",
};

/**
 * @param {string} supportNameMatch
 * @param {string} [type] speed/stamina/...
 * @returns {string} 例: スピタップ
 */
export function formatDeckShortLabel(supportNameMatch, type) {
  const short = SHORT_NAME_BY_MATCH[supportNameMatch];
  if (!short) return "";
  const typeLabel = SUPPORT_TYPE_STYLES[type]?.label || "";
  return typeLabel ? `${typeLabel}${short}` : short;
}

/**
 * @param {{ title?: string, characterName?: string, name?: string, type?: string }} support
 * @returns {string}
 */
export function shortNameForSupport(support) {
  if (!support) return "";
  const title = support.title;
  if (title && SHORT_NAME_BY_MATCH[title]) return SHORT_NAME_BY_MATCH[title];
  const name = support.characterName || support.name || "";
  return name.length > 6 ? `${name.slice(0, 5)}…` : name;
}

/**
 * トレヒント由来の詳細ラベル（例: スピタップ / 友人たづな）
 * @param {{ type?: string, title?: string, characterName?: string, name?: string }} support
 * @returns {string}
 */
export function formatTrainingSourceLabel(support) {
  if (!support) return "";
  if (support.title && SHORT_NAME_BY_MATCH[support.title]) {
    return formatDeckShortLabel(support.title, support.type);
  }
  const typeLabel = SUPPORT_TYPE_STYLES[support.type]?.label || "";
  const short = shortNameForSupport(support);
  return typeLabel ? `${typeLabel}${short}` : short;
}

/**
 * label 先頭のデッキ略称（タイプ付き or 旧キャラのみ）を剥がしてイベント名だけ返す
 * @param {string} label
 * @param {string} supportNameMatch
 * @param {string} [type]
 */
export function stripEventNamePrefix(label, supportNameMatch, type) {
  let name = String(label || "").trim();
  const tag = formatDeckShortLabel(supportNameMatch, type);
  const short = SHORT_NAME_BY_MATCH[supportNameMatch];
  if (tag && name.startsWith(`${tag} `)) {
    return name.slice(tag.length + 1).trim();
  }
  if (short && name.startsWith(`${short} `)) {
    return name.slice(short.length + 1).trim();
  }
  return name;
}

/**
 * 「スピタップ イベント名」形式のイベント表示名
 * @param {string} supportNameMatch
 * @param {string} eventName
 * @param {string} type サポカ type（必須・無いとタイプ無し略称のみ）
 */
export function formatEventLabel(supportNameMatch, eventName, type) {
  const short = SHORT_NAME_BY_MATCH[supportNameMatch];
  if (!short) {
    throw new Error(`短縮名未定義: ${supportNameMatch}`);
  }
  const tag = formatDeckShortLabel(supportNameMatch, type) || short;
  const name = stripEventNamePrefix(eventName, supportNameMatch, type);
  return `${tag} ${name}`;
}
