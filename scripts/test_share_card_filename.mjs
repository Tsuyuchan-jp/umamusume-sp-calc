import {
  buildShareCardFilename,
  sanitizeShareFilenamePart,
} from "../app/js/shareCard.js";

function assertEq(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
  console.log(`OK ${label}`);
}

assertEq(sanitizeShareFilenamePart("アーモンドアイ"), "アーモンドアイ", "日本語はそのまま");
assertEq(
  sanitizeShareFilenamePart('切れ者 a/b:c*d?.png'),
  "切れ者_abcd.png",
  "禁止文字と空白を除去"
);
assertEq(sanitizeShareFilenamePart("   "), "編成設計", "空はフォールバック");

const fixed = new Date(2026, 7, 3); // 2026-08-03 ローカル
assertEq(
  buildShareCardFilename({
    title: "切れ者前提・パワ寄せ",
    totalSp: 8159,
    date: fixed,
  }),
  "切れ者前提・パワ寄せ-20260803-8159sp.png",
  "名前-日付-SPsp"
);
assertEq(
  buildShareCardFilename({ title: "", totalSp: 4281, date: fixed }),
  "編成設計-20260803-4281sp.png",
  "タイトル空は編成設計"
);
assertEq(
  buildShareCardFilename({
    title: "アーモンドアイ",
    totalSp: 4281.4,
    date: fixed,
  }),
  "アーモンドアイ-20260803-4281sp.png",
  "SP は四捨五入"
);

console.log("test_share_card_filename: all passed");
