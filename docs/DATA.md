# データ

## ディレクトリ概要

```
data/
  skills.json          # extract 生成（未生成ならアプリ起動不可）
  supports.json        # extract 生成
  characters.json      # extract 生成
  meta.json            # extract 生成（件数・ソースパス）
  events.json          # 手メンテ
  scenarios/
    toresenken.json    # 手メンテ（トレセン軒）
```

**現状（確認済み）**: extract 済み。

- `skills.json` / `supports.json` / `characters.json` / `meta.json` **あり**
- `meta.json` 例: skillCount 2078, supportCount 539, characterCount 258
- 抽出元: `D:\DMM\umamusumeDMM\Umamusume\umamusume_Data\Persistent\master\master.mdb`
- `events.json` / `toresenken.json` は手メンテ継続（優先11サポカのイベントは記入済み）

## master.mdb → extract

スクリプト:

- **推奨**: `scripts/extract_mdb.mjs`（Node / `node:sqlite`）— この環境での初回 extract 実績
- 代替: `scripts/extract_mdb.py`（Python）

実績パス:

```text
D:\DMM\umamusumeDMM\Umamusume\umamusume_Data\Persistent\master\master.mdb
```

既定（無い場合あり）:

```text
%USERPROFILE%\AppData\LocalLow\Cygames\umamusume\master\master.mdb
```

```powershell
node scripts/extract_mdb.mjs
node scripts/extract_mdb.mjs --mdb "D:\DMM\umamusumeDMM\Umamusume\umamusume_Data\Persistent\master\master.mdb"
python scripts/extract_mdb.py --mdb "D:\...\master.mdb"
```

補助: `scripts/verify_data.mjs`（優先サポカ名・スキル解決の目視）、`scripts/test_sp.mjs`（コスト式回帰）

### 主なテーブル / text_data category

| 用途 | ソース |
|------|--------|
| スキル名 | `text_data` category **47** |
| スキル説明 | 48（抽出では未使用） |
| サポカ名 | 75 / バリアント 76 / キャラ名寄せ 77 |
| ウマ娘名 | 6 |
| スキル本体 | `skill_data`（id, rarity, group_id, group_rate, icon_id） |
| 必要SP | `single_mode_skill_need_point`（need_skill_point → `baseSp`） |
| サポカヒント | `single_mode_hint_gain`（`hint_gain_type = 0` → `hintSkillIds`） |
| ヒントLvアップ上限 | `support_card_effect_table` type **17** → `hintLevelUpMax` |
| サポカマスタ | `support_card_data` |
| カード↔所持スキルセット | `card_data.available_skill_set_id` |
| 育成ウマ娘所持スキル | `available_skill_set`（`need_rank`, `skill_id`） |

### 生成 JSON の要点

**skills.json** 1件:

- `id`, `name`, `baseSp`, `rarity`, `groupId`, `groupRate`, `iconId`
- `lowerSkillId` / `upperSkillId` — 同一 `groupId` 内を `group_rate` 昇順でリンク（白↔金）

**supports.json** 1件:

- `id`, `name`（`[バリアント] 名前` 形式）、`characterId`, `rarity`, `type`（`command_id` 由来: speed/stamina/power/guts/wit/friend）
- `hintSkillIds` — 訓練ヒント（自動）。イベントはここには入らない
- `eventIds` — 現状空配列（将来用）

**characters.json** 1件:

- `id`, `name`, `skillsByAwakening`: `{ "1": [skillId,...], ... }` — **育成ウマ娘所持スキル**（覚醒レベル `need_rank` 別。フィールド名はレガシー）

用語: [GLOSSARY.md](./GLOSSARY.md)

## 手メンテ: events.json

```json
{
  "version": 2,
  "prioritySupportNames": [ "...11枚..." ],
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
- **現状**: 優先11サポカすべて記入済み（11/11）

### 優先サポカ一覧

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

## 手メンテ: scenarios/toresenken.json

グループ:

- `linkSkills` — シナリオリンク（**相互排他・UI はラジオ1択**。未選択なし。デフォルト: メイショウドトウ）
- `rmjSkills` — シニア12月 盛況段階の選択金など
- `endSkills` — 育成終了スキル
- `classicRmj` — クラシック12月 大盛況など

`linkSkills` 以外はチェックボックスで ON/OFF（複数選択可）。

参考: https://github.com/mee1080/umasim/blob/main/data/ramen_memo.md

## 自動 vs 手動の境界

| データ | 取得方法 |
|--------|----------|
| スキル baseSp・上下位 | mdb 自動 |
| サポカ訓練ヒント | mdb 自動 |
| 育成ウマ娘所持スキル | mdb 自動（`available_skill_set`） |
| サポカイベントの金・追加スキル | **events.json 手メンテ** |
| シナリオ固有 | **toresenken.json 手メンテ** |
