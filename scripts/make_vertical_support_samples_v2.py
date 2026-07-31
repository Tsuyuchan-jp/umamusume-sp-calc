"""サポカ縦型サンプル v2: マスク・枠リング・実タイプアイコン合成。

tex を 3:4 クロップし、共有マスクで角丸、support_card_s から虹枠を推定、
実機のタイプアイコンを重ねて .cache に出力する。assets/ は変更しない。
"""
from __future__ import annotations

import json
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
OUT_DIR = REPO_ROOT / ".cache" / "asset-dump" / "compare-vertical-v2"
UI_PARTS = REPO_ROOT / ".cache" / "asset-dump" / "compare-vertical" / "ui-parts"
SUPPORTS_JSON = REPO_ROOT / "data" / "supports.json"
DECRYPT_DIR = REPO_ROOT / ".cache" / "asset-dump" / "decrypted"

SAMPLE_IDS = [30305, 30289, 30307, 30242]
VERT_W, VERT_H = 240, 320

# supports.json type → utx_ico_supportcharastatus_XX
TYPE_ICON_INDEX: dict[str, int] = {
    "speed": 0,
    "stamina": 1,
    "power": 2,
    "guts": 3,
    "wit": 4,
}

# master.mdb command_id → type（参考・supports.json 優先）
COMMAND_ID_TO_TYPE: dict[int, str] = {
    101: "speed",
    102: "power",
    103: "guts",
    105: "stamina",
    106: "wit",
}

AB_KEY = b"\x53\x2B\x46\x31\xE4\xA7\xB9\x47\x3E\x7C\xFB"

META_MASK = "supportcard/support00000/tex_support_card_00000_mask"
META_THUMB_MASK = "supportcard/support00000/tex_support_thumb_00000_mask"
META_TYPE_ICON = (
    "uianimation/flash/singlemode/statusicon/utx_ico_supportcharastatus_{idx:02d}"
)
META_RARITY = "uianimation/flash/singlemode/supportrarity/supportcard_rarity_02"


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
    print(f"  ok -> {out_png} ({out_png.stat().st_size} bytes)")
    return True


def find_existing(paths: list[Path]) -> Path | None:
    for p in paths:
        if p.exists():
            return p
    return None


def ensure_png(
    meta_name: str,
    out_png: Path,
    dat_root: Path,
    meta_conn: sqlite3.Connection,
) -> Path | None:
    if out_png.exists():
        return out_png
    existing = find_existing(
        [
            out_png,
            UI_PARTS / f"{meta_name.replace('/', '__')}__tex0.png",
            UI_PARTS / f"{meta_name.replace('/', '__')}__tex1.png",
        ]
    )
    # glob soft match in ui-parts
    if existing is None:
        prefix = meta_name.replace("/", "__")
        hits = sorted(UI_PARTS.glob(f"{prefix}__*.png")) if UI_PARTS.exists() else []
        hits = [h for h in hits if not h.name.startswith("_")]
        if hits:
            return hits[0]
    if existing:
        return existing
    out_png.parent.mkdir(parents=True, exist_ok=True)
    if extract_to_png(meta_name, dat_root, meta_conn, out_png):
        return out_png
    return None


def ensure_support_assets(
    sid: int,
    dat_root: Path,
    meta_conn: sqlite3.Connection,
) -> tuple[Path | None, Path | None]:
    tex = find_existing(
        [
            COMPARE_DIR / f"tex_support_card_{sid}.png",
            COMPARE_DIR / f"tex_support_card_{sid}__tex_support_card_{sid}.png",
        ]
    )
    card_s = find_existing(
        [
            COMPARE_DIR / f"support_card_s_{sid}.png",
            COMPARE_DIR / f"support_card_s_{sid}__support_card_s_{sid}.png",
        ]
    )
    if tex is None:
        out_tex = COMPARE_DIR / f"tex_support_card_{sid}.png"
        ok = extract_to_png(
            f"supportcard/support{sid}/tex_support_card_{sid}",
            dat_root,
            meta_conn,
            out_tex,
        )
        tex = out_tex if ok else None
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


def vertical_crop_3x4(src: Image.Image, size: tuple[int, int] = (VERT_W, VERT_H)) -> Image.Image:
    img = src.convert("RGBA")
    w, h = img.size
    new_w = int(h * 3 / 4)
    if new_w > w:
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


def make_rounded_rect_mask(size: tuple[int, int], radius: int) -> Image.Image:
    """角丸矩形のアルファマスクを生成する。"""
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    return mask


def load_card_mask_alpha(
    dat_root: Path,
    meta_conn: sqlite3.Connection,
    size: tuple[int, int],
) -> tuple[Image.Image, str]:
    """共有カードマスクのアルファを size にリサイズして返す。"""
    out = UI_PARTS / "mask_card_alpha_source.png"
    path = ensure_png(META_MASK, out, dat_root, meta_conn)
    if path and path.exists():
        im = Image.open(path).convert("RGBA")
        alpha = im.split()[3].resize(size, Image.Resampling.LANCZOS)
        # ほぼ全面不透明なら失敗扱い（誤抽出）
        extrema = alpha.getextrema()
        if extrema[0] < 200:
            return alpha, f"game mask alpha from {META_MASK} (stretched to {size[0]}x{size[1]})"
    # フォールバック: 角丸矩形
    radius = max(8, min(size) // 12)
    return make_rounded_rect_mask(size, radius), f"generated rounded-rect r={radius}"


def apply_alpha_mask(img: Image.Image, alpha: Image.Image) -> Image.Image:
    base = img.convert("RGBA")
    r, g, b, a = base.split()
    # 既存アルファとマスクの最小
    a2 = ImageChops_multiply_luma(a, alpha)
    return Image.merge("RGBA", (r, g, b, a2))


def ImageChops_multiply_luma(a: Image.Image, b: Image.Image) -> Image.Image:
    """2つの L 画像を乗算（依存を増やさない簡易版）。"""
    a = a.convert("L").resize(b.size) if a.size != b.size else a.convert("L")
    b = b.convert("L")
    pa = a.load()
    pb = b.load()
    out = Image.new("L", a.size)
    po = out.load()
    w, h = a.size
    for y in range(h):
        for x in range(w):
            po[x, y] = (pa[x, y] * pb[x, y]) // 255
    return out


def derive_frame_ring_from_card_s(
    card_s: Image.Image,
    out_size: tuple[int, int],
    band_ratio: float = 0.07,
) -> tuple[Image.Image, str]:
    """support_card_s の外縁バンドを虹枠レイヤとして切り出す。

    品質: partial — 正方形カード縁の色は取れるが、縦型実機枠の形状・厚みとは一致しない。
    """
    src = card_s.convert("RGBA")
    w, h = src.size
    band = max(6, int(min(w, h) * band_ratio))
    ring = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px_s = src.load()
    px_r = ring.load()
    for y in range(h):
        for x in range(w):
            edge = x < band or y < band or x >= w - band or y >= h - band
            if not edge:
                continue
            r, g, b, a = px_s[x, y]
            if a < 40:
                continue
            # 内側ほど薄く（簡易フォールオフ）
            dist = min(x, y, w - 1 - x, h - 1 - y)
            fade = 255 if dist < band * 0.35 else int(255 * (1 - (dist / band)))
            px_r[x, y] = (r, g, b, min(a, max(0, fade)))
    ring = ring.resize(out_size, Image.Resampling.LANCZOS)
    note = (
        f"derived ring from support_card_s edge band≈{band}px "
        f"(quality=partial; square→{out_size[0]}x{out_size[1]} stretch)"
    )
    return ring, note


def crop_ssr_badge_from_card_s(card_s: Image.Image) -> Image.Image:
    """左上の SSR バッジ相当を切り出す。"""
    im = card_s.convert("RGBA")
    w, h = im.size
    # 実機正方形カード左上の帯
    box = (int(w * 0.02), int(h * 0.02), int(w * 0.38), int(h * 0.16))
    return im.crop(box)


def crop_type_badge_from_card_s(card_s: Image.Image) -> Image.Image:
    """右上のタイプアイコン相当を切り出す（friend 用フォールバック）。"""
    im = card_s.convert("RGBA")
    w, h = im.size
    box = (int(w * 0.72), int(h * 0.02), int(w * 0.98), int(h * 0.28))
    return im.crop(box)


def ensure_type_icons(
    dat_root: Path,
    meta_conn: sqlite3.Connection,
) -> dict[int, Path]:
    result: dict[int, Path] = {}
    for idx in range(5):
        meta_name = META_TYPE_ICON.format(idx=idx)
        out = UI_PARTS / f"type_icon_{idx:02d}.png"
        # 既存抽出を優先
        prefix = meta_name.replace("/", "__")
        hits = []
        if UI_PARTS.exists():
            hits = sorted(UI_PARTS.glob(f"{prefix}__*.png"))
            hits = [h for h in hits if not h.name.startswith("_")]
        if hits:
            result[idx] = hits[0]
            # 分かりやすい別名もコピー
            if not out.exists():
                Image.open(hits[0]).save(out)
            continue
        path = ensure_png(meta_name, out, dat_root, meta_conn)
        if path:
            result[idx] = path
    return result


def rarity_plate_is_useful(path: Path | None) -> bool:
    """塗りつぶしプレートのみなら False（SSR 文字なし想定）。"""
    if not path or not path.exists():
        return False
    im = Image.open(path).convert("RGBA")
    # 既知: supportcard_rarity_02 は塗りプレート → 使わない
    return False


def composite_v2(
    crop: Image.Image,
    mask_alpha: Image.Image,
    frame_ring: Image.Image | None,
    type_icon: Image.Image | None,
    ssr_badge: Image.Image | None,
) -> Image.Image:
    base = apply_alpha_mask(crop, mask_alpha)
    if frame_ring is not None:
        # 枠もマスク内に収める
        fr = apply_alpha_mask(frame_ring, mask_alpha)
        base = Image.alpha_composite(base, fr)
    # SSR バッジ（左上）
    if ssr_badge is not None:
        badge = ssr_badge.convert("RGBA")
        tw = 72
        th = max(1, int(badge.height * tw / max(1, badge.width)))
        badge = badge.resize((tw, th), Image.Resampling.LANCZOS)
        base.alpha_composite(badge, (4, 4))
    # タイプアイコン（右上）
    if type_icon is not None:
        icon = type_icon.convert("RGBA")
        iw = 44
        ih = max(1, int(icon.height * iw / max(1, icon.width)))
        icon = icon.resize((iw, ih), Image.Resampling.LANCZOS)
        x = base.width - iw - 4
        y = 4
        base.alpha_composite(icon, (x, y))
    return base


def make_contact_sheet(images: list[Image.Image], labels: list[str]) -> Image.Image:
    pad = 12
    label_h = 24
    n = len(images)
    sheet_w = pad + n * (VERT_W + pad)
    sheet_h = pad + label_h + VERT_H + pad
    sheet = Image.new("RGBA", (sheet_w, sheet_h), (28, 30, 36, 255))
    draw = ImageDraw.Draw(sheet)
    for i, (im, lab) in enumerate(zip(images, labels)):
        x = pad + i * (VERT_W + pad)
        draw.text((x, pad), lab, fill=(220, 220, 220, 255))
        tile = im.convert("RGBA")
        if tile.size != (VERT_W, VERT_H):
            tile = tile.resize((VERT_W, VERT_H), Image.Resampling.LANCZOS)
        sheet.alpha_composite(tile, (x, pad + label_h))
    return sheet


def write_readme(
    out_dir: Path,
    mask_note: str,
    frame_note: str,
    type_note: str,
    rarity_note: str,
) -> Path:
    text = f"""サポカ縦クロップ比較 v2
========================

出力:
  {{id}}_v2.png     … 合成結果（240x320）
  sheet_v2.png      … 4枚コンタクトシート
  README.txt        … 本ファイル

レイヤソース:
1. ベースイラスト
   - meta: supportcard/support{{id}}/tex_support_card_{{id}}
   - 中央 3:4 クロップ → 240x320

2. 角丸マスク
   - {mask_note}
   - 共有マスク meta: {META_MASK}
   - カード個別マスクは meta 上見つからず（support00000 のみ）

3. 虹枠（レインボーフレーム）
   - {frame_note}
   - 独立した support%frame% / rainbow card frame アセットは meta に無し
   - supportcard_rarity_* は塗りつぶしプレートで枠ではない

4. タイプアイコン（右上）
   - {type_note}
   - speed/stamina/power/guts/wit:
       uianimation/flash/singlemode/statusicon/utx_ico_supportcharastatus_00..04
       （色: 青/赤系/橙/桃/緑）
   - friend: 専用アイコンアセット未発見 → support_card_s 右上をクロップ

5. SSR バッジ（左上）
   - {rarity_note}

品質メモ:
  - 虹枠再現: partial（正方形カード縁の色バンドを縦に引き伸ばし。実機縦枠とは形状がずれる）
  - マスク: good（共有アルファシルエットを利用、縦比へストレッチ）
  - タイプアイコン: good（ステータス5種は実アセット。friend のみクロップ代替）
"""
    path = out_dir / "README.txt"
    path.write_text(text, encoding="utf-8")
    return path


def main() -> int:
    dat_root = DEFAULT_DAT
    meta_path = resolve_meta_path()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    COMPARE_DIR.mkdir(parents=True, exist_ok=True)
    UI_PARTS.mkdir(parents=True, exist_ok=True)

    print(f"DAT={dat_root}")
    print(f"META={meta_path}")
    print(f"OUT={OUT_DIR}")

    if not dat_root.exists():
        print(f"DAT_ROOT not found: {dat_root}")
        return 1

    conn = sqlite3.connect(str(meta_path))
    mask_alpha, mask_note = load_card_mask_alpha(dat_root, conn, (VERT_W, VERT_H))
    print(f"MASK: {mask_note}")
    type_icons = ensure_type_icons(dat_root, conn)
    print(f"TYPE ICONS loaded: {sorted(type_icons.keys())}")

    # rarity plate は塗りのみ → スキップ方針を明示
    rarity_path = ensure_png(
        META_RARITY,
        UI_PARTS / "rarity_02.png",
        dat_root,
        conn,
    )
    use_rarity_plate = rarity_plate_is_useful(rarity_path)
    print(f"RARITY plate useful={use_rarity_plate} path={rarity_path}")

    v2_images: list[Image.Image] = []
    labels: list[str] = []
    frame_note = ""
    type_note = (
        "utx_ico_supportcharastatus_00..04 mapped by supports.json type; "
        "friend uses card_s TR crop"
    )
    rarity_note = "support_card_s top-left crop (rarity_02 is opaque plate only — skipped)"

    for sid in SAMPLE_IDS:
        print(f"--- id={sid} ---")
        tex_path, card_s_path = ensure_support_assets(sid, dat_root, conn)
        if tex_path is None:
            print(f"SKIP: no tex for {sid}")
            continue
        tex_img = Image.open(tex_path)
        crop = vertical_crop_3x4(tex_img)
        meta = load_support_meta(sid)
        stype = str(meta.get("type", "unknown"))

        frame_ring = None
        if card_s_path and card_s_path.exists():
            card_s_img = Image.open(card_s_path)
            frame_ring, frame_note = derive_frame_ring_from_card_s(card_s_img, (VERT_W, VERT_H))
            ssr_badge = crop_ssr_badge_from_card_s(card_s_img)
        else:
            card_s_img = None
            ssr_badge = None
            frame_note = "no support_card_s — frame skipped"

        type_icon = None
        if stype in TYPE_ICON_INDEX and TYPE_ICON_INDEX[stype] in type_icons:
            type_icon = Image.open(type_icons[TYPE_ICON_INDEX[stype]])
        elif card_s_img is not None:
            type_icon = crop_type_badge_from_card_s(card_s_img)
            print(f"  friend/unknown type={stype}: using card_s TR crop")
        else:
            print(f"  WARN: no type icon for {stype}")

        composited = composite_v2(crop, mask_alpha, frame_ring, type_icon, ssr_badge)
        out_path = OUT_DIR / f"{sid}_v2.png"
        composited.save(out_path)
        print(f"  -> {out_path.resolve()} {composited.size[0]}x{composited.size[1]} type={stype}")
        v2_images.append(composited)
        labels.append(f"{sid} {stype}")

    conn.close()

    if v2_images:
        sheet = make_contact_sheet(v2_images, labels)
        sheet_path = OUT_DIR / "sheet_v2.png"
        sheet.save(sheet_path)
        print(f"sheet -> {sheet_path.resolve()} {sheet.size[0]}x{sheet.size[1]}")

    readme = write_readme(OUT_DIR, mask_note, frame_note or "(n/a)", type_note, rarity_note)
    print(f"readme -> {readme.resolve()}")

    print("=== outputs ===")
    for p in sorted(OUT_DIR.iterdir()):
        if p.suffix.lower() == ".png":
            im = Image.open(p)
            print(f"{p.resolve()}  {im.size[0]}x{im.size[1]}")
        else:
            print(p.resolve())

    # ui-parts 要約
    summary = UI_PARTS / "PARTS_SUMMARY.txt"
    summary.write_text(
        "\n".join(
            [
                "ui-parts 抽出サマリ",
                f"- MASK card: {META_MASK} → 2048x2048 white+alpha silhouette (shared)",
                f"- MASK thumb: {META_THUMB_MASK} → 512x512 rounded alpha",
                "- FRAME: no dedicated asset; derive from support_card_s edge",
                "- RARITY 00/01/02: 128x128 opaque plates (not hollow frames)",
                "- TYPE: utx_ico_supportcharastatus_00..04 = speed/sta/pow/guts/wit",
                "- friend type icon: not found as standalone",
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"parts summary -> {summary.resolve()}")

    return 0 if len(v2_images) == len(SAMPLE_IDS) else 2


if __name__ == "__main__":
    raise SystemExit(main())
