"""優先サポート40枚 + 全育成ウマ娘カードの PNG を flat 出力する。

サポカは support_thumb（512×512・レア枠焼き付き）を抽出。import 側で縦合成する。
育成は chr_icon（カードID → dress フォールバック → 6桁レガシー名）。piece_icon は使わない。
"""
from __future__ import annotations

import argparse
import json
import sqlite3
import struct
from pathlib import Path

import UnityPy

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DAT = Path(r"D:\DMM\umamusumeDMM\Umamusume\umamusume_Data\Persistent\dat")
META_FRESH = (
    REPO_ROOT / ".cache" / "umamusu-utils-old-jp" / "storage" / "meta_decrypted_persistent_fresh"
)
META_FALLBACK = REPO_ROOT / ".cache" / "umamusu-utils-old-jp" / "storage" / "meta_decrypted"
DEFAULT_OUT_FLAT = REPO_ROOT / ".cache" / "asset-dump" / "flat"
DEFAULT_OUT_PNG = REPO_ROOT / ".cache" / "asset-dump" / "png"
PRIORITY_JSON = REPO_ROOT / "data" / "priority-supports.json"
CHARACTERS_JSON = REPO_ROOT / "data" / "characters.json"
DEFAULT_MASTER = Path(
    r"D:\DMM\umamusumeDMM\Umamusume\umamusume_Data\Persistent\master\master.mdb"
)

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
    """Texture2D/Sprite を抽出し、最初に成功した画像を out_png に保存。"""
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


def extract_named_asset(
    *,
    meta_name: str,
    dat_root: Path,
    meta_conn: sqlite3.Connection,
    decrypt_dir: Path,
    mirror_png_dir: Path,
    flat_png: Path,
    quiet_missing: bool = False,
) -> bool:
    hit = lookup_meta(meta_conn, meta_name)
    if not hit:
        if not quiet_missing:
            print(f"MISSING meta: {meta_name}")
        return False
    h, e = hit
    src = dat_root / h[:2] / h
    if not src.exists():
        if not quiet_missing:
            print(f"MISSING dat: {meta_name} -> {src}")
        return False
    dst = decrypt_dir / meta_name
    print(f"decrypt {meta_name} ({src.stat().st_size} bytes, e={e})")
    decrypt_blob(src, e, dst)
    mirror = mirror_png_dir / Path(meta_name).parent / Path(meta_name).name / "Texture2D.png"
    saved = dump_best_texture(dst, mirror)
    if not saved:
        print(f"NO TEXTURE: {meta_name}")
        return False
    flat_png.parent.mkdir(parents=True, exist_ok=True)
    flat_png.write_bytes(saved.read_bytes())
    print(f"  ok -> {flat_png} ({saved.stat().st_size} bytes)")
    return True


def load_support_ids() -> list[int]:
    data = json.loads(PRIORITY_JSON.read_text(encoding="utf-8"))
    supports = data.get("supports", data)
    return [int(x["id"] if isinstance(x, dict) else x) for x in supports]


def load_character_card_ids() -> list[int]:
    data = json.loads(CHARACTERS_JSON.read_text(encoding="utf-8"))
    items = data if isinstance(data, list) else data.get("characters", [])
    return [int(x["id"]) for x in items]


def resolve_meta_path(explicit: Path | None) -> Path:
    if explicit is not None:
        return explicit
    if META_FRESH.exists():
        return META_FRESH
    return META_FALLBACK


def open_master(master_path: Path) -> sqlite3.Connection | None:
    if not master_path.is_file():
        return None
    try:
        return sqlite3.connect(f"file:{master_path.as_posix()}?mode=ro", uri=True)
    except sqlite3.Error as e:
        print(f"master open failed: {e}")
        return None


def load_card_chara_map(master_conn: sqlite3.Connection | None) -> dict[int, int]:
    """card_id -> chara_id"""
    if master_conn is None:
        return {}
    try:
        cols = {row[1] for row in master_conn.execute("PRAGMA table_info(card_data)")}
        id_col = "id" if "id" in cols else ("card_id" if "card_id" in cols else None)
        if id_col is None or "chara_id" not in cols:
            return {}
        rows = master_conn.execute(
            f"SELECT {id_col}, chara_id FROM card_data"
        ).fetchall()
        return {int(cid): int(chara) for cid, chara in rows}
    except sqlite3.Error as e:
        print(f"card_data query failed: {e}")
        return {}


def dress_ids_from_master(master_conn: sqlite3.Connection | None, card_id: int) -> list[int]:
    """card_rarity_data から race_dress_id / get_dress_id_* を読む。"""
    if master_conn is None:
        return []
    try:
        cols = {row[1] for row in master_conn.execute("PRAGMA table_info(card_rarity_data)")}
        want = [c for c in ("race_dress_id", "get_dress_id_2", "get_dress_id_1") if c in cols]
        if not want:
            return []
        id_col = "card_id" if "card_id" in cols else None
        if id_col is None:
            return []
        sql = f"SELECT {', '.join(want)} FROM card_rarity_data WHERE {id_col}=?"
        row = master_conn.execute(sql, (card_id,)).fetchone()
        if not row:
            return []
        out: list[int] = []
        for v in row:
            if v is None:
                continue
            iv = int(v)
            if iv > 1000 and iv not in out:
                out.append(iv)
        return out
    except sqlite3.Error as e:
        print(f"master query failed for {card_id}: {e}")
        return []


def guess_chara_id(card_id: int) -> int:
    """master が無いときの簡易推定（6桁カード向け）。"""
    s = str(card_id)
    if len(s) >= 6:
        return int(s[:4])
    return card_id


def resolve_icon_keys(card_id: int, master_conn: sqlite3.Connection | None) -> list[int]:
    keys: list[int] = [card_id]
    for d in dress_ids_from_master(master_conn, card_id):
        if d not in keys:
            keys.append(d)
    return keys


def iter_chr_icon_meta_names(chara_id: int, keys: list[int]) -> list[str]:
    """カードID直結・dress・6桁レガシー名の候補を列挙。"""
    names: list[str] = []
    seen: set[str] = set()
    for key in keys:
        key_forms = [str(key), f"{key % 1000:06d}"]
        for key_s in key_forms:
            for variant in ("01", "02"):
                name = f"chara/chr{chara_id}/chr_icon_{chara_id}_{key_s}_{variant}"
                if name not in seen:
                    seen.add(name)
                    names.append(name)
    return names


def extract_character_icon(
    *,
    card_id: int,
    chara_id: int,
    master_conn: sqlite3.Connection | None,
    dat_root: Path,
    meta_conn: sqlite3.Connection,
    decrypt_dir: Path,
    mirror_png_dir: Path,
    flat_png: Path,
) -> str | None:
    keys = resolve_icon_keys(card_id, master_conn)
    for meta_name in iter_chr_icon_meta_names(chara_id, keys):
        if extract_named_asset(
            meta_name=meta_name,
            dat_root=dat_root,
            meta_conn=meta_conn,
            decrypt_dir=decrypt_dir,
            mirror_png_dir=mirror_png_dir,
            flat_png=flat_png,
            quiet_missing=True,
        ):
            return meta_name
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description="Extract priority support + all character card PNGs")
    parser.add_argument("--dat", type=Path, default=DEFAULT_DAT)
    parser.add_argument("--meta", type=Path, default=None)
    parser.add_argument("--master", type=Path, default=DEFAULT_MASTER)
    parser.add_argument("--out-flat", type=Path, default=DEFAULT_OUT_FLAT)
    parser.add_argument("--out-png", type=Path, default=DEFAULT_OUT_PNG)
    parser.add_argument(
        "--skip-supports",
        action="store_true",
        help="サポカ抽出を省略（育成のみ）",
    )
    parser.add_argument(
        "--characters-only",
        action="store_true",
        help="--skip-supports の別名",
    )
    args = parser.parse_args()
    skip_supports = bool(args.skip_supports or args.characters_only)

    dat_root: Path = args.dat
    meta_path: Path = resolve_meta_path(args.meta)
    master_path: Path = args.master
    out_flat: Path = args.out_flat
    out_png: Path = args.out_png
    decrypt_dir = REPO_ROOT / ".cache" / "asset-dump" / "decrypted"

    if not dat_root.exists():
        print(f"DAT_ROOT not found: {dat_root}")
        return 1
    if not meta_path.exists():
        print(f"META not found: {meta_path}")
        return 1

    support_ids = [] if skip_supports else load_support_ids()
    character_ids = load_character_card_ids()
    print(f"priority supports: {len(support_ids)} (skip={skip_supports})")
    print(f"characters: {len(character_ids)}")
    print(f"DAT={dat_root}")
    print(f"META={meta_path}")
    print(f"MASTER={master_path} (exists={master_path.is_file()})")
    print(f"OUT_FLAT={out_flat}")

    master_conn = open_master(master_path)
    card_chara = load_card_chara_map(master_conn)
    meta_conn = sqlite3.connect(str(meta_path))

    ok_supports: list[int] = []
    missing_supports: list[int] = []
    for sid in support_ids:
        meta_name = f"supportcard/support{sid}/support_thumb_{sid}"
        flat = out_flat / "supports" / f"{sid}.png"
        if extract_named_asset(
            meta_name=meta_name,
            dat_root=dat_root,
            meta_conn=meta_conn,
            decrypt_dir=decrypt_dir,
            mirror_png_dir=out_png,
            flat_png=flat,
        ):
            ok_supports.append(sid)
        else:
            missing_supports.append(sid)

    ok_chars: list[tuple[int, str]] = []
    missing_chars: list[int] = []
    for card_id in character_ids:
        chara_id = card_chara.get(card_id) or guess_chara_id(card_id)
        flat = out_flat / "characters" / f"{card_id}.png"
        used = extract_character_icon(
            card_id=card_id,
            chara_id=chara_id,
            master_conn=master_conn,
            dat_root=dat_root,
            meta_conn=meta_conn,
            decrypt_dir=decrypt_dir,
            mirror_png_dir=out_png,
            flat_png=flat,
        )
        if used:
            ok_chars.append((card_id, used))
            print(f"chara {card_id}: ok via {used}")
        else:
            missing_chars.append(card_id)
            print(f"chara {card_id}: MISSING (chara_id={chara_id})")

    meta_conn.close()
    if master_conn is not None:
        master_conn.close()

    print("---")
    if not skip_supports:
        print(f"supports ok: {len(ok_supports)}/{len(support_ids)}")
        print(f"supports missing: {missing_supports if missing_supports else '(none)'}")
    print(f"characters ok: {len(ok_chars)}/{len(character_ids)}")
    print(f"characters missing: {missing_chars if missing_chars else '(none)'}")

    support_fail = bool(missing_supports)
    # 育成は可能な限り同梱。欠落が残ってもサポカ成功なら警告終了コード2
    if support_fail:
        return 2
    if missing_chars:
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
