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
- `meta.json` 例: skillCount 2103, supportCount 543, characterCount 261
- 抽出元: `D:\DMM\umamusumeDMM\Umamusume\umamusume_Data\Persistent\master\master.mdb`
- `events.json` / `toresenken.json` は手メンテ継続（優先37サポカのイベントは記入済み）
- **実機通し確認済み**（2026-07）: 常用デッキ＋イベント＋シナリオリンク白/金＋RMJ自動計上／ラーメン3択＋終了。問題・バグなし

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
- `lowerSkillId` / `upperSkillId` — 同一 `groupId` 内を `group_rate` 昇順でリンク（白↔金、○↔◎↔金 など）。**`group_rate < 0`（× 等）は購入チェーン外**

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
  "prioritySupportNames": [ "...37枚..." ],
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
- **現状**: 優先37サポカ記入済み（37/37・103イベント）。追加26枚は GameWith / U-tools 照合（2026-07）

### 優先サポカ一覧

`events.json` の `prioritySupportNames` を正とする（計37種）。旧11種に加え、グランアレグリア・アーモンドアイほか24枚を追加（2026-07）。

## 手メンテ: scenarios/toresenken.json

`version: 3`。シナリオスキルの `skillId` は埋済み（実機通し確認済み）。

グループ:

- `linkSkills` — シナリオリンク（**相互排他・UI はラジオ1択**。未選択なし。デフォルト: `link_dotou`）
  - シニア9月前半イベント。選んだリンクにつきヒントは **1スキルのみ**
  - デフォルトは `skillWithoutLink`（白）。リンク対象キャラが **育成ウマ娘または6枠サポカ** にいれば `skillWithLink`（金）
  - `requiresLinkCharacterId` — 単一キャラ（`supports.characterId` / 育成カードの `floor(id/100)`）
  - `requiresLinkCharacterIds` — 複数キャラは **OR**（いずれか1人いれば金。たづな＆ハロー用）
  - 実装: `app/js/scenarioLink.js`
- `scenarioAutoSkills` — ガチ想定で常に計上（UI は折りたたみ確認用）
  - クラシック12月 大盛況 → 時中の妙 Lv1
  - シニア12月 超盛況固定 → ペースキープ Lv2 / 深呼吸 Lv2 / 恩返し、召し上がれ Lv3
  - 育成終了（大盛況以上）→ 極上の感謝を！ Lv2
  - 注: 「恩返し」と「極上の感謝を！」は白/金ペアのため、一覧では金行に合算表示（`goldLower`）
- `seniorRmjChoice` — シニア12月 超盛況のラーメン3択（ラジオ1択・選択金 Lv2）
  - スペシャル → 火事場のバ鹿力
  - よくばり → いいとこ入った！（`defaultChoiceId`: `ramen_yokubari`）
  - 珠玉 → 好奇心

旧 `rmjSkills` / `endSkills` / `classicRmj`（チェック ON/OFF）は廃止。盛況段階チェックボックスも廃止。

参考: https://github.com/mee1080/umasim/blob/main/data/ramen_memo.md

## 自動 vs 手動の境界

| データ | 取得方法 |
|--------|----------|
| スキル baseSp・上下位 | mdb 自動 |
| サポカ訓練ヒント | mdb 自動 |
| 育成ウマ娘所持スキル | mdb 自動（`available_skill_set`） |
| サポカイベントの金・追加スキル | **events.json 手メンテ** |
| シナリオ固有 | **toresenken.json 手メンテ** |
