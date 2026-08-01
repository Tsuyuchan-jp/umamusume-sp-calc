"""優先サポート40枚 + キャラカードの PNG を flat 出力する。

サポカは support_thumb（512×512・レア枠焼き付き）を抽出。import 側で縦合成する。
育成は chr_icon（カードID → dress フォールバック）。piece_icon は使わない。
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
CHARA_CARD_ID = 107703
CHARA_CHARA_ID = 1077
# カードID直結の chr_icon が無い場合の dress フォールバック（master の race_dress_id と一致）
CHARA_DRESS_FALLBACK_IDS = [107702]
DEFAULT_MASTER = Path(
    r"D:\DMM\umamusumeDMM\Umamusume\umamusume_Data\Persistent\master\master.mdb"
)

AB_KEY = b"\x53\x2B\x46\x31\xE4\xA7\xB9\x47\x3E\x7C\xFB"


def chr_icon_meta_name(chara_id: int, icon_key: int, *, variant: str = "01") -> str:
    return f"chara/chr{chara_id}/chr_icon_{chara_id}_{icon_key}_{variant}"


def dress_ids_from_master(master_path: Path, card_id: int) -> list[int]:
    """card_rarity_data から race_dress_id / get_dress_id_2 を読む。"""
    if not master_path.is_file():
        return []
    try:
        conn = sqlite3.connect(f"file:{master_path.as_posix()}?mode=ro", uri=True)
    except sqlite3.Error as e:
        print(f"master open failed: {e}")
        return []
    try:
        # 列名は環境差があり得るので PRAGMA で確認
        cols = {row[1] for row in conn.execute("PRAGMA table_info(card_rarity_data)")}
        want = [c for c in ("race_dress_id", "get_dress_id_2", "get_dress_id_1") if c in cols]
        if not want:
            return []
        id_col = "card_id" if "card_id" in cols else None
        if id_col is None:
            return []
        sql = f"SELECT {', '.join(want)} FROM card_rarity_data WHERE {id_col}=?"
        row = conn.execute(sql, (card_id,)).fetchone()
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
        print(f"master query failed: {e}")
        return []
    finally:
        conn.close()


def resolve_chr_icon_keys(card_id: int, master_path: Path | None) -> list[int]:
    """試す icon key 順: カードID → master dress → 既知フォールバック。"""
    keys: list[int] = [card_id]
    if master_path is not None:
        for d in dress_ids_from_master(master_path, card_id):
            if d not in keys:
                keys.append(d)
    if card_id == CHARA_CARD_ID:
        for d in CHARA_DRESS_FALLBACK_IDS:
            if d not in keys:
                keys.append(d)
    return keys


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
    cur = conn.cursor()
    cur.execute("SELECT h, e FROM a WHERE n=?", (name,))
    row = cur.fetchone()
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
    dst = decrypt_dir / meta_name
    print(f"decrypt {meta_name} ({src.stat().st_size} bytes, e={e})")
    decrypt_blob(src, e, dst)
    mirror = mirror_png_dir / Path(meta_name).parent / Path(meta_name).name / "Texture2D.png"
    saved = dump_best_texture(dst, mirror)
    if not saved:
        print(f"NO TEXTURE: {meta_name}")
        return False
    flat_png.parent.mkdir(parents=True, exist_ok=True)
    # flat へコピー（同一内容）
    flat_png.write_bytes(saved.read_bytes())
    print(f"  ok -> {flat_png} ({saved.stat().st_size} bytes)")
    return True


def load_support_ids() -> list[int]:
    data = json.loads(PRIORITY_JSON.read_text(encoding="utf-8"))
    supports = data.get("supports", data)
    return [int(x["id"] if isinstance(x, dict) else x) for x in supports]


def resolve_meta_path(explicit: Path | None) -> Path:
    if explicit is not None:
        return explicit
    if META_FRESH.exists():
        return META_FRESH
    return META_FALLBACK


def main() -> int:
    parser = argparse.ArgumentParser(description="Extract priority support/chara card PNGs")
    parser.add_argument("--dat", type=Path, default=DEFAULT_DAT)
    parser.add_argument("--meta", type=Path, default=None)
    parser.add_argument("--master", type=Path, default=DEFAULT_MASTER)
    parser.add_argument("--out-flat", type=Path, default=DEFAULT_OUT_FLAT)
    parser.add_argument("--out-png", type=Path, default=DEFAULT_OUT_PNG)
    args = parser.parse_args()

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

    ids = load_support_ids()
    print(f"priority supports: {len(ids)}")
    print(f"DAT={dat_root}")
    print(f"META={meta_path}")
    print(f"MASTER={master_path} (exists={master_path.is_file()})")
    print(f"OUT_FLAT={out_flat}")

    conn = sqlite3.connect(str(meta_path))
    ok_ids: list[int] = []
    missing_ids: list[int] = []

    for sid in ids:
        meta_name = f"supportcard/support{sid}/support_thumb_{sid}"
        flat = out_flat / "supports" / f"{sid}.png"
        if extract_named_asset(
            meta_name=meta_name,
            dat_root=dat_root,
            meta_conn=conn,
            decrypt_dir=decrypt_dir,
            mirror_png_dir=out_png,
            flat_png=flat,
        ):
            ok_ids.append(sid)
        else:
            missing_ids.append(sid)

    # 育成キャラ: chr_icon（カードID → dress フォールバック）。piece_icon は使わない
    chara_flat = out_flat / "characters" / f"{CHARA_CARD_ID}.png"
    icon_keys = resolve_chr_icon_keys(
        CHARA_CARD_ID, master_path if master_path.is_file() else None
    )
    print(f"chara {CHARA_CARD_ID}: chr_icon keys to try = {icon_keys}")
    chara_ok = False
    used_meta = ""
    for key in icon_keys:
        for variant in ("01", "02"):
            meta_name = chr_icon_meta_name(CHARA_CHARA_ID, key, variant=variant)
            if extract_named_asset(
                meta_name=meta_name,
                dat_root=dat_root,
                meta_conn=conn,
                decrypt_dir=decrypt_dir,
                mirror_png_dir=out_png,
                flat_png=chara_flat,
            ):
                chara_ok = True
                used_meta = meta_name
                break
        if chara_ok:
            break

    conn.close()

    print("---")
    print(f"supports ok: {len(ok_ids)}/{len(ids)}")
    print(f"supports missing: {missing_ids if missing_ids else '(none)'}")
    if chara_ok:
        print(f"chara {CHARA_CARD_ID}: ok via {used_meta} -> {chara_flat}")
    else:
        print(f"chara {CHARA_CARD_ID}: MISSING (tried keys {icon_keys})")
    return 0 if not missing_ids and chara_ok else 2


if __name__ == "__main__":
    raise SystemExit(main())
