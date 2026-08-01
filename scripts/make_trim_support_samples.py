"""枠外余白トリムの before/after 比較サンプル。

flat/supports の support_thumb を使い、トリム無し vs 有りを並べる。
出力は .cache のみ（assets/ は変更しない）。
"""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

from support_vertical_card import (
    FRAME_INSET_BOTTOM,
    FRAME_INSET_LEFT,
    FRAME_INSET_RIGHT,
    FRAME_INSET_TOP,
    VERT_H,
    VERT_W,
    compose_support_vertical_card,
    load_type_icons,
)

REPO_ROOT = Path(__file__).resolve().parents[1]
FLAT_DIR = REPO_ROOT / ".cache" / "asset-dump" / "flat" / "supports"
PRIORITY_JSON = REPO_ROOT / "data" / "priority-supports.json"
OUT_DIR = REPO_ROOT / ".cache" / "asset-dump" / "compare-trim"

# friend / sta / spd / pow / guts / wit
SAMPLE_IDS = [30305, 30304, 30302, 30297, 30294, 30289]


def load_type_map() -> dict[int, str]:
    data = json.loads(PRIORITY_JSON.read_text(encoding="utf-8"))
    return {int(s["id"]): str(s["type"]) for s in data["supports"]}


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    icons = load_type_icons()
    if len(icons) < 6:
        print(f"type icons incomplete: {sorted(icons)}")
        return 1

    type_map = load_type_map()
    pairs: list[tuple[Image.Image, Image.Image, str]] = []
    ok = 0

    for sid in SAMPLE_IDS:
        src = FLAT_DIR / f"{sid}.png"
        stype = type_map.get(sid, "unknown")
        print(f"--- id={sid} type={stype} ---")
        if not src.is_file():
            print(f"SKIP: missing {src}")
            continue
        if stype not in icons:
            print(f"SKIP: no icon for type={stype}")
            continue

        thumb = Image.open(src)
        before = compose_support_vertical_card(
            thumb, stype, icons=icons, trim_frame=False
        )
        after = compose_support_vertical_card(
            thumb, stype, icons=icons, trim_frame=True
        )
        before.save(OUT_DIR / f"{sid}_before.webp", "WEBP", quality=82, method=6)
        after.save(OUT_DIR / f"{sid}_after.webp", "WEBP", quality=82, method=6)
        print(f"  -> {sid}_before/after.webp")
        pairs.append((before, after, f"{sid} {stype}"))
        ok += 1

    if pairs:
        pad = 8
        cols = 2
        rows = len(pairs)
        sheet_w = cols * VERT_W + (cols + 1) * pad
        sheet_h = rows * VERT_H + (rows + 1) * pad
        sheet = Image.new("RGBA", (sheet_w, sheet_h), (32, 32, 36, 255))
        for ri, (left, right, _label) in enumerate(pairs):
            y = pad + ri * (VERT_H + pad)
            sheet.alpha_composite(left.convert("RGBA"), (pad, y))
            sheet.alpha_composite(right.convert("RGBA"), (pad + VERT_W + pad, y))
        sheet_path = OUT_DIR / "sheet_trim.png"
        sheet.save(sheet_path)
        print(f"sheet -> {sheet_path.resolve()}")

    readme = OUT_DIR / "README.txt"
    readme.write_text(
        f"""枠外余白トリム比較
==================

左 = before（トリム無し・旧 v4）
右 = after（固定 inset L{FRAME_INSET_LEFT}/T{FRAME_INSET_TOP}/R{FRAME_INSET_RIGHT}/B{FRAME_INSET_BOTTOM}）

タイプ印座標は未調整（ずれは別途指示で対応）。
""",
        encoding="utf-8",
    )
    print(readme.resolve())
    return 0 if ok == len(SAMPLE_IDS) else 2


if __name__ == "__main__":
    raise SystemExit(main())
