# 開発・セットアップ

**使い方・公開 URL**は [../README.md](../README.md)。docs 入口は [README.md](../README.md)。

ゲーム本パッチ後の extract / イベント / 画像 / デプロイ手順の**正本**は [GAME_UPDATE_RUNBOOK.md](./GAME_UPDATE_RUNBOOK.md)。本ファイルは起動・トラブル・Git 向け。

## 前提

- Windows（本プロジェクトの作業環境）
- Node.js（extract / test / verify / `npm run serve`）
- ブラウザ（Chrome / Edge 等）
- DMM/Steam 版ウマ娘の `master.mdb`（再 extract 時）

## リポジトリ

```powershell
cd C:\Users\PC1\Projects\umamusume-sp-calc
```

remote: `https://github.com/Tsuyuchan-jp/umamusume-sp-calc.git`  
公開 URL: https://Tsuyuchan-jp.github.io/umamusume-sp-calc/app/

## ローカル確認

`file://` では `fetch` が失敗する。**HTTP 必須**。

サイトルート = リポジトリ直下（`data/` と `app/` が同階層）。入口は **`/app/`**。

```powershell
npm run serve
```

ブラウザ: http://localhost:8080/app/

`app/` だけをルートにすると `../data/*.json` が 404 になる。

データが無いときは [GAME_UPDATE_RUNBOOK.md](./GAME_UPDATE_RUNBOOK.md) の extract 手順へ。

## GitHub Pages（本番）

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

**注意**: 公開反映は `git push`（Pages は GitHub Actions）。手順は上記。

## Python / PATH

再 extract は Node 推奨。Python を使う場合は実体の PATH を確認（WindowsApps スタブに注意）。

```powershell
where.exe python
```

## Git コミット方針（必須）

作業のたびにコミット。PowerShell では `git add .` と `git commit` を**別ステップ**（`&&` 禁止）。

```powershell
git add .
git commit -m "feat: 変更内容の要約"
```

- **push は明示依頼時のみ**

## エージェント / チャット運用

次タスクが決まっているとき、実装着手前に推奨言語モデル（4択）を提示する。  
詳細: [MODEL_SELECTION.md](../AGENT_HANDOFF.md#推奨言語モデル)

## よくある失敗

| 症状 | 原因 | 対処 |
|------|------|------|
| ロードエラー | skills 等が無い | Runbook の `npm run extract` |
| CORS / fetch 失敗 | file:// または `app/` のみ配信 | リポジトリ直下で `npm run serve` → `/app/` |
| Pages デプロイ失敗（Not Found） | Pages Source 未設定 | Settings → Pages → GitHub Actions |
| イベントが効かない | skillId/名前不一致 or サポカ未選択 | events.json とデッキを確認 |
