/**
 * 育成アイコン webp の内容重複を検出する。
 * 同一ハッシュ = 別カードなのに同じ画像（dress フォールバック誤りの目視前チェック用）
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const CHAR_DIR = path.join(REPO_ROOT, "assets", "characters");
const CHARACTERS_JSON = path.join(REPO_ROOT, "data", "characters.json");

function loadNames() {
  const items = JSON.parse(fs.readFileSync(CHARACTERS_JSON, "utf8"));
  return new Map(items.map((c) => [String(c.id), c.name]));
}

function hashFile(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function baseName(name) {
  const m = String(name).match(/^\[[^\]]+\](.+)$/);
  return m ? m[1] : name;
}

const names = loadNames();
const byHash = new Map();

for (const file of fs.readdirSync(CHAR_DIR).filter((f) => f.endsWith(".webp"))) {
  const id = file.replace(/\.webp$/, "");
  const hash = hashFile(path.join(CHAR_DIR, file));
  if (!byHash.has(hash)) byHash.set(hash, []);
  byHash.get(hash).push(id);
}

const dupes = [...byHash.entries()].filter(([, ids]) => ids.length > 1);
dupes.sort((a, b) => b[1].length - a[1].length);

console.log(`characters: ${byHash.size} unique hashes / ${names.size} cards`);
console.log(`duplicate groups: ${dupes.length}`);

for (const [hash, ids] of dupes) {
  const sorted = ids.map(Number).sort((a, b) => a - b);
  const label = sorted
    .map((id) => `${id} ${names.get(String(id)) ?? "?"}`)
    .join(" | ");
  const bases = new Set(sorted.map((id) => baseName(names.get(String(id)) ?? "")));
  const sameChara = bases.size === 1 ? "同一キャラ" : "別キャラ混在";
  console.log(`\n[${sameChara}] hash=${hash.slice(0, 12)}…`);
  console.log(label);
}

if (dupes.length) process.exit(2);
