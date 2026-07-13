# 仕様（計算・データ解釈）

要件の要約は [REQUIREMENTS.md](./REQUIREMENTS.md)。実装は `app/js/` を正とする。

## 目的

サポカデッキ・育成ウマ娘・トレセン軒想定で、取得可能なスキルをすべて習得するのに必要な理論 SP を算出する。

## ヒントLv解決

各スキルについて、由来ごとのヒントLvを集め、**最大値**を採用する。

| 由来 | Lv | 実装 |
|------|-----|------|
| サポカ訓練ヒント | 5 | `aggregate.js` 定数 `TRAINING_HINT` |
| ウマ娘所持・覚醒 | 3 | `CHARA_HINT`。覚醒は最大ランク（Lv5想定）のセットのみ |
| イベント | JSON の `hintLevel` | デッキに該当サポカがいるときのみ |
| シナリオ | JSON の `hintLevel` | ユーザーがチェックしたエントリのみ |
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

## 除外・含めないもの

| 対象 | 扱い |
|------|------|
| 自分の固有スキル本体 | 計画に含めない（SP 0） |
| 進化スキル | 進化前の金スキル SP で計上（進化後 ID は使わない方針） |
| UI で「含める」を外したスキル | 合計から除外（対人レギュ等） |
| 継承固有（オプションOFF） | 加算しない |

## 継承固有（オプション）

スコープを広げないため **汎用行のみ**:

- 個数: 2–6
- baseSp: 既定 200（変更可）
- ヒントLv: 一律 1–5（ユーザー指定）
- 親ウマ娘名・固有スキル名は扱わない

コスト: `calcSkillCost(baseSp, hintLv, 切れ者) * 個数`

## シナリオ（トレセン軒）

- 当面このシナリオのみ。データ: `data/scenarios/toresenken.json`
- リンク / 盛況段階 / 終了スキル / クラシック盛況などを **選択式 ON/OFF**
- 参照メモ: https://github.com/mee1080/umasim/blob/main/data/ramen_memo.md
- 多くの `skillId` は `null`。名前マッチ or 手入力で補完する

## イベント

- `data/events.json` を手メンテ
- 初期は優先11サポカのイベントスキルのみ（訓練ヒントは mdb）
- `supportNameMatch` でデッキ内サポカ名部分一致 → イベント適用

## 覚醒

- `characters.json` の `skillsByAwakening` から **最大 need_rank** のスキル群を採用（Lv5 想定）
- ヒントLv は 3（他由来の方が高ければ上書き）
