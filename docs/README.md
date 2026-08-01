# docs 案内（人間用入口）

ドキュメントは **ここから開く**。トップ直下は **8ファイル + `archive/`** に抑える。

AI 新チャットは [AGENT_HANDOFF.md](./AGENT_HANDOFF.md) から。

## 状況別: 何を開くか

| いまやりたいこと | 開くファイル |
|------------------|--------------|
| 次の作業・優先度・やらないこと | [TODO.md](./TODO.md) |
| セッション状態・非交渉・モデル | [AGENT_HANDOFF.md](./AGENT_HANDOFF.md) |
| 要件・計算仕様・用語 | [SPEC.md](./SPEC.md) |
| 起動 / ゲーム更新 / 画像 / データ | [OPS.md](./OPS.md)（目次から該当節） |
| UX 判断 | [UX.md](./UX.md) |
| 公開版の履歴 | [CHANGELOG.md](./CHANGELOG.md) |
| 優先40サポカ一覧 | [PRIORITY_SUPPORTS.md](./PRIORITY_SUPPORTS.md) |

## 正本（事実は1箇所だけ）

| 知りたいこと | 正本 |
|--------------|------|
| 次にやること | [TODO.md](./TODO.md) |
| セッション状態・非交渉・モデル | [AGENT_HANDOFF.md](./AGENT_HANDOFF.md) |
| 要件・計算・用語 | [SPEC.md](./SPEC.md) |
| 起動・ゲーム更新・画像・スキーマ・構成 | [OPS.md](./OPS.md) |
| UX 思想 | [UX.md](./UX.md) |
| 公開履歴 | [CHANGELOG.md](./CHANGELOG.md) |
| 優先40一覧 | [PRIORITY_SUPPORTS.md](./PRIORITY_SUPPORTS.md)（生成物） |

## トップ直下の上限

常時置くのは上記 **8ファイル** のみ。増やしたくなったら既存正本へ追記するか、完了物は `archive/` へ。

## archive（通常読まない）

[archive/](./archive/) は完了した設計レビュー・タスク起票・スナップショット。**運用の正本ではない。**

## 再肥大化防止

- 新しいトップファイルを増やす前に、既存8本へ追記できないか確認する
- 完了した設計・タスク起票は `archive/` へ移す
- HANDOFF / 本 INDEX に詳細を増やさない（リンクのみ）
- TODO の Open は短く保つ（目安 15 件以内）
