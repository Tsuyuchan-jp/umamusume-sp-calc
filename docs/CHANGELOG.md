# 更新履歴

公開版の主な変更を記録する。細かい開発コミットは Git 履歴を参照。

形式は [Keep a Changelog](https://keepachangelog.com/ja/1.0.0/) に近いが、セマンティックバージョニングは緩め（`0.1.x` = 公開後の軽量改修）。

## [0.1.9] — 2026-07-16

### 追加

- オプション **トレヒントLv**（3 / 4 / 5、既定5）。編成サポカのトレヒントを一括指定。イベント・シナリオ由来は変更しない

### 変更

- ツール内の「訓練ヒント」表記を **トレヒント** に統一
- バージョン表記を **v0.1.9**

## [0.1.8] — 2026-07-15

### 追加

- 結果パネルに **含めるスキルをコピー** ボタン。含める ON の表示行スキル名をカンマ区切り1行でクリップボードへコピー（継承固有は対象外）。`copyIncludedSkills.js` と `test_copy_included_skills.mjs` を追加。実機確認済み

### 変更

- バージョン表記を **v0.1.8**

## [0.1.7] — 2026-07-14

### 変更

- 結果レギュ絞込に **適用ボタン**（セレクト変更は下書きのみ、適用で確定）。編成変更時は確定済み絞込を新規スキルに増分適用（手動「含める」は維持）。実機確認済み
- レギュ絞込 UI を枠でグルーピング（未適用時は枠色のみ強調）
- `skillActivation.js` に増分／全置換除外の pure 関数、`test_skill_activation.mjs` に回帰テスト追加
- バージョン表記を **v0.1.7**

## [0.1.6] — 2026-07-14

### 追加

- 結果スキル一覧に **発動条件タグ**（バ場・距離・作戦）と **レギュ絞込**（バ場／距離／作戦）。非互換スキルを合計から自動除外（手動「含める」は絞込変更でリセット）。実機確認済み
- `skills.json` の `activation` フィールド（mdb `skill_data` 条件から extract）
- `app/js/skillActivation.js`、`scripts/patch_skill_activation.mjs`、`scripts/test_skill_activation.mjs`

### 変更

- バージョン表記を **v0.1.6**
- 絞込 UI の「馬場」表記をゲーム内表記の **「バ場」** に統一
- 結果パネル見出し右に「スキル数 ON/全件」を表示（実機確認済み）

---

## [0.1.5] — 2026-07-14

### 追加

- ヘッダー右 **「使い方」** から開く **説明書モーダル**（ネイティブ `<dialog>`）。使い方・ヒントLvの算出・FAQ・制限と免責（GitHub / note / X 連絡先含む）。実機確認済み

### 変更

- バージョン表記を **v0.1.5**

---

## [0.1.4] — 2026-07-14

### 追加

- サポカフィルタ **「イベント対応のみ」**（デフォルト ON）。`events.json` の `prioritySupportIds`（37種）でセレクト候補を絞込
- 選択中カードはフィルタ外でもその枠に残す（既存の SSR／タイプ／検索と AND 結合）

### 変更

- バージョン表記を **v0.1.4**

---

## [0.1.3] — 2026-07-14

### 変更

- サポカイベント正本を **U-tools + mdb 抽出**に置換（Phase B 完了）
- `events.json` 102件（抽出100 + preserve 2）。旧 id は `events.id-aliases.json` に記録
- ゴールデン比較: 抽出100件すべて match（conflict 0）

### 追加

- `npm run apply:events` / `scripts/apply_extracted_events.mjs`
- `data/events.preserve.json`（たづなお出かけ/正月・実機確認済み）
- `data/events.default-overrides.json`（ドトウ連続・ヤング Dreams デフォルト）

### 削除（手メンテ誤記）

- グラン「成長のヒント」（U-tools に無し）
- フジ「スライハンド」auto 登録（U-tools ではヒント無し）

---

## [0.1.2] — 2026-07-13

### 追加

- 優先サポカ **+26種**（計37種・103イベント）。GameWith / U-tools 照合の手メンテ
- `scripts/merge_support_events.mjs`（調査JSON → `events.json` マージ＋skillId 解決）
- `scripts/generate-support-events-26.mjs` / `data/support-events-research-26.json`（調査正本）

### 変更

- `bind_priority.mjs` を `prioritySupportNames` から自動生成するよう汎用化
- サポカイベント注意書きの件数（11種 → 37種）
- バージョン表記を **v0.1.2**

### 修正

- アストンマーチャン「いつもそばから見つめてる」を削除（GameWith誤記の捕捉ヒント。実機・U-toolsではステータスのみ）

---

## [0.1.1] — 2026-07-13

### 追加

- ○→◎ のガチ想定合算（ヒントは○準拠、◎専用ヒントなし）
- グループ内チェーン合算（○+◎、○+◎+金）。内訳は `(78+84+135)` 形式
- サポカイベント「優先11種のみ」注意（見出し横ボタンのアコーディオン）
- `scripts/relink_skills.mjs`（`group_rate < 0` を除いたリンク再構築）
- 本ファイル（更新履歴）

### 修正

- `group_rate < 0` の × を購入チェーンから除外（extract・`skills.json`・実行時）
  - 例: 冬ウマ娘◎、弧線のプロフェッサーで3項合算になっていた問題

### 変更

- バージョン表記を **v0.1.1**

---

## [0.1.0] — 2026-07-13

### 追加

- **GitHub Pages 公開**（https://Tsuyuchan-jp.github.io/umamusume-sp-calc/app/）
- ヘッダーにバージョン表記
- 公開向け README 整理（利用者向けを先頭、開発手順は `docs/DEV.md`）
- デプロイ workflow（`verify` / `test` 後に Pages 配信）
- ルート `index.html` から `/app/` へリダイレクト

### 修正

- 公開前レビュー High/Medium（R01–R10）

---

## [0.1] — 2026-07（タグ `v0.1`）

### 追加

- 画面下部の合計 SP 固定バーと差分ハイライト

---

## 0.1.0 以前（開発・未公開）

トレセン軒シナリオ、リンク白/金、RMJ 自動計上、優先11サポカイベント、金+白コスト合算などのコア機能を実装。詳細は `docs/ROADMAP.md` の Phase A–C を参照。
