# データ

JSON の意味・スキーマの正本。件数・パスの現状は `data/meta.json` / [AGENT_HANDOFF.md](./AGENT_HANDOFF.md)。  
ゲーム更新時の手順は [GAME_UPDATE_RUNBOOK.md](./GAME_UPDATE_RUNBOOK.md)。

## ディレクトリ概要

```
data/
  skills.json          # extract 生成（未生成ならアプリ起動不可）
  supports.json        # extract 生成
  characters.json      # extract 生成
  meta.json            # extract 生成（件数・ソースパス）
  events.json          # U-tools+mdb 抽出正本（+ preserve）
  priority-supports.json  # イベント対応40種のエクスポート（render:priority-supports で生成）
  events.extracted.json
  events.preserve.json # たづな2 + GameWith一時6（30307/30308）
  events.id-aliases.json
  events.default-overrides.json
  scenarios/
    toresenken.json    # 手メンテ（トレセン軒）
```

## master.mdb → JSON（概要）

- **推奨**: `scripts/extract_mdb.mjs`（Node）
- 代替: `scripts/extract_mdb.py`
- 手順・mdb パス: [GAME_UPDATE_RUNBOOK.md](./GAME_UPDATE_RUNBOOK.md)

補助: `scripts/verify_data.mjs`、`scripts/test_sp.mjs`、`scripts/test_skill_activation.mjs`

### サポカイベント関連ファイル

| ファイル | 役割 |
|----------|------|
| `events.raw.utools.json` | U-tools 生データ（ローカルキャッシュ・gitignore） |
| `events.extracted.json` | 正規化済み中間物 |
| `events.preserve.json` | U-tools 外の例外（たづな・30307/30308 の GameWith 一時） |
| `events.default-overrides.json` | `defaultChoiceId` の人手上書き |
| `events.id-aliases.json` | 旧 id → 新 id |
| `events.json` | **アプリ正本** |

パース仕様: [UTOOLS_EVENT_PARSE.md](./UTOOLS_EVENT_PARSE.md)。設計経緯: [archive/EVENT_EXTRACT_DESIGN.md](./archive/EVENT_EXTRACT_DESIGN.md)。

### 主なテーブル / text_data category

| 用途 | ソース |
|------|--------|
| スキル名 | `text_data` category **47** |
| スキル説明 | 48（抽出では未使用） |
| サポカ名 | 75 / バリアント 76 / キャラ名寄せ 77 |
| ウマ娘名 | 6 |
| スキル本体 | `skill_data`（id, rarity, group_id, group_rate, icon_id, precondition_*, condition_*） |
| 必要SP | `single_mode_skill_need_point`（need_skill_point → `baseSp`） |
| サポカトレヒント | `single_mode_hint_gain`（`hint_gain_type = 0` → `hintSkillIds`） |
| ヒントLvアップ上限 | `support_card_effect_table` type **17** → `hintLevelUpMax` |
| サポカマスタ | `support_card_data` |
| カード↔所持スキルセット | `card_data.available_skill_set_id` |
| 育成ウマ娘所持スキル | `available_skill_set`（`need_rank`, `skill_id`） |

### 生成 JSON の要点

**skills.json** 1件:

- `id`, `name`, `baseSp`, `rarity`, `groupId`, `groupRate`, `iconId`
- `lowerSkillId` / `upperSkillId` — 同一 `groupId` 内を `group_rate` 昇順でリンク。**`group_rate < 0`（× 等）は購入チェーン外**
- `activation` — 発動条件タグ（バ場・距離・作戦）。`branches` / `tags`。実装: `app/js/skillActivation.js`

**supports.json** 1件:

- `id`, `name`（`[バリアント] 名前`）、`characterId`, `rarity`, `type`
- `hintSkillIds` — トレヒント（mdb 自動）。イベントはここには入らない
- `eventIds` — 現状空配列（将来用）

**characters.json** 1件:

- `id`, `name`, `skillsByAwakening`: `{ "1": [skillId,...], ... }` — **育成ウマ娘所持スキル**

用語: [GLOSSARY.md](./GLOSSARY.md)

## events.json（サポカイベント）

```json
{
  "version": 2,
  "prioritySupportNames": [ "..." ],
  "events": [
    {
      "id": "evt_...",
      "supportNameMatch": "一杯のノスタルジア",
      "label": "表示名",
      "selection": "auto",
      "skills": [
        { "skillName": "...", "hintLevel": 3, "skillId": null }
      ]
    },
    {
      "id": "evt_..._chain",
      "supportNameMatch": "その執念は怒濤が如く",
      "label": "連続イベント（最終選択）",
      "selection": "single",
      "defaultChoiceId": "ou",
      "choices": [
        {
          "id": "ou",
          "label": "① スキルA + スキルB",
          "skills": [
            { "skillName": "...", "hintLevel": 2, "skillId": null }
          ]
        }
      ]
    }
  ]
}
```

| `selection` | UI | 計上 |
|-------------|-----|------|
| `auto` | 表示のみ（チェックなし） | 該当サポカ編成時に常に加算 |
| `single` | ラジオ1択（＋未選択） | 選んだ `choices` のスキルのみ |
| `toggle` | チェックボックス（後方互換） | ON のとき `skills` を加算 |

- `skillId` は extract 後に埋めると確実。無くても `skillName` 完全一致で解決を試す
- 優先サポカ一覧の正: `events.json` の `prioritySupportNames`。表は [PRIORITY_SUPPORTS.md](./PRIORITY_SUPPORTS.md)

## 手メンテ: scenarios/toresenken.json

`version: 3`。シナリオスキルの `skillId` は埋済み。

グループ:

- `linkSkills` — シナリオリンク（**相互排他・UI はラジオ1択**。未選択なし。デフォルト: `link_dotou`）
  - デフォルトは `skillWithoutLink`（白）。リンク対象が育成ウマ娘または6枠サポカにいれば `skillWithLink`（金）
  - `requiresLinkCharacterId` / `requiresLinkCharacterIds`（OR）
  - 実装: `app/js/scenarioLink.js`
- `scenarioAutoSkills` — ガチ想定で常に計上（クラシック大盛況・シニア超盛況・育成終了）
- `seniorRmjChoice` — シニア12月 ラーメン3択（デフォルト: `ramen_yokubari`）

参考: https://github.com/mee1080/umasim/blob/main/data/ramen_memo.md

## 自動 vs 手動の境界

| データ | 取得方法 |
|--------|----------|
| スキル baseSp・上下位 | mdb 自動 |
| サポカトレヒント（`hintSkillIds`） | mdb 自動。UI で Lv 3–5（既定5） |
| 育成ウマ娘所持スキル | mdb 自動（`available_skill_set`） |
| サポカイベントの金・追加スキル | **events.json**（U-tools+mdb） |
| シナリオ固有 | **toresenken.json 手メンテ** |
