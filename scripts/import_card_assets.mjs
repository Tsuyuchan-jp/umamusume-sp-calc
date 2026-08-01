/**
 * flat PNG (.cache/asset-dump/flat) を assets 配下の {id}.webp に変換する。
 *
 * サポカ: support_thumb → 縦縮尺 + タイプ印合成（240×320）
 * キャラ: chr_icon flat → 長辺 256px 以内に縮小
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const PRIORITY_JSON = path.join(REPO_ROOT, "data", "priority-supports.json");
const CHARACTERS_JSON = path.join(REPO_ROOT, "data", "characters.json");
const FLAT_ROOT = path.join(REPO_ROOT, ".cache", "asset-dump", "flat");
const OUT_SUPPORTS = path.join(REPO_ROOT, "assets", "supports");
const OUT_CHARS = path.join(REPO_ROOT, "assets", "characters");
const IMPORT_SCRIPT = path.join(REPO_ROOT, "scripts", "import_card_images.py");
const MAX_EDGE = 256;
const WEBP_QUALITY = 82;

const VENV_CANDIDATES = [
  path.join(REPO_ROOT, ".cache", "umamusu-utils-old-jp", ".venv", "Scripts", "python.exe"),
  path.join(REPO_ROOT, ".cache", "umamusu-utils", ".venv", "Scripts", "python.exe"),
];

function findPython() {
  for (const p of VENV_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function loadPrioritySupports() {
  const data = JSON.parse(fs.readFileSync(PRIORITY_JSON, "utf8"));
  return data.supports.map((s) => ({
    id: Number(s.id),
    type: String(s.type),
  }));
}

function loadCharacterIds() {
  const data = JSON.parse(fs.readFileSync(CHARACTERS_JSON, "utf8"));
  const items = Array.isArray(data) ? data : data.characters || [];
  return items.map((c) => Number(c.id));
}

function convertWithPillow(pythonExe, payload) {
  const r = spawnSync(pythonExe, [IMPORT_SCRIPT], {
    input: JSON.stringify(payload),
    encoding: "utf8",
    cwd: REPO_ROOT,
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  return r.status === 0;
}

function main() {
  const pythonExe = findPython();
  if (!pythonExe) {
    console.error(
      "Pillow 用 Python venv が見つかりません。.cache/umamusu-utils-old-jp/.venv を用意するか、先に assets:extract の環境を整えてください。"
    );
    process.exit(1);
  }

  const supports = loadPrioritySupports();
  const characterIds = loadCharacterIds();
  const supportJobs = [];
  const characterJobs = [];
  const missingSupports = [];
  const missingCharacters = [];

  for (const { id, type } of supports) {
    const src = path.join(FLAT_ROOT, "supports", `${id}.png`);
    const dst = path.join(OUT_SUPPORTS, `${id}.webp`);
    if (!fs.existsSync(src)) {
      missingSupports.push(`supports/${id}.png`);
      continue;
    }
    supportJobs.push({ src, dst, type });
  }

  for (const id of characterIds) {
    const src = path.join(FLAT_ROOT, "characters", `${id}.png`);
    const dst = path.join(OUT_CHARS, `${id}.webp`);
    if (!fs.existsSync(src)) {
      missingCharacters.push(`characters/${id}.png`);
      continue;
    }
    characterJobs.push({ src, dst });
  }

  if (missingSupports.length) {
    console.error("必須サポカ PNG 欠落:");
    for (const m of missingSupports) console.error(`  - ${m}`);
    console.error("先に: npm run assets:extract");
    process.exit(2);
  }

  if (missingCharacters.length) {
    console.warn(`育成 PNG 欠落: ${missingCharacters.length}/${characterIds.length}`);
    for (const m of missingCharacters.slice(0, 20)) console.warn(`  - ${m}`);
    if (missingCharacters.length > 20) {
      console.warn(`  ... and ${missingCharacters.length - 20} more`);
    }
  }

  console.log(
    `import supports=${supportJobs.length} characters=${characterJobs.length} via ${pythonExe}`
  );
  const ok = convertWithPillow(pythonExe, {
    supports: supportJobs,
    characters: characterJobs,
    maxEdge: MAX_EDGE,
    quality: WEBP_QUALITY,
  });
  if (!ok) process.exit(1);

  let total = 0;
  for (const { id } of supports) {
    const p = path.join(OUT_SUPPORTS, `${id}.webp`);
    if (fs.existsSync(p)) total += fs.statSync(p).size;
  }
  for (const id of characterIds) {
    const p = path.join(OUT_CHARS, `${id}.webp`);
    if (fs.existsSync(p)) total += fs.statSync(p).size;
  }
  console.log(`total webp bytes: ${total} (~${(total / 1024 / 1024).toFixed(2)} MiB)`);
  if (total > 8 * 1024 * 1024) {
    console.warn("警告: 同梱合計が 8MB を超えています。品質を下げて再 import を検討してください。");
  }

  if (missingCharacters.length) process.exit(2);
}

main();
