/**
 * support_thumb 縦縮尺サンプル v3 のランチャ。
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const SCRIPT = path.join(REPO_ROOT, "scripts", "make_vertical_support_samples_v3.py");

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
  console.error(
    "UnityPy 用 Python venv が見つかりません。docs/ops/ASSETS.md の抽出手順を参照してください。"
  );
  process.exit(1);
}

const r = spawnSync(python, [SCRIPT, ...process.argv.slice(2)], {
  cwd: REPO_ROOT,
  stdio: "inherit",
});
process.exit(r.status ?? 1);
