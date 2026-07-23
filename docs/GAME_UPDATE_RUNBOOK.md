# ゲーム更新時の運用チェックリスト

ウマ娘クライアントがパッチされ **`master.mdb` が更新されたあと**、このリポジトリの JSON と公開サイトを追随させる手順です。

**目的**: スキル・サポカ・育成ウマ娘のトレヒントと、優先38サポカのイベントデータを最新化し、回帰テストと実機確認のうえ本番（GitHub Pages）へ反映する。

詳細仕様は [DATA.md](./DATA.md)・[EVENT_EXTRACT_DESIGN.md](./EVENT_EXTRACT_DESIGN.md) を参照。このファイルは **作業順の正本** とする。

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

# 2. サポカイベント（優先38・U-tools + mdb）
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
git commit -m "chore: ゲーム更新に伴うデータ再 extract（2026-07-14）"
git push
```

push 後:

1. GitHub Actions の **Deploy GitHub Pages** が成功するか確認
2. https://Tsuyuchan-jp.github.io/umamusume-sp-calc/app/ でヘッダー版と合計 SP をスモーク

Pages が失敗するときは **Settings → Pages → Source = GitHub Actions** を確認（[DEV.md](./DEV.md) 参照）。

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
```

---

## よくあるトラブル

| 症状 | 原因 | 対処 |
|------|------|------|
| `master.mdb が見つかりません` | パス未設定・DL未完了 | `--mdb` で DMM Persistent を指定 |
| `extract:events` がネットワークエラー | U-tools 未取得 | ネット接続後に再実行。または既存キャッシュで `--cache-only` |
| `compare:events` で旧11 conflict | 抽出と実機/U-tools の差 | `events.diff-report.json` を読み、preserve / overrides を検討 |
| アプリがロードエラー | JSON 欠損 | `npm run extract` |
| fetch 失敗（ローカル） | `file://` または `app/` のみ配信 | リポジトリ直下で `npm run serve` → `/app/` |
| イベントが効かない | skillId 不一致・サポカ未選択 | デッキと `events.json` を確認 |
| Pages デプロイ Not Found | Pages Source 未設定 | GitHub Settings → Pages → GitHub Actions |

---

## 関連ドキュメント

| ファイル | 内容 |
|----------|------|
| [DEV.md](./DEV.md) | 開発環境・serve・Pages 設定 |
| [DATA.md](./DATA.md) | JSON 各ファイルの役割・mdb テーブル |
| [EVENT_EXTRACT_DESIGN.md](./EVENT_EXTRACT_DESIGN.md) | イベント抽出の設計・Phase B |
| [UTOOLS_EVENT_PARSE.md](./UTOOLS_EVENT_PARSE.md) | U-tools SSR のパース仕様 |
| [AGENT_HANDOFF.md](./AGENT_HANDOFF.md) | エージェント向け最短ブリーフ |
| [CHANGELOG.md](./CHANGELOG.md) | 公開版の変更履歴（データ更新も記録推奨） |
| [PRIORITY_SUPPORTS.md](./PRIORITY_SUPPORTS.md) | イベント対応サポカ38種の一覧 |

データ更新を公開したら、`CHANGELOG.md` に `### 変更` で件数やパッチ日を1行追記しておくと後から追いやすい。
