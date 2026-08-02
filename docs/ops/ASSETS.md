# 画像アセット方針

方針・抽出／import の正本。完了タスクの経緯は [archive/SUPPORT_CARD_IMAGE_TASK.md](../archive/SUPPORT_CARD_IMAGE_TASK.md)。  
ゲーム更新時の全体手順は [GAME_UPDATE_RUNBOOK.md](./GAME_UPDATE_RUNBOOK.md)。

## 方針

| 手段 | 判定 |
|------|------|
| 公式の無料 CDN API | **なし** |
| 攻略サイト画像の直リンク | **採用しない** |
| ゲームクライアントからの抽出 | **採用** — リポジトリに同梱 |

## パス規約

| 種別 | パス | ファイル名 |
|------|------|--------------|
| サポカ | `assets/supports/` | `{supportCardId}.webp` |
| 育成ウマ娘 | `assets/characters/` | `{characterCardId}.webp` |
| タイプ印（共有） | `assets/type-icons/` | `{type}.webp`（speed/stamina/power/guts/wit/friend） |
| UI 背景 | `assets/ui/` | `uma-world.png`（横長・競馬場。世界観背景） |

UI は `app/js/cardAssets.js` が URL を組み立てる。画像が無い場合はタイプ色＋短縮名のプレースホルダ（計算には影響しない）。

## 同梱範囲

- 優先サポカ **40種** → `assets/supports/{id}.webp`
- 育成ウマ娘 **全カード**（`chr_icon` のみ。card_id → race_dress → 未使用 dress）→ `assets/characters/{id}.webp`
- タイプ印 **6種** — 実行時 CDN 非依存
- UI 背景 `assets/ui/uma-world.png` — 横長イラスト（空＋芝）。旧 U-tools 縦長 webp は使わない
- 目安サイズ: サポカ **240×320**・キャラ長辺 256px・WebP

### タイプ印の出所（再取得用）

実行時は `assets/type-icons/` のみ参照。

```text
https://static.kouryaku.tools/umamusume/images/app/supports/{name}.png
  speed / stamina / power / guts / friend … 同名
  wit ← wisdom.png
```

再取り込み: PNG を `.cache/asset-dump/type-icon-probe/` に置き `python scripts/import_type_icons.py`

## 著作権・配布

- 非公式・非商用。画像の権利はゲーム権利者に帰属
- **必要最小限のみ同梱**
- 公開 Pages への反映（`git push`）は **v1.0.0** まで行わない

## 抽出パイプライン

```text
DMM Persistent (meta + dat)
  → meta 復号（初回・更新時）
  → npm run assets:extract
  → npm run assets:import
```

### 前提パス（実績）

```text
D:\DMM\umamusumeDMM\Umamusume\umamusume_Data\Persistent\
  meta
  dat\
  master\master.mdb
```

### meta 復号

現行 JP クライアントの `meta` は SQLite3MC 暗号化。平文 `meta_decrypted` が必要。

- 作業用ツール・venv は `.cache/`（gitignore）
- 実績: `.cache/umamusu-utils-old-jp/storage/meta_decrypted`
- アセット先頭 256B 以降の XOR 復号は `scripts/extract_card_assets.py` に実装済み

### コマンド

```powershell
npm run assets:extract
# 育成のみ: node scripts/run_extract_card_assets.mjs --skip-supports
npm run assets:import
npm run assets:audit-dupes   # 別カードなのに同一 webp が無いか（0 件が理想）
```

| 種別 | meta 名 |
|------|---------|
| サポカ縦カード元 | `supportcard/support{ID}/support_thumb_{ID}` |
| 育成カード | `chr_icon` のみ（`piece_icon` 不使用）。キー: card_id → race_dress（他カードIDと一致ならスキップ）→ 同キャラ未使用 dress |

import 時のサポカ後処理（`scripts/support_vertical_card.py`）:

- 枠外パディング＋ソフトグロー除去、角丸マスク、縦縮尺 3:4 → 240×320
- タイプ印を右上合成（size=52 / top=-1 / right=4）
- 比較試作: `npm run samples:trim`

### スクリプト

| ファイル | 役割 |
|----------|------|
| `scripts/extract_card_assets.py` | meta+dat → flat PNG |
| `scripts/run_extract_card_assets.mjs` | venv Python ランチャ |
| `scripts/support_vertical_card.py` | 枠外トリム + 縦縮尺 + タイプ印合成 |
| `scripts/import_card_images.py` | flat PNG → WebP |
| `scripts/import_card_assets.mjs` | import ランチャ |
