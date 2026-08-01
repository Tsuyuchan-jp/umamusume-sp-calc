"""タイプ印の黒背景を透過化し、assets/type-icons に WebP 同梱する。

取得元（再取得用・実行時非依存）:
  https://static.kouryaku.tools/umamusume/images/app/supports/{name}.png
  wit ← wisdom.png / 他は同名
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parents[1]
SRC_DIR = REPO / ".cache" / "asset-dump" / "type-icon-probe"
DST_DIR = REPO / "assets" / "type-icons"
TYPES = ("speed", "stamina", "power", "guts", "wit", "friend")


def key_out_near_black(im: Image.Image, threshold: int = 28) -> Image.Image:
    """四隅から近い黒を塗りつぶし透過にする（角の黒キャンバス除去）。"""
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    visited = [[False] * w for _ in range(h)]
    stack: list[tuple[int, int]] = []

    def is_key(x: int, y: int) -> bool:
        r, g, b, a = px[x, y]
        if a == 0:
            return True
        return r <= threshold and g <= threshold and b <= threshold

    for x, y in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        if is_key(x, y):
            stack.append((x, y))
            visited[y][x] = True

    while stack:
        x, y = stack.pop()
        px[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h and not visited[ny][nx] and is_key(nx, ny):
                visited[ny][nx] = True
                stack.append((nx, ny))
    return im


def main() -> int:
    DST_DIR.mkdir(parents=True, exist_ok=True)
    for name in TYPES:
        src = SRC_DIR / f"{name}.png"
        if not src.exists():
            print(f"MISSING {src}")
            return 1
        im = key_out_near_black(Image.open(src))
        out = DST_DIR / f"{name}.webp"
        im.save(out, "WEBP", quality=90, method=6)
        a = im.split()[3]
        print(f"{name}: {im.size} alpha={a.getextrema()} -> {out.name} ({out.stat().st_size}B)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
