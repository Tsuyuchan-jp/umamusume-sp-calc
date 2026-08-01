/**
 * カードピッカー等の検索文字列正規化。
 * ひらがな↔カタカナ、ローマ字（カタカナ読み）を同一視する。
 */

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

/**
 * `[衣装]キャラ名` からキャラ名だけ取り出す。
 * 括弧が無ければ全体を返す。
 */
export function characterBaseName(fullName) {
  const m = String(fullName).match(/^\[([^\]]+)\](.+)$/);
  return m ? m[2].trim() : String(fullName).trim();
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

/**
 * カタカナ（またはひらがな）文字列をローマ字にする。
 * 漢字など非かなはそのまま残す。
 */
export function kanaToRomaji(input) {
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
      out += m ? m[0] : "";
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
 */
export function buildCharacterNameSearchText(characterName) {
  const base = characterBaseName(characterName);
  const kana = normalizeSearchText(base);
  const romaji = kanaToRomaji(base);
  return romaji && romaji !== kana ? `${kana} ${romaji}` : kana;
}
