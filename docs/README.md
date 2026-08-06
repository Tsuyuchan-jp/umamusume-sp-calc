# docs 案内（人間用入口）

ドキュメントは **ここから開く**。直下は入口だけ。詳細はフォルダ内の短いファイルへ。

AI 新チャットは [AGENT_HANDOFF.md](./AGENT_HANDOFF.md) から。

## 直下の構成

| 種類 | 名前 | 役割 |
|------|------|------|
| 入口 | [README.md](./README.md)（本ファイル） | 状況別の開き方・正本表 |
| 入口 | [TODO.md](./TODO.md) | 次タスク・やらないこと |
| 入口 | [AGENT_HANDOFF.md](./AGENT_HANDOFF.md) | AI ブリーフ・モデル推奨 |
| 入口 | [CHANGELOG.md](./CHANGELOG.md) | 公開履歴 |
| フォルダ | [spec/](./spec/) | 要件・計算仕様・用語 |
| フォルダ | [ops/](./ops/) | 起動・ゲーム更新・画像・データ・構成 |
| フォルダ | [product/](./product/) | UX・優先40一覧 |
| フォルダ | [archive/](./archive/) | 完了設計（通常読まない） |

## 状況別: 何を開くか

| いまやりたいこと | 開くファイル |
|------------------|--------------|
| 次の作業・優先度・やらないこと | [TODO.md](./TODO.md) |
| セッション状態・非交渉・モデル | [AGENT_HANDOFF.md](./AGENT_HANDOFF.md) |
| 確定要件 | [spec/REQUIREMENTS.md](./spec/REQUIREMENTS.md) |
| 計算・データ解釈 | [spec/calc.md](./spec/calc.md) |
| 用語 | [spec/GLOSSARY.md](./spec/GLOSSARY.md) |
| ローカル起動・トラブル | [ops/DEV.md](./ops/DEV.md) |
| ゲーム本パッチ後の追随 | [ops/GAME_UPDATE_RUNBOOK.md](./ops/GAME_UPDATE_RUNBOOK.md) |
| カード画像 | [ops/ASSETS.md](./ops/ASSETS.md) |
| JSON・スキーマ | [ops/DATA.md](./ops/DATA.md) |
| 構成・データフロー | [ops/ARCHITECTURE.md](./ops/ARCHITECTURE.md) |
| U-tools パース（壊れ時） | [ops/UTOOLS_EVENT_PARSE.md](./ops/UTOOLS_EVENT_PARSE.md) |
| UX 判断 | [product/UX.md](./product/UX.md) |
| 全域レビュー棚卸し | [product/repo-review-findings.md](./product/repo-review-findings.md) |
| v1.0.0 レビュー棚卸し | [product/v1-review-findings.md](./product/v1-review-findings.md) |
| 見た目モック | [product/mockups/hybrid-index.html](./product/mockups/hybrid-index.html)（ハイブリッド入口） |
| 優先40サポカ一覧 | [product/PRIORITY_SUPPORTS.md](./product/PRIORITY_SUPPORTS.md) |
| 公開版の履歴 | [CHANGELOG.md](./CHANGELOG.md) |

## 正本（事実は1箇所だけ）

| 知りたいこと | 正本 |
|--------------|------|
| 次にやること | [TODO.md](./TODO.md) |
| セッション状態・非交渉・モデル | [AGENT_HANDOFF.md](./AGENT_HANDOFF.md) |
| 確定要件 | [spec/REQUIREMENTS.md](./spec/REQUIREMENTS.md) |
| 計算・データ解釈 | [spec/calc.md](./spec/calc.md) |
| 用語 | [spec/GLOSSARY.md](./spec/GLOSSARY.md) |
| ローカル起動・トラブル | [ops/DEV.md](./ops/DEV.md) |
| ゲーム更新の手順 | [ops/GAME_UPDATE_RUNBOOK.md](./ops/GAME_UPDATE_RUNBOOK.md) |
| 画像方針・抽出 | [ops/ASSETS.md](./ops/ASSETS.md) |
| JSON スキーマ | [ops/DATA.md](./ops/DATA.md) |
| 構成・フロー | [ops/ARCHITECTURE.md](./ops/ARCHITECTURE.md) |
| UX 思想 | [product/UX.md](./product/UX.md) |
| 優先40一覧 | [product/PRIORITY_SUPPORTS.md](./product/PRIORITY_SUPPORTS.md) |
| 公開履歴 | [CHANGELOG.md](./CHANGELOG.md) |

## 再肥大化防止

- **docs 直下にファイルを増やさない**（入口4本を維持）。新規は `spec/` / `ops/` / `product/` へ
- 完了した設計・タスク起票は `archive/` へ移す
- HANDOFF / 本 INDEX に詳細を増やさない（リンクのみ）
- 1ファイルに無理に統合しない（探す負荷より、短いファイル＋フォルダを優先）
- TODO の Open は短く保つ（目安 15 件以内）
