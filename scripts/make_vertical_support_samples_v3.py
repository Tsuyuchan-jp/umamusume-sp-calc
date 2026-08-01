"""サポカ縦型サンプル v3: support_thumb を左右カットせず縦縮尺＋角丸マスク。

枠は thumb に焼き付きの本物をそのまま利用する。レアバッジ・タイプ印は載せない。
出力先は .cache のみ（assets/ は変更しない）。
"""
from __future__ import annotations

import sqlite3
import struct
from pathlib import Path

import UnityPy
from PIL import Image, ImageDraw

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DAT = Path(r"D:\DMM\umamusumeDMM\Umamusume\umamusume_Data\Persistent\dat")
META_FRESH = (
    REPO_ROOT / ".cache" / "umamusu-utils-old-jp" / "storage" / "meta_decrypted_persistent_fresh"
)
META_FALLBACK = REPO_ROOT / ".cache" / "umamusu-utils-old-jp" / "storage" / "meta_decrypted"
COMPARE_DIR = REPO_ROOT / ".cache" / "asset-dump" / "compare"
OUT_DIR = REPO_ROOT / ".cache" / "asset-dump" / "compare-vertical-v3"
UI_PARTS = OUT_DIR / "ui-parts"
DECRYPT_DIR = REPO_ROOT / ".cache" / "asset-dump" / "decrypted"

SAMPLE_IDS = [30305, 30289, 30307, 30242]

# 表示用出力（3:4）
VERT_W, VERT_H = 240, 320
ASPECT_W, ASPECT_H = 3, 4

META_THUMB_MASK = "supportcard/support00000/tex_support_thumb_00000_mask"

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
    print(f"decrypt {meta_name} ({src.stat().st_size} bytes, e={e})")
    decrypt_blob(src, e, dst)
    saved = dump_best_texture(dst, out_png)
    if not saved:
        print(f"NO TEXTURE: {meta_name}")
        return False
    print(f"  ok -> {out_png}")
    return True


def ensure_png(
    meta_name: str,
    out_png: Path,
    dat_root: Path,
    meta_conn: sqlite3.Connection,
) -> Path | None:
    if out_png.exists():
        return out_png
    out_png.parent.mkdir(parents=True, exist_ok=True)
    if extract_to_png(meta_name, dat_root, meta_conn, out_png):
        return out_png
    return None


def find_thumb(sid: int, dat_root: Path, meta_conn: sqlite3.Connection) -> Path | None:
    candidates = [
        COMPARE_DIR / f"support_thumb_{sid}.png",
        COMPARE_DIR / f"support_thumb_{sid}__support_thumb_{sid}.png",
        OUT_DIR / f"_src_thumb_{sid}.png",
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


def vertical_stretch_keep_width(
    src: Image.Image,
    aspect_w: int = ASPECT_W,
    aspect_h: int = ASPECT_H,
) -> Image.Image:
    """左右を削らず、幅を維持して縦方向だけ伸ばす（非等方スケール）。"""
    img = src.convert("RGBA")
    w, _h = img.size
    target_h = max(1, round(w * aspect_h / aspect_w))
    return img.resize((w, target_h), Image.Resampling.LANCZOS)


def load_thumb_mask_alpha(
    dat_root: Path,
    meta_conn: sqlite3.Connection,
    size: tuple[int, int],
) -> tuple[Image.Image, str]:
    out = UI_PARTS / "mask_thumb_alpha_source.png"
    path = ensure_png(META_THUMB_MASK, out, dat_root, meta_conn)
    if path and path.exists():
        im = Image.open(path).convert("RGBA")
        alpha = im.split()[3].resize(size, Image.Resampling.LANCZOS)
        lo, hi = alpha.getextrema()
        if lo < 250 or hi < 255:
            return alpha, f"thumb mask {META_THUMB_MASK} -> {size[0]}x{size[1]}"
    radius = max(8, min(size) // 12)
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    return mask, f"fallback rounded-rect r={radius}"


def multiply_alpha(a: Image.Image, mask_l: Image.Image) -> Image.Image:
    a = a.convert("L")
    if a.size != mask_l.size:
        a = a.resize(mask_l.size, Image.Resampling.LANCZOS)
    mask_l = mask_l.convert("L")
    out = Image.new("L", mask_l.size)
    pa, pb, po = a.load(), mask_l.load(), out.load()
    w, h = mask_l.size
    for y in range(h):
        for x in range(w):
            po[x, y] = (pa[x, y] * pb[x, y]) // 255
    return out


def apply_mask(img: Image.Image, alpha: Image.Image) -> Image.Image:
    base = img.convert("RGBA")
    r, g, b, a = base.split()
    merged = multiply_alpha(a, alpha)
    return Image.merge("RGBA", (r, g, b, merged))


def resize_to_display(img: Image.Image, size: tuple[int, int] = (VERT_W, VERT_H)) -> Image.Image:
    return img.resize(size, Image.Resampling.LANCZOS)


def write_readme(mask_note: str) -> Path:
    text = f"""サポカ縦サンプル v3（thumb 縦縮尺）
================================

方針:
  - ベース: support_thumb_{{id}}（虹/金/銀枠は焼き付き）
  - 左右カットなし。幅維持で縦だけ {ASPECT_H}:{ASPECT_W} に伸ばす
  - 角丸: {mask_note}
  - 載せない: レアバッジ / タイプ印 / 縁伸ばし近似枠

出力:
  {{id}}_v3.png           … 縦縮尺＋マスク（{VERT_W}x{VERT_H}）
  {{id}}_stretch.png      … 縦縮尺のみ（マスク前・比較用）
  {{id}}_square.png       … 元 thumb 正方形（{VERT_W}x{VERT_W}）
  sheet_v3.png            … 上記3列のコンタクトシート
  README.txt              … 本ファイル

assets/ は変更していません。
"""
    path = OUT_DIR / "README.txt"
    path.write_text(text, encoding="utf-8")
    return path


def main() -> int:
    dat_root = DEFAULT_DAT
    meta_path = resolve_meta_path()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    UI_PARTS.mkdir(parents=True, exist_ok=True)

    print(f"DAT={dat_root}")
    print(f"META={meta_path}")
    print(f"OUT={OUT_DIR}")

    if not dat_root.exists():
        print(f"DAT_ROOT not found: {dat_root}")
        return 1

    conn = sqlite3.connect(str(meta_path))
    mask_note = ""
    ok_count = 0
    sheet_rows: list[list[Image.Image]] = []

    for sid in SAMPLE_IDS:
        print(f"--- id={sid} ---")
        thumb_path = find_thumb(sid, dat_root, conn)
        if thumb_path is None:
            print(f"SKIP: no thumb for {sid}")
            continue

        thumb = Image.open(thumb_path)
        stretched = vertical_stretch_keep_width(thumb)
        sw, sh = stretched.size
        mask_alpha, mask_note = load_thumb_mask_alpha(dat_root, conn, (sw, sh))
        masked = apply_mask(stretched, mask_alpha)

        square_disp = resize_to_display(thumb.convert("RGBA"), (VERT_W, VERT_W))
        stretch_disp = resize_to_display(stretched)
        final_disp = resize_to_display(masked)

        stretch_disp.save(OUT_DIR / f"{sid}_stretch.png")
        final_disp.save(OUT_DIR / f"{sid}_v3.png")
        square_disp.save(OUT_DIR / f"{sid}_square.png")
        print(
            f"  src {thumb.size[0]}x{thumb.size[1]} "
            f"-> stretch {sw}x{sh} -> out {VERT_W}x{VERT_H}"
        )
        print(f"  mask: {mask_note}")

        sheet_rows.append([square_disp, stretch_disp, final_disp])
        ok_count += 1

    conn.close()

    if sheet_rows:
        # 4枚分を縦に並べた大きなシート
        pad = 8
        label_h = 4
        tile_w, tile_h_sq, tile_h_vert = VERT_W, VERT_W, VERT_H
        cols = 3
        rows = len(sheet_rows)
        sheet_w = cols * tile_w + (cols + 1) * pad
        row_h = max(tile_h_sq, tile_h_vert)
        sheet_h = rows * (row_h + label_h) + (rows + 1) * pad
        sheet = Image.new("RGBA", (sheet_w, sheet_h), (32, 32, 36, 255))
        for ri, tiles in enumerate(sheet_rows):
            y = pad + ri * (row_h + label_h + pad)
            for ci, tile in enumerate(tiles):
                x = pad + ci * (tile_w + pad)
                th = tile_h_sq if ci == 0 else tile_h_vert
                t = tile.resize((tile_w, th), Image.Resampling.LANCZOS)
                sheet.alpha_composite(t, (x, y + label_h))
        sheet_path = OUT_DIR / "sheet_v3.png"
        sheet.save(sheet_path)
        print(f"sheet -> {sheet_path.resolve()} {sheet.size[0]}x{sheet.size[1]}")

    readme = write_readme(mask_note or "(n/a)")
    print(f"readme -> {readme.resolve()}")

    print("=== outputs ===")
    for p in sorted(OUT_DIR.glob("*.png")):
        im = Image.open(p)
        print(f"{p.name}  {im.size[0]}x{im.size[1]}")

    return 0 if ok_count == len(SAMPLE_IDS) else 2


if __name__ == "__main__":
    raise SystemExit(main())
