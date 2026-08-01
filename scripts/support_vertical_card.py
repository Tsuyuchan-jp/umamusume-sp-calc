"""サポカ縦カード合成（support_thumb 枠外トリム + 縦縮尺 + 右上タイプ印）。

v4 試作で確定した処理を本番 import からも使う。
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

REPO_ROOT = Path(__file__).resolve().parents[1]
TYPE_ICONS_DIR = REPO_ROOT / "assets" / "type-icons"

# 表示解像度（240×320）
VERT_W, VERT_H = 240, 320
ASPECT_W, ASPECT_H = 3, 4

# 512キャンバス上の虹枠外余白＋ソフトグロー除去
# 優先40・SSR実測 2026-08-01: ハードクロム外縁（α≥220・高彩度）まで同一 inset
# 旧 dark-padding のみ除去（10/3/10/12）だと外周に半透明のにじみが残り浮いて見える
FRAME_INSET_LEFT = 12
FRAME_INSET_TOP = 5
FRAME_INSET_RIGHT = 12
FRAME_INSET_BOTTOM = 13

# 角丸枠の外（AABB内）に残る半透明グローを落とす
SOFT_FRINGE_RING = 8
SOFT_FRINGE_ALPHA_MAX = 180

# 表示解像度での枠外縁の角丸半径（クロップ後≈50px → 240幅で≈25相当）
# R=25 だと角の半透明シアン/緑フリンジが内側に残るため 29 まで広げる
# ゲーム共有 mask は使わず、自前の角丸で四隅グローだけ落とす
FRAME_CORNER_RADIUS = 29

# 右上固定 — 2026-08-01 目視確定。トリム後は再調整が必要な場合あり
TYPE_ICON_SIZE = 52
TYPE_MARGIN_TOP = -1
TYPE_MARGIN_RIGHT = 4

_icon_cache: dict[str, Image.Image] | None = None


def clear_outer_soft_fringe(src: Image.Image) -> Image.Image:
    """外周リングの半透明ピクセルを透明化し、枠外のにじみを消す。"""
    img = src.convert("RGBA")
    px = img.load()
    w, h = img.size
    ring = SOFT_FRINGE_RING
    a_max = SOFT_FRINGE_ALPHA_MAX
    for y in range(h):
        for x in range(w):
            if ring <= x < w - ring and ring <= y < h - ring:
                continue
            r, g, b, a = px[x, y]
            if a < a_max:
                px[x, y] = (r, g, b, 0)
    return img


def apply_rounded_frame_mask(
    src: Image.Image,
    radius: int | None = None,
) -> Image.Image:
    """角丸の外側（矩形四隅の枠外グロー）を透明にする。"""
    img = src.convert("RGBA")
    w, h = img.size
    r = FRAME_CORNER_RADIUS if radius is None else radius
    r = max(1, min(r, w // 2, h // 2))
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, w - 1, h - 1), radius=r, fill=255)
    r_ch, g_ch, b_ch, a_ch = img.split()
    return Image.merge("RGBA", (r_ch, g_ch, b_ch, ImageChops.multiply(a_ch, mask)))


def trim_frame_padding(src: Image.Image) -> Image.Image:
    """support_thumb の枠外パディングとソフトグローを除去する。"""
    img = src.convert("RGBA")
    w, h = img.size
    left = FRAME_INSET_LEFT
    top = FRAME_INSET_TOP
    right = w - FRAME_INSET_RIGHT
    bottom = h - FRAME_INSET_BOTTOM
    if right <= left or bottom <= top:
        return clear_outer_soft_fringe(img)
    return clear_outer_soft_fringe(img.crop((left, top, right, bottom)))


def vertical_stretch_keep_width(src: Image.Image) -> Image.Image:
    """左右を削らず、全幅を保って縦方向だけ 3:4 に合わせる。"""
    img = src.convert("RGBA")
    w, _h = img.size
    target_h = max(1, round(w * ASPECT_H / ASPECT_W))
    return img.resize((w, target_h), Image.Resampling.LANCZOS)


def content_bbox(im: Image.Image) -> tuple[int, int, int, int] | None:
    """不透明かつ非黒の外接矩形を返す。"""
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    xs: list[int] = []
    ys: list[int] = []
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 16:
                continue
            if r < 20 and g < 20 and b < 20:
                continue
            xs.append(x)
            ys.append(y)
    if not xs:
        return None
    return min(xs), min(ys), max(xs), max(ys)


def trim_icon(im: Image.Image) -> Image.Image:
    """キャンバス余白を除き、見かけの図形だけにする。"""
    bb = content_bbox(im)
    if bb is None:
        return im.convert("RGBA")
    return im.convert("RGBA").crop(bb)


def load_type_icons() -> dict[str, Image.Image]:
    global _icon_cache
    if _icon_cache is not None:
        return _icon_cache
    icons: dict[str, Image.Image] = {}
    for path in sorted(TYPE_ICONS_DIR.glob("*.webp")):
        icons[path.stem] = Image.open(path).convert("RGBA")
    _icon_cache = icons
    return icons


def overlay_type_icon(base: Image.Image, icon: Image.Image) -> Image.Image:
    """表示解像度のベースに右上固定でタイプ印を重ねる。"""
    out = base.convert("RGBA").copy()
    icon_t = trim_icon(icon)
    icon_r = icon_t.resize((TYPE_ICON_SIZE, TYPE_ICON_SIZE), Image.Resampling.LANCZOS)
    x = out.size[0] - TYPE_MARGIN_RIGHT - TYPE_ICON_SIZE
    y = TYPE_MARGIN_TOP
    out.alpha_composite(icon_r, (x, y))
    return out


def compose_support_vertical_card(
    thumb: Image.Image,
    support_type: str,
    *,
    icons: dict[str, Image.Image] | None = None,
    trim_frame: bool = True,
) -> Image.Image:
    """support_thumb PNG から 240×320 の縦カードを合成する。"""
    base = trim_frame_padding(thumb) if trim_frame else thumb.convert("RGBA")
    stretched = vertical_stretch_keep_width(base)
    display = stretched.resize((VERT_W, VERT_H), Image.Resampling.LANCZOS)
    if trim_frame:
        display = apply_rounded_frame_mask(display)
    icon_map = icons if icons is not None else load_type_icons()
    icon = icon_map.get(support_type)
    if icon is None:
        return display
    return overlay_type_icon(display, icon)
