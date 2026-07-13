# アーキテクチャ

## フォルダ構成

```
umamusume-sp-calc/
  README.md
  .gitignore
  docs/                 # 要件・仕様・引き継ぎ
  scripts/
    extract_mdb.mjs     # master.mdb → data/*.json（Node・推奨）
    extract_mdb.py      # 同上（Python）
    verify_data.mjs     # 抽出データの簡易確認
    test_sp.mjs         # SPコスト回帰テスト
  data/
    events.json         # 手メンテ
    scenarios/
      toresenken.json
    skills.json         # extract（未生成の場合あり）
    supports.json
    characters.json
    meta.json
  app/
    index.html
    css/style.css
    js/
      app.js            # UI・データ読込・再計算
      aggregate.js      # ヒント収集〜合計
      hintResolve.js    # max(hintLv)
      spCost.js         # floor コスト
      goldLower.js      # 金+白・表示フィルタ
```

## ランタイム構成

- **静的フロントのみ**（ビルドツール・フレームワークなし）
- ES modules（`type="module"`）
- `fetch` で `../data/*.json` を読むため、原則 **HTTP サーバー経由**で `app/` を配信

## データフロー

```text
master.mdb
    │ extract_mdb.mjs（または .py）
    ▼
data/skills.json + supports.json + characters.json
    │
data/events.json ──────────────┐
data/scenarios/toresenken.json ─┤
    │                           │
    ▼                           ▼
app.js (loadJson) ──► buildSkillPlan(aggregate.js)
                          │
                          ├─ サポカ hintSkillIds → Lv5
                          ├─ 育成ウマ娘所持スキル skillsByAwakening（全ランク合算）→ Lv3
                          ├─ 有効イベント → JSON hintLv
                          ├─ 有効シナリオ → JSON hintLv
                          ├─ resolveHintLevels (max)
                          ├─ filterDisplaySkills（金がある白を隠す）
                          ├─ calcAcquisitionCost（白+金）
                          └─ 継承オプション加算
                          ▼
                     合計SP + 行一覧（除外チェック可）
```

## モジュール責務

| ファイル | 責務 |
|----------|------|
| `spCost.js` | 割引テーブルと `calcSkillCost` |
| `hintResolve.js` | skillId → max hintLv + sources |
| `goldLower.js` | 金取得コスト合算、表示用白除外 |
| `aggregate.js` | 全由来のヒント収集と合計 |
| `app.js` | UI バインド、JSON 読込、再計算 |

## 設計上の注意

- サポカ **訓練ヒントは自動**、**イベント金は手メンテ** — 混ぜない
- シナリオはトレセン軒固定（UI に切替なし）
- extract 失敗時は `app.js` が `#load-error` に手順を表示
