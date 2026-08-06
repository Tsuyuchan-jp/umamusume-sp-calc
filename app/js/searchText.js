/**
 * カードピッカー等の検索文字列正規化。
 * ひらがな↔カタカナ、ローマ字（カタカナ読み）を同一視する。
 */

import { characterBaseName } from "./cardAssets.js";

/** ひらがなをカタカナへ */
export function toKatakana(s) {
  return String(s).replace(/[\u3041-\u3096]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) + 0x60)
  );
}

/** 検索照合用（かな統一＋小文字） */
export function normalizeSearchText(s) {
  return toKatakana(s).toLowerCase();
}

/** カタカナ→ローマ字（ヘボン寄り・長音は直前母音の繰り返し） */
const KANA_ROMAJI = {
  ア: "a",
  イ: "i",
  ウ: "u",
  エ: "e",
  オ: "o",
  カ: "ka",
  キ: "ki",
  ク: "ku",
  ケ: "ke",
  コ: "ko",
  サ: "sa",
  シ: "shi",
  ス: "su",
  セ: "se",
  ソ: "so",
  タ: "ta",
  チ: "chi",
  ツ: "tsu",
  テ: "te",
  ト: "to",
  ナ: "na",
  ニ: "ni",
  ヌ: "nu",
  ネ: "ne",
  ノ: "no",
  ハ: "ha",
  ヒ: "hi",
  フ: "fu",
  ヘ: "he",
  ホ: "ho",
  マ: "ma",
  ミ: "mi",
  ム: "mu",
  メ: "me",
  モ: "mo",
  ヤ: "ya",
  ユ: "yu",
  ヨ: "yo",
  ラ: "ra",
  リ: "ri",
  ル: "ru",
  レ: "re",
  ロ: "ro",
  ワ: "wa",
  ヲ: "wo",
  ン: "n",
  ガ: "ga",
  ギ: "gi",
  グ: "gu",
  ゲ: "ge",
  ゴ: "go",
  ザ: "za",
  ジ: "ji",
  ズ: "zu",
  ゼ: "ze",
  ゾ: "zo",
  ダ: "da",
  ヂ: "ji",
  ヅ: "zu",
  デ: "de",
  ド: "do",
  バ: "ba",
  ビ: "bi",
  ブ: "bu",
  ベ: "be",
  ボ: "bo",
  パ: "pa",
  ピ: "pi",
  プ: "pu",
  ペ: "pe",
  ポ: "po",
  ヴ: "vu",
  ァ: "a",
  ィ: "i",
  ゥ: "u",
  ェ: "e",
  ォ: "o",
  ャ: "ya",
  ュ: "yu",
  ョ: "yo",
  ッ: "tsu",
  ー: "-",
};

const DIGRAPHS = {
  キャ: "kya",
  キュ: "kyu",
  キョ: "kyo",
  シャ: "sha",
  シュ: "shu",
  ショ: "sho",
  チャ: "cha",
  チュ: "chu",
  チョ: "cho",
  ニャ: "nya",
  ニュ: "nyu",
  ニョ: "nyo",
  ヒャ: "hya",
  ヒュ: "hyu",
  ヒョ: "hyo",
  ミャ: "mya",
  ミュ: "myu",
  ミョ: "myo",
  リャ: "rya",
  リュ: "ryu",
  リョ: "ryo",
  ギャ: "gya",
  ギュ: "gyu",
  ギョ: "gyo",
  ジャ: "ja",
  ジュ: "ju",
  ジョ: "jo",
  ビャ: "bya",
  ビュ: "byu",
  ビョ: "byo",
  ピャ: "pya",
  ピュ: "pyu",
  ピョ: "pyo",
  ティ: "ti",
  ディ: "di",
  トゥ: "tu",
  ドゥ: "du",
  ファ: "fa",
  フィ: "fi",
  フェ: "fe",
  フォ: "fo",
  ウィ: "wi",
  ウェ: "we",
  ウォ: "wo",
  ヴァ: "va",
  ヴィ: "vi",
  ヴェ: "ve",
  ヴォ: "vo",
};

/** ローマ字→カタカナ（長いトークン優先） */
const ROMAJI_TO_KANA_ENTRIES = (() => {
  /** @type {Map<string, string>} */
  const map = new Map();
  for (const [kana, roma] of Object.entries(DIGRAPHS)) {
    map.set(roma, kana);
  }
  for (const [kana, roma] of Object.entries(KANA_ROMAJI)) {
    if (kana === "ー" || kana === "ッ") continue;
    if (!map.has(roma)) map.set(roma, kana);
  }
  // よく使う別名
  map.set("si", "シ");
  map.set("ti", "ティ");
  map.set("tu", "ツ");
  map.set("hu", "フ");
  map.set("zi", "ジ");
  map.set("di", "ディ");
  map.set("du", "ドゥ");
  map.set("sya", "シャ");
  map.set("syu", "シュ");
  map.set("syo", "ショ");
  map.set("tya", "チャ");
  map.set("tyu", "チュ");
  map.set("tyo", "チョ");
  return [...map.entries()].sort((a, b) => b[0].length - a[0].length);
})();

const VOWELS = new Set(["a", "i", "u", "e", "o"]);

/**
 * ローマ字をカタカナへ（ai → アイ、a-mondo / aamondo → アーモンド）。
 * 変換できない文字が残ったら null（フォールバック用）。
 */
export function romajiToKana(input) {
  const s = String(input).toLowerCase().replace(/'/g, "");
  let out = "";
  let i = 0;
  while (i < s.length) {
    // 単独のハイフンは長音
    if (s[i] === "-" || s[i] === "—") {
      out += "ー";
      i += 1;
      continue;
    }
    // 促音: kk / tt / pp など（nn はンなので除外）
    if (
      i + 1 < s.length &&
      s[i] === s[i + 1] &&
      !VOWELS.has(s[i]) &&
      s[i] !== "n" &&
      /[bcdfghjklmpqrstvwxyz]/.test(s[i])
    ) {
      out += "ッ";
      i += 1;
      continue;
    }
    let matched = false;
    for (const [roma, kana] of ROMAJI_TO_KANA_ENTRIES) {
      if (s.startsWith(roma, i)) {
        out += kana;
        i += roma.length;
        // 長音: 直後が同じ母音（aamondo）またはハイフン（a-mondo）
        const lastVowel = [...roma].reverse().find((c) => VOWELS.has(c));
        if (lastVowel && i < s.length && (s[i] === "-" || s[i] === lastVowel)) {
          out += "ー";
          i += 1;
        }
        matched = true;
        break;
      }
    }
    if (!matched) return null;
  }
  return out;
}

/**
 * ピッカー入力の正規化。
 * 英字のみ（ハイフン可）ならローマ字→かなにしてから照合する
 * （ai が daiamondo の部分一致に引っかからないようにする）。
 */
export function normalizeSearchQuery(raw) {
  const trimmed = String(raw).trim();
  if (!trimmed) return "";
  if (/^[a-zA-Z\-']+$/.test(trimmed)) {
    const kana = romajiToKana(trimmed);
    if (kana) return normalizeSearchText(kana);
    // 変換不能時は従来どおり小文字ローマ字（部分一致）
    return trimmed.toLowerCase();
  }
  return normalizeSearchText(trimmed);
}

/**
 * カタカナ（またはひらがな）文字列をローマ字にする。
 * 漢字など非かなはそのまま残す。
 * @param {string} input
 * @param {{ longVowel?: "double" | "hyphen" }} [options]
 *   - double: アー → aa（既定）
 *   - hyphen: アー → a-（a-mondo 形式）
 */
export function kanaToRomaji(input, options = {}) {
  const longVowel = options.longVowel === "hyphen" ? "hyphen" : "double";
  const s = toKatakana(input);
  let out = "";
  let i = 0;
  while (i < s.length) {
    const two = s.slice(i, i + 2);
    if (DIGRAPHS[two]) {
      out += DIGRAPHS[two];
      i += 2;
      continue;
    }
    const ch = s[i];
    if (ch === "ッ") {
      const nextTwo = s.slice(i + 1, i + 3);
      const nextOne = s[i + 1];
      const nextRoma = DIGRAPHS[nextTwo] || KANA_ROMAJI[nextOne] || "";
      const cons = nextRoma.match(/^[bcdfghjklmnpqrstvwxyz]/i);
      out += cons ? cons[0] : "tsu";
      i += 1;
      continue;
    }
    if (ch === "ー") {
      const m = out.match(/[aeiou]$/i);
      if (m) {
        out += longVowel === "hyphen" ? "-" : m[0];
      }
      i += 1;
      continue;
    }
    if (KANA_ROMAJI[ch]) {
      out += KANA_ROMAJI[ch];
      i += 1;
      continue;
    }
    // 非かな（漢字・記号・英字）はそのまま
    out += ch;
    i += 1;
  }
  return out.toLowerCase();
}

/**
 * キャラ名からピッカー用 searchText を作る（かな＋ローマ字）。
 * 衣装タイトルは含めない。
 * ローマ字は長音の二重母音（aamondo）とハイフン（a-mondo）の両方を持つ。
 */
export function buildCharacterNameSearchText(characterName) {
  const base = characterBaseName(characterName);
  const kana = normalizeSearchText(base);
  const romajiDouble = kanaToRomaji(base, { longVowel: "double" });
  const romajiHyphen = kanaToRomaji(base, { longVowel: "hyphen" });
  const parts = [kana];
  if (romajiDouble && romajiDouble !== kana) parts.push(romajiDouble);
  if (romajiHyphen && romajiHyphen !== kana && romajiHyphen !== romajiDouble) {
    parts.push(romajiHyphen);
  }
  return parts.join(" ");
}
