# AGENT_HANDOFF — 新チャット最初に読むこと

会話履歴なしで続けるための**最短ブリーフ**。詳細は他 docs へ委譲する（ここに再掲しない）。

人間用入口: [README.md](./README.md)  
用語: [spec/GLOSSARY.md](./spec/GLOSSARY.md) — 「育成ウマ娘所持スキル」と「覚醒進化（金→金）」を混同しない。

## いまの状態

| 項目 | 状態 |
|------|------|
| アプリ | **v1.0.5** 公開。SP計算・デュアルUI・スクショ（WebP保存）・スマホ対応・集計実装済み |
| データ | skills / supports / characters / events / toresenken **あり**（件数は `data/meta.json`） |
| events | 優先40・111イベント（U-tools+mdb + preserve。30307/30308 は GameWith 一時） |
| カード画像 | サポカ縦40 + 育成 `chr_icon` 全262 同梱済み（[ops/ASSETS.md](./ops/ASSETS.md)） |
| extract 元 mdb | `D:\DMM\...\Persistent\master\master.mdb`（AppData 既定は無しが多い） |
| 公開 URL | https://Tsuyuchan-jp.github.io/umamusume-sp-calc/app/ |
| push / Pages | **通常どおり push 可**（v1.0.0 で初反映。以降は変更のたびコミット＋明示時 push） |
| 初期編成 | 育成112901（アーモンドアイ）/ 枠1エアグルーヴ・枠2テイオー・枠3タップ・枠4ドトウ・枠5ヤング・枠6たづな |
| 編成スクショ | **本実装完了・実機OK**（v28.1・snapdom）。[product/screenshot-requirements.md](./product/screenshot-requirements.md) |
| v1 レビュー | M1〜M4・スマホ対応 **クローズ**。次は TODO Open（回帰拡充・ゲーム更新・30307/30308 等） |

通し確認・版履歴の詳細は [CHANGELOG.md](./CHANGELOG.md)。

## 次にやること

**正本は [TODO.md](./TODO.md)。** 着手・完了のたびに更新する。ここには要約を長く書かない。

**デザイン大改修の会話引継ぎ（完了・履歴）**: [archive/design-overhaul-handoff.md](./archive/design-overhaul-handoff.md)（デュアル・イベントA/B/Cは [product/UX.md](./product/UX.md)）
**全域レビュー**: [product/repo-review-findings.md](./product/repo-review-findings.md)

## 非交渉ルール（変えない）

詳細・数式は [spec/REQUIREMENTS.md](./spec/REQUIREMENTS.md) / [spec/calc.md](./spec/calc.md) が正本。ここでは要約のみ。

- **ローカル HTML/JS + JSON**（NotebookLM / Electron ではない）
- **シナリオはトレセン軒のみ**
- **ヒントLv / 金+白 / ○+◎ / ×除外 / 継承固有 / イベント優先40** — REQUIREMENTS の確定ルールに従う
- **イベント正本**: U-tools+mdb（`events.preserve.json` で例外維持）。全サポカ網羅はスコープ外
- **Git**: 変更のたびコミット。PowerShell では `git add .` と `git commit` を別ステップ。push は明示依頼時のみ

## 詳細はどこ

| 知りたいこと | 正本 |
|--------------|------|
| 次タスク・やらないこと | [TODO.md](./TODO.md) |
| 要件 / 計算 / 用語 | [spec/](./spec/) |
| 起動 / 更新 / 画像 / データ | [ops/](./ops/) |
| UX / 優先40 | [product/](./product/) |
| 全域レビュー | [product/repo-review-findings.md](./product/repo-review-findings.md) |
| デザイン大改修引継ぎ（履歴） | [archive/design-overhaul-handoff.md](./archive/design-overhaul-handoff.md) |
| 設計履歴（通常不要） | [archive/](./archive/) |

## 推奨言語モデル

次タスクが具体化されているとき、実装着手前に **1つ**推奨する（第一目的: Quota 節約）。Cursor ルール: `.cursor/rules/model-recommendation.mdc`。

| モデル | 向く作業 |
|--------|----------|
| **Composer 2.5** | 設計済みの実装、UI、JSON追記、docs、小さな修正 |
| **Grok 4.6 Low** | 軽い調査、文言整理、単純確認 |
| **Grok 4.6 Medium** | 仕様が曖昧な改修、集計ロジック切り分け、複数ファイルの設計調整 |
| **Grok 4.6 High** | 実機との大きなズレ調査、extract 変更、要件の再設計 |

提示テンプレートと例外は `.cursor/rules/model-recommendation.mdc` を正とする。

## エージェントへの指示

1. 本ファイル → [TODO.md](./TODO.md) → 必要なら [spec/](./spec/)
2. `data/meta.json` と `skills.json` の有無を確認してから作業
3. 次タスク具体化時は実装前に推奨モデルを提示
4. 変更したらコミット。TODO も更新。計算式・スコープは勝手に変えない
5. 再 extract / イベント再生成は [ops/GAME_UPDATE_RUNBOOK.md](./ops/GAME_UPDATE_RUNBOOK.md)
