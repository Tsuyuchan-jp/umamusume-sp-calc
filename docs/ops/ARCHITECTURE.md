# アーキテクチャ

フォルダ構成とデータフローの正本。手順は [DEV.md](./DEV.md) / [GAME_UPDATE_RUNBOOK.md](./GAME_UPDATE_RUNBOOK.md)。JSON 意味は [DATA.md](./DATA.md)。

## フォルダ構成

```
umamusume-sp-calc/
  README.md
  docs/                 # 入口は docs/README.md
  scripts/              # extract / verify / test / assets
  data/                 # JSON（extract 生成 + シナリオ手メンテ）
  assets/               # カード画像（supports / characters / type-icons）
  app/
    index.html
    css/style.css
    js/                 # UI・集計（app.js / aggregate.js 等）
```

主要スクリプト・モジュールの一覧はリポジトリ内の実ファイルを正とする。docs に長いツリーを複製しない。

## ランタイム構成

- **静的フロントのみ**（ビルドツール・フレームワークなし）
- ES modules（`type="module"`）
- `fetch` で `../data/*.json` を読むため、原則 **HTTP サーバー経由**で `app/` を配信

## データフロー

```text
master.mdb
    │ extract_mdb.mjs
    ▼
data/skills.json + supports.json + characters.json
    │
U-tools SSR + mdb ──► extract_support_events.mjs
    │                      │
    │                      ▼
    │               events.extracted.json
    │                      │ apply_extracted_events.mjs
    │                      │ (+ events.preserve.json)
    ▼                      ▼
data/events.json ──────────────┐
data/scenarios/toresenken.json ┤
    │                           │
    ▼                           ▼
app.js (loadJson) ──► buildSkillPlan(aggregate.js)
                          │
                          ├─ サポカ hintSkillIds → トレヒントLv
                          ├─ 育成ウマ娘所持スキル → Lv3
                          ├─ イベント / シナリオ → JSON hintLv
                          ├─ resolveHintLevels (max)
                          ├─ filterDisplaySkills / calcAcquisitionCost
                          └─ 継承オプション加算
                          ▼
                     合計SP + 行一覧
```

## モジュール責務

| ファイル | 責務 |
|----------|------|
| `spCost.js` | 割引テーブルと `calcSkillCost` |
| `hintResolve.js` | skillId → max hintLv + sources |
| `goldLower.js` | グループ内チェーン合算・表示フィルタ |
| `skillActivation.js` | 発動条件タグ・絞込 |
| `scenarioLink.js` | シナリオリンク白/金 |
| `aggregate.js` | 全由来のヒント収集と合計 |
| `copyIncludedSkills.js` | 含める ON 行のクリップボード書き出し |
| `designSnapshot.js` / `designMemory.js` | 設計メモリ |
| `cardAssets.js` | カード画像 URL |
| `htmlEscape.js` | HTML エスケープ共通 |
| `eventUi.js` | 列下イベント要約・選択ダイアログ／スプリット詳細 |
| `scenarioLinkUi.js` | シナリオリンク・シニア RMJ チップ UI |
| `designMemoryUi.js` | 設計メモリダイアログ（一覧・サムネ・保存／復元／削除） |
| `designSessionUi.js` | セッション自動保存・スナップショット復元 |
| `deckUi.js` | 編成ダッシュボード・カードピッカー・継承ポップオーバー |
| `resultTable.js` | 結果表 tbody レンダ（ON／条件／由来） |
| `app.js` | UI 配線・JSON 読込・`recalc` オーケストレーション |

## 設計上の注意

- サポカ **トレヒントは mdb 自動**、**イベントスキルヒントは U-tools+mdb** — 混ぜない
- シナリオはトレセン軒固定
- ユーザー向け説明はヘッダー「使い方」`<dialog>`（`index.html`）。開発者向けは `docs/spec/calc.md` 等
