import fs from "node:fs";
import { renderPrioritySupports } from "./render_priority_supports.mjs";

const supports = JSON.parse(fs.readFileSync("./data/supports.json", "utf8"));
const eventsDoc = JSON.parse(fs.readFileSync("./data/events.json", "utf8"));

/** prioritySupportNames と同順のタイトル部分（supportNameMatch 用） */
const titles = (eventsDoc.prioritySupportNames || []).map((display) => {
  const m = display.match(/^\[([^\]]+)\]/);
  return m ? m[1] : display;
});

const priority = [];
for (const t of titles) {
  const hit = supports.find((x) => x.title === t || x.name.includes(`[${t}]`));
  console.log(t, hit ? `${hit.id}:${hit.name}` : "NONE");
  if (hit) priority.push({ id: hit.id, title: t, name: hit.name });
}

eventsDoc.prioritySupports = priority;
eventsDoc.prioritySupportIds = priority.map((p) => p.id);
fs.writeFileSync("./data/events.json", JSON.stringify(eventsDoc, null, 2), "utf8");
console.log("updated events.json with", priority.length, "priority ids");
renderPrioritySupports();
