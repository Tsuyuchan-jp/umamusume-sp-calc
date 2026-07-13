#!/usr/bin/env python3
"""master.mdb から data/*.json を生成する。"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
DEFAULT_MDB = Path.home() / "AppData/LocalLow/Cygames/umamusume/master/master.mdb"

# text_data category
TEXT_SKILL_NAME = 47
TEXT_SKILL_DESC = 48
TEXT_SUPPORT_NAME = 75
TEXT_SUPPORT_VARIANT = 76
TEXT_SUPPORT_CHAR = 77
TEXT_CHAR_NAME = 6


def load_text_map(conn: sqlite3.Connection, category: int) -> dict[int, str]:
    rows = conn.execute(
        'SELECT "index", text FROM text_data WHERE category = ?', (category,)
    ).fetchall()
    return {int(r[0]): r[1] for r in rows}


def extract_skills(conn: sqlite3.Connection) -> list[dict]:
    names = load_text_map(conn, TEXT_SKILL_NAME)
    points = {
        int(r[0]): int(r[1])
        for r in conn.execute("SELECT id, need_skill_point FROM single_mode_skill_need_point")
    }

    # group_id -> [(group_rate, skill_id), ...]
    groups: dict[int, list[tuple[int, int]]] = defaultdict(list)
    skills_raw = conn.execute(
        "SELECT id, rarity, group_id, group_rate, icon_id FROM skill_data"
    ).fetchall()

    skill_rows: list[dict] = []
    for sid, rarity, group_id, group_rate, icon_id in skills_raw:
        sid = int(sid)
        gid = int(group_id)
        gr = int(group_rate)
        groups[gid].append((gr, sid))
        skill_rows.append(
            {
                "id": sid,
                "name": names.get(sid, f"skill_{sid}"),
                "baseSp": points.get(sid, 0),
                "rarity": int(rarity),
                "groupId": gid,
                "groupRate": gr,
                "iconId": int(icon_id),
                "lowerSkillId": None,
                "upperSkillId": None,
            }
        )

    # 上下位リンク（group_rate 昇順）
    id_to_skill = {s["id"]: s for s in skill_rows}
    for gid, members in groups.items():
        members.sort(key=lambda x: x[0])
        for i, (_, skill_id) in enumerate(members):
            s = id_to_skill[skill_id]
            if i > 0:
                s["lowerSkillId"] = members[i - 1][1]
            if i < len(members) - 1:
                s["upperSkillId"] = members[i + 1][1]

    return sorted(skill_rows, key=lambda x: x["id"])


def extract_supports(conn: sqlite3.Connection) -> list[dict]:
    names = load_text_map(conn, TEXT_SUPPORT_NAME)
    variants = load_text_map(conn, TEXT_SUPPORT_VARIANT)
    chars = load_text_map(conn, TEXT_SUPPORT_CHAR)

    rarity_map = {1: "R", 2: "SR", 3: "SSR"}
    # 育成タイプは support_card_type ではなく command_id
    type_by_command_id = {
        0: "friend",
        101: "speed",
        102: "stamina",
        103: "power",
        105: "guts",
        106: "wit",
    }

    hints_by_card: dict[int, list[int]] = defaultdict(list)
    for row in conn.execute(
        """
        SELECT support_card_id, hint_value_1
        FROM single_mode_hint_gain
        WHERE hint_gain_type = 0
        ORDER BY support_card_id, hint_group
        """
    ):
        card_id, skill_id = int(row[0]), int(row[1])
        if skill_id and skill_id not in hints_by_card[card_id]:
            hints_by_card[card_id].append(skill_id)

    hint_lv_up: dict[int, int] = defaultdict(int)
    for row in conn.execute(
        """
        SELECT effect_table_id, limit_lv5, limit_lv10, limit_lv15, limit_lv20,
               limit_lv25, limit_lv30, limit_lv35, limit_lv40, limit_lv45, limit_lv50
        FROM support_card_effect_table
        WHERE type = 17
        """
    ):
        table_id = int(row[0])
        for v in row[1:]:
            if v and int(v) > hint_lv_up[table_id]:
                hint_lv_up[table_id] = int(v)

    supports = []
    for row in conn.execute(
        """
        SELECT id, chara_id, rarity, command_id, effect_table_id
        FROM support_card_data
        ORDER BY id
        """
    ):
        sid = int(row[0])
        command_id = int(row[3])
        display = names.get(sid, f"support_{sid}")
        if sid in variants and variants[sid]:
            display = f"[{variants[sid]}] {display}"
        if sid in chars and chars[sid]:
            display = f"{display} ({chars[sid]})"

        supports.append(
            {
                "id": sid,
                "name": display,
                "characterId": int(row[1]),
                "rarity": rarity_map.get(int(row[2]), str(row[2])),
                "commandId": command_id,
                "type": type_by_command_id.get(command_id, "unknown"),
                "hintSkillIds": hints_by_card.get(sid, []),
                "hintLevelUpMax": hint_lv_up.get(int(row[4]), 0),
                "eventIds": [],
            }
        )

    return supports


def extract_characters(conn: sqlite3.Connection) -> list[dict]:
    names = load_text_map(conn, TEXT_CHAR_NAME)

    # card_id -> available_skill_set_id
    card_sets = {
        int(r[0]): int(r[1])
        for r in conn.execute("SELECT id, available_skill_set_id FROM card_data")
    }

    # set_id -> [(need_rank, skill_id)]
    set_skills: dict[int, list[tuple[int, int]]] = defaultdict(list)
    for row in conn.execute(
        "SELECT available_skill_set_id, need_rank, skill_id FROM available_skill_set"
    ):
        set_id, rank, skill_id = int(row[0]), int(row[1]), int(row[2])
        if rank == 0:
            rank = 1
        set_skills[set_id].append((rank, skill_id))

    characters = []
    for card_id, set_id in sorted(card_sets.items()):
        by_rank: dict[int, list[int]] = defaultdict(list)
        for rank, skill_id in set_skills.get(set_id, []):
            by_rank[rank].append(skill_id)

        characters.append(
            {
                "id": card_id,
                "name": names.get(card_id, f"chara_{card_id}"),
                "skillsByAwakening": {str(k): v for k, v in sorted(by_rank.items())},
            }
        )

    return characters


def write_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="master.mdb から JSON を抽出")
    parser.add_argument("--mdb", type=Path, default=DEFAULT_MDB, help="master.mdb のパス")
    args = parser.parse_args()

    if not args.mdb.is_file():
        print(f"エラー: master.mdb が見つかりません: {args.mdb}", file=sys.stderr)
        print("DMM/Steam版でデータDL後、--mdb でパスを指定してください。", file=sys.stderr)
        return 1

    conn = sqlite3.connect(str(args.mdb))
    try:
        skills = extract_skills(conn)
        supports = extract_supports(conn)
        characters = extract_characters(conn)
    finally:
        conn.close()

    write_json(DATA_DIR / "skills.json", skills)
    write_json(DATA_DIR / "supports.json", supports)
    write_json(DATA_DIR / "characters.json", characters)

    meta = {
        "source": str(args.mdb),
        "skillCount": len(skills),
        "supportCount": len(supports),
        "characterCount": len(characters),
    }
    write_json(DATA_DIR / "meta.json", meta)

    print(f"skills.json: {len(skills)} 件")
    print(f"supports.json: {len(supports)} 件")
    print(f"characters.json: {len(characters)} 件")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
