import fs from "node:fs";

const supports = JSON.parse(fs.readFileSync("./data/supports.json", "utf8"));
const titles = [
  "一杯のノスタルジア",
  "その執念は怒濤が如く",
  "永久の誓い、永久の輝き",
  "刀光散らしてClash！",
  "全てに挑む勇ましき者",
  "白に至る覚悟",
  "Innovator",
  "ゆかし、きらめきの旅路",
  "心覚えし、京の華",
  "天才的ユートピア",
  "Zirkus der Träume",
];

const priority = [];
for (const t of titles) {
  const hit = supports.find((x) => x.title === t || x.name.includes(`[${t}]`));
  console.log(t, hit ? `${hit.id}:${hit.name}` : "NONE");
  if (hit) priority.push({ id: hit.id, title: t, name: hit.name });
}

const events = JSON.parse(fs.readFileSync("./data/events.json", "utf8"));
events.prioritySupports = priority;
events.prioritySupportIds = priority.map((p) => p.id);
fs.writeFileSync("./data/events.json", JSON.stringify(events, null, 2), "utf8");
console.log("updated events.json with", priority.length, "priority ids");
