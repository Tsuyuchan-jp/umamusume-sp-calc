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

UI は `app/js/cardAssets.js` が URL を組み立てる。画像が無い場合はタイプ色＋短縮名のプレースホルダを表示（計算には影響しない）。

## 同梱範囲（Phase 1）

- 優先サポカ **40種**（`data/priority-supports.json`）→ `assets/supports/{id}.webp`
- 初期育成ウマ娘 **107703**（`[万福龍湯伝・頂]ナリタトップロード`）→ `assets/characters/107703.webp`
- 目安サイズ: 長辺 256px・WebP・Phase1 合計 **約 0.6 MiB**（5MB 未満）

## 著作権・配布

- 非公式・非商用。画像の権利はゲーム権利者に帰属する
- **必要最小限のみ同梱**（優先枠＋初期カード）
- 公開 Pages への反映（`git push`）は UX 完成後の **v1.0.0** まで行わない方針

## 抽出パイプライン（半自動）

```text
DMM Persistent (meta + dat)
  → meta 復号（初回・更新時）
  → npm run assets:extract   # support_card_s_{id} / piece_icon_{id} → .cache/asset-dump/flat/*.png
  → npm run assets:import    # flat PNG → assets/**/{id}.webp
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
| サポカ小カード | `supportcard/support{ID}/support_card_s_{ID}` |
| 育成カード | `outgame/piece/piece_icon_{characterCardId}` |

### スクリプト

| ファイル | 役割 |
|----------|------|
| `scripts/extract_card_assets.py` | meta+dat → flat PNG |
| `scripts/run_extract_card_assets.mjs` | venv Python ランチャ |
| `scripts/import_card_assets.mjs` | flat PNG → `assets/**/*.webp` |

ゲーム更新時の手順全体は [GAME_UPDATE_RUNBOOK.md](./GAME_UPDATE_RUNBOOK.md) を参照。
