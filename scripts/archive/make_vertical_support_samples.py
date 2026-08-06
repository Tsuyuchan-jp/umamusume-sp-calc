"""縦型サポートカード比較サンプルを生成する。

ゲーム内の縦デッキカードと比較できるよう、tex から 3:4 クロップし、
レアリティ板・タイプ表示を簡易オーバーレイした PNG を .cache に出力する。
assets/ は変更しない。
"""
from __future__ import annotations

import json
import sqlite3
import struct
from pathlib import Path

import UnityPy
from PIL import Image, ImageDraw, ImageFont

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DAT = Path(r"D:\DMM\umamusumeDMM\Umamusume\umamusume_Data\Persistent\dat")
META_FRESH = (
    REPO_ROOT / ".cache" / "umamusu-utils-old-jp" / "storage" / "meta_decrypted_persistent_fresh"
)
META_FALLBACK = REPO_ROOT / ".cache" / "umamusu-utils-old-jp" / "storage" / "meta_decrypted"
COMPARE_DIR = REPO_ROOT / ".cache" / "asset-dump" / "compare"
OUT_DIR = REPO_ROOT / ".cache" / "asset-dump" / "compare-vertical"
SUPPORTS_JSON = REPO_ROOT / "data" / "supports.json"
DECRYPT_DIR = REPO_ROOT / ".cache" / "asset-dump" / "decrypted"

# 比較サンプル対象 ID
SAMPLE_IDS = [30305, 30289, 30307, 30242]

# 縦型出力サイズ（幅:高さ = 3:4）
VERT_W, VERT_H = 240, 320

# タイプ表示（supports.json の type → 日本語略称と色）
TYPE_STYLE: dict[str, tuple[str, tuple[int, int, int, int]]] = {
    "speed": ("スピ", (80, 160, 240, 230)),
    "stamina": ("スタ", (240, 100, 100, 230)),
    "power": ("パワ", (240, 170, 60, 230)),
    "guts": ("根性", (240, 120, 160, 230)),
    "wit": ("賢さ", (100, 200, 120, 230)),
    "friend": ("友人", (180, 140, 220, 230)),
}

AB_KEY = b"\x53\x2B\x46\x31\xE4\xA7\xB9\x47\x3E\x7C\xFB"


def derive_asset_key(key_long: int):
    if key_long == 0:
        return None
    key_long = int(key_long)
    if key_long >= 2**63:
        key_long -= 2**64
    key_bytes = struct.pack("<q", key_long)
    base_key = AB_KEY
    base_len = len(base_key)
    final_key = bytearray(base_len * 8)
    for i in range(base_len):
        b = base_key[i]
        base_offset = i * 8
        for j in range(8):
            final_key[base_offset + j] = b ^ key_bytes[j]
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
    """Texture2D/Sprite を抽出し、最初に成功した画像を保存する。"""
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
    cur = conn.cursor()
    cur.execute("SELECT h, e FROM a WHERE n=?", (name,))
    row = cur.fetchone()
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
    """meta+dat からアセットを復号・抽出し out_png に保存する。"""
    hit = lookup_meta(meta_conn, meta_name)
    if not hit:
        print(f"MISSING meta: {meta_name}")
        return False
    h, e = hit
    src = dat_root / h[:2] / h
    if not src.exists():
        print(f"MISSING dat: {meta_name} -> {src}")
        return False
    dst = DECRYPT_DIR / meta_name
    print(f"decrypt {meta_name} ({src.stat().st_size} bytes, e={e})")
    decrypt_blob(src, e, dst)
    saved = dump_best_texture(dst, out_png)
    if not saved:
        print(f"NO TEXTURE: {meta_name}")
        return False
    print(f"  ok -> {out_png} ({out_png.stat().st_size} bytes)")
    return True


def find_existing(paths: list[Path]) -> Path | None:
    for p in paths:
        if p.exists():
            return p
    return None


def ensure_support_assets(
    sid: int,
    dat_root: Path,
    meta_conn: sqlite3.Connection,
) -> tuple[Path | None, Path | None]:
    """tex（または thumb）と support_card_s のパスを確保して返す。"""
    tex = find_existing(
        [
            COMPARE_DIR / f"tex_support_card_{sid}.png",
            COMPARE_DIR / f"tex_support_card_{sid}__tex_support_card_{sid}.png",
            COMPARE_DIR / f"support_thumb_{sid}.png",
            COMPARE_DIR / f"support_thumb_{sid}__support_thumb_{sid}.png",
        ]
    )
    card_s = find_existing(
        [
            COMPARE_DIR / f"support_card_s_{sid}.png",
            COMPARE_DIR / f"support_card_s_{sid}__support_card_s_{sid}.png",
        ]
    )

    if tex is None:
        # tex 本体を優先、無ければ thumb
        out_tex = COMPARE_DIR / f"tex_support_card_{sid}.png"
        ok = extract_to_png(
            f"supportcard/support{sid}/tex_support_card_{sid}",
            dat_root,
            meta_conn,
            out_tex,
        )
        if not ok:
            out_thumb = COMPARE_DIR / f"support_thumb_{sid}.png"
            ok = extract_to_png(
                f"supportcard/support{sid}/support_thumb_{sid}",
                dat_root,
                meta_conn,
                out_thumb,
            )
            tex = out_thumb if ok else None
        else:
            tex = out_tex

    if card_s is None:
        out_s = COMPARE_DIR / f"support_card_s_{sid}.png"
        ok = extract_to_png(
            f"supportcard/support{sid}/support_card_s_{sid}",
            dat_root,
            meta_conn,
            out_s,
        )
        card_s = out_s if ok else None

    return tex, card_s


def ensure_rarity_ui(dat_root: Path, meta_conn: sqlite3.Connection) -> Path | None:
    """SSR 用レアリティ板（supportcard_rarity_02）を確保する。"""
    existing = find_existing(
        [
            COMPARE_DIR / "ui" / "supportcard_rarity_02__tex0.png",
            COMPARE_DIR / "ui" / "supportcard_rarity_02.png",
        ]
    )
    if existing:
        return existing
    out = COMPARE_DIR / "ui" / "supportcard_rarity_02__tex0.png"
    meta_name = (
        "uianimation/flash/singlemode/supportrarity/supportcard_rarity_02"
    )
    if extract_to_png(meta_name, dat_root, meta_conn, out):
        return out
    return None


def vertical_crop_3x4(src: Image.Image, size: tuple[int, int] = (VERT_W, VERT_H)) -> Image.Image:
    """正方形（または任意）画像から中央の 3:4 帯を切り出し、指定サイズにリサイズする。"""
    img = src.convert("RGBA")
    w, h = img.size
    new_w = int(h * 3 / 4)
    if new_w > w:
        # 横が足りない場合は高さ側を中央クロップ
        new_h = int(w * 4 / 3)
        top = (h - new_h) // 2
        cropped = img.crop((0, top, w, top + new_h))
    else:
        left = (w - new_w) // 2
        cropped = img.crop((left, 0, left + new_w, h))
    return cropped.resize(size, Image.Resampling.LANCZOS)


def load_support_meta(sid: int) -> dict:
    data = json.loads(SUPPORTS_JSON.read_text(encoding="utf-8"))
    items = data if isinstance(data, list) else data.get("supports", [])
    for row in items:
        if int(row.get("id", -1)) == sid:
            return row
    return {}


def get_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    """日本語表示可能なフォントを探す。見つからなければデフォルト。"""
    candidates = [
        Path(r"C:\Windows\Fonts\meiryo.ttc"),
        Path(r"C:\Windows\Fonts\YuGothM.ttc"),
        Path(r"C:\Windows\Fonts\msgothic.ttc"),
        Path(r"C:\Windows\Fonts\segoeui.ttf"),
    ]
    for path in candidates:
        if path.exists():
            try:
                return ImageFont.truetype(str(path), size=size, index=0)
            except OSError:
                continue
    return ImageFont.load_default()


def draw_rounded_rect(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    fill: tuple[int, int, int, int],
    radius: int = 6,
) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def composite_vertical(
    crop: Image.Image,
    rarity_png: Path | None,
    support_type: str,
    rarity_label: str = "SSR",
) -> Image.Image:
    """縦クロップにレアリティ板（または文字）とタイプアイコンを重ねる。"""
    base = crop.convert("RGBA").copy()
    draw = ImageDraw.Draw(base)

    # 左上: レアリティ板 or SSR 文字
    if rarity_png and rarity_png.exists():
        badge = Image.open(rarity_png).convert("RGBA")
        # 幅約 50px にリサイズ
        tw = 50
        th = max(1, int(badge.height * tw / badge.width))
        badge = badge.resize((tw, th), Image.Resampling.LANCZOS)
        base.alpha_composite(badge, (6, 6))
    else:
        font = get_font(14)
        draw.rounded_rectangle((6, 6, 52, 28), radius=4, fill=(40, 40, 60, 220))
        draw.text((10, 8), rarity_label, fill=(255, 220, 80, 255), font=font)

    # 右上: タイプ色付き角丸＋略称
    label, color = TYPE_STYLE.get(support_type, (support_type[:2], (120, 120, 120, 230)))
    font_t = get_font(13)
    box_w, box_h = 52, 26
    x0 = base.width - box_w - 6
    y0 = 6
    draw_rounded_rect(draw, (x0, y0, x0 + box_w, y0 + box_h), color, radius=6)
    # 文字を中央寄せ
    bbox = draw.textbbox((0, 0), label, font=font_t)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    tx = x0 + (box_w - tw) // 2
    ty = y0 + (box_h - th) // 2 - 1
    draw.text((tx, ty), label, fill=(255, 255, 255, 255), font=font_t)

    return base


def make_contact_sheet(rows: list[tuple[Image.Image, Image.Image, Image.Image]], labels: list[str]) -> Image.Image:
    """各 ID を1行、列=[card_s | vertical_crop | vertical_composited] のコンタクトシート。"""
    pad = 12
    label_h = 28
    cell_w = VERT_W
    # card_s は正方形なので縦に合わせて中央配置用にセル高さは VERT_H
    cell_h = VERT_H
    cols = 3
    n = len(rows)
    sheet_w = pad + cols * (cell_w + pad)
    sheet_h = pad + n * (label_h + cell_h + pad)
    sheet = Image.new("RGBA", (sheet_w, sheet_h), (32, 34, 40, 255))
    draw = ImageDraw.Draw(sheet)
    font = get_font(16)
    headers = ["card_s", "vertical_crop", "composited"]

    for r, (card_s, crop, comp) in enumerate(rows):
        y_label = pad + r * (label_h + cell_h + pad)
        draw.text((pad, y_label), f"id={labels[r]}", fill=(230, 230, 230, 255), font=font)
        y = y_label + label_h
        images = [card_s, crop, comp]
        for c, im in enumerate(images):
            x = pad + c * (cell_w + pad)
            # ヘッダは1行目のみ
            if r == 0:
                draw.text((x, y_label - 2), headers[c], fill=(160, 170, 180, 255), font=get_font(12))
            tile = im.convert("RGBA")
            # card_s は正方形なのでセル内中央にフィット
            if tile.width != cell_w or tile.height != cell_h:
                # アスペクト比を保ってセル内に収める
                scale = min(cell_w / tile.width, cell_h / tile.height)
                nw = max(1, int(tile.width * scale))
                nh = max(1, int(tile.height * scale))
                tile = tile.resize((nw, nh), Image.Resampling.LANCZOS)
            ox = x + (cell_w - tile.width) // 2
            oy = y + (cell_h - tile.height) // 2
            sheet.alpha_composite(tile, (ox, oy))
    return sheet


def write_readme(out_dir: Path) -> Path:
    text = (
        "各ファイル: {id}_current_card_s.png=現行正方形カード、"
        "{id}_vertical_crop.png=tex中央3:4切り出し、"
        "{id}_vertical_composited.png=レアリティ/タイプ重ね、"
        "sheet_compare.png=横並び比較シート。\n"
    )
    path = out_dir / "README.txt"
    path.write_text(text, encoding="utf-8")
    return path


def main() -> int:
    dat_root = DEFAULT_DAT
    meta_path = resolve_meta_path()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    COMPARE_DIR.mkdir(parents=True, exist_ok=True)
    (COMPARE_DIR / "ui").mkdir(parents=True, exist_ok=True)

    print(f"DAT={dat_root}")
    print(f"META={meta_path}")
    print(f"OUT={OUT_DIR}")

    if not dat_root.exists():
        print(f"DAT_ROOT not found: {dat_root}")
        return 1

    conn = sqlite3.connect(str(meta_path))
    rarity_ui = ensure_rarity_ui(dat_root, conn)

    sheet_rows: list[tuple[Image.Image, Image.Image, Image.Image]] = []
    outputs: list[tuple[Path, tuple[int, int]]] = []

    for sid in SAMPLE_IDS:
        print(f"--- id={sid} ---")
        tex_path, card_s_path = ensure_support_assets(sid, dat_root, conn)
        if tex_path is None:
            print(f"SKIP: no tex/thumb for {sid}")
            continue
        if card_s_path is None:
            print(f"WARN: no support_card_s for {sid}")

        tex_img = Image.open(tex_path)
        crop = vertical_crop_3x4(tex_img)
        meta = load_support_meta(sid)
        stype = str(meta.get("type", "unknown"))
        rarity = str(meta.get("rarity", "SSR"))
        composited = composite_vertical(crop, rarity_ui, stype, rarity_label=rarity)

        out_crop = OUT_DIR / f"{sid}_vertical_crop.png"
        out_comp = OUT_DIR / f"{sid}_vertical_composited.png"
        out_s = OUT_DIR / f"{sid}_current_card_s.png"
        crop.save(out_crop)
        composited.save(out_comp)
        outputs.append((out_crop, crop.size))
        outputs.append((out_comp, composited.size))

        if card_s_path and card_s_path.exists():
            card_s_img = Image.open(card_s_path).convert("RGBA")
            out_s.write_bytes(card_s_path.read_bytes())
            outputs.append((out_s, card_s_img.size))
        else:
            # プレースホルダ（灰色）
            card_s_img = Image.new("RGBA", (256, 256), (80, 80, 80, 255))
            card_s_img.save(out_s)
            outputs.append((out_s, card_s_img.size))

        sheet_rows.append((card_s_img, crop, composited))
        print(f"  crop={out_crop}")
        print(f"  composited={out_comp}")
        print(f"  card_s={out_s}")

    conn.close()

    if sheet_rows:
        sheet = make_contact_sheet(sheet_rows, [str(i) for i in SAMPLE_IDS[: len(sheet_rows)]])
        sheet_path = OUT_DIR / "sheet_compare.png"
        sheet.save(sheet_path)
        outputs.append((sheet_path, sheet.size))
        print(f"sheet -> {sheet_path}")

    readme = write_readme(OUT_DIR)
    outputs.append((readme, (0, 0)))

    print("=== outputs ===")
    for path, size in outputs:
        if size == (0, 0):
            print(f"{path.resolve()}")
        else:
            print(f"{path.resolve()}  {size[0]}x{size[1]}")

    return 0 if len(sheet_rows) == len(SAMPLE_IDS) else 2


if __name__ == "__main__":
    raise SystemExit(main())
