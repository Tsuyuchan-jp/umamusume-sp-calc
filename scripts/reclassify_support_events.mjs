/**
 * 追加26種イベントの selection を旧11種ルールで一括正規化
 */
import fs from "node:fs";
import { NEW_MATCHES } from "./format_event_choice_labels.mjs";
import { normalizeEventSelection } from "./event_selection.mjs";

const eventsDoc = JSON.parse(fs.readFileSync("./data/events.json", "utf8"));
let autoCount = 0;
let singleCount = 0;

eventsDoc.events = (eventsDoc.events || []).map((evt) => {
  if (!NEW_MATCHES.has(evt.supportNameMatch)) return evt;
  const next = normalizeEventSelection(evt);
  if (next.selection === "auto") autoCount++;
  else singleCount++;
  return next;
});

fs.writeFileSync("./data/events.json", JSON.stringify(eventsDoc, null, 2), "utf8");
console.log(`reclassified: auto=${autoCount} single=${singleCount}`);
