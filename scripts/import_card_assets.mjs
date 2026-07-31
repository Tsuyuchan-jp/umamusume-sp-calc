/**
 * flat PNG (.cache/asset-dump/flat) を assets 配下の {id}.webp に変換する。
 *
 * 変換はローカル venv の Pillow を使う（システム Python 不要）。
 * 必須リスト（優先40 + キャラ 107703）の欠落は exit 2。
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const PRIORITY_JSON = path.join(REPO_ROOT, "data", "priority-supports.json");
const FLAT_ROOT = path.join(REPO_ROOT, ".cache", "asset-dump", "flat");
const OUT_SUPPORTS = path.join(REPO_ROOT, "assets", "supports");
const OUT_CHARS = path.join(REPO_ROOT, "assets", "characters");
const CHARA_ID = 107703;
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

function loadRequiredSupportIds() {
  const data = JSON.parse(fs.readFileSync(PRIORITY_JSON, "utf8"));
  return data.supports.map((s) => Number(s.id));
}

function convertWithPillow(pythonExe, jobs) {
  const payload = JSON.stringify({
    jobs,
    maxEdge: MAX_EDGE,
    quality: WEBP_QUALITY,
  });
  const py = `
import json, sys
from pathlib import Path
from PIL import Image

cfg = json.loads(sys.stdin.read())
max_edge = int(cfg["maxEdge"])
quality = int(cfg["quality"])
ok = 0
fail = []
for job in cfg["jobs"]:
    src = Path(job["src"])
    dst = Path(job["dst"])
    try:
        if not src.is_file():
            fail.append(str(src))
            continue
        img = Image.open(src).convert("RGBA")
        w, h = img.size
        scale = min(1.0, max_edge / max(w, h))
        if scale < 1.0:
            img = img.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.Resampling.LANCZOS)
        dst.parent.mkdir(parents=True, exist_ok=True)
        img.save(dst, "WEBP", quality=quality, method=6)
        ok += 1
        print(f"ok {dst} ({dst.stat().st_size} bytes)")
    except Exception as e:
        fail.append(f"{src}: {e}")
        print(f"FAIL {src}: {e}", file=sys.stderr)
print(f"converted={ok} failed={len(fail)}")
if fail:
    sys.exit(1)
`;
  const r = spawnSync(pythonExe, ["-c", py], {
    input: payload,
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

  const supportIds = loadRequiredSupportIds();
  const jobs = [];
  const missing = [];

  for (const id of supportIds) {
    const src = path.join(FLAT_ROOT, "supports", `${id}.png`);
    const dst = path.join(OUT_SUPPORTS, `${id}.webp`);
    if (!fs.existsSync(src)) {
      missing.push(`supports/${id}.png`);
      continue;
    }
    jobs.push({ src, dst });
  }

  const charaSrc = path.join(FLAT_ROOT, "characters", `${CHARA_ID}.png`);
  const charaDst = path.join(OUT_CHARS, `${CHARA_ID}.webp`);
  if (!fs.existsSync(charaSrc)) {
    missing.push(`characters/${CHARA_ID}.png`);
  } else {
    jobs.push({ src: charaSrc, dst: charaDst });
  }

  if (missing.length) {
    console.error("必須 PNG 欠落:");
    for (const m of missing) console.error(`  - ${m}`);
    console.error("先に: npm run assets:extract");
    process.exit(2);
  }

  console.log(`import ${jobs.length} images via ${pythonExe}`);
  const ok = convertWithPillow(pythonExe, jobs);
  if (!ok) process.exit(1);

  // サイズ合計
  let total = 0;
  for (const id of supportIds) {
    const p = path.join(OUT_SUPPORTS, `${id}.webp`);
    total += fs.statSync(p).size;
  }
  total += fs.statSync(charaDst).size;
  console.log(`total webp bytes: ${total} (~${(total / 1024 / 1024).toFixed(2)} MiB)`);
  if (total > 5 * 1024 * 1024) {
    console.warn("警告: Phase1 目安 5MB を超えています。品質を下げて再 import してください。");
  }
}

main();
