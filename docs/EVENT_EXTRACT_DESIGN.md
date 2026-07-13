# 設計レビュー: サポカイベント抽出（全サポカ対応の基盤）

**状態**: 設計合意待ち（実装未着手）  
**調査日**: 2026-07-14  
**mdb**: `D:/DMM/umamusumeDMM/Umamusume/umamusume_Data/Persistent/master/master.mdb`  
**探査スクリプト**: `scripts/_probe_mdb_events.mjs`（読み取り専用）

---

## 1. 現状整理

### いまの正本分担

| データ | 正本 | 備考 |
|--------|------|------|
| スキル SP / 上下位 | `master.mdb` → `extract_mdb.mjs` | 自動 |
| サポカ訓練ヒント | `single_mode_hint_gain` (type=0) | 自動 |
| サポカイベントのスキルヒント | `data/events.json` **手メンテ** | 優先37種・102イベント |
| トレセン軒シナリオ | `data/scenarios/toresenken.json` | **別系統・変更しない** |

### 手メンテの痛み

- 旧11種は実機確認済み。追加26種は GameWith / U-tools 照合で、**GameWith 誤記が混入**した（例: アストンマーチャン「いつもそばから見つめてる」に存在しない「捕捉」→削除済み）。
- 現行 `extract_mdb.mjs` はイベント選択肢→スキルヒントを**未抽出**。
- docs / ROADMAP 上も「全サポカイベント網羅は当面スコープ外」。

### mdb 再確認の結論（本レビュー）

| 取れるもの | テーブル / 経路 | 結果 |
|------------|-----------------|------|
| サポカ↔イベント紐付け | `single_mode_story_data`（`support_chara_id` / `support_card_id`, `event_category=4`） | **可** |
| イベント名 | `text_data` category **181**（index=`story_id`） | **概ね可**（名前無し story あり。例: 801087003） |
| 選択肢の報酬（スキルヒント含む） | 単純な1テーブル結合 | **不可** |
| `single_mode_event_choice_reward` | 57件・表示メタ（`effect_value_type_*`）のみ | 報酬本体ではない |
| `single_mode_conclusion_set` | `story_id`→`conclusion_id`（演出） | スキル無し |
| `single_mode_hint_gain` type=1 | 訓練以外だが **story_id 非紐付け** | イベント選択肢には使えない |
| `single_mode_reward_set` | レース順位報酬系 | イベント選択肢ではない |

**判定**: 「master.mdb 直読みだけで選択肢 effect まで復元」は **現行クライアント DB の範囲では No**。  
報酬グラフは **ストーリーアセット（タイムライン）側**、または U-tools 等が既に解決した中間データにある、という前提で設計する。

### 規模感（mdb）

| 指標 | 値 |
|------|-----|
| `support_card_data` | 539 |
| `event_category=4` かつ card 紐付け | 1156 story / 398 card |
| `event_category=4` かつ chara のみ | 538 story / 142 chara |
| 名前付き support story（chara>0 ∩ cat181） | 452 / 538 |

スキルヒント付きだけに絞ると件数はさらに減る。UI はデッキ一致フィルタ済みのため、JSON 全件でも実行時のラジオ数は「編成6枚分」に収まる。

### 現行 `events.json` 契約（維持対象）

- `selection: auto` … 獲得スキルヒントが1系統のみ → 編成時自動計上、`skills` のみ
- `selection: single` … 異なるスキルヒント候補が2つ以上 → ラジオ、`defaultChoiceId` + `choices`
- スキルヒント無しイベントは **登録しない**
- 正規化正本: `scripts/event_selection.mjs`（`shouldBeSingle` / `normalizeEventSelection`）
- 現状: auto 83 / single 19 / 計 102

---

## 2. 候補アーキテクチャ

### 案1 — mdb のみ（却下）

```
master.mdb → extract → events.json
```

- 紐付け・名称までは可。**選択肢報酬が取れない**ため全サポカの正本化に不足。
- 「全部 GameWith」は禁止。本案も不可なので採用しない。

### 案2 — U-tools SSR JSON 一次実装 + mdb で身元照合（推奨・短期）

```
mdb: support ↔ story_id ↔ イベント名
        ↓ 突合キー
U-tools HTML 内埋め込み JSON: choices / effects / skillId / hintLv
        ↓ normalizeEventSelection
data/events.extracted.json（生成物）
        ↓ Phase A ゴールデン比較 → Phase B 置換
data/events.json
```

- U-tools はアストン誤記ケースで実機と一致（信頼できる照合源として既に実績あり）。
- GameWith は正本にも照合用にも使わない。
- 将来、アセット解析（案3）に差し替え可能な **中間スキーマ** を挟む。

### 案3 — Unity ストーリーアセット直読み（将来の真の正本）

```
meta + story timeline assets → effect 解決 → 中間JSON → events.json
```

- ゲームクライアントと同系統の正本になりうる。
- 暗号化・フォーマット・メンテコストが高い。Phase A のブロッカーにするには過大。
- **Phase C 以降の差し替え候補**として残す。

### 比較表

| 観点 | 案1 mdbのみ | 案2 U-tools+mdb | 案3 アセット |
|------|-------------|-----------------|--------------|
| 選択肢スキルヒント | × | ○ | ○（想定） |
| 身元（card/story/name） | ○ | ○（mdb） | ○ |
| 実装コスト | 低（だが不完全） | 中 | 高 |
| 壊れやすさ | 低 | SSR 構造依存 | アセット仕様依存 |
| GameWith 排除 | — | ○ | ○ |
| 全サポカ | 不可 | **条件付き可** | 可（想定） |

---

## 3. 推奨案と段階計画

### 推奨: 案2（二段構え）。将来の正本寄せは案3。

**全サポカ対応は可能か?**  
→ **Yes（条件付き）**

条件:

1. 選択肢報酬の一次ソースを U-tools（または将来アセット）とする。
2. mdb で `support`↔`story_id`↔名称の身元を担保し、 orphan / 名前不一致を検出する。
3. `event_selection.mjs` の auto/single 規則を機械適用する。
4. スキルヒント無しは出力しない。
5. UI は当面「デッキにいるサポカのイベントのみ表示」（現行どおり）。全件 JSON 化しても描画負荷は許容範囲。
6. `defaultChoiceId` 方針をユーザー合意する（下記 ★）。

### Phase A — 抽出パイプライン確立（破壊的置換なし）

- 入力: mdb + U-tools（優先37種に限定してよい）
- 出力: `data/events.extracted.json`（生成物・gitignore 可）と差分レポート
- ゴールデン: 現行 `events.json` の優先37種と **スキル集合ベース**で比較
- 成功: 旧11種は差分ゼロ〜許容リストのみ。追加26種は U-tools 側が正で、手メンテ誤記を検出できること

### Phase B — 優先37種の手メンテ置換

- 並走期間後、`events.json` を抽出結果で置換（id 安定化ルール確定後）
- `prioritySupportNames` は当面維持（UI 注意書き用）または「抽出カバレッジ」に更新
- 計算式・ヒントLv合算・トレセン軒は不変

### Phase C — 全サポカ

- 全カード分を抽出して `events.json` に載せる
- UI: 優先リスト注意書きを廃止 or 「未対応ゼロ」表示へ
- 性能: クライアントはデッキフィルタのみ（現行実装で足りる想定）。必要なら `supportCardId` 索引を付与
- デフォルト: 機械規則 + 任意の override ファイル

### 非ゴール（明示）

| 対象 | 扱い |
|------|------|
| トレセン軒（`toresenken.json`） | **同梱しない**。別正本・別UIのまま |
| 育成ウマ娘固有ストーリー / シナリオ汎用イベント | 本パイプラインの対象外（要別設計） |
| GameWith / Game8 | 正本・照合とも使わない |
| 計算式・ヒントLv合算仕様の変更 | しない（データ源のみ正本化） |

---

## 4. 入出力契約（extract）

### コマンド（案）

```
npm run extract:events
# または extract_mdb.mjs に --events を追加せず、独立スクリプトに分離推奨
# scripts/extract_support_events.mjs
```

分離理由: U-tools 取得はネットワーク依存で、既存 `npm run extract`（ローカル mdb のみ）と失敗モードが異なる。

### 生成物

| ファイル | 役割 | idempotent |
|----------|------|------------|
| `data/events.raw.utools.json` | U-tools 生データ（任意・キャッシュ） | 同一入力なら同一 |
| `data/events.extracted.json` | 正規化後・現行スキーマ互換 | **はい**（ソート・安定 id） |
| `data/events.diff-report.json` | Phase A ゴールデン差分 | 比較用 |
| `data/events.json` | アプリが読む正本 | Phase B まで手メンテ / 以降は生成 or 生成+override |

### 中間→現行スキーマ変換規則

1. スキルヒントを含む choice のみ残す（ステータスのみ枝は捨てる。UI「未選択」で代替）。
2. `normalizeEventSelection` を通す:
   - ヒント系統が1つ → `auto`（`skills` 化、`choices` 削除）
   - 2系統以上 → `single`（`defaultChoiceId` 必須）
3. ラベル: `format_event_choice_labels.mjs` と同形式（`① スキル LvN + …`）。
4. `supportNameMatch`: サポカタイトル部分（`text_data` 76 or 名称の `[title]` 部分）で現行と互換。
5. `skillId`: U-tools / mdb の skill id を優先。名前フォールバックは既存どおり。
6. **登録しない**: 全枝にスキルヒントが無いイベント（アストン「いつもそばから見つめてる」等）。

### 安定 id 規則（案）

```
evt_{supportCardId|charaId}_{storyId}[_{choiceFingerprint}]
```

手メンテ id（`evt_tazuna_oodate5` 等）との互換は Phase A では **マッピング表**で吸収し、Phase B で新 id に寄せるか併記する（★未決）。

### `defaultChoiceId`（案・要合意）

| 方針 | 内容 |
|------|------|
| 機械デフォルト | ヒント付き choice のうち、`Σ baseSp`（またはヒントLv加重）が最大の枝。同点は先頭 |
| オーバーライド | `data/events.default-overrides.json` で優先サポカのみ人手上書き（ドトウ連続の `ou` 等） |
| 推奨 | **機械 + 少数 override**（全人手はスケールしない） |

---

## 5. ゴールデン比較（Phase A）

### キー

手メンテ id に依存しない。優先順:

1. `supportNameMatch` + イベント表示名（正規化）
2. なければ `supportNameMatch` + スキル集合シグネチャ（`skillId` or name + hintLevel のソート連結）

### 判定

| 結果 | 意味 | 扱い |
|------|------|------|
| match | スキル集合一致 | OK |
| extracted_only | 抽出のみ | 手メンテ漏れの候補（追加検討） |
| hand_only | 手メンテのみ | 抽出漏れ or 誤登録（要調査） |
| conflict | 両方あるがスキル集合不一致 | **要レビュー**（26種の誤記検出ポイント） |

旧11種は `conflict` / `hand_only` を原則ゼロにする。アストン削除済みイベントは `extracted_only` にも出ない（ヒント無しのため）。

---

## 6. リスクと検証

| リスク | 影響 | 検証 |
|--------|------|------|
| 報酬がサーバーのみ | 抽出不能 | U-tools に載るイベントはクライアント解決済みとみなす。載らないものは対象外ログ |
| U-tools SSR 構造変更 | 抽出破綻 | raw キャッシュ＋スキーマ断言テスト。失敗時は前回 raw でビルド可 |
| 連続イベント | 途中枝と最終枝の扱い | 現行どおり「最終選択のみ」をエントリ化。中間は skill 無ければスキップ |
| ランダム枝 | 期待値とガチ想定がずれる | Phase A で検出したら `selection` 拡張 or 注記（初期は single の一枝として列挙できるか確認） |
| 同キャラ複数サポカでイベント共有 | 二重計上 | `supportNameMatch` / cardId の紐付けを mdb で検証 |
| 名前無し story_id | ラベル欠落 | mdb 181 欠落は story_id フォールバック表示＋要確認リスト |

---

## 7. 未決事項（ユーザー判断）

| ID | 内容 | 推奨 |
|----|------|------|
| ★1 | Phase A の一次ソースを U-tools でよいか | Yes（mdb 単独は不可のため） |
| ★2 | `defaultChoiceId` を機械規則のみにするか、override を許すか | 機械 + 少数 override |
| ★3 | Phase B で手メンテ id を捨てるか、エイリアス維持か | エイリアス表を1バージョン残してから破棄 |
| ★4 | Phase C で `prioritySupportNames` を廃止するか | 全カバー後に廃止 |
| ★5 | 育成固有・シナリオ汎用イベントを将来同梱するか | **しない**（トレセン軒と同様に分離） |
| ★6 | U-tools 取得を CI に載せるか（利用規約・負荷） | 当面ローカル手動 / キャッシュコミットは避ける |

---

## 8. 実装タスク分解（次チャット用）

### 推奨言語モデル（実装フェーズ）

**Composer 2.5**（本設計合意後はパイプライン実装が中心。U-tools パースで構造が読めないときだけ Medium）

| モデル | 向き |
|--------|------|
| Composer 2.5 | ◎ Phase A 実装 |
| Grok 4.6 Low | △ 件数確認のみ |
| Grok 4.6 Medium | ○ SSR 構造が崩れたときの切り分け |
| Grok 4.6 High | × 設計再オープン時のみ |

### タスク Splits

1. **U-tools 1枚分の SSR JSON 形状を固定**（マーチャン等）→ パース仕様メモ
2. **`extract_support_events.mjs` 骨組み** — mdb 紐付け + U-tools fetch/parse + 中間JSON
3. **`event_selection` / ラベル整形への接続** — 現行スキーマ出力
4. **ゴールデン比較スクリプト** — 37種 diff レポート
5. **docs 更新** — `DATA.md` / `ARCHITECTURE.md` / `AGENT_HANDOFF.md` / ROADMAP Phase 追記
6. （合意後）Phase B 置換 → Phase C 全件

---

## 付録: 探査で確認した具体例

アストンマーチャン `support_chara_id=1087`:

| story_id | 名称 (cat181) | conclusion |
|----------|---------------|------------|
| 801087001 | いつもそばから見つめてる | conclusion_id=1 |
| 801087002 | いつも写真から見つめてる | conclusion_id=1 |
| 801087003 | （名称なし） | conclusion_id=2 |

報酬（スキル）はこれらの行からは復元不能。U-tools 側では 801087001 相当がステータスのみ（skillId なし）で正しい、という既存知見と整合。
