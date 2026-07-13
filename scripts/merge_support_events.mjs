/**
 * support-events-research-26.json を events.json にマージし skillId を解決する
 */
import fs from "node:fs";
import {
  formatEventChoices,
  formatEventLabel,
} from "./format_event_choice_labels.mjs";

const skills = JSON.parse(fs.readFileSync("./data/skills.json", "utf8"));
const supports = JSON.parse(fs.readFileSync("./data/supports.json", "utf8"));
const eventsDoc = JSON.parse(fs.readFileSync("./data/events.json", "utf8"));
const research = JSON.parse(fs.readFileSync("./data/support-events-research-26.json", "utf8"));

const nameToId = new Map(skills.map((s) => [s.name, s.id]));
const unresolved = [];

function resolveSkill(sk) {
  const id = nameToId.get(sk.skillName);
  if (id == null) {
    unresolved.push(sk.skillName);
    return { ...sk, skillId: null };
  }
  return { ...sk, skillId: id };
}

function resolveSkills(list) {
  return (list || []).map(resolveSkill);
}

function toEventEntry(raw) {
  const { supportId: _sid, _source, _note, ...evt } = raw;
  const out = { ...evt };
  out.label = formatEventLabel(out.supportNameMatch, out.label);
  if (out.skills) out.skills = resolveSkills(out.skills);
  if (out.choices) {
    out.choices = formatEventChoices(
      out.choices.map((c) => ({
        ...c,
        skills: resolveSkills(c.skills),
      }))
    );
    if (out.choices.length === 0) {
      throw new Error(`event ${out.id}: ヒント付き選択肢が0件`);
    }
    if (!out.choices.some((c) => c.id === out.defaultChoiceId)) {
      throw new Error(
        `event ${out.id}: defaultChoiceId "${out.defaultChoiceId}" が choices に無い`
      );
    }
  }
  return out;
}

const NEW_TITLES = [
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
];

const newEvents = research.map(toEventEntry);
const existingIds = new Set((eventsDoc.events || []).map((e) => e.id));
for (const e of newEvents) {
  if (existingIds.has(e.id)) {
    console.error("duplicate id:", e.id);
    process.exit(1);
  }
}

eventsDoc.events = [...(eventsDoc.events || []), ...newEvents];

const newNames = [];
for (const t of NEW_TITLES) {
  const hit = supports.find((s) => s.name.includes(t));
  if (!hit) {
    console.error("support not found:", t);
    process.exit(1);
  }
  // prioritySupportNames は [タイトル] キャラ名 形式（スペースあり）
  const m = hit.name.match(/^\[([^\]]+)\](.+)$/);
  const display = m ? `[${m[1]}] ${m[2].trim()}` : hit.name;
  newNames.push(display);
}

eventsDoc.prioritySupportNames = [...eventsDoc.prioritySupportNames, ...newNames];

fs.writeFileSync("./data/events.json", JSON.stringify(eventsDoc, null, 2), "utf8");
console.log(`merged ${newEvents.length} events, prioritySupportNames=${eventsDoc.prioritySupportNames.length}`);

if (unresolved.length) {
  const unique = [...new Set(unresolved)];
  console.error("unresolved skill names:", unique);
  process.exit(1);
}
