# AGENT_HANDOFF — 新チャット最初に読むこと



このファイルは、会話履歴なしで開発を続けるための最短ブリーフです。詳細は他の `docs/` を参照。



**用語**: [GLOSSARY.md](./GLOSSARY.md) — 「育成ウマ娘所持スキル」とゲーム内「覚醒進化（金→金）」を混同しないこと。



## いまの状態（ディスク確認済み）



| 項目 | 状態 |

|------|------|

| アプリ骨格 (`app/`) | **あり** — SP計算・UI・集計ロジック実装済み |

| `scripts/extract_mdb.py` | **あり** |

| `data/skills.json` 等 | **あり** — skills 2078 / supports 539 / characters 258（`meta.json` 参照） |

| extract 元 mdb | `D:\DMM\umamusumeDMM\Umamusume\umamusume_Data\Persistent\master\master.mdb` |

| 既定 AppData の mdb | **無し** — `%USERPROFILE%\AppData\LocalLow\Cygames\...` には無い |

| `data/events.json` | **あり** — 優先11サポカすべて記入済み（33イベント・実機確認済み） |

| `data/scenarios/toresenken.json` | **あり** — リンクは白/金分離（編成で切替）。RMJ 盛況はプレースホルダ |

| Python / `py` | `where` 上は WindowsApps の `python.exe` スタブ寄り。`py` 無し。再 extract 時に実体 Python 要確認 |

| Git | リポジトリ初期化済み |



**アプリは実用段階。** 次はシナリオ RMJ 具体化・リンク通し確認。



## 次にやること（優先順）



1. **`toresenken.json` の RMJ 盛況スキル**を具体スキル名に置換（現状 `選択金スキル` プレースホルダ）

2. 常用デッキ + シナリオリンク（白/金切替）の通し確認

3. ゲーム更新時は DMM パスの mdb を `--mdb` 指定して再 extract



## 非交渉ルール（変えない）



- **ローカル HTML/JS + JSON**。NotebookLM / Electron ではない。

- **シナリオは当面トレセン軒のみ**（〜4ヶ月想定）。参照: https://github.com/mee1080/umasim/blob/main/data/ramen_memo.md

- **ヒントLv**: サポカトレ=5 / 育成ウマ娘所持スキル=3（他由来が高ければ max）/ イベント・シナリオ=JSON定義 / 同一スキルは max。

- **金+白コスト（実機検証済み）**:

  - `cost = floor(baseSp * (1 - hintDiscount - (切れ者?0.10:0)))`

  - 割引: Lv0=0, 1=10%, 2=20%, 3=30%, 4=35%, 5=40%

  - 金取得（白未取得）: `cost(白,白Lv) + cost(金,金Lv)`

  - mdb の baseSp は白・金別々（合算済みではない）

- **固有スキル・覚醒進化**: 現行 extract（`available_skill_set`）で実機と整合。専用除外ロジックは不要（[GLOSSARY.md](./GLOSSARY.md)）

- **育成ウマ娘覚醒レベル**: 最大想定で所持スキル全合算

- **継承固有**: 汎用行のみ（親名・スキル名なし）、個数 2–6、baseSp 200、ヒント一律 1–5。

- **イベントは優先サポカから手メンテ**（全カード一括ではない）。サポカヒント自体は mdb 自動抽出。

- **Git**: ワークスペース変更のたびにコミット。PowerShell では `git add .` と `git commit` を**別ステップ**（`&&` 禁止）。push は明示依頼時のみ。



## ファイルの場所



```

docs/AGENT_HANDOFF.md   ← 今ここ

docs/GLOSSARY.md        用語（育成ウマ娘所持スキル / 覚醒進化 など）

docs/MODEL_SELECTION.md 推奨言語モデル（4択・Quota節約）

docs/REQUIREMENTS.md    確定要件

docs/spec.md            計算仕様（詳細）

docs/DATA.md            mdb / JSON / 優先サポカ

docs/ARCHITECTURE.md    構成とデータフロー

docs/DEV.md             セットアップ・トラブルシュート

docs/ROADMAP.md         完了 / 残り

app/                    ブラウザアプリ

data/                   JSON（手メンテ + extract 生成）

scripts/extract_mdb.py  master.mdb → JSON

```



## 優先サポカ（events.json 対象・すべて記入済み）



1. [一杯のノスタルジア] 駿川たづな

2. [その執念は怒濤が如く] メイショウドトウ

3. [永久の誓い、永久の輝き] サトノダイヤモンド

4. [刀光散らしてClash！] タップダンスシチー

5. [全てに挑む勇ましき者] アグネスデジタル

6. [白に至る覚悟] デアリングハート

7. [Innovator] フォーエバーヤング

8. [ゆかし、きらめきの旅路] ファインモーション

9. [心覚えし、京の華] エアグルーヴ

10. [天才的ユートピア] トウカイテイオー

11. [Zirkus der Träume] エイシンフラッシュ



## エージェントへの指示（短縮）



1. このファイルと `REQUIREMENTS.md` / `spec.md` / `GLOSSARY.md` を読む。

2. `data/meta.json` と `skills.json` の有無を確認してから作業する。

3. **次タスクが具体化されているとき、実装着手前に推奨言語モデルを必ず提示する**（[MODEL_SELECTION.md](./MODEL_SELECTION.md) / `.cursor/rules/model-recommendation.mdc`）。

4. 変更したら必ずコミット（メッセージ例: `feat/fix/chore: …` / ドキュメントなら `docs: …`）。

5. 計算式・ヒントLv・継承スコープ・トレセン軒固定は勝手に変えない。変えるなら要件ドキュメントも更新する。

6. 再 extract は Python より **Node の `scripts/extract_mdb.mjs`** が実績あり（DMM パス候補内蔵）。

