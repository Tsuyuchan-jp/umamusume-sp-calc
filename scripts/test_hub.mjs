/**
 * ハブ接続の判定と対象サポカ集合。
 * 隣に umamusume-data があれば、棚の実ファイルでも件数を確認する。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  allowedSupportIds,
  hubFileUrl,
  hubManifestUrl,
  hubPreferenceFromSearch,
} from "../app/js/hub.js";

let failed = 0;
function check(name, ok, detail = "") {
  if (ok) console.log(`ok  ${name}`);
  else {
    failed += 1;
    console.error(`NG  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

check("?hub=local → local", hubPreferenceFromSearch("?hub=local") === "local");
check("?hub=0 → local", hubPreferenceFromSearch("hub=0") === "local");
check("?hub=remote → remote", hubPreferenceFromSearch("?hub=remote") === "remote");
check("空は auto", hubPreferenceFromSearch("") === "auto");

const supports = [{ id: 1 }, { id: 2 }, { id: 3 }];
const events = { prioritySupportIds: [2, 3, 9] };
const allowed = allowedSupportIds(supports, events);
check("events ∩ supports", allowed.size === 2 && allowed.has(2) && allowed.has(3) && !allowed.has(9));

const hubFiltered = allowedSupportIds([{ id: 2 }, { id: 3 }], events);
check("ハブの対象分だけでも events で絞る", hubFiltered.size === 2);

check(
  "hubFileUrl に版クエリ",
  hubFileUrl("https://example.test/hub/", "data/skills.json", "0.1.1") ===
    "https://example.test/hub/data/skills.json?v=0.1.1"
);
check(
  "hubManifestUrl に時刻クエリ",
  hubManifestUrl("https://example.test/hub/", 1700000000000) ===
    "https://example.test/hub/manifest.json?t=1700000000000"
);

const hubDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../umamusume-data");
const manifestPath = path.join(hubDir, "manifest.json");
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const supportsPath = path.join(hubDir, manifest.files.supports.path);
  const eventsPath = path.join(hubDir, manifest.files.events.path);
  const hubSupports = JSON.parse(fs.readFileSync(supportsPath, "utf8"));
  const hubEvents = JSON.parse(fs.readFileSync(eventsPath, "utf8"));
  const ids = allowedSupportIds(hubSupports, hubEvents);
  const expected = Number(manifest.files.supports.count);
  check(
    "棚の supports 件数と対象集合が一致",
    ids.size === expected && expected > 0,
    `ids=${ids.size} count=${expected}`
  );
} else {
  console.log("skip 隣の umamusume-data が無いため棚ファイル検証は省略");
}

if (failed) process.exit(1);
console.log("test_hub: すべて成功");
