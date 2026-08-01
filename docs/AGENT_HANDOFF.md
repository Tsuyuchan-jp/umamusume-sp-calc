# AGENT_HANDOFF — 新チャット最初に読むこと

会話履歴なしで続けるための**最短ブリーフ**。詳細は他 docs へ委譲する（ここに再掲しない）。

人間用入口: [README.md](./README.md)（状況別の開き方・正本表）  
用語: [GLOSSARY.md](./GLOSSARY.md) — 「育成ウマ娘所持スキル」と「覚醒進化（金→金）」を混同しない。

## いまの状態

| 項目 | 状態 |
|------|------|
| アプリ | 実用段階・公開済み（v0.1.14）。SP計算・UI・集計実装済み |
| データ | skills / supports / characters / events / toresenken **あり**（件数は `data/meta.json`） |
| events | 優先40・111イベント（U-tools+mdb + preserve。30307/30308 は GameWith 一時） |
| カード画像 | サポカ縦40 + 育成 `chr_icon` 全264 同梱済み（[ASSETS.md](./ASSETS.md)） |
| extract 元 mdb | `D:\DMM\...\Persistent\master\master.mdb`（AppData 既定は無しが多い） |
| 公開 URL | https://Tsuyuchan-jp.github.io/umamusume-sp-calc/app/ |
| push / Pages | **v1.0.0 まで push しない**（ローカルコミットのみ） |
| 初期編成 | 育成107703 / 枠5ヤング / 枠6たづな、枠1–4空（常用6枚化は [TODO.md](./TODO.md) P0） |

通し確認・版履歴の詳細は [CHANGELOG.md](./CHANGELOG.md)。

## 次にやること

**正本は [TODO.md](./TODO.md)。** 着手・完了のたびに更新する。ここには要約を長く書かない。

## 非交渉ルール（変えない）

詳細・数式は [REQUIREMENTS.md](./REQUIREMENTS.md) / [spec.md](./spec.md) が正本。ここでは要約のみ。

- **ローカル HTML/JS + JSON**（NotebookLM / Electron ではない）
- **シナリオはトレセン軒のみ**
- **ヒントLv / 金+白 / ○+◎ / ×除外 / 継承固有 / イベント優先40** — REQUIREMENTS の確定ルールに従う
- **イベント正本**: U-tools+mdb（`events.preserve.json` で例外維持）。全サポカ網羅はスコープ外
- **Git**: 変更のたびコミット。PowerShell では `git add .` と `git commit` を別ステップ。push は明示依頼時のみ

## 詳細はどこ（正本へのポインタ）

| 知りたいこと | 正本 |
|--------------|------|
| 次タスク | [TODO.md](./TODO.md) |
| 確定要件 | [REQUIREMENTS.md](./REQUIREMENTS.md) |
| 計算・データ解釈 | [spec.md](./spec.md) |
| 用語 | [GLOSSARY.md](./GLOSSARY.md) |
| 起動・トラブル | [DEV.md](./DEV.md) |
| ゲーム更新手順 | [GAME_UPDATE_RUNBOOK.md](./GAME_UPDATE_RUNBOOK.md) |
| 画像 | [ASSETS.md](./ASSETS.md) |
| UX | [UX_PHILOSOPHY.md](./UX_PHILOSOPHY.md) |
| 構成・フロー | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| JSON 意味 | [DATA.md](./DATA.md) |
| スコープ外 | [ROADMAP.md](./ROADMAP.md) |
| 優先40一覧 | [PRIORITY_SUPPORTS.md](./PRIORITY_SUPPORTS.md) |
| モデル選択 | [MODEL_SELECTION.md](./MODEL_SELECTION.md) |
| 設計履歴（通常不要） | [archive/](./archive/) |

## エージェントへの指示

1. 本ファイル → [TODO.md](./TODO.md) → 必要なら REQUIREMENTS / spec / GLOSSARY
2. `data/meta.json` と `skills.json` の有無を確認してから作業
3. 次タスク具体化時は実装前に推奨モデルを提示（[MODEL_SELECTION.md](./MODEL_SELECTION.md)）
4. 変更したらコミット。TODO も更新。計算式・スコープは勝手に変えない
5. 再 extract / イベント再生成の手順全体は [GAME_UPDATE_RUNBOOK.md](./GAME_UPDATE_RUNBOOK.md)
