"""flat PNG を assets 用 WebP に変換する（サポカ縦合成 + キャラ単純縮小）。"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image

from support_vertical_card import compose_support_vertical_card, load_type_icons

REPO_ROOT = Path(__file__).resolve().parents[1]


def convert_character(src: Path, dst: Path, *, max_edge: int, quality: int) -> None:
    img = Image.open(src).convert("RGBA")
    w, h = img.size
    scale = min(1.0, max_edge / max(w, h))
    if scale < 1.0:
        img = img.resize(
            (max(1, int(w * scale)), max(1, int(h * scale))),
            Image.Resampling.LANCZOS,
        )
    dst.parent.mkdir(parents=True, exist_ok=True)
    img.save(dst, "WEBP", quality=quality, method=6)


def convert_support(
    src: Path,
    dst: Path,
    support_type: str,
    *,
    icons: dict,
    quality: int,
) -> None:
    thumb = Image.open(src).convert("RGBA")
    out = compose_support_vertical_card(thumb, support_type, icons=icons)
    dst.parent.mkdir(parents=True, exist_ok=True)
    out.save(dst, "WEBP", quality=quality, method=6)


def main() -> int:
    cfg = json.loads(sys.stdin.read())
    max_edge = int(cfg.get("maxEdge", 256))
    quality = int(cfg.get("quality", 82))
    supports = cfg.get("supports", [])
    characters = cfg.get("characters", [])

    icons = load_type_icons()
    if len(icons) < 6:
        print(f"type icons incomplete: {sorted(icons)}", file=sys.stderr)
        return 1

    ok = 0
    fail: list[str] = []

    for job in supports:
        src = Path(job["src"])
        dst = Path(job["dst"])
        stype = str(job.get("type", "unknown"))
        try:
            if not src.is_file():
                fail.append(str(src))
                continue
            convert_support(src, dst, stype, icons=icons, quality=quality)
            ok += 1
            print(f"ok {dst} ({dst.stat().st_size} bytes) type={stype}")
        except Exception as e:
            fail.append(f"{src}: {e}")
            print(f"FAIL {src}: {e}", file=sys.stderr)

    for job in characters:
        src = Path(job["src"])
        dst = Path(job["dst"])
        try:
            if not src.is_file():
                fail.append(str(src))
                continue
            convert_character(src, dst, max_edge=max_edge, quality=quality)
            ok += 1
            print(f"ok {dst} ({dst.stat().st_size} bytes)")
        except Exception as e:
            fail.append(f"{src}: {e}")
            print(f"FAIL {src}: {e}", file=sys.stderr)

    print(f"converted={ok} failed={len(fail)}")
    return 1 if fail else 0


if __name__ == "__main__":
    raise SystemExit(main())
