# docs 案内（人間用入口）

ドキュメントは **ここから開く**。詳細を複数ファイルに同時に散らかさない。

AI 新チャットは [AGENT_HANDOFF.md](./AGENT_HANDOFF.md) から。

## 状況別: 何を開くか

| いまやりたいこと | 開くファイル |
|------------------|--------------|
| 次の作業・優先度 | [TODO.md](./TODO.md) |
| セッション状態・非交渉の要約 | [AGENT_HANDOFF.md](./AGENT_HANDOFF.md) |
| 要件・計算仕様・用語 | [REQUIREMENTS.md](./REQUIREMENTS.md) / [spec.md](./spec.md) / [GLOSSARY.md](./GLOSSARY.md) |
| ローカル起動・トラブル | [DEV.md](./DEV.md) |
| ゲーム本パッチ後の追随 | [GAME_UPDATE_RUNBOOK.md](./GAME_UPDATE_RUNBOOK.md) |
| カード画像の方針・抽出 | [ASSETS.md](./ASSETS.md) |
| UX 判断 | [UX_PHILOSOPHY.md](./UX_PHILOSOPHY.md) |
| 公開版の履歴 | [CHANGELOG.md](./CHANGELOG.md) |
| スコープ外・長期残り | [ROADMAP.md](./ROADMAP.md) |
| 優先40サポカ一覧 | [PRIORITY_SUPPORTS.md](./PRIORITY_SUPPORTS.md) |
| 推奨モデル | [MODEL_SELECTION.md](./MODEL_SELECTION.md) |

## 正本（事実は1箇所だけ）

| 知りたいこと | 正本 |
|--------------|------|
| 次にやること | [TODO.md](./TODO.md) |
| セッション状態・非交渉の要約 | [AGENT_HANDOFF.md](./AGENT_HANDOFF.md) |
| 確定要件 | [REQUIREMENTS.md](./REQUIREMENTS.md) |
| 計算・データ解釈 | [spec.md](./spec.md) |
| 用語 | [GLOSSARY.md](./GLOSSARY.md) |
| ローカル起動・トラブル | [DEV.md](./DEV.md) |
| ゲーム更新の手順 | [GAME_UPDATE_RUNBOOK.md](./GAME_UPDATE_RUNBOOK.md) |
| 画像方針・抽出 | [ASSETS.md](./ASSETS.md) |
| UX 思想 | [UX_PHILOSOPHY.md](./UX_PHILOSOPHY.md) |
| 公開履歴 | [CHANGELOG.md](./CHANGELOG.md) |
| スコープ外・長期残り | [ROADMAP.md](./ROADMAP.md) |
| 優先40一覧 | [PRIORITY_SUPPORTS.md](./PRIORITY_SUPPORTS.md)（生成物） |
| モデル選択 | [MODEL_SELECTION.md](./MODEL_SELECTION.md) + `.cursor/rules` |
| フォルダ構成・データフロー | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| JSON スキーマ・フィールド意味 | [DATA.md](./DATA.md) |
| U-tools パース（壊れ時） | [UTOOLS_EVENT_PARSE.md](./UTOOLS_EVENT_PARSE.md) |

## 常用の上限（認知負荷）

日常〜週次で見るのは実質これだけ:

1. 本ファイル（入口）
2. [TODO.md](./TODO.md)
3. [AGENT_HANDOFF.md](./AGENT_HANDOFF.md)（必要なら）
4. 仕様層: REQUIREMENTS / spec / GLOSSARY（変更時）
5. 運用層: DEV / GAME_UPDATE_RUNBOOK / ASSETS（メンテ時）
6. [UX_PHILOSOPHY.md](./UX_PHILOSOPHY.md)（UX 判断時）
7. [CHANGELOG.md](./CHANGELOG.md)（リリース時）

それ以外は「開かない前提」。

## archive（通常読まない）

[archive/](./archive/) は完了した設計レビュー・タスク起票・スナップショット。**運用の正本ではない。** 経緯が必要なときだけ開く。

## 再肥大化防止

- 新しい docs を増やす前に、既存正本へ追記できないか確認する
- 完了した設計レビュー・タスク起票は `archive/` へ移し、常用導線から外す
- HANDOFF / 本 INDEX に**詳細を増やさない**（リンクのみ）
- TODO の Open は短く保つ（目安 15 件以内）
