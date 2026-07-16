# AGENT_HANDOFF — 新チャット最初に読むこと

このファイルは、会話履歴なしで開発を続けるための最短ブリーフです。詳細は他の `docs/` を参照。

**用語**: [GLOSSARY.md](./GLOSSARY.md) — 「育成ウマ娘所持スキル」とゲーム内「覚醒進化（金→金）」を混同しないこと。

## いまの状態（ディスク確認済み）

| 項目 | 状態 |
|------|------|
| アプリ骨格 (`app/`) | **あり** — SP計算・UI・集計ロジック実装済み |
| `scripts/extract_mdb.py` / `.mjs` | **あり**（再 extract は Node `.mjs` 推奨） |
| `data/skills.json` 等 | **あり** — skills 2103 / supports 543 / characters 261（`meta.json` 参照） |
| extract 元 mdb | `D:\DMM\umamusumeDMM\Umamusume\umamusume_Data\Persistent\master\master.mdb` |
| 既定 AppData の mdb | **無し** — `%USERPROFILE%\AppData\LocalLow\Cygames\...` には無い |
| `data/events.json` | **あり** — 優先37・102イベント（U-tools+mdb 抽出正本・Phase B 完了）。例外2件は `events.preserve.json` |
| `data/scenarios/toresenken.json` | **あり** — リンク白/金・RMJ自動計上・ラーメン3択（実機通し確認済み） |
| Python / `py` | `where` 上は WindowsApps の `python.exe` スタブ寄り。`py` 無し。再 extract 時に実体 Python 要確認 |
| Git | remote: `Tsuyuchan-jp/umamusume-sp-calc`（public）。Pages デプロイ運用中 |
| 公開 URL | **https://Tsuyuchan-jp.github.io/umamusume-sp-calc/app/** （v0.1.9・2026-07） |
| サポカ絞込 | **イベント対応のみ**（デフォルト ON・`prioritySupportIds`）＋ SSR／タイプ／検索 |
| 結果スキル絞込 | **バ場／距離／作戦**＋**適用ボタン**（draft/committed）。確定済み絞込を編成変更時に新規 skillId へ増分適用。実装: `skillActivation.js` / `app.js` |
| 結果スキル件数 | 見出し右 **「スキル数 N/M」**（ON＝`!excluded`、全件＝`rows.length`・継承固有含む）。実装: `updateSkillCountDisplay` / `recalc` |
| 含めるスキルコピー | 見出し右ボタン。ON 表示行の `name` をカンマ区切りでクリップボードへ（継承除外）。実装: `copyIncludedSkills.js` / `recalc`。実機確認済み |
| トレヒントLv | オプション select（3/4/5・既定5）。`aggregate.js` の `trainingHintLevel` |
| 説明書 UI | ヘッダー右 **「使い方」** → `<dialog>`（5セクション・実機確認済み） |

**アプリは実用段階・公開済み。** 常用デッキ＋シナリオ（リンク白/金・RMJ・終了）の通し確認は **実機 OK・バグなし**（2026-07）。

## 次にやること（優先順）

1. UX 改善（結果の由来表示・初期デッキ6枚化など。プリセットは当面スコープ外。※結果スキル絞込の適用ボタン＋デッキ変更連動は 2026-07 実装済み）
2. 実機で確認したケースの回帰テスト追加（`npm test` 拡充）
3. ゲーム更新時: [GAME_UPDATE_RUNBOOK.md](./GAME_UPDATE_RUNBOOK.md) に従い extract → events → verify → push
4. （運用）`master` push で Pages 自動デプロイ。失敗時は Settings → Pages Source=GitHub Actions を確認

## 非交渉ルール（変えない）

- **ローカル HTML/JS + JSON**。NotebookLM / Electron ではない。
- **シナリオは当面トレセン軒のみ**（〜4ヶ月想定）。参照: https://github.com/mee1080/umasim/blob/main/data/ramen_memo.md
- **ヒントLv**: サポカトレ=既定5（オプションで3–5）/ 育成ウマ娘所持スキル=3（他由来が高ければ max）/ イベント・シナリオ=JSON定義 / 同一スキルは max。
- **金+白コスト（実機検証済み）**:
  - `cost = floor(baseSp * (1 - hintDiscount - (切れ者?0.10:0)))`
  - 割引: Lv0=0, 1=10%, 2=20%, 3=30%, 4=35%, 5=40%
  - 金取得（白未取得）: `cost(白,白Lv) + cost(金,金Lv)`
  - mdb の baseSp は白・金別々（合算済みではない）
- **○+◎（ガチ想定）**: ヒントは○準拠（◎専用無し）。○のみ→◎行に合算。金行は下位チェーン全段。実装: `goldLower.js`
- **×（group_rate < 0）**: 購入チェーン外。extract / `relink_skills.mjs` でリンクしない
- **固有スキル・覚醒進化**: 現行 extract（`available_skill_set`）で実機と整合。専用除外ロジックは不要（[GLOSSARY.md](./GLOSSARY.md)）
- **育成ウマ娘覚醒レベル**: 最大想定で所持スキル全合算
- **継承固有**: 汎用行のみ（親名・スキル名なし）、個数 2–6、baseSp 200、ヒント一律 1–5。
- **イベントは優先37サポカのみ**（全539枚はスコープ外）。**正本は U-tools+mdb 抽出**（`events.preserve.json` でたづな2件を例外維持）。トレヒントは mdb 自動。
- **Git**: ワークスペース変更のたびにコミット。PowerShell では `git add .` と `git commit` を**別ステップ**（`&&` 禁止）。push は明示依頼時のみ。

## シナリオ・UI の要点（トレセン軒）

- **リンク（シニア9月前半）**: ラジオ1択・相互排他・未選択なし（デフォルト `link_dotou`）。編成連動で白/金切替（育成ウマ娘 ∪ サポカ6枠。たづな＆ハローは OR）。実装: `app/js/scenarioLink.js`
- **RMJ / 終了（ガチ想定）**: 盛況チェックは廃止。`scenarioAutoSkills` で自動計上（クラシック大盛況・シニア超盛況固定・育成終了）。シニア12月は `seniorRmjChoice` ラーメン3択（デフォルト: よくばり → いいとこ入った！）
- **初期値**: 育成ウマ娘 `[万福龍湯伝・頂]ナリタトップロード` / サポカ枠5 ヤング・枠6 たづな（枠1–4 未選択）/ 継承固有 個数4・ヒントLv3
- **サポカ絞込**: 「イベント対応のみ」デフォルト ON（`prioritySupportIds`）。選択中カードは keep。実装: `app.js` の `getSupportFilterState` / `supportMatchesFilters`
- **結果スキル絞込**: バ場／距離／作戦＋適用ボタン（draft/committed）。適用で全行再除外＋手動リセット。編成変更時は確定済み絞込を新規 skillId に増分適用。実装: `skillActivation.js`（`applyFullFilterExclusions` / `applyIncrementalFilterExclusions`）/ `app.js`
- **結果スキル件数**: 見出し右 `スキル数 N/M`（ON＝`!row.excluded`、全件＝`plan.rows.length`・継承固有含む）。`recalc` で更新
- **含めるスキルコピー**: 見出し右ボタン。ON 表示行の `name` をカンマ区切りでクリップボードへ（継承除外）。実装: `copyIncludedSkills.js` / `bindCopyIncludedSkills`
- **説明書モーダル**: ヘッダー `#help-open` → `#help-dialog`（`bindHelpDialog`）。本文は `index.html` 内直書き（`docs/` と自動同期しない）

## ファイルの場所

```
docs/AGENT_HANDOFF.md   ← 今ここ
docs/GAME_UPDATE_RUNBOOK.md  ゲーム更新時の運用チェックリスト（extract・events・デプロイ）
docs/PRIORITY_SUPPORTS.md   イベント対応サポカ37種（利用者向け表・開発者向け id）
docs/CHANGELOG.md        公開版の更新履歴
docs/GLOSSARY.md        用語（育成ウマ娘所持スキル / 覚醒進化 など）
docs/MODEL_SELECTION.md 推奨言語モデル（4択・Quota節約）
docs/REQUIREMENTS.md    確定要件
docs/spec.md            計算仕様（詳細）
docs/DATA.md            mdb / JSON / 優先サポカ
docs/ARCHITECTURE.md    構成とデータフロー
docs/DEV.md             セットアップ・トラブルシュート
docs/ROADMAP.md         完了 / 残り
docs/EVENT_EXTRACT_DESIGN.md  イベント抽出設計（Phase B 完了）
docs/UTOOLS_EVENT_PARSE.md    U-tools SSR パース仕様
app/                    ブラウザアプリ
data/                   JSON（extract 生成 + シナリオ手メンテ）
scripts/extract_mdb.mjs master.mdb → skills/supports/characters（推奨・`activation` 付与）
scripts/patch_skill_activation.mjs 既存 skills.json へ activation のみ付与
scripts/extract_support_events.mjs  U-tools+mdb → events.extracted.json
scripts/apply_extracted_events.mjs  events.json へ反映
scripts/extract_mdb.py  同上（代替）
```

## 優先サポカ（events.json 対象）

計 **37種**。イベント **102件**（抽出100 + preserve 2）。**一覧**: [PRIORITY_SUPPORTS.md](./PRIORITY_SUPPORTS.md) / [data/priority-supports.json](../data/priority-supports.json)

## エージェントへの指示（短縮）

1. このファイルと `REQUIREMENTS.md` / `spec.md` / `GLOSSARY.md` を読む。
2. `data/meta.json` と `skills.json` の有無を確認してから作業する。
3. **次タスクが具体化されているとき、実装着手前に推奨言語モデルを必ず提示する**（[MODEL_SELECTION.md](./MODEL_SELECTION.md) / `.cursor/rules/model-recommendation.mdc`）。
4. 変更したら必ずコミット（メッセージ例: `feat/fix/chore: …` / ドキュメントなら `docs: …`）。
5. 計算式・ヒントLv・継承スコープ・トレセン軒固定は勝手に変えない。変えるなら要件ドキュメントも更新する。
6. 再 extract は Python より **Node の `scripts/extract_mdb.mjs`** が実績あり（DMM パス候補内蔵）。
7. サポカイベント再生成は **`npm run extract:events` → `npm run apply:events`**（手順全体: [GAME_UPDATE_RUNBOOK.md](./GAME_UPDATE_RUNBOOK.md)）。
