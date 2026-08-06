# リポジトリ全域レビュー（棚卸し）

調査日: 2026-08-06  
方針: **直さず一覧化** → 合意後にリファクタ。計算式・REQUIREMENTS は変更しない。  
関連: [TODO.md](../TODO.md) / [v1-review-findings.md](./v1-review-findings.md) / [ops/ARCHITECTURE.md](../ops/ARCHITECTURE.md)

## 結論（1行）

コア計算は分離済みで健全。負債の中心は **`app.js` 肥大・CSS 二重レイヤ・scripts/docs の残骸と鮮度**。致命バグは見当たらない。

## 規模感

| 領域 | 概算 |
|------|------|
| `app/js` | ~5500 行（うち `app.js` ~2500） |
| `app/css` | ~5400 行（`style.css` ~3150 / `foundation.css` ~1600） |
| `scripts/` | 43 ファイル（npm 直結 + テスト + 一度きり／試作） |
| テスト | `npm test` 7 本（SP / activation / copy / snapshot / source / ファイル名 / title） |

## 重大度の定義

| 印 | 意味 |
|----|------|
| **致命** | 合計 SP や状態が常用フローで誤る／操作不能 |
| **中** | メンテコスト・誤実行・回帰しやすい構造。対人準備で踏まれうる穴 |
| **軽** | 重複・鮮度・死コード。品質・可読性 |

---

## 発見一覧

### 致命

（なし）

### 中

| ID | 箇所 | 内容 |
|----|------|------|
| **R1** | `app/js/app.js` | God-object。イベント UI・結果表・レイアウト・メモリが同居（関数 110+）。変更の影響範囲が広い |
| **R2** | `style.css` ↔ `foundation.css` | `.panel` / 汎用 `table`·`th`·`td` / `.result-table-wrap` が二重。cascade が読みにくく見た目回帰の温床（th 背景ずれと同系統） |
| **R3** | `scripts/append_priority_events.mjs` 等 | 一度きり／調査用スクリプトがルートに残存。誤実行で `events` 汚染のリスク |
| **R4** | テスト穴 | 継承固有 SP の明示回帰・代表編成の合計アサーションが弱い。`recalc` DOM フルパス E2E は未整備（ユニットで代替可） |
| **R5** | `merge` / `reclassify` / `extract_mdb.py` | npm に残るが Runbook 正本は `extract:events` → `apply:events`。位置づけ曖昧 |

### 軽

| ID | 箇所 | 内容 |
|----|------|------|
| **L1** | `escapeHtml` | `app.js` と `shareCard.js` に別実装 |
| **L2** | `characterBaseName` | `cardAssets.js` と `searchText.js` に二重 export |
| **L3** | `renderSupportSlots` | `app.js` 内の薄いラッパ。呼び出しなし（死コード） |
| **L4** | 版キャッシュバス | HTML `?v=` / `DATA_CACHE_BUST` / `ASSET_CACHE_BUST` が散在（版上げ時の手同期） |
| **L5** | 縦カード samples | v1/v2 Python が残存。本番は v4 + `support_vertical_card.py`。`samples:vertical-v3` も npm に残る |
| **L6** | docs 鮮度 | `v1-review-findings` の L7（M1 回帰なし）は現状誤り。推奨順にクローズ済み項目が残る |
| **L7** | product 常駐 | 完了済み `design-polish-backlog` / `design-overhaul-handoff` は archive 候補 |
| **L8** | spec 版表記 | 「実機確認済み（v0.1.10）」など古い版ラベルが残る（事実自体は有効） |
| **L9** | v1-review L1–L6, L8 | 軽微のまま未消化（今回の構造リファクタとは別枠でも可） |

### v1-review からの引き継ぎ（訂正）

- **M1〜M4・スマホ対応**: クローズ済み（実機 OK）
- **L7「M1 の回帰なし」**: **誤り** — `test_skill_activation.mjs` にコネクト／シンパシー回帰あり
- **L7 継承 SP・recalc E2E**: なお未整備 → 本レビュー **R4**

---

## 推奨修正順（合意たたき台 → 本イニシアチブで実施）

1. **docs 鮮度・archive・死スクリプト隔離**（R3, L5–L8）
2. **共有ユーティリティ一本化・死コード削除**（L1–L3）
3. **CSS 責任境界の整理**（R2）— 見た目=foundation / 配置・layout=style
4. **`app.js` 分割**（R1）— イベント UI → 結果表レンダ（挙動不変）
5. **テスト穴の最小埋め**（R4）— 継承 SP + 代表合計
6. **レイアウト切替の分離** — 回帰が重いので **本枠では後回し**（findings に残す）
7. **R5 明文化** — Runbook / package コメントでレガシー扱い（削除はしない）

## やらない（本枠）

- フレームワーク／バンドラ導入
- 計算ルール再設計
- 共有カード右背景（TODO 保留）
- モック HTML 一括削除
- `aggregate` / `skillActivation` の大きな再設計

## 合意（2026-08-06）

計画デフォルト順を採用。既存 Open（共有カード右背景・回帰拡充・30307/30308・ゲーム更新）はレビュー枠完了まで保留 → **完了後に復帰済み**。

## 実施結果（2026-08-06）

| 順 | 項目 | 結果 |
|----|------|------|
| 1 | docs／archive／死スクリプト隔離 | **済** |
| 2 | ユーティリティ一本化・死コード | **済**（`htmlEscape`・`characterBaseName`・`renderSupportSlots`） |
| 3 | CSS 責任境界 | **済** |
| 4 | `eventUi.js` / `resultTable.js` | **済** |
| 5 | 継承 SP テスト | **済** |
| 6 | レイアウト切替の分離 | **後回し**（本枠外） |
| 7 | R5 レガシー明文化 | **済**（DATA.md） |