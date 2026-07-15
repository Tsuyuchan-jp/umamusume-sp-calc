# 仕様（計算・データ解釈）

要件の要約は [REQUIREMENTS.md](./REQUIREMENTS.md)。実装は `app/js/` を正とする。

## 目的

サポカデッキ・育成ウマ娘・トレセン軒想定で、取得可能なスキルをすべて習得するのに必要な理論 SP を算出する。

用語は [GLOSSARY.md](./GLOSSARY.md) を正とする。

## ヒントLv解決

各スキルについて、由来ごとのヒントLvを集め、**最大値**を採用する。

| 由来 | Lv | 実装 |
|------|-----|------|
| サポカ訓練ヒント | 5 | `aggregate.js` 定数 `TRAINING_HINT` |
| 育成ウマ娘所持スキル | 3 | `CHARA_HINT`。育成ウマ娘覚醒レベルは最大想定で全ランク合算 |
| イベント | JSON の `hintLevel` | デッキに該当サポカがいるときのみ |
| シナリオリンク | JSON の `hintLevel` | 選択1件・編成で白/金を切替（`scenarioLink.js`） |
| シナリオ自動 | JSON の `hintLevel` | `scenarioAutoSkills` を常時計上 |
| シニア12月 RMJ | JSON の `hintLevel` | ラーメン3択ラジオ（`seniorRmjChoice`） |
| 複数由来 | `max` | `hintResolve.js` |

`skillId` が無いエントリは、`skills.json` の **名前完全一致**で ID 解決を試みる。

## SPコスト

### 単体

```text
cost = floor(baseSp * (1 - hintDiscount - (切れ者 ? 0.10 : 0)))
```

ヒント割引:

| Lv | 割引 |
|----|------|
| 0 | 0% |
| 1 | 10% |
| 2 | 20% |
| 3 | 30% |
| 4 | 35% |
| 5 | 40% |

実装: `spCost.js` の `HINT_DISCOUNTS` / `calcSkillCost`  
割引合計が 1 を超えないよう `Math.max(0, 1 - discount)`。

### 金 + 白（検証済み）

金スキル（`lowerSkillId` あり）を白未取得のまま取る場合:

```text
cost(白, whiteHintLv) + cost(金, goldHintLv)
```

- mdb / `skills.json` では白・金それぞれ別 `baseSp`
- 一覧表示では、同じ計画内に白と金の両方があるとき **白行を隠し、金行に合算コストを出す**（`filterDisplaySkills` / `calcAcquisitionCost`）

検証例（強者の証 / さらなる高みへ）:

| 操作 | SP |
|------|-----|
| 白のみ（強者の証、ヒントLv2） | 170 |
| 金直取り（白未取得、金ヒントLv0） | 306 |
| 白取得後に金のみ | 136 |

→ `170 + 136 = 306`。回帰テスト: `node scripts/test_sp.mjs`

### ○ + ◎（ガチ想定・軽量版）

同一 `groupId` 内の ○ → ◎（および ○ → ◎ → 金）:

| ルール | 内容 |
|--------|------|
| ヒント | **○ に付く**。◎専用ヒントは無い。◎ ID のヒントも白帯で共有（`getEffectiveHintLevel`） |
| ○のみヒント | **◎行に繰り上げ**、cost(○)+cost(◎)。金へは自動繰り上げしない |
| 金が計画に含まれる | **金行のみ表示**、下位チェーン全段を合算（○+◎+金） |
| 内訳表示 | `(78+84+135)` のように数値のみ（`chainCosts`） |
| 除外 | 表示行単位（◎/金行を外すと下位もまとめて除外） |

実機ショップは金行と○行を並記することがあるが、本ツールは「全部取得」合計のため **二重計上しない**。

検証例（先行直線○ Lv5 / 勇迅一閃 Lv1）:

| 状態 | 金表示コスト | 備考 |
|------|-------------|------|
| 未取得フル | 297 | 78+84+135 |
| ○取得後（参考） | 219 | 84+135 |
| ◎取得後（参考） | 135 | 金のみ |

## 除外・含めないもの

| 対象 | 扱い |
|------|------|
| 固有スキル本体 | SP 購入リスト外（mdb `skill_set`）。現行 extract は `available_skill_set` のみ採用のため **一覧に出ない** |
| 覚醒進化（金→金） | 購入リストは**進化前の金** ID のみ（実機・mdb 確認済み）。進化後 ID で計上しない |
| 白→金 | 白行は一覧から隠し、金行に白+金の合算コスト（`goldLower.js`） |
| ○→◎（ガチ想定） | ○ヒントは◎にも適用。○のみなら◎行に合算。金行は下位チェーン全段を含む |
| ×（`group_rate < 0`） | 購入チェーン外。ヒントに載っても単独行（合算に含めない） |
| UI で「含める」を外したスキル | 合計から除外（対人レギュ等） |
| 結果のバ場／距離／作戦絞込で非互換と判定されたスキル | 合計から除外（表示行は残す）。絞込は「適用」で確定し、確定時に手動「含める」もリセット。編成変更で追加されたスキルには確定済み絞込を増分適用 |
| 結果パネルスキル数表示 | 見出し右 `スキル数 N/M`。ON＝`!excluded` の行数、全件＝`rows.length`（継承固有含む） |
| 含めるスキルコピー | 見出し右ボタン。含める ON の表示行 `name` をカンマ区切り1行でクリップボードへ。継承固有・OFF 行は含めない |
| 継承固有（オプションOFF） | 加算しない |

## 継承固有（オプション）

スコープを広げないため **汎用行のみ**:

- 個数: 2–6
- baseSp: 既定 200（変更可）
- ヒントLv: 一律 1–5（ユーザー指定）
- 親ウマ娘名・固有スキル名は扱わない

コスト: `calcSkillCost(baseSp, hintLv, 切れ者) * 個数`

## シナリオ（トレセン軒）

- 当面このシナリオのみ。データ: `data/scenarios/toresenken.json`（`version: 3`、skillId 埋済み）
- 盛況段階のチェック ON/OFF は廃止（ガチ想定の自動計上に統一）
- **シナリオリンク（シニア9月前半）**:
  - UI はラジオ1択（常に全リンク表示・未選択なし）。選択1件につきヒントは白 or 金の **1スキルのみ**
  - リンク対象キャラが育成ウマ娘 ∪ サポカ6枠にいなければ白（`skillWithoutLink`）、いれば金（`skillWithLink`）
  - 複数キャラ条件（たづな＆ハロー）は **OR**（どちらか一方で金）
  - 実装: `app/js/scenarioLink.js`
- **シナリオ自動計上**（ガチ想定）: `scenarioAutoSkills` を常時計上（クラシック大盛況・超盛況固定・育成終了）
- **シニア12月 RMJ**: `seniorRmjChoice` ラジオ3択（ラーメン種で選択金が変わる。デフォルト: よくばり）
- 参照メモ: https://github.com/mee1080/umasim/blob/main/data/ramen_memo.md
- 常用デッキ＋シナリオの通し確認は **実機 OK**（2026-07）

## イベント

- `data/events.json` は **U-tools + mdb 抽出正本**（v0.1.3〜）。`events.preserve.json` でたづなお出かけ/正月2件を例外維持
- 優先37サポカ・102イベント（訓練ヒントは mdb 自動）
- 再生成: `npm run extract:events` → `npm run apply:events`（設計: [EVENT_EXTRACT_DESIGN.md](./EVENT_EXTRACT_DESIGN.md)）
- `supportNameMatch` でデッキ内サポカ名部分一致 → イベント適用
- `selection: auto` は編成時自動計上、`single` はラジオ1択（排他分岐用）
- 安定 id: `evt_{supportCardId}_{storyId}`（旧 id は `events.id-aliases.json`）

## 育成ウマ娘所持スキル

- mdb `available_skill_set` → `characters.json` の `skillsByAwakening`
- **育成ウマ娘覚醒レベルは最大想定**: 全 `need_rank` のスキル ID を合算
- ヒントLv は 3（他由来の方が高ければ上書き）
- 固有スキルはこのセットに含まれない（[GLOSSARY.md](./GLOSSARY.md)）
