# OPS — 開発・運用

ローカル起動・ゲーム更新・画像・データスキーマ・構成の正本。  
docs 入口: [README.md](./README.md)。仕様: [SPEC.md](./SPEC.md)。

## 目次

- [ローカル起動・Pages・Git](#ローカル起動pagesgit)
- [ゲーム更新 Runbook](#ゲーム更新-runbook)
- [画像アセット](#画像アセット)
- [データ・スキーマ](#データスキーマ)
- [アーキテクチャ](#アーキテクチャ)
- [U-tools パース](#u-tools-パース)

---

## ローカル起動・Pages・Git

**使い方・公開 URL**は [../README.md](../README.md)。docs 入口は [README.md](./README.md)。

ゲーム本パッチ後の extract / イベント / 画像 / デプロイ手順の**正本**は [ゲーム更新 Runbook](#ゲーム更新-runbook)。本ファイルは起動・トラブル・Git 向け。

## 前提

- Windows（本プロジェクトの作業環境）
- Node.js（extract / test / verify / `npm run serve`）
- ブラウザ（Chrome / Edge 等）
- DMM/Steam 版ウマ娘の `master.mdb`（再 extract 時）

## リポジトリ

```powershell
cd C:\Users\PC1\Projects\umamusume-sp-calc
```

remote: `https://github.com/Tsuyuchan-jp/umamusume-sp-calc.git`  
公開 URL: https://Tsuyuchan-jp.github.io/umamusume-sp-calc/app/

## ローカル確認

`file://` では `fetch` が失敗する。**HTTP 必須**。

サイトルート = リポジトリ直下（`data/` と `app/` が同階層）。入口は **`/app/`**。

```powershell
npm run serve
```

ブラウザ: http://localhost:8080/app/

`app/` だけをルートにすると `../data/*.json` が 404 になる。

データが無いときは [ゲーム更新 Runbook](#ゲーム更新-runbook) の extract 手順へ。

## GitHub Pages（本番）

- workflow: `.github/workflows/deploy-pages.yml`（`master` push / 手動）
- デプロイ前に `npm run verify` と `npm test`
- サイトルート = リポジトリ直下、入口 `/app/`
- ルート `index.html` は `./app/` へリダイレクト
- `.nojekyll` で Jekyll 無効化

### 初回・再デプロイ

1. リポジトリ **Settings → Pages → Source** を **GitHub Actions** にする
2. `master` へ push、または Actions から `Deploy GitHub Pages` を再実行
3. https://Tsuyuchan-jp.github.io/umamusume-sp-calc/app/ で合計 SP を確認

`configure-pages` が「Pages site failed / Not Found」になる場合は、Source が Actions 未設定のことが多い。設定後に workflow を rerun する。

**注意**: UX 完了の **v1.0.0 まで push しない**方針（[画像アセット](#画像アセット) / [TODO.md](./TODO.md)）。

## Python / PATH

再 extract は Node 推奨。Python を使う場合は実体の PATH を確認（WindowsApps スタブに注意）。

```powershell
where.exe python
```

## Git コミット方針（必須）

作業のたびにコミット。PowerShell では `git add .` と `git commit` を**別ステップ**（`&&` 禁止）。

```powershell
git add .
git commit -m "feat: 変更内容の要約"
```

- **push は明示依頼時のみ**

## エージェント / チャット運用

次タスクが決まっているとき、実装着手前に推奨言語モデル（4択）を提示する。  
詳細: [AGENT_HANDOFF.md（モデル）](./AGENT_HANDOFF.md#推奨言語モデル)

## よくある失敗

| 症状 | 原因 | 対処 |
|------|------|------|
| ロードエラー | skills 等が無い | Runbook の `npm run extract` |
| CORS / fetch 失敗 | file:// または `app/` のみ配信 | リポジトリ直下で `npm run serve` → `/app/` |
| Pages デプロイ失敗（Not Found） | Pages Source 未設定 | Settings → Pages → GitHub Actions |
| イベントが効かない | skillId/名前不一致 or サポカ未選択 | events.json とデッキを確認 |

---

## ゲーム更新 Runbook

ウマ娘クライアントがパッチされ **`master.mdb` が更新されたあと**、このリポジトリの JSON と公開サイトを追随させる手順です。

**目的**: スキル・サポカ・育成ウマ娘のトレヒントと、優先40サポカのイベントデータを最新化し、回帰テストと実機確認のうえ本番（GitHub Pages）へ反映する。

詳細仕様は [データ・スキーマ](#データスキーマ)。設計経緯は [archive/EVENT_EXTRACT_DESIGN.md](./archive/EVENT_EXTRACT_DESIGN.md)。このファイルは **作業順の正本** とする。

---

## いつ実行するか

| きっかけ | やること |
|----------|----------|
| ゲーム本パッチ（スキル・サポカ・マスタ更新） | 下記 **フル手順** |
| サポカ SSR 追加のみで mdb は同じ | 通常は不要。U-tools 側だけ変わった疑いがあるときは **イベント手順のみ** |
| 計算ロジックや UI だけ変更 | この Runbook は不要（`npm test` のみ） |

---

## 前提

- **Node.js** が使える（extract / test / serve は Node 推奨。Python は代替）
- クライアントのデータ DL が完了し、**新しい `master.mdb`** が手元にある
- 作業ディレクトリ: リポジトリ直下（`C:\Users\PC1\Projects\umamusume-sp-calc` など）

### master.mdb の場所（この環境の実績）

```text
D:\DMM\umamusumeDMM\Umamusume\umamusume_Data\Persistent\master\master.mdb
```

既定の AppData パスに無い場合が多い。見つからなければ `--mdb` で明示指定する。

---

## クイックチェックリスト（コピペ用）

```powershell
cd C:\Users\PC1\Projects\umamusume-sp-calc

# 1. mdb → skills / supports / characters
npm run extract
# または: node scripts/extract_mdb.mjs --mdb "D:\...\master.mdb"

npm run verify
npm test

# 2. サポカイベント（優先40・U-tools + mdb）
npm run extract:events
npm run compare:events
# → data/events.diff-report.json を確認。旧11 conflict があれば要調査

npm run apply:events
npm run compare:events

npm run verify
npm test

# 3. ローカル目視
npm run serve
# ブラウザ: http://localhost:8080/app/

# 4. コミット（add と commit は別ステップ）
git add .
git commit -m "chore: ゲーム更新に伴うデータ再 extract（YYYY-MM-DD）"

# 5. 本番反映（明示依頼時または運用判断時）
git push
```

`git push` 後、GitHub Actions が `verify` / `test` を通して Pages にデプロイする。

---

## 手順の詳細

### 1. master.mdb から基本データを再抽出

```powershell
npm run extract
```

フル extract の代わりに、既存 `skills.json` へ `activation` だけ付与する場合:

```powershell
npm run patch:activation
```

パスを指定する場合:

```powershell
node scripts/extract_mdb.mjs --mdb "D:\DMM\umamusumeDMM\Umamusume\umamusume_Data\Persistent\master\master.mdb"
```

**更新されるファイル**

| ファイル | 内容 |
|----------|------|
| `data/skills.json` | スキル定義・上下位リンク・発動条件タグ（`activation`） |
| `data/supports.json` | サポカ・トレヒント（`hintSkillIds`） |
| `data/characters.json` | 育成ウマ娘・覚醒スキル |
| `data/meta.json` | 件数・抽出元パス・日時 |

**このステップでは上書きされない**

- `data/events.json`（別パイプライン）
- `data/scenarios/toresenken.json`（手メンテ）

`skills.json` のリンクだけ直したいとき（extract し直さない）:

```powershell
node scripts/relink_skills.mjs
```

### 2. 基本データの検証

```powershell
npm run verify
npm test
```

- `verify`: 優先サポカ名の解決など簡易チェック
- `test`: SP コスト式・デフォルト編成・リンク白/金・発動条件タグ絞込などの回帰

失敗したら **apply / push 前に** 原因を切り分ける（新スキル id・表記ゆれ・テスト期待値の更新が必要なことがある）。

### 3. サポカイベントの再生成

トレヒントは mdb 自動。**イベントのスキルヒント**だけ U-tools + mdb の別パイプライン。

```powershell
npm run extract:events
```

| オプション | 用途 |
|------------|------|
| （省略） | U-tools を取得（初回・更新時はネットワーク必要） |
| `--cache-only` | `data/events.raw.utools.json` のみで再パース（オフライン） |
| `--mdb path` | mdb パス明示 |

キャッシュ `data/events.raw.utools.json` は **gitignore**（ローカル保持）。

**反映前に差分確認**

```powershell
npm run compare:events
```

出力: `data/events.diff-report.json`

| ステータス | 意味 | 対応 |
|------------|------|------|
| `match` | 手元と抽出が一致 | そのまま |
| `conflict` | 同一イベントで内容差分 | **要確認**（特に旧11種） |
| `extracted_only` | 抽出にだけある（新規） | apply で取り込まれる想定 |
| `hand_only` | 手元にだけある | preserve 例外か、削除候補かを判断 |

**正本へ反映**

```powershell
npm run apply:events
```

ドライラン:

```powershell
node scripts/apply_extracted_events.mjs --dry-run
```

`apply` は次を行う:

- `events.extracted.json` を `events.json` の正とする
- `events.preserve.json` の例外をマージ（たづなお出かけ/正月など）
- 必要に応じ `events.id-aliases.json` を更新

再度 `npm run compare:events` と `npm test` を実行する。

### 4. 手メンテ JSON の見直し（必要時のみ）

| ファイル | いつ触るか |
|----------|------------|
| `events.preserve.json` | U-tools に無いが実機で確認済みのイベントを追加・維持 |
| `events.default-overrides.json` | 選択肢のデフォルトを人が上書きしたいとき |
| `data/scenarios/toresenken.json` | トレセン軒の新スキル・リンク・RMJ・終了スキルがパッチで変わったとき |
| `npm run bind-priority` | **優先枠のメンバー自体が変わった**ときのみ（通常は不要）。新規追加は最新の課金必須 SSR を原則とする |

優先枠の一覧を更新したら:

```powershell
npm run render:priority-supports
```

（`bind-priority` 実行時は自動で再生成されます）

全539サポカのイベント網羅は **スコープ外**（優先枠のみ）。

### 5. ローカルでアプリ確認

```powershell
npm run serve
```

http://localhost:8080/app/ を開く（`file://` では動かない）。

確認の目安:

- データ読み込みエラーが出ない
- 常用デッキ相当で合計 SP が妥当
- イベント・シナリオリンク・RMJ が想定どおり計上される

### 6. コミットと本番反映

PowerShell では **`git add .` と `git commit` を別ステップ**（`&&` 禁止）。

```powershell
git add .
git commit -m "chore: ゲーム更新に伴うデータ再 extract（YYYY-MM-DD）"
```

**push 方針（現行）**: UX 思想が完成した **v1.0.0** まで `git push` / Pages 反映は行わない。ローカルコミットのみで復元点を残す。v1.0.0 以降は従来どおり:

```powershell
git push
```

push 後:

1. GitHub Actions の **Deploy GitHub Pages** が成功するか確認
2. https://Tsuyuchan-jp.github.io/umamusume-sp-calc/app/ でヘッダー版と合計 SP をスモーク

Pages が失敗するときは **Settings → Pages → Source = GitHub Actions** を確認（[ローカル起動・Pages・Git](#ローカル起動pagesgit) 参照）。

---

## カード画像の再 import（優先枠）

詳細は [画像アセット](#画像アセット)。`master.mdb` の extract とは別系統（`meta` + `dat`）。

優先サポカ追加・カード見た目更新・ゲーム大幅パッチのあと:

```powershell
# 要: 復号済み meta（.cache 内）と DMM Persistent の dat
# サポカは support_thumb を抽出 → import で 240×320 縦合成 + タイプ印
npm run assets:extract
npm run assets:import
npm run serve
# ピッカー・上段で画像表示を確認
```

| 症状 | 対処 |
|------|------|
| `META not found` | 本ファイル「画像アセット」の meta 復号手順。`.cache/.../meta_decrypted` を用意 |
| `DAT_ROOT not found` | `--dat` で Persistent\dat を指定 |
| `必須 PNG 欠落` | 先に `assets:extract` 成功を確認 |
| 一部だけプレースホルダ | 該当 id の meta 名欠落。レポートを確認 |

---

## パイプライン一覧

```text
master.mdb
    │ npm run extract
    ▼
skills.json / supports.json / characters.json / meta.json
    │
U-tools + mdb
    │ npm run extract:events
    ▼
events.extracted.json
    │ npm run apply:events (+ events.preserve.json)
    ▼
events.json ──► app/（fetch）

meta + dat（別系統）
    │ npm run assets:extract → assets:import
    ▼
assets/supports|characters/{id}.webp ──► app/（cardAssets.js）
```

---

## よくあるトラブル

| 症状 | 原因 | 対処 |
|------|------|------|
| `master.mdb が見つかりません` | パス未設定・DL未完了 | `--mdb` で DMM Persistent を指定 |
| `extract:events` がネットワークエラー | U-tools 未取得 | ネット接続後に再実行。または既存キャッシュで `--cache-only` |
| `extract:events` で個別カード 404 | U-tools 未掲載 | 警告付きでスキップし続行。優先枠には入れられるがイベント0。掲載後に再実行 |
| `compare:events` で旧11 conflict | 抽出と実機/U-tools の差 | `events.diff-report.json` を読み、preserve / overrides を検討 |
| アプリがロードエラー | JSON 欠損 | `npm run extract` |
| fetch 失敗（ローカル） | `file://` または `app/` のみ配信 | リポジトリ直下で `npm run serve` → `/app/` |
| イベントが効かない | skillId 不一致・サポカ未選択 | デッキと `events.json` を確認 |
| Pages デプロイ Not Found | Pages Source 未設定 | GitHub Settings → Pages → GitHub Actions |

---

## 関連ドキュメント

入口は [README.md](./README.md)。仕様は [SPEC.md](./SPEC.md)、日次キューは [TODO.md](./TODO.md)。完了設計・旧タスクは [archive/](./archive/)。

---

## 画像アセット

方針・抽出／import の正本。完了タスクの経緯は [archive/SUPPORT_CARD_IMAGE_TASK.md](./archive/SUPPORT_CARD_IMAGE_TASK.md)。  
ゲーム更新時の全体手順は [ゲーム更新 Runbook](#ゲーム更新-runbook)。

## 方針

| 手段 | 判定 |
|------|------|
| 公式の無料 CDN API | **なし** |
| 攻略サイト画像の直リンク | **採用しない** |
| ゲームクライアントからの抽出 | **採用** — リポジトリに同梱 |

## パス規約

| 種別 | パス | ファイル名 |
|------|------|--------------|
| サポカ | `assets/supports/` | `{supportCardId}.webp` |
| 育成ウマ娘 | `assets/characters/` | `{characterCardId}.webp` |
| タイプ印（共有） | `assets/type-icons/` | `{type}.webp`（speed/stamina/power/guts/wit/friend） |

UI は `app/js/cardAssets.js` が URL を組み立てる。画像が無い場合はタイプ色＋短縮名のプレースホルダ（計算には影響しない）。

## 同梱範囲

- 優先サポカ **40種** → `assets/supports/{id}.webp`
- 育成ウマ娘 **全カード**（`chr_icon` + dress フォールバック）→ `assets/characters/{id}.webp`
- タイプ印 **6種** — 実行時 CDN 非依存
- 目安サイズ: サポカ **240×320**・キャラ長辺 256px・WebP

### タイプ印の出所（再取得用）

実行時は `assets/type-icons/` のみ参照。

```text
https://static.kouryaku.tools/umamusume/images/app/supports/{name}.png
  speed / stamina / power / guts / friend … 同名
  wit ← wisdom.png
```

再取り込み: PNG を `.cache/asset-dump/type-icon-probe/` に置き `python scripts/import_type_icons.py`

## 著作権・配布

- 非公式・非商用。画像の権利はゲーム権利者に帰属
- **必要最小限のみ同梱**
- 公開 Pages への反映（`git push`）は **v1.0.0** まで行わない

## 抽出パイプライン

```text
DMM Persistent (meta + dat)
  → meta 復号（初回・更新時）
  → npm run assets:extract
  → npm run assets:import
```

### 前提パス（実績）

```text
D:\DMM\umamusumeDMM\Umamusume\umamusume_Data\Persistent\
  meta
  dat\
  master\master.mdb
```

### meta 復号

現行 JP クライアントの `meta` は SQLite3MC 暗号化。平文 `meta_decrypted` が必要。

- 作業用ツール・venv は `.cache/`（gitignore）
- 実績: `.cache/umamusu-utils-old-jp/storage/meta_decrypted`
- アセット先頭 256B 以降の XOR 復号は `scripts/extract_card_assets.py` に実装済み

### コマンド

```powershell
npm run assets:extract
# 育成のみ: node scripts/run_extract_card_assets.mjs --skip-supports
npm run assets:import
```

| 種別 | meta 名 |
|------|---------|
| サポカ縦カード元 | `supportcard/support{ID}/support_thumb_{ID}` |
| 育成カード | `chara/chr{charaId}/chr_icon_{charaId}_{key}_01`（無ければ dress。`piece_icon` は不使用） |

import 時のサポカ後処理（`scripts/support_vertical_card.py`）:

- 枠外パディング＋ソフトグロー除去、角丸マスク、縦縮尺 3:4 → 240×320
- タイプ印を右上合成（size=52 / top=-1 / right=4）
- 比較試作: `npm run samples:trim`

### スクリプト

| ファイル | 役割 |
|----------|------|
| `scripts/extract_card_assets.py` | meta+dat → flat PNG |
| `scripts/run_extract_card_assets.mjs` | venv Python ランチャ |
| `scripts/support_vertical_card.py` | 枠外トリム + 縦縮尺 + タイプ印合成 |
| `scripts/import_card_images.py` | flat PNG → WebP |
| `scripts/import_card_assets.mjs` | import ランチャ |

---

## データ・スキーマ

JSON の意味・スキーマの正本。件数・パスの現状は `data/meta.json` / [AGENT_HANDOFF.md](./AGENT_HANDOFF.md)。  
ゲーム更新時の手順は [ゲーム更新 Runbook](#ゲーム更新-runbook)。

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
- 手順・mdb パス: [ゲーム更新 Runbook](#ゲーム更新-runbook)

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

パース仕様: [U-tools パース](#u-tools-パース)。設計経緯: [archive/EVENT_EXTRACT_DESIGN.md](./archive/EVENT_EXTRACT_DESIGN.md)。

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

用語: [SPEC.md（用語）](./SPEC.md#用語集)

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

---

## アーキテクチャ

フォルダ構成とデータフローの正本。手順は [ローカル起動・Pages・Git](#ローカル起動pagesgit) / [ゲーム更新 Runbook](#ゲーム更新-runbook)。JSON 意味は [データ・スキーマ](#データスキーマ)。

## フォルダ構成

```
umamusume-sp-calc/
  README.md
  docs/                 # 入口は docs/README.md
  scripts/              # extract / verify / test / assets
  data/                 # JSON（extract 生成 + シナリオ手メンテ）
  assets/               # カード画像（supports / characters / type-icons）
  app/
    index.html
    css/style.css
    js/                 # UI・集計（app.js / aggregate.js 等）
```

主要スクリプト・モジュールの一覧はリポジトリ内の実ファイルを正とする。docs に長いツリーを複製しない。

## ランタイム構成

- **静的フロントのみ**（ビルドツール・フレームワークなし）
- ES modules（`type="module"`）
- `fetch` で `../data/*.json` を読むため、原則 **HTTP サーバー経由**で `app/` を配信

## データフロー

```text
master.mdb
    │ extract_mdb.mjs
    ▼
data/skills.json + supports.json + characters.json
    │
U-tools SSR + mdb ──► extract_support_events.mjs
    │                      │
    │                      ▼
    │               events.extracted.json
    │                      │ apply_extracted_events.mjs
    │                      │ (+ events.preserve.json)
    ▼                      ▼
data/events.json ──────────────┐
data/scenarios/toresenken.json ┤
    │                           │
    ▼                           ▼
app.js (loadJson) ──► buildSkillPlan(aggregate.js)
                          │
                          ├─ サポカ hintSkillIds → トレヒントLv
                          ├─ 育成ウマ娘所持スキル → Lv3
                          ├─ イベント / シナリオ → JSON hintLv
                          ├─ resolveHintLevels (max)
                          ├─ filterDisplaySkills / calcAcquisitionCost
                          └─ 継承オプション加算
                          ▼
                     合計SP + 行一覧
```

## モジュール責務

| ファイル | 責務 |
|----------|------|
| `spCost.js` | 割引テーブルと `calcSkillCost` |
| `hintResolve.js` | skillId → max hintLv + sources |
| `goldLower.js` | グループ内チェーン合算・表示フィルタ |
| `skillActivation.js` | 発動条件タグ・絞込 |
| `scenarioLink.js` | シナリオリンク白/金 |
| `aggregate.js` | 全由来のヒント収集と合計 |
| `copyIncludedSkills.js` | 含める ON 行のクリップボード書き出し |
| `designSnapshot.js` / `designMemory.js` | 設計メモリ |
| `cardAssets.js` | カード画像 URL |
| `app.js` | UI・JSON 読込・再計算 |

## 設計上の注意

- サポカ **トレヒントは mdb 自動**、**イベントスキルヒントは U-tools+mdb** — 混ぜない
- シナリオはトレセン軒固定
- ユーザー向け説明はヘッダー「使い方」`<dialog>`（`index.html`）。開発者向けは `docs/SPEC.md` 等

---

## U-tools パース

**対象**: `https://ウマ娘.tools/supports/{supportCardId}` の HTML（Next.js RSC）

## 取得経路

1. HTML 内の `self.__next_f.push([1,"..."])` を全件抽出
2. エスケープ解除（`\"` → `"`, `\n` → 改行）
3. 結合文字列から `"events":[` を bracket match で切り出し
4. `"skill":{...}` ネストを `"skill":null` に置換（`skillDesc` 内改行で JSON が壊れるため）
5. `JSON.parse` → `UToolsEvent[]`

## UToolsEvent（1イベント）

| フィールド | 型 | 備考 |
|-----------|-----|------|
| `id` | string | story_id 相当（例: `801087002`, `830304003`） |
| `title` | string | イベント表示名 |
| `supportCharaId` | number | サポカキャラ ID |
| `supportCardId` | number | カード固有イベントでは 0 のことが多い |
| `choices` | array | 選択肢 |

## choice / effect

```json
{
  "id": "801087002002",
  "text": "華麗な辻写りの極意が知りたい",
  "results": [{
    "effects": [
      { "type": 221, "val": 5, "skillId": null },
      { "type": 311, "val": 2, "skillId": 202042, "skill": { "...": "省略" } }
    ]
  }]
}
```

### スキルヒント判定

- **type `311`** かつ **`skillId` 非 null** → スキルヒント
- `val` = ヒント Lv
- ステータス系（101/201/221 等）は **捨てる**

## 変換後（本プロジェクト）

- ヒント無し choice / ヒント無し event は登録しない
- `normalizeEventSelection`（`event_selection.mjs`）で auto / single 化
- 安定 id: `evt_{supportCardId}_{storyId}`（storyId は U-tools `event.id`）
