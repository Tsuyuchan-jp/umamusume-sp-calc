# umamusume-sp-calc — 開発環境・仕様・Docs 統合参照（AI レビュー用）

> **読者**: AI 言語モデル（開発環境のレビュー・ブラッシュアップ提案用）  
> **作成目的**: 分散した `docs/`・ルール・運用慣行を **1 ファイルに圧縮**し、仕様駆動開発（SDD）の健全性を評価できるようにする。  
> **正本との関係**: 本ファイルは **スナップショット要約**。実装・計算の最終正本はコードと個別 docs。矛盾時は下表の優先順位に従う。  
> **スナップショット日**: 2026-07-27 / アプリ **v0.1.12**

---

## 0. 本ファイルの使い方（レビューア向け）

評価・提案時は次を区別すること。

| 区分 | 扱い |
|------|------|
| **非交渉ルール**（§3） | 勝手に変えない。変更提案時は要件ドキュメント更新をセットにする |
| **確定仕様**（§4–§6） | 実機検証済みの計算・データ解釈。乖離があればバグまたは docs 遅延 |
| **運用・Docs 慣習**（§8–§10） | 改善提案の主戦場。冗長・重複・ドリフトを指摘してよい |
| **ロードマップ残り**（§11） | スコープ外と未完了を混同しない |

**レビュー出力で欲しいもの（推奨フォーマット）**

1. 現状の強み（短く）
2. Docs / SDD / エージェント運用のギャップ（優先度付き）
3. 具体的な改善案（ファイル単位・手順単位）
4. 触ってはいけない領域への誤提案が無いか自己チェック

---

## 1. プロダクト要約

| 項目 | 内容 |
|------|------|
| 名前 / パス | `umamusume-sp-calc` / `C:\Users\PC1\Projects\umamusume-sp-calc` |
| 形態 | **ローカル HTML/JS + JSON**（ビルド・FW なし・ES modules） |
| 非対象 | NotebookLM、Electron、サーバー必須バックエンド |
| 目的 | デッキ＋育成ウマ娘＋**トレセン軒**想定で、「取得可能スキルをすべて取る」**理論必要 SP** を算出 |
| 公開 | https://Tsuyuchan-jp.github.io/umamusume-sp-calc/app/ |
| リポジトリ | https://github.com/Tsuyuchan-jp/umamusume-sp-calc （public） |
| 状態 | 実用段階・公開済み。常用デッキ＋シナリオ通しは実機 OK（2026-07） |

利用者向け入口は `README.md`。技術・メンテは `docs/`。

---

## 2. 仕様駆動開発（SDD）の実態

このリポジトリは形式的な「仕様書 → コード生成」パイプラインではないが、**ドキュメント先行・変更時同期**の運用で SDD に近い。

### 2.1 正本の階層（矛盾時の優先）

```text
1. 実機（ウマ娘クライアント）での検証結果
2. 実装コード（app/js/）— 計算・UI の実行定義
3. docs/REQUIREMENTS.md + docs/spec.md — 確定要件・計算仕様
4. docs/DATA.md + data/*.json スキーマ慣行 — データ契約
5. docs/AGENT_HANDOFF.md — エージェント向け最短ブリーフ（状態付き）
6. docs/ROADMAP.md / CHANGELOG.md — 進捗・公開履歴
7. 本ファイル（docs/reference/…）— レビュー用圧縮。個別 docs より新しいとは限らない
```

### 2.2 「仕様を変える」ときの必須セット

計算式・ヒント Lv・継承スコープ・トレセン軒固定などを変える場合:

1. `REQUIREMENTS.md` / `spec.md` を先または同時に更新
2. 必要なら `GLOSSARY.md`（用語衝突防止）
3. 実装（`app/js/`）と回帰テスト（`npm test`）
4. ユーザー向け説明書は **`app/index.html` 内 `<dialog>` 直書き**（`docs/` と自動同期しない）
5. `CHANGELOG.md`・必要なら `AGENT_HANDOFF.md` / `ROADMAP.md`
6. **毎回コミット**（§9）

### 2.3 データ契約の二系統

| 系統 | 正本 | 更新手段 |
|------|------|----------|
| スキル / サポカ / 育成ウマ娘 | `master.mdb` → extract | `npm run extract`（Node `.mjs` 推奨） |
| サポカイベント（優先38） | U-tools SSR + mdb → `events.json` | `extract:events` → `apply:events` |
| シナリオ（トレセン軒） | `data/scenarios/toresenken.json` | **手メンテのみ** |
| 例外イベント | `events.preserve.json` | 手メンテ（たづな2件など） |

**混ぜない**: サポカ **トレヒントは mdb**、**イベントスキルヒントは U-tools+mdb**。

### 2.4 エージェント向けゲート

- 新チャット: まず `AGENT_HANDOFF.md` → `REQUIREMENTS.md` / `spec.md` / `GLOSSARY.md`
- `data/meta.json` と `skills.json` の有無を確認してから作業
- 次タスク具体化時: **推奨言語モデルを実装前に提示**（§10）
- ゲーム更新: `GAME_UPDATE_RUNBOOK.md` が作業順の正本

---

## 3. 非交渉ルール（変えない）

エージェント・レビューアは次を勝手に緩めないこと。

1. **ローカル HTML/JS + JSON**。NotebookLM / Electron 化しない。
2. **シナリオは当面トレセン軒のみ**（〜4ヶ月想定）。参考: https://github.com/mee1080/umasim/blob/main/data/ramen_memo.md
3. **ヒント Lv**:
   - サポカトレ = 既定 5（オプション 3–5）
   - 育成ウマ娘所持スキル = 3（他由来が高ければ max）
   - イベント・シナリオ = JSON 定義
   - 同一スキルは `max(levels)`
4. **金+白コスト（実機検証済み）**:
   - `cost = floor(baseSp * (1 - hintDiscount - (切れ者?0.10:0)))`
   - 割引: Lv0=0, 1=10%, 2=20%, 3=30%, 4=35%, 5=40%
   - 金取得（白未取得）: `cost(白,白Lv) + cost(金,金Lv)`
   - mdb の baseSp は白・金別々（合算済みではない）
5. **○+◎（ガチ想定）**: ヒントは○準拠（◎専用無し）。○のみ→◎行に合算。金行は下位チェーン全段。実装: `goldLower.js`
6. **×（`group_rate < 0`）**: 購入チェーン外。extract / `relink_skills.mjs` でリンクしない
7. **固有スキル・覚醒進化**: 現行 extract（`available_skill_set`）で実機整合。専用除外ロジック不要（用語は `GLOSSARY.md`）
8. **育成ウマ娘覚醒レベル**: 最大想定で所持スキル全合算
9. **継承固有**: 汎用行のみ（親名・スキル名なし）、個数 2–6、baseSp 200、ヒント一律 1–5
10. **イベントは優先38サポカのみ**（全539はスコープ外）。正本は U-tools+mdb。例外は `events.preserve.json`。新規追加は最新の**課金必須 SSR**原則
11. **Git**: ワークスペース変更のたびコミット。PowerShell では `git add .` と `git commit` を**別ステップ**（`&&` 禁止）。push は明示依頼時のみ

---

## 4. 計算仕様（要約）

詳細正本: `docs/spec.md`。実装正本: `app/js/`。

### 4.1 ヒント Lv 解決

由来ごとの Lv を集め **最大値**（`hintResolve.js`）。

| 由来 | Lv | 実装メモ |
|------|-----|----------|
| サポカトレヒント | 3–5（既定5） | `trainingHintLevel` → `aggregate.js` |
| 育成ウマ娘所持スキル | 3 | `CHARA_HINT`。覚醒は最大想定で全ランク合算 |
| イベント | JSON `hintLevel` | 該当サポカ編成時のみ |
| シナリオリンク | JSON | 選択1件・編成で白/金（`scenarioLink.js`） |
| シナリオ自動 | JSON | `scenarioAutoSkills` 常時計上 |
| シニア12月 RMJ | JSON | ラーメン3択（`seniorRmjChoice`） |

`skillId` 欠落時は `skills.json` の **名前完全一致**で解決を試みる。

### 4.2 SP コスト

```text
cost = floor(baseSp * (1 - hintDiscount - (切れ者 ? 0.10 : 0)))
```

割引合計が 1 を超えないよう `Math.max(0, 1 - discount)`（`spCost.js`）。

**金+白**: 計画内に白と金があるとき白行を隠し、金行に合算（`filterDisplaySkills` / `calcAcquisitionCost`）。

検証例（強者の証 / さらなる高みへ）: 白Lv2=170、金直取り=306、白後金=136 → `170+136=306`。回帰: `node scripts/test_sp.mjs`。

### 4.3 ○+◎+金チェーン

| ルール | 内容 |
|--------|------|
| ヒント | ○に付く。◎ ID のヒントも白帯共有（`getEffectiveHintLevel`） |
| ○のみ | ◎行に繰り上げ、cost(○)+cost(◎)。金へは自動繰り上げしない |
| 金が計画に入る | 金行のみ表示、下位全段合算 |
| 除外 | 表示行単位（◎/金を外すと下位もまとめて除外） |
| × | チェーン外・単独行 |

### 4.4 除外・非対象

| 対象 | 扱い |
|------|------|
| 固有スキル本体 | 購入リスト外（extract 経路に出ない） |
| 覚醒進化（金→金） | 進化前金 ID のみ計上 |
| UI「含める」OFF | 合計から除外 |
| バ場／距離／作戦絞込 | 非互換を除外（「適用」で確定。確定時に手動除外リセット。編成変更時は新規 skillId へ増分適用） |
| 継承固有 OFF | 加算しない |

### 4.5 継承固有

`calcSkillCost(baseSp, hintLv, 切れ者) * 個数`。スキル数は個数分（`skillWeight`）。コピー・絞込・activation 対象外。

---

## 5. UI / プロダクト挙動（要約）

| 機能 | 要点 | 実装 |
|------|------|------|
| サポカ絞込 | 「イベント対応のみ」デフォルト ON（`prioritySupportIds`）。選択中は keep | `app.js` |
| 結果スキル絞込 | バ場／距離／作戦＋適用（draft/committed） | `skillActivation.js` |
| スキル数 | 見出し右 `N/M`（ON/全件。継承は個数分） | `rowSkillWeight` / `recalc` |
| 含めるスキルコピー | ON 行名をカンマ区切り（継承除外） | `copyIncludedSkills.js` |
| オプション | 切れ者 → 継承固有 → トレヒントLv | `#training-hint-level` |
| 説明書 | ヘッダー「使い方」`<dialog>`（docs 非同期） | `bindHelpDialog` |
| 初期値 | 育成 `[万福龍湯伝・頂]ナリタトップロード` / 枠5ヤング・枠6たづな / 継承 個数4・Lv3 | — |

### シナリオ（トレセン軒）`toresenken.json` v3

- **リンク（シニア9月前半）**: ラジオ1択・相互排他・未選択なし（デフォルト `link_dotou`）。編成連動で白/金。たづな＆ハローは OR
- **RMJ / 終了（ガチ想定）**: 盛況チェック廃止。`scenarioAutoSkills` 自動計上。シニア12月はラーメン3択（デフォルト: よくばり）

---

## 6. データ・アーキテクチャ

### 6.1 フォルダ

```text
umamusume-sp-calc/
  README.md                 # 利用者向け
  .cursor/rules/            # エージェント常時ルール
  docs/                     # 開発者・エージェント向け正本群
    reference/              # 本ファイル等の圧縮参照
  scripts/                  # extract / verify / test
  data/                     # JSON（extract + 手メンテ）
  app/                      # 静的フロント
  .github/workflows/        # Pages デプロイ
```

### 6.2 データフロー

```text
master.mdb
    │ extract_mdb.mjs
    ▼
skills.json + supports.json + characters.json + meta.json
    │
U-tools SSR + mdb ──► extract_support_events.mjs
    │                      ▼
    │               events.extracted.json
    │                      │ apply (+ preserve)
    ▼                      ▼
events.json / toresenken.json
    │
    ▼
app.js → buildSkillPlan(aggregate.js)
    → resolveHintLevels → filterDisplaySkills → calcAcquisitionCost
    → 合計SP + 行一覧
```

### 6.3 モジュール責務

| ファイル | 責務 |
|----------|------|
| `spCost.js` | 割引・`calcSkillCost` |
| `hintResolve.js` | max hintLv + sources |
| `goldLower.js` | チェーン合算・表示フィルタ |
| `skillActivation.js` | 発動条件タグ・絞込 |
| `scenarioLink.js` | リンク白/金 |
| `aggregate.js` | 全由来収集と合計 |
| `copyIncludedSkills.js` | クリップボード整形 |
| `app.js` | UI・読込・再計算 |

### 6.4 JSON 要点

- **skills**: `baseSp`, `lowerSkillId`/`upperSkillId`（`group_rate>=0` のみ）, `activation`（grounds/distances/styles）
- **supports**: `hintSkillIds`（トレのみ。イベントは別）, `type`, 名前は `[バリアント] 名前`
- **characters**: `skillsByAwakening`（レガシー名＝育成ウマ娘所持スキル）
- **events**: `selection: auto|single`（`toggle` 後方互換）, `supportNameMatch`, 安定 id `evt_{supportCardId}_{storyId}`
- 現状目安: skills ~2103 / supports ~543 / characters ~261 / イベント 105（優先38）

### 6.5 mdb 主なソース

| 用途 | ソース |
|------|--------|
| スキル名 | `text_data` cat 47 |
| 必要 SP | `single_mode_skill_need_point` |
| トレヒント | `single_mode_hint_gain`（type=0） |
| 育成所持スキル | `available_skill_set` |
| サポカイベント報酬スキル | mdb 単独では復元不可 → U-tools |

---

## 7. 開発環境・コマンド

### 7.1 前提

- Windows + Node.js（extract / test / serve）
- ブラウザ（Chrome / Edge）
- 再 extract 時: DMM/Steam の `master.mdb`
- 実績パス: `D:\DMM\umamusumeDMM\Umamusume\umamusume_Data\Persistent\master\master.mdb`
- 既定 AppData パスは **無いことが多い**
- Python は代替。WindowsApps スタブに注意 → **Node 推奨**

### 7.2 主要 npm scripts

| コマンド | 用途 |
|----------|------|
| `npm run extract` | mdb → skills/supports/characters/meta |
| `npm run patch:activation` | 既存 skills へ activation のみ |
| `npm run extract:events` | U-tools+mdb → events.extracted |
| `npm run apply:events` | extracted → events.json（+preserve） |
| `npm run compare:events` | ゴールデン差分レポート |
| `npm run verify` | データ簡易確認 |
| `npm test` | SP / activation / copy 回帰 |
| `npm run serve` | http://localhost:8080 （サイトルート＝リポジトリ直下） |
| `npm run render:priority-supports` | 優先38一覧再生成 |
| `npm run bind-priority` | 優先枠メンバー変更時のみ |

入口は **`/app/`**。`file://` 不可。`app/` だけをルートにすると `../data` が 404。

### 7.3 ゲーム更新 Runbook（要約）

正本: `GAME_UPDATE_RUNBOOK.md`。

1. `npm run extract` → `verify` → `test`
2. `extract:events` → `compare:events` → `apply:events` → 再比較・再 test
3. 必要時: preserve / overrides / `toresenken.json`
4. `npm run serve` で目視
5. コミット →（明示時）push → Pages Actions

Pages: `master` push / 手動。失敗時は Settings → Pages Source = **GitHub Actions**。

---

## 8. Docs 管理法（現状マップと運用）

### 8.1 ファイル役割マトリクス

| ファイル | 読者 | 役割 | 更新トリガー |
|----------|------|------|----------------|
| `README.md` | 利用者 | 公開 URL・使い方・制限 | 版・機能告知 |
| `AGENT_HANDOFF.md` | エージェント | **新チャット最初**・現状表・次タスク | 状態変化のたび |
| `REQUIREMENTS.md` | 開発/AI | 確定要件・非交渉に近いルール | 要件変更 |
| `spec.md` | 開発/AI | 計算・データ解釈の詳細 | 計算変更 |
| `GLOSSARY.md` | 全員 | 用語統一（混同防止） | 呼称変更時 |
| `DATA.md` | 開発/AI | JSON・mdb・自動/手動境界 | スキーマ・件数 |
| `ARCHITECTURE.md` | 開発/AI | 構成・データフロー・責務 | モジュール追加 |
| `DEV.md` | 開発 | セットアップ・TS・Pages | 環境手順 |
| `GAME_UPDATE_RUNBOOK.md` | 運用 | パッチ後チェックリスト正本 | 手順改善時 |
| `EVENT_EXTRACT_DESIGN.md` | 設計履歴 | イベント正本化の決定記録 | 設計変更時 |
| `UTOOLS_EVENT_PARSE.md` | 開発 | U-tools SSR パース | パース変更 |
| `PRIORITY_SUPPORTS.md` | 利用者+開発 | 優先38一覧 | `render:priority-supports` |
| `MODEL_SELECTION.md` | エージェント | モデル4択・Quota | 方針変更 |
| `ROADMAP.md` | 開発 | 完了/残り/スコープ外 | マイルストーン |
| `CHANGELOG.md` | 公開履歴 | 版ごとの変更 | リリース・データ更新 |
| `reference/DEV_ENV_SPEC_REVIEW.md` | **AI レビュー** | 本圧縮ファイル | 大きな方針変更後に再生成推奨 |

### 8.2 Docs の書き分け原則（観察される慣行）

1. **利用者**と**開発者/エージェント**を分離（README vs docs）
2. **状態付きブリーフ**（HANDOFF）と**不変に近い仕様**（REQUIREMENTS/spec）を分離
3. **手順の正本は1つ**（ゲーム更新は Runbook）
4. **設計決定の経緯**は EVENT_EXTRACT_DESIGN 等に残し、日常手順から切り離す
5. **用語は GLOSSARY が正**（「育成ウマ娘所持スキル」≠「覚醒進化」、トレヒント統一）
6. **インアプリ説明は docs 非連動** — UI 文言変更時は `index.html` も手で直す（ドリフトリスク）

### 8.3 既知の Docs リスク（レビュー観点）

| リスク | 内容 |
|--------|------|
| 重複 | HANDOFF / REQUIREMENTS / spec / DATA に同一ルールが多重記載 |
| ドリフト | アプリ dialog ↔ docs、HANDOFF の件数・版 ↔ meta.json |
| 圧縮参照の陳腐化 | 本 `reference/` ファイルは個別 docs より古くなりうる |
| 自動同期なし | 仕様変更チェックリストが口頭・慣行依存 |
| 英語/日本語混在なし（ほぼ日本語） | AI には明示的でよいが、外部コントリビュータ向け英語要約は無い |

### 8.4 推奨される「Docs を触るとき」の最小セット

| 変更種別 | 最低限更新する docs |
|----------|---------------------|
| 計算・ヒントルール | REQUIREMENTS + spec（+ 必要なら GLOSSARY）+ CHANGELOG |
| UI のみ（仕様不変） | CHANGELOG + 必要なら README / dialog |
| extract / JSON 件数 | DATA + HANDOFF + CHANGELOG |
| 優先サポカ増減 | PRIORITY_SUPPORTS（render）+ REQUIREMENTS 言及 + HANDOFF |
| 運用手順 | Runbook および/または DEV |
| エージェント手順 | HANDOFF + MODEL_SELECTION / `.cursor/rules` |

---

## 9. Git / 品質ゲート

### 9.1 コミット方針（プロジェクト最優先）

- ワークスペースを書き換えたら **毎回コミット**（復元ポイント）
- PowerShell: `git add .` と `git commit` は **別ステップ**（`&&` 禁止）
- メッセージ例: `feat:` / `fix:` / `chore:` / `docs:`
- `git push` はユーザー明示時のみ
- CI（Pages workflow）: デプロイ前に `verify` + `test`

### 9.2 テスト現状

- `test_sp.mjs` — SP コスト・編成・リンク等
- `test_skill_activation.mjs` — 発動条件・絞込
- `test_copy_included_skills.mjs` — コピー整形
- 残り課題（ROADMAP）: 実機確認ケースの回帰拡充は一部済・継続可

---

## 10. エージェント・モデル運用

### 10.1 Cursor ルール

- `.cursor/rules/model-recommendation.mdc`（`alwaysApply: true`）
- 詳細: `docs/MODEL_SELECTION.md`

### 10.2 推奨モデル（4択のみ・Quota 節約が第一）

| モデル | 向き |
|--------|------|
| **Composer 2.5** | 設計済み実装、UI、JSON、小さな修正、docs |
| **Grok 4.6 Low** | 軽い調査、文言、単純確認 |
| **Grok 4.6 Medium** | 仕様曖昧な改修、集計切り分け、複数ファイル設計調整 |
| **Grok 4.6 High** | 実機大ズレ調査、extract 源変更、要件再設計 |

提示タイミング: 次タスク具体化直後・実装フェーズ直前。質問のみ・方針未確定は不要。

### 10.3 エージェント作業プロトコル（短縮）

1. HANDOFF + REQUIREMENTS/spec/GLOSSARY を読む
2. meta / skills の存在確認
3. モデル推奨（該当時）
4. 実装・検証（`npm test` / 必要なら実機相当の serve）
5. 関連 docs 同期
6. コミット（add と commit 分離）

---

## 11. ロードマップ・スコープ（レビュー時の境界）

### 11.1 完了（要約）

骨格・extract・計算コア・UI・events 正本化（優先38/105）・toresenken・Pages 公開・v0.1.3〜0.1.12（説明書・activation 絞込・適用ボタン・コピー・トレヒントLv・継承スキル数・キャッシュ対策など）。

### 11.2 残り（任意〜運用）

- UX: 結果の由来表示、初期デッキ6枚化（プリセットは当面スコープ外）
- 回帰テスト拡充
- ゲーム更新時の extract → events → verify → push 運用継続

### 11.3 スコープ外（当面やらない）

- トレセン軒以外のシナリオ
- 全サポカイベント網羅
- 継承固有の個別名前・親指定
- 常用デッキプリセット
- Electron / 必須クラウド化（Pages 静的公開は実施済み）
- U-tools を CI に載せる（ローカル手動）

### 11.4 不要と判断済み

- 固有除外の専用ロジック（データ源で自然に整合）
- 覚醒進化の置換ロジック（購入リストは進化前のみ）

---

## 12. 用語（最小セット）

正本: `docs/GLOSSARY.md`。

| 用語 | 意味 |
|------|------|
| **育成ウマ娘所持スキル** | 覚醒レベル（カード開花）で得る購入対象スキル。`available_skill_set` |
| **覚醒進化** | ゲーム内の金→金進化。購入リストは進化前金のみ |
| **固有スキル** | 本体ユニーク。購入リスト外 |
| **継承固有** | UI オプションの汎用枠（個数×SP） |
| **トレヒント** | サポカ編成時のトレーニングヒント（旧称「訓練ヒント」廃止） |
| **×** | `group_rate < 0`。チェーン外 |

---

## 13. レビュー用チェックリスト（ブラッシュアップ提案向け）

AI は次を点検し、改善案を出してよい（§3 非交渉は除く）。

### Docs / SDD

- [ ] 正本階層はエージェントに十分明確か（HANDOFF が肥大化していないか）
- [ ] REQUIREMENTS と spec の重複を「要約 vs 詳細」に整理できるか
- [ ] `reference/` の再生成タイミング・「個別 docs が正」の明示は十分か
- [ ] インアプリ説明と docs の同期手順を文書化すべきか
- [ ] CHANGELOG / ROADMAP / HANDOFF の更新漏れパターンは何か

### 開発環境

- [ ] Runbook・npm scripts・gitignore（`events.raw.utools.json` 等）は一貫しているか
- [ ] テストカバレッジと「実機確認済み」表記のギャップ
- [ ] Pages / serve / extract の失敗モードは DEV に足りているか
- [ ] Windows / PowerShell 固有制約（`&&` 禁止等）はルールと docs で揃っているか

### エージェント運用

- [ ] モデル推奨ルールは Quota 目的と整合しているか
- [ ] 新チャット起動コスト（読むファイル数）は適切か
- [ ] 用語混同ガード（GLOSSARY）は十分か

### プロダクト境界

- [ ] スコープ外が ROADMAP と HANDOFF で一致しているか
- [ ] 優先38の追加方針（課金必須 SSR）は運用可能か

---

## 14. 個別 docs へのポインタ（深掘り用）

作業・実装時は本ファイルだけでなく、該当正本を開くこと。

- 最短ブリーフ: `docs/AGENT_HANDOFF.md`
- 要件: `docs/REQUIREMENTS.md`
- 計算仕様: `docs/spec.md`
- 用語: `docs/GLOSSARY.md`
- データ: `docs/DATA.md`
- 構成: `docs/ARCHITECTURE.md`
- 開発: `docs/DEV.md`
- ゲーム更新: `docs/GAME_UPDATE_RUNBOOK.md`
- イベント設計: `docs/EVENT_EXTRACT_DESIGN.md`
- U-tools: `docs/UTOOLS_EVENT_PARSE.md`
- モデル: `docs/MODEL_SELECTION.md`
- 進捗: `docs/ROADMAP.md`
- 履歴: `docs/CHANGELOG.md`
- 優先サポカ: `docs/PRIORITY_SUPPORTS.md`

---

## 15. メタ（本ファイル）

| 項目 | 値 |
|------|-----|
| パス | `docs/reference/DEV_ENV_SPEC_REVIEW.md` |
| 生成意図 | AI による開発環境・Docs・SDD のレビュー入力 |
| メンテ方針 | 大きな仕様・運用変更後に再生成または差分更新。日常の正本にはしない |
| 非目標 | 利用者向けマニュアルの代替、実行可能な Runbook の代替 |
