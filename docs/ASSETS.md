# 画像アセット方針

UX 改善 Phase 1（2026-08-01）で確定。抽出パイプライン Phase 1（2026-08）実装。

## 調査結論

| 手段 | 判定 |
|------|------|
| 公式の無料 CDN API | **なし**（公開されていない） |
| 攻略サイト画像の直リンク | **採用しない**（更新・規約・CORS で壊れやすい） |
| ゲームクライアントからの抽出 | **採用（A）** — リポジトリに同梱（優先枠から段階投入） |

## パス規約

| 種別 | パス | ファイル名 |
|------|------|--------------|
| サポカ | `assets/supports/` | `{supportCardId}.webp` |
| 育成ウマ娘 | `assets/characters/` | `{characterCardId}.webp` |
| タイプ印（共有） | `assets/type-icons/` | `{type}.webp`（speed/stamina/power/guts/wit/friend） |

UI は `app/js/cardAssets.js` が URL を組み立てる。画像が無い場合はタイプ色＋短縮名のプレースホルダを表示（計算には影響しない）。

## 同梱範囲（Phase 1）

- 優先サポカ **40種**（`data/priority-supports.json`）→ `assets/supports/{id}.webp`
- 初期育成ウマ娘 **107703**（`[万福龍湯伝・頂]ナリタトップロード`）→ `assets/characters/107703.webp`
- タイプ印 **6種**（`assets/type-icons/{type}.webp`）— カード横断で使いまわし。実行時CDN非依存
- 目安サイズ: サポカ **240×320**・キャラ長辺 256px・WebP・Phase1 合計 **約 1〜2 MiB**（5MB 未満）

### タイプ印の出所（同梱・再取得用）

実行時は `assets/type-icons/` のみ参照。取得元 CDN への直リンクはしない。

```text
https://static.kouryaku.tools/umamusume/images/app/supports/{name}.png
  speed / stamina / power / guts / friend … 同名
  wit ← wisdom.png
```

再取り込み: PNG を `.cache/asset-dump/type-icon-probe/` に置き `python scripts/import_type_icons.py`

## 著作権・配布

- 非公式・非商用。画像の権利はゲーム権利者に帰属する
- **必要最小限のみ同梱**（優先枠＋初期カード）
- 公開 Pages への反映（`git push`）は UX 完成後の **v1.0.0** まで行わない方針

## 抽出パイプライン（半自動）

```text
DMM Persistent (meta + dat)
  → meta 復号（初回・更新時）
  → npm run assets:extract   # support_thumb_{id} / piece_icon_{id} → .cache/asset-dump/flat/*.png
  → npm run assets:import    # サポカ縦合成 + flat PNG → assets/**/{id}.webp
```

### 前提パス（この環境の実績）

```text
D:\DMM\umamusumeDMM\Umamusume\umamusume_Data\Persistent\
  meta
  dat\
  master\master.mdb
```

AppData `LocalLow\Cygames\umamusume` には meta/dat が無いことが多い。

### meta 復号

現行 JP クライアントの `meta` は SQLite3MC 暗号化。平文 `meta_decrypted` が必要。

- 作業用ツール・venv はリポジトリの **`.cache/`**（gitignore）に置く
- 実績: `.cache/umamusu-utils-old-jp/storage/meta_decrypted`
- stock の umamusu-utils main はそのままでは JP 暗号化アセットに未対応。アセットは先頭 256B 以降の XOR 復号が必要（`scripts/extract_card_assets.py` に実装済み）

### コマンド

```powershell
# 1) 優先40 + キャラ 107703 を PNG 抽出（要: 復号済み meta・dat・.cache 内 venv）
npm run assets:extract
# オプション: --dat "D:\...\Persistent\dat" --meta ".\.cache\...\meta_decrypted"

# 2) WebP 化して assets/ へ配置（必須欠落は exit 2）
npm run assets:import
```

使用アセット名（meta `n`）:

| 種別 | meta 名 |
|------|---------|
| サポカ縦カード元 | `supportcard/support{ID}/support_thumb_{ID}`（512×512・レア枠焼き付き） |
| 育成カード | `outgame/piece/piece_icon_{characterCardId}` |

import 時のサポカ後処理（`scripts/support_vertical_card.py`）:
- `support_thumb` の枠外パディング＋ソフトグローを除去（512基準 L12/T5/R12/B13・ハードクロム外縁）
- 表示解像度で自前角丸マスク（半径29）により四隅の枠外グローを透明化
- 左右カットせず縦縮尺（3:4）→ 240×320 にリサイズ
- `assets/type-icons/{type}.webp` を右上固定で合成（size=52 / top=0 / right=4）
- 共有マスク・レアバッジは載せない
- 比較試作: `npm run samples:trim` → `.cache/.../compare-trim/`

### スクリプト

| ファイル | 役割 |
|----------|------|
| `scripts/extract_card_assets.py` | meta+dat → flat PNG（サポカは `support_thumb`） |
| `scripts/run_extract_card_assets.mjs` | venv Python ランチャ |
| `scripts/support_vertical_card.py` | 枠外トリム + 縦縮尺 + タイプ印合成（本番・試作共通） |
| `scripts/import_card_images.py` | flat PNG → WebP（サポカ縦合成・キャラ縮小） |
| `scripts/import_card_assets.mjs` | import ランチャ |

ゲーム更新時の手順全体は [GAME_UPDATE_RUNBOOK.md](./GAME_UPDATE_RUNBOOK.md) を参照。
