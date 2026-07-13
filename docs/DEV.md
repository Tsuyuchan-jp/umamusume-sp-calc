# 開発・セットアップ

**使い方・公開 URL**は [README.md](../README.md) を先に参照。このファイルは開発・メンテ用。

## 前提

- Windows（本プロジェクトの作業環境）
- Node.js（extract / test / verify / `npm run serve`）
- ブラウザ（Chrome / Edge 等）
- DMM/Steam 版ウマ娘の `master.mdb`（再 extract 時）

## 1. リポジトリ

```powershell
cd C:\Users\PC1\Projects\umamusume-sp-calc
```

remote: `https://github.com/Tsuyuchan-jp/umamusume-sp-calc.git`  
公開 URL: https://Tsuyuchan-jp.github.io/umamusume-sp-calc/app/

## 2. master.mdb 抽出（ゲーム更新時）

**ゲーム更新時の全体手順（チェックリスト正本）**: [GAME_UPDATE_RUNBOOK.md](./GAME_UPDATE_RUNBOOK.md)

**推奨: Node.js**

```powershell
npm run extract
# または
node scripts/extract_mdb.mjs --mdb "D:\DMM\umamusumeDMM\Umamusume\umamusume_Data\Persistent\master\master.mdb"
```

既定で次を順に探す: AppData 既定 → DMM Persistent → `D:\Umamusume\...`

成功すると `data/skills.json`, `supports.json`, `characters.json`, `meta.json` が更新される。  
`events.json` / `toresenken.json` は `extract_mdb` では上書きされない。

`skills.json` の `lowerSkillId` / `upperSkillId` は **`group_rate >= 0` のみ**リンクする（`group_rate < 0` の × は購入チェーン外）。  
既存 JSON のリンクだけ直す場合:

```powershell
node scripts/relink_skills.mjs
```

### サポカイベントの再生成（ゲーム更新・U-tools 再取得時）

```powershell
npm run extract:events
# オフライン再生成のみ: node scripts/extract_support_events.mjs --cache-only
npm run apply:events
npm run compare:events
```

U-tools の raw キャッシュは `data/events.raw.utools.json`（gitignore）。初回はネットワーク必須。

`events.preserve.json` — U-tools に無い実機確認済み例外（たづなお出かけ/正月）。  
`events.default-overrides.json` — `defaultChoiceId` の少数上書き（ドトウ連続・ヤング Dreams 等）。

```powershell
npm run verify
npm test
```

優先サポカ ID の再同期が必要なときのみ `npm run bind-priority`（通常は不要）。

## 3. ローカル確認

`file://` では `fetch` が失敗する。**HTTP 必須**。

**サイトルート = リポジトリ直下**（`data/` と `app/` が同階層）。入口は **`/app/`**。

```powershell
npm run serve
```

ブラウザ: http://localhost:8080/app/

`app/` だけをルートにすると `../data/*.json` が 404 になる。

## 4. GitHub Pages（本番）

- workflow: `.github/workflows/deploy-pages.yml`（`master` push / 手動）
- デプロイ前に `npm run verify` と `npm test`
- サイトルート = リポジトリ直下、入口 `/app/`
- ルート `index.html` は `./app/` へリダイレクト
- `.nojekyll` で Jekyll 無効化

### 初回・再デプロイ

1. リポジトリ **Settings → Pages → Source** を **GitHub Actions** にする
2. `master` へ push、または Actions から `Deploy GitHub Pages` を再実行
3. https://Tsuyuchan-jp.github.io/umamusume-sp-calc/app/ で合計 SP を確認

`configure-pages` が「Pages site failed / Not Found」になる場合は、Source が Actions 未設定のことが多い。設定後に workflow を rerun する。

## Python / PATH

再 extract は Node 推奨。Python を使う場合は実体の PATH を確認（WindowsApps スタブに注意）。

```powershell
where.exe python
```

mdb が無いときはクライアントのデータ DL 完了を確認し、見つかったパスを `--mdb` で渡す。

## Git コミット方針（必須）

作業のたびにコミット。PowerShell では `git add .` と `git commit` を**別ステップ**（`&&` 禁止）。

```powershell
git add .
git commit -m "feat: 変更内容の要約"
```

- **push は明示依頼時のみ**

## エージェント / チャット運用

次タスクが決まっているとき、実装着手前に推奨言語モデル（4択）を提示する。  
詳細: [MODEL_SELECTION.md](./MODEL_SELECTION.md)

## よくある失敗

| 症状 | 原因 | 対処 |
|------|------|------|
| ロードエラー | skills 等が無い | `npm run extract` |
| CORS / fetch 失敗 | file:// または `app/` のみ配信 | リポジトリ直下で `npm run serve` → `/app/` |
| Pages デプロイ失敗（Not Found） | Pages Source 未設定 | Settings → Pages → GitHub Actions |
| イベントが効かない | skillId/名前不一致 or サポカ未選択 | events.json とデッキを確認 |
