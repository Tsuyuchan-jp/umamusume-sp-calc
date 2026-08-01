"""サポカ縦サンプル v4: thumb縦縮尺（マスク無し）＋右上タイプ印。

v3で採用候補となった stretch をベースに、assets/type-icons/{type}.webp を固定座標で重ねる。
レアバッジ・共有マスクは載せない。出力は .cache のみ。
"""
from __future__ import annotations

import json
import sqlite3
import struct
from pathlib import Path

import UnityPy
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DAT = Path(r"D:\DMM\umamusumeDMM\Umamusume\umamusume_Data\Persistent\dat")
META_FRESH = (
    REPO_ROOT / ".cache" / "umamusu-utils-old-jp" / "storage" / "meta_decrypted_persistent_fresh"
)
META_FALLBACK = REPO_ROOT / ".cache" / "umamusu-utils-old-jp" / "storage" / "meta_decrypted"
COMPARE_DIR = REPO_ROOT / ".cache" / "asset-dump" / "compare"
OUT_DIR = REPO_ROOT / ".cache" / "asset-dump" / "compare-vertical-v4"
DECRYPT_DIR = REPO_ROOT / ".cache" / "asset-dump" / "decrypted"
TYPE_ICONS_DIR = REPO_ROOT / "assets" / "type-icons"
SUPPORTS_JSON = REPO_ROOT / "data" / "supports.json"

# 優先枠からタイプ網羅サンプル
SAMPLE_IDS = [30305, 30304, 30302, 30297, 30294, 30289]  # friend/sta/spd/pow/guts/wit

VERT_W, VERT_H = 240, 320
ASPECT_W, ASPECT_H = 3, 4

# 右上固定（表示解像度 240x320 基準）
TYPE_ICON_SIZE = 42
TYPE_MARGIN_TOP = 8
TYPE_MARGIN_RIGHT = 8

AB_KEY = b"\x53\x2B\x46\x31\xE4\xA7\xB9\x47\x3E\x7C\xFB"


def derive_asset_key(key_long: int):
    if key_long == 0:
        return None
    key_long = int(key_long)
    if key_long >= 2**63:
        key_long -= 2**64
    key_bytes = struct.pack("<q", key_long)
    final_key = bytearray(len(AB_KEY) * 8)
    for i, b in enumerate(AB_KEY):
        for j in range(8):
            final_key[i * 8 + j] = b ^ key_bytes[j]
    return bytes(final_key)


def decrypt_blob(src: Path, key_long: int, dst: Path) -> Path:
    data = bytearray(src.read_bytes())
    decryption_key = derive_asset_key(key_long)
    if decryption_key and len(data) > 256:
        key_len = len(decryption_key)
        for j in range(256, len(data)):
            data[j] ^= decryption_key[j % key_len]
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_bytes(data)
    return dst


def dump_best_texture(bundle_path: Path, out_png: Path) -> Path | None:
    env = UnityPy.load(str(bundle_path))
    for obj in env.objects:
        if obj.type.name not in ("Texture2D", "Sprite"):
            continue
        try:
            data = obj.read()
            img = data.image
            if img is None:
                continue
            out_png.parent.mkdir(parents=True, exist_ok=True)
            img.save(out_png)
            return out_png
        except Exception as e:
            print(f"FAIL {bundle_path.name}: {e}")
    return None


def lookup_meta(conn: sqlite3.Connection, name: str) -> tuple[str, int] | None:
    row = conn.execute("SELECT h, e FROM a WHERE n=?", (name,)).fetchone()
    if not row:
        return None
    return row[0], int(row[1])


def resolve_meta_path() -> Path:
    if META_FRESH.exists():
        return META_FRESH
    if META_FALLBACK.exists():
        return META_FALLBACK
    raise FileNotFoundError(f"meta not found: {META_FRESH} or {META_FALLBACK}")


def extract_to_png(
    meta_name: str,
    dat_root: Path,
    meta_conn: sqlite3.Connection,
    out_png: Path,
) -> bool:
    hit = lookup_meta(meta_conn, meta_name)
    if not hit:
        print(f"MISSING meta: {meta_name}")
        return False
    h, e = hit
    src = dat_root / h[:2] / h
    if not src.exists():
        print(f"MISSING dat: {meta_name} -> {src}")
        return False
    dst = DECRYPT_DIR / meta_name.replace("/", "__")
    print(f"decrypt {meta_name} ({src.stat().st_size} bytes)")
    decrypt_blob(src, e, dst)
    saved = dump_best_texture(dst, out_png)
    return bool(saved)


def find_thumb(sid: int, dat_root: Path, meta_conn: sqlite3.Connection) -> Path | None:
    candidates = [
        COMPARE_DIR / f"support_thumb_{sid}.png",
        OUT_DIR / f"_src_thumb_{sid}.png",
        REPO_ROOT / ".cache" / "asset-dump" / "compare-vertical-v3" / f"_src_thumb_{sid}.png",
        REPO_ROOT
        / ".cache"
        / "asset-dump"
        / "sol1-ui-parts"
        / "key_candidates"
        / f"support_thumb_{sid}_512x512.png",
    ]
    for p in candidates:
        if p.exists():
            return p
    out = OUT_DIR / f"_src_thumb_{sid}.png"
    if extract_to_png(
        f"supportcard/support{sid}/support_thumb_{sid}",
        dat_root,
        meta_conn,
        out,
    ):
        return out
    return None


def vertical_stretch_keep_width(src: Image.Image) -> Image.Image:
    img = src.convert("RGBA")
    w, _h = img.size
    target_h = max(1, round(w * ASPECT_H / ASPECT_W))
    return img.resize((w, target_h), Image.Resampling.LANCZOS)


def load_support_type(sid: int) -> str:
    data = json.loads(SUPPORTS_JSON.read_text(encoding="utf-8"))
    items = data if isinstance(data, list) else data.get("supports", [])
    for row in items:
        if int(row.get("id", -1)) == sid:
            return str(row.get("type", "unknown"))
    return "unknown"


def load_type_icons() -> dict[str, Image.Image]:
    icons: dict[str, Image.Image] = {}
    for path in sorted(TYPE_ICONS_DIR.glob("*.webp")):
        icons[path.stem] = Image.open(path).convert("RGBA")
    return icons


def overlay_type_icon(base: Image.Image, icon: Image.Image) -> Image.Image:
    """表示解像度のベースに右上固定でタイプ印を重ねる。"""
    out = base.convert("RGBA").copy()
    icon_r = icon.resize((TYPE_ICON_SIZE, TYPE_ICON_SIZE), Image.Resampling.LANCZOS)
    x = out.size[0] - TYPE_MARGIN_RIGHT - TYPE_ICON_SIZE
    y = TYPE_MARGIN_TOP
    out.alpha_composite(icon_r, (x, y))
    return out


def write_readme() -> Path:
    text = f"""サポカ縦サンプル v4（stretch + タイプ印）
========================================

方針:
  - ベース: support_thumb を左右カットせず縦縮尺（3:4）— v3 stretch と同じ
  - 共有マスクは掛けない（虹枠を削らない）
  - タイプ印: assets/type-icons/{{type}}.webp を右上固定
      size={TYPE_ICON_SIZE}px, margin top={TYPE_MARGIN_TOP}, right={TYPE_MARGIN_RIGHT}
  - レアバッジは載せない

出力:
  {{id}}_stretch.png … タイプ印なし
  {{id}}_v4.png      … stretch + タイプ印（目視対象）
  sheet_v4.png       … 比較シート（左=stretch / 右=v4）
"""
    path = OUT_DIR / "README.txt"
    path.write_text(text, encoding="utf-8")
    return path


def main() -> int:
    dat_root = DEFAULT_DAT
    meta_path = resolve_meta_path()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"DAT={dat_root}")
    print(f"META={meta_path}")
    print(f"OUT={OUT_DIR}")
    print(f"TYPE_ICONS={TYPE_ICONS_DIR}")

    if not dat_root.exists():
        print(f"DAT_ROOT not found: {dat_root}")
        return 1

    icons = load_type_icons()
    if len(icons) < 6:
        print(f"type icons incomplete: {sorted(icons)}")
        return 1
    print(f"loaded icons: {sorted(icons)}")

    conn = sqlite3.connect(str(meta_path))
    ok = 0
    sheet_pairs: list[tuple[Image.Image, Image.Image, str]] = []

    for sid in SAMPLE_IDS:
        stype = load_support_type(sid)
        print(f"--- id={sid} type={stype} ---")
        thumb_path = find_thumb(sid, dat_root, conn)
        if thumb_path is None:
            print("SKIP: no thumb")
            continue
        if stype not in icons:
            print(f"SKIP: no icon for type={stype}")
            continue

        stretched = vertical_stretch_keep_width(Image.open(thumb_path))
        stretch_disp = stretched.resize((VERT_W, VERT_H), Image.Resampling.LANCZOS)
        with_type = overlay_type_icon(stretch_disp, icons[stype])

        stretch_disp.save(OUT_DIR / f"{sid}_stretch.png")
        with_type.save(OUT_DIR / f"{sid}_v4.png")
        print(f"  -> {sid}_v4.png ({VERT_W}x{VERT_H}) type={stype}")
        sheet_pairs.append((stretch_disp, with_type, f"{sid} {stype}"))
        ok += 1

    conn.close()

    if sheet_pairs:
        pad = 8
        cols = 2
        rows = len(sheet_pairs)
        sheet_w = cols * VERT_W + (cols + 1) * pad
        sheet_h = rows * VERT_H + (rows + 1) * pad
        sheet = Image.new("RGBA", (sheet_w, sheet_h), (32, 32, 36, 255))
        for ri, (left, right, _label) in enumerate(sheet_pairs):
            y = pad + ri * (VERT_H + pad)
            sheet.alpha_composite(left, (pad, y))
            sheet.alpha_composite(right, (pad + VERT_W + pad, y))
        sheet.save(OUT_DIR / "sheet_v4.png")
        print(f"sheet -> {(OUT_DIR / 'sheet_v4.png').resolve()}")

    print(write_readme().resolve())
    return 0 if ok == len(SAMPLE_IDS) else 2


if __name__ == "__main__":
    raise SystemExit(main())
