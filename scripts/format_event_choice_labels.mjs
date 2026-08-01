/**
 * 優先サポカイベントの選択肢ラベルを旧11種と同形式に整形する。
 *
 * 形式（append_priority_events.mjs / 既存11種と同一）:
 *   choice.label = "① スキル名 LvN + スキル名 LvN"
 *   ヒント無し選択肢は含めない（UI の「未選択」で代替）
 */
import fs from "node:fs";
import { SHORT_NAME_BY_MATCH } from "../app/js/supportShortName.js";

const CIRCLED = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧"];

export { SHORT_NAME_BY_MATCH };

/** 追加26種のみ（既存11種は既に正しい形式） */
export const NEW_MATCHES = new Set([
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

/**
 * ヒント付き選択肢のみ残し、旧11種形式の label を付与する。
 * skills が空の選択肢は除外する。
 */
export function formatEventChoices(choices) {
  const withSkills = (choices || []).filter((c) => (c.skills || []).length > 0);
  return withSkills.map((c, i) => ({
    ...c,
    label: `${CIRCLED[i] ?? `${i + 1}.`} ${formatSkillHintList(c.skills)}`,
  }));
}

/** 「短縮名 イベント名」形式のイベント表示名を作る */
export function formatEventLabel(supportNameMatch, eventName) {
  const short = SHORT_NAME_BY_MATCH[supportNameMatch];
  if (!short) {
    throw new Error(`短縮名未定義: ${supportNameMatch}`);
  }
  let name = String(eventName || "").trim();
  // 既に「短縮名 …」ならイベント名部分だけ取り直す
  if (name.startsWith(`${short} `)) {
    name = name.slice(short.length + 1).trim();
  }
  return `${short} ${name}`;
}

function normalizeEvent(evt) {
  const out = { ...evt };
  out.label = formatEventLabel(evt.supportNameMatch, evt.label);

  if (evt.selection === "single") {
    const choices = formatEventChoices(evt.choices);
    if (choices.length === 0) {
      throw new Error(`event ${evt.id}: ヒント付き選択肢が0件`);
    }
    out.choices = choices;
    if (!choices.some((c) => c.id === evt.defaultChoiceId)) {
      throw new Error(
        `event ${evt.id}: defaultChoiceId "${evt.defaultChoiceId}" が choices に無い`
      );
    }
  }
  return out;
}

function main() {
  const eventsDoc = JSON.parse(fs.readFileSync("./data/events.json", "utf8"));
  let updated = 0;

  eventsDoc.events = (eventsDoc.events || []).map((evt) => {
    if (!NEW_MATCHES.has(evt.supportNameMatch)) return evt;
    updated++;
    return normalizeEvent(evt);
  });

  fs.writeFileSync("./data/events.json", JSON.stringify(eventsDoc, null, 2), "utf8");
  console.log(`normalized ${updated} events (new 26 supports)`);
}

if (process.argv[1]?.endsWith("format_event_choice_labels.mjs")) {
  main();
}
