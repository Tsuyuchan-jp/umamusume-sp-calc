/**
 * イベント選択肢ラベルを旧11種と同形式に整形する
 * - 番号: ①②③…
 * - ヒントあり: 「{選択肢文} — スキル名 LvN + …」またはスキルのみ「① スキル名 LvN + …」
 */
import fs from "node:fs";

const CIRCLED = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧"];

/** 追加26種の supportNameMatch（この範囲のみ再整形） */
const NEW_MATCHES = new Set([
  "スマイル・エバーアフター",
  "賑やかな未来を乗せて走れ！",
  "単焦点でつかまえて",
  "白に至る純真",
  "響け、二人の凱歌",
  "星跨ぐメッセージ",
  "吉兆招福チョコ来たる",
  "私のためのショッピング",
  "故郷に錦を飾るんでい！",
  "ぬくもりのノエル",
  "激録！爆走トナカイ事件",
  "無機の闘志",
  "決意のフローラ",
  "壇上より魔法を込めて",
  "Inseparable",
  "カルストンライトオ、猫です",
  "氷結晶の静域",
  "気まぐれ渡り星",
  "Tranquillo",
  "水面のプリンシパル",
  "瞳に闘志を胸に勝利の渇望を",
  "白き稲妻の如く",
  "Unveiled Dream",
  "無垢の白妙",
  "誘うは夢心地",
  "世界を変える眼差し",
]);

export function formatSkillHintList(skills) {
  return (skills || [])
    .map((s) => `${s.skillName} Lv${s.hintLevel}`)
    .join(" + ");
}

/** 先頭の丸数字と「 — …」以降を除去して選択肢本文だけ返す */
export function stripChoiceLabelDecor(label) {
  let text = label.trim();
  text = text.replace(/^[①②③④⑤⑥⑦⑧]\s*/, "");
  const dash = text.indexOf(" — ");
  if (dash >= 0) text = text.slice(0, dash);
  return text.trim();
}

/** プレースホルダーか（ゲーム内セリフではない） */
function isPlaceholder(text) {
  return !text || text === "（非ヒント選択肢）" || text === "（ステータスのみ）";
}

export function formatChoiceLabel(choice, index) {
  const num = CIRCLED[index] ?? `${index + 1}.`;
  const dialogue = stripChoiceLabelDecor(choice.label);
  const hints = formatSkillHintList(choice.skills);

  if (choice.skills?.length > 0) {
    if (isPlaceholder(dialogue)) {
      return `${num} ${hints}`;
    }
    return `${num} ${dialogue} — ${hints}`;
  }
  if (isPlaceholder(dialogue)) {
    return `${num} （ステータスのみ）`;
  }
  return `${num} ${dialogue}`;
}

export function formatEventChoices(choices) {
  return choices.map((c, i) => ({
    ...c,
    label: formatChoiceLabel(c, i),
  }));
}

function main() {
  const eventsDoc = JSON.parse(fs.readFileSync("./data/events.json", "utf8"));
  let updated = 0;

  for (const evt of eventsDoc.events || []) {
    if (evt.selection !== "single" || !evt.choices?.length) continue;
    if (!NEW_MATCHES.has(evt.supportNameMatch)) continue;

    evt.choices = formatEventChoices(evt.choices);
    updated++;
  }

  fs.writeFileSync("./data/events.json", JSON.stringify(eventsDoc, null, 2), "utf8");
  console.log(`formatted choice labels for ${updated} events`);
}

if (process.argv[1]?.endsWith("format_event_choice_labels.mjs")) {
  main();
}
