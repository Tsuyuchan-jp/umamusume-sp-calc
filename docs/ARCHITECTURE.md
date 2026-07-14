# アーキテクチャ

## フォルダ構成

```
umamusume-sp-calc/
  README.md
  .gitignore
  docs/                 # 要件・仕様・引き継ぎ
  scripts/
    extract_mdb.mjs           # master.mdb → skills/supports/characters（Node・推奨）
    extract_mdb.py            # 同上（Python）
    extract_support_events.mjs  # U-tools + mdb → events.extracted.json
    apply_extracted_events.mjs  # events.extracted.json → events.json
    compare_events_golden.mjs   # ゴールデン比較
    verify_data.mjs             # 抽出データの簡易確認
    test_sp.mjs                 # SPコスト回帰テスト
  data/
    events.json                 # サポカイベント正本（U-tools+mdb 抽出 + preserve）
    events.extracted.json       # 抽出中間物
    events.preserve.json        # U-tools 外の例外（たづなお出かけ/正月）
    events.id-aliases.json        # 旧 id → 新 id（Phase B 移行記録）
    scenarios/
      toresenken.json           # 手メンテ（トレセン軒）
    skills.json                 # extract 生成
    supports.json
    characters.json
    meta.json
  app/
    index.html
    css/style.css
    js/
      app.js            # UI・データ読込・再計算
      aggregate.js      # ヒント収集〜合計
      scenarioLink.js   # シナリオリンク白/金
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
                          ├─ サポカ hintSkillIds → Lv5
                          ├─ 育成ウマ娘所持スキル skillsByAwakening（全ランク合算）→ Lv3
                          ├─ イベント（auto / single）→ JSON hintLv
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
| `goldLower.js` | グループ内チェーン合算（白+金 / ○+◎+金）、○→◎繰り上げ、表示フィルタ |
| `skillActivation.js` | 発動条件タグのパース・絞込互換判定・チェーン OR マージ |
| `scenarioLink.js` | シナリオリンク白/金の編成連動解決 |
| `aggregate.js` | 全由来のヒント収集と合計 |
| `app.js` | UI バインド、JSON 読込、サポカ絞込、結果スキル絞込・件数表示、説明書ダイアログ、再計算 |

## 設計上の注意

- サポカ **訓練ヒントは mdb 自動**、**イベントスキルヒントは U-tools+mdb 抽出**（`events.preserve.json` で少数例外）— 混ぜない
- シナリオはトレセン軒固定（UI に切替なし）
- ユーザー向け説明はヘッダー「使い方」`<dialog>`（`index.html` + `bindHelpDialog`）。開発者向け詳細は `docs/spec.md` 等
- extract 失敗時は `app.js` が `#load-error` に手順を表示
