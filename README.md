# umamusume-sp-calc

ウマ娘プリティーダービー向け。育成完了時に「取得可能スキルをすべて取る」ための理論必要SPを算出するローカルツール（HTML/JS + JSON）。

**新チャットで開発を続ける場合は、まず [docs/AGENT_HANDOFF.md](docs/AGENT_HANDOFF.md) を読む。**

## ドキュメント

| ファイル | 内容 |
|----------|------|
| [docs/AGENT_HANDOFF.md](docs/AGENT_HANDOFF.md) | **最初に読む** 現状・次手順・非交渉ルール |
| [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) | 確定要件 |
| [docs/spec.md](docs/spec.md) | 計算仕様・ヒントLv・金+白 |
| [docs/DATA.md](docs/DATA.md) | mdb / 抽出 / 手メンテ JSON |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 構成・データフロー |
| [docs/DEV.md](docs/DEV.md) | セットアップ・Python トラブル・Git |
| [docs/ROADMAP.md](docs/ROADMAP.md) | 完了 / 残りフェーズ |

## 使い方（要約）

詳細は [docs/DEV.md](docs/DEV.md)。

### 1. データ抽出（ゲーム更新時）

```powershell
node scripts/extract_mdb.mjs
```

または Python 版（PATH 要確認）:

```powershell
python scripts/extract_mdb.py --mdb "D:\DMM\umamusumeDMM\Umamusume\umamusume_Data\Persistent\master\master.mdb"
```

詳細・トラブルシュートは [docs/DEV.md](docs/DEV.md)。

### 2. アプリ起動

```powershell
cd app
python -m http.server 8080
```

http://localhost:8080

**注意**: `data/skills.json` 等が無いとロードエラー。初回 extract は済んでいる想定（`data/meta.json` を確認）。再抽出時は DMM 配下の mdb を `--mdb` で指定すること（AppData 既定パスが空の場合あり）。

## 構成

- `scripts/extract_mdb.mjs` — master.mdb → data/*.json（Node・推奨）
- `scripts/extract_mdb.py` — 同上（Python）
- `scripts/verify_data.mjs` / `test_sp.mjs` — 検証
- `scripts/inspect_names*.mjs` — mdb 名前調査用（一時的・任意）
- `data/` — スキル・サポカ・ウマ娘（extract）+ イベント・シナリオ（手メンテ）
- `app/` — ブラウザUI
- `docs/` — 仕様と引き継ぎ

## データ更新

ゲームパッチ後: `master.mdb` 更新 → `node scripts/extract_mdb.mjs` 再実行 → 必要なら `data/events.json` / `data/scenarios/toresenken.json` を手修正。
