"""サポカ縦カード合成（support_thumb 縦縮尺 + 右上タイプ印）。

v4 試作で確定した処理を本番 import からも使う。
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[1]
TYPE_ICONS_DIR = REPO_ROOT / "assets" / "type-icons"

# 表示解像度（240×320）
VERT_W, VERT_H = 240, 320
ASPECT_W, ASPECT_H = 3, 4

# 右上固定 — 2026-08-01 目視確定・変更しない
TYPE_ICON_SIZE = 52
TYPE_MARGIN_TOP = 1
TYPE_MARGIN_RIGHT = 4

_icon_cache: dict[str, Image.Image] | None = None


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
) -> Image.Image:
    """support_thumb PNG から 240×320 の縦カードを合成する。"""
    stretched = vertical_stretch_keep_width(thumb)
    display = stretched.resize((VERT_W, VERT_H), Image.Resampling.LANCZOS)
    icon_map = icons if icons is not None else load_type_icons()
    icon = icon_map.get(support_type)
    if icon is None:
        return display
    return overlay_type_icon(display, icon)
