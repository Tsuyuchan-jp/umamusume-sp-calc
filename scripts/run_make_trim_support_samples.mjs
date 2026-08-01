/**
 * 枠外余白トリム before/after サンプルのランチャ。
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const SCRIPT = path.join(REPO_ROOT, "scripts", "make_trim_support_samples.py");

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

const python = findPython();
if (!python) {
  console.error("Pillow 用 Python venv が見つかりません。");
  process.exit(1);
}

const r = spawnSync(python, [SCRIPT, ...process.argv.slice(2)], {
  cwd: REPO_ROOT,
  stdio: "inherit",
});
process.exit(r.status ?? 1);
