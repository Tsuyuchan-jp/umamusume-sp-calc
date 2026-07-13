# 設計レビュー: サポカイベント抽出（優先37置換）

**状態**: **Phase B 完了**（2026-07-14）— `events.json` を U-tools+mdb 抽出で置換済み  
**ゴール**: ~~優先37サポカの `events.json` を U-tools + mdb 抽出で置換する~~ **達成**  
**調査日**: 2026-07-14  
**mdb**: `D:/DMM/umamusumeDMM/Umamusume/umamusume_Data/Persistent/master/master.mdb`  
**探査スクリプト**: `scripts/_probe_mdb_events.mjs`（読み取り専用）

---

## 承認サマリ

| 項目 | 決定 |
|------|------|
| 一次ソース | **U-tools SSR JSON** + mdb 身元照合（★1） |
| `defaultChoiceId` | 機械（Σ baseSp 最大）+ 少数 override（★2） |
| 手メンテ id | エイリアス表を1バージョン残してから新 id へ（★3） |
| `prioritySupportNames` | **維持**（UI 注意書き・対象範囲の正。全カバー廃止は不要）（★4） |
| 育成固有・シナリオ汎用イベント | **同梱しない**（★5） |
| U-tools 取得 | 当面ローカル手動。CI 載せない。raw キャッシュはコミットしない（★6） |
| **全サポカ対応** | **撤回** — mdb 単独でスキルヒントまで復元できないため、539枚一括はスコープ外のまま |

---

## 1. 現状整理

### いまの正本分担

| データ | 正本 | 備考 |
|--------|------|------|
| スキル SP / 上下位 | `master.mdb` → `extract_mdb.mjs` | 自動 |
| サポカ訓練ヒント | `single_mode_hint_gain` (type=0) | 自動 |
| サポカイベントのスキルヒント | `data/events.json` **U-tools+mdb 抽出** | 優先37種・102イベント（preserve 2） |
| トレセン軒シナリオ | `data/scenarios/toresenken.json` | **別系統・変更しない** |

### 手メンテの痛み

- 旧11種は実機確認済み。追加26種は GameWith / U-tools 照合で、**GameWith 誤記が混入**した（例: アストンマーチャン「いつもそばから見つめてる」に存在しない「捕捉」→削除済み）。
- 現行 `extract_mdb.mjs` はイベント選択肢→スキルヒントを**未抽出**。

### mdb 再確認の結論

| 取れるもの | テーブル / 経路 | 結果 |
|------------|-----------------|------|
| サポカ↔イベント紐付け | `single_mode_story_data`（`support_chara_id` / `support_card_id`, `event_category=4`） | **可** |
| イベント名 | `text_data` category **181**（index=`story_id`） | **概ね可**（名前無し story あり） |
| 選択肢の報酬（スキルヒント含む） | 単純な1テーブル結合 | **不可** |
| `single_mode_event_choice_reward` | 57件・表示メタのみ | 報酬本体ではない |

**判定**: master.mdb 直読みだけでは選択肢 effect まで復元 **不可**。  
報酬はストーリーアセット側、または U-tools 等の解決済み中間データにある。

### 現行 `events.json` 契約（維持対象）

- `selection: auto` … 獲得スキルヒントが1系統のみ
- `selection: single` … 異なるスキルヒント候補が2つ以上
- スキルヒント無しイベントは **登録しない**
- 正規化正本: `scripts/event_selection.mjs`
- 現状: auto 83 / single 19 / 計 102

---

## 2. 採用アーキテクチャ

### 案2 — U-tools SSR JSON + mdb 身元照合（採用）

```
mdb: support ↔ story_id ↔ イベント名
        ↓ 突合キー
U-tools HTML 内埋め込み JSON: choices / effects / skillId / hintLv
        ↓ normalizeEventSelection
data/events.extracted.json（生成物）
        ↓ Phase A ゴールデン比較 → Phase B 置換
data/events.json
```

- GameWith は正本にも照合にも使わない。
- 対象は **優先37サポカのみ**（全539枚は対象外）。

### 却下・スコープ外

| 案 / 施策 | 理由 |
|-----------|------|
| 案1 mdb のみ | 選択肢報酬が取れない |
| 案3 アセット直読み | コスト過大。本プロジェクトのゴール外 |
| 全サポカ一括 | mdb 正本化が成立しない。U-tools 全件依存は運用・正本性の観点から撤回 |
| GameWith 全振り | 禁止 |

---

## 3. 段階計画（ゴール = Phase B）

### Phase A — 抽出パイプライン確立 ✅（2026-07-14）

### Phase B — 優先37種の置換 ✅（2026-07-14）

### 非ゴール（明示）

| 対象 | 扱い |
|------|------|
| **全サポカ（539枚）のイベント網羅** | **撤回・スコープ外** |
| トレセン軒（`toresenken.json`） | 同梱しない |
| 育成ウマ娘固有 / シナリオ汎用イベント | 対象外 |
| GameWith / Game8 | 使わない |
| 計算式・ヒントLv合算の変更 | しない |

---

## 4. 入出力契約（extract）

### コマンド（案）

```
npm run extract:events
# scripts/extract_support_events.mjs（extract_mdb.mjs とは分離）
```

### 生成物

| ファイル | 役割 | idempotent |
|----------|------|------------|
| `data/events.raw.utools.json` | U-tools 生データ（ローカルキャッシュ・gitignore） | 同一入力なら同一 |
| `data/events.extracted.json` | 正規化後・現行スキーマ互換 | **はい** |
| `data/events.diff-report.json` | ゴールデン差分 | 比較用 |
| `data/events.default-overrides.json` | `defaultChoiceId` の人手上書き（少数） | 手メンテ |
| `data/events.id-aliases.json` | 旧 id → 新 id（Phase B 移行用・一時） | — |
| `data/events.json` | アプリ正本 | **置換済み** |

### 変換規則

1. スキルヒントを含む choice のみ残す。
2. `normalizeEventSelection` を通す（`event_selection.mjs`）。
3. ラベル: `format_event_choice_labels.mjs` と同形式。
4. `supportNameMatch`: サポカタイトル部分で現行と互換。
5. ヒント無しイベントは登録しない。

### 安定 id

```
evt_{supportCardId|charaId}_{storyId}[_{choiceFingerprint}]
```

Phase A はマッピング表で旧 id と突合。Phase B で新 id に寄せ、エイリアスを1版残す。

### `defaultChoiceId`（確定）

1. 機械: ヒント付き choice のうち `Σ baseSp` 最大（同点は先頭）
2. 上書き: `data/events.default-overrides.json`（ドトウ連続の `ou` 等、少数のみ）

---

## 5. ゴールデン比較

### キー

1. `supportNameMatch` + イベント表示名（正規化）
2. なければ `supportNameMatch` + スキル集合シグネチャ

### 判定

| 結果 | 扱い |
|------|------|
| match | OK |
| extracted_only | 手メンテ漏れ候補 |
| hand_only | 抽出漏れ or 誤登録 |
| conflict | 要レビュー（26種誤記検出） |

旧11種は `conflict` / `hand_only` を原則ゼロ。

---

## 6. リスクと検証

| リスク | 検証 |
|--------|------|
| U-tools SSR 構造変更 | raw キャッシュ＋スキーマ断言。ローカル手動再取得 |
| 連続イベント | 最終選択のみエントリ化（現行どおり） |
| ランダム枝 | Phase A で検出・注記 |
| 名前無し story_id | story_id フォールバック＋要確認リスト |

---

## 7. 未決事項 — すべて承認済み

| ID | 内容 | **決定** |
|----|------|----------|
| ★1 | 一次ソースを U-tools にするか | **Yes** |
| ★2 | `defaultChoiceId` | **機械 + 少数 override** |
| ★3 | 手メンテ id | **エイリアス1版 → 破棄** |
| ★4 | `prioritySupportNames` | **維持**（全カバー廃止は不要） |
| ★5 | 育成固有・シナリオ汎用 | **しない** |
| ★6 | U-tools を CI に載せるか | **しない**（ローカル手動） |
| — | 全サポカ対応 | **撤回** |

---

## 8. 実装タスク — 完了（2026-07-14）

| # | タスク | 状態 |
|---|--------|------|
| 1 | U-tools SSR JSON パース仕様 | ✅ [UTOOLS_EVENT_PARSE.md](./UTOOLS_EVENT_PARSE.md) |
| 2 | `extract_support_events.mjs` | ✅ |
| 3 | `event_selection` / ラベル整形接続 | ✅ |
| 4 | ゴールデン比較 `compare_events_golden.mjs` | ✅ |
| 5 | `events.json` 置換 + `events.id-aliases.json` | ✅ |
| 6 | docs 更新 | ✅ |

### 運用（ゲーム更新時）

手順の正本: [GAME_UPDATE_RUNBOOK.md](./GAME_UPDATE_RUNBOOK.md)

```powershell
npm run extract:events
npm run compare:events
npm run apply:events
npm run compare:events
npm test
```

---

## 付録: アストンマーチャン（mdb では報酬不可の例）

| story_id | 名称 (cat181) |
|----------|---------------|
| 801087001 | いつもそばから見つめてる |
| 801087002 | いつも写真から見つめてる |
| 801087003 | （名称なし） |

U-tools では 801087001 相当がステータスのみ（skillId なし）で正しい。
