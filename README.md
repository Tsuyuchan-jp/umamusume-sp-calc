# umamusume-sp-calc

ウマ娘プリティーダービー向け。育成完了時に「取得可能スキルをすべて取る」ための理論必要SPを算出するローカルツール。

## 注意（公開利用者向け）

- **HTML をダブルクリックして開けない** — `fetch` で JSON を読むため HTTP サーバーが必要
- **シナリオはトレセン軒のみ** — 当面このシナリオ固定
- **シナリオスキルはガチ想定** — クラシック大盛況・シニア超盛況・育成終了スキルは常時計上（盛況段階の切替はなし）
- **イベントは優先11サポカのみ** — 全サポカ網羅ではない

## 使い方

### 1. データ抽出（ゲーム更新時）

```powershell
npm run extract
# またはパス指定
node scripts/extract_mdb.mjs --mdb "C:\path\to\master.mdb"
```

既定で次を順に探します。

1. `%USERPROFILE%\AppData\LocalLow\Cygames\umamusume\master\master.mdb`
2. `D:\DMM\umamusumeDMM\Umamusume\umamusume_Data\Persistent\master\master.mdb`
3. `D:\Umamusume\umamusume_Data\Persistent\master\master.mdb`

### 2. アプリ起動

`app` 配下をルートではなく、**リポジトリ直下**を配信します。

```powershell
npm run serve
```

ブラウザで http://localhost:8080/app/ を開く。

`app/js/app.js` は `../data/*.json` を読むため、`app/` だけをサイトルートにするとデータ取得に失敗します。

### 3. 公開 URL（GitHub Pages）

**使い方**: 下記 URL をブラウザで開くだけ（インストール不要）。

| 項目 | URL |
|------|-----|
| アプリ入口 | `https://<GitHubユーザー名>.github.io/umamusume-sp-calc/app/` |
| リポジトリ直下 | `https://<GitHubユーザー名>.github.io/umamusume-sp-calc/` → 自動で `/app/` へ |

> 初回デプロイ後、`<GitHubユーザー名>` を実際のユーザー名に置き換えてください。

**制限事項（告知用）**

> ウマ娘 SP 計算ツール（コミュニティ向け）。**トレセン軒シナリオのみ**・**ガチ想定**（大盛況/超盛況・終了スキル固定）・**優先11サポカのイベントのみ**対応。ゲーム更新時はデータが古くなる場合があります。

### 4. 静的ホスト公開（技術メモ）

GitHub Pages / Cloudflare Pages 等で公開する場合も同様です。

- **サイトルート = リポジトリ直下**（`data/` と `app/` が同階層）
- 入口は **`/app/`**（例: `https://example.github.io/umamusume-sp-calc/app/`）
- `file://` では動かない（HTTP 必須）

#### GitHub Pages 初回セットアップ

1. GitHub に **public** リポジトリ `umamusume-sp-calc` を作成して push
2. リポジトリ **Settings → Pages → Build and deployment → Source** を **GitHub Actions** に設定
3. `master` へ push すると `.github/workflows/deploy-pages.yml` が `verify` / `test` 後にデプロイ
4. 数分後、上記公開 URL で `/app/` を開いて合計 SP が表示されることを確認

ルートの `index.html` は誤ってリポジトリ直下だけ開いた場合に `/app/` へリダイレクトします。

### 5. テスト・データ検証

```powershell
npm test
npm run verify
```

`verify` は skillId 欠損・名前不一致があると **非0終了** します。

## 機能

- 育成ウマ娘所持スキル（最大覚醒レベル想定・ヒントLv3）＋サポカ6枚（ヒントLv5）
- イベント／シナリオスキル選択式
- 金＋白コスト合算（実機検証済み）
- 切れ者トグル
- スキル除外
- 継承固有（汎用行・2〜6本・baseSp200・一律Lv）

## 構成

| パス | 内容 |
|------|------|
| `scripts/extract_mdb.mjs` | master.mdb → JSON |
| `data/` | skills / supports / characters / events / scenarios |
| `app/` | ブラウザUI |
| `docs/spec.md` | 仕様 |
| `docs/GLOSSARY.md` | 用語（育成ウマ娘所持スキル / 覚醒進化 など） |

## 更新フロー

1. ゲーム更新後に最新 `master.mdb` を用意
2. `npm run extract`
3. 必要なら `data/events.json` にイベントスキルを追記
4. `npm run bind-priority`（常用サポカID再紐付け）
