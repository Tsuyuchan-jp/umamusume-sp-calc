# umamusume-sp-calc

ウマ娘プリティーダービー向け。育成完了時に「取得可能スキルをすべて取る」ための理論必要SPを算出するローカルツール。

## 使い方

### 1. データ抽出（ゲーム更新時）

```powershell
npm run extract
# またはパス指定
node scripts/extract_mdb.mjs --mdb "C:\path\to\master.mdb"
```

既定で次を順に探します。

1. `%USERPROFILE%\AppData\LocalLow\Cygames\umamusume\master\master.mdb`
2. `D:\DMM\umamusumeDMM\Umamusume\umamusume_Data\Persistent\master\master.mdb`
3. `D:\Umamusume\umamusume_Data\Persistent\master\master.mdb`

### 2. アプリ起動

`app` 配下をルートではなく、**リポジトリ直下**を配信します。

```powershell
npm run serve
```

ブラウザで http://localhost:8080/app/ を開く。

### 3. テスト

```powershell
npm test
```

## 機能

- 育成ウマ娘所持スキル（最大覚醒レベル想定・ヒントLv3）＋サポカ6枚（ヒントLv5）
- イベント／シナリオスキル選択式
- 金＋白コスト合算（実機検証済み）
- 切れ者トグル
- スキル除外
- 継承固有（汎用行・2〜6本・baseSp200・一律Lv）

## 構成

| パス | 内容 |
|------|------|
| `scripts/extract_mdb.mjs` | master.mdb → JSON |
| `data/` | skills / supports / characters / events / scenarios |
| `app/` | ブラウザUI |
| `docs/spec.md` | 仕様 |
| `docs/GLOSSARY.md` | 用語（育成ウマ娘所持スキル / 覚醒進化 など） |

## 更新フロー

1. ゲーム更新後に最新 `master.mdb` を用意
2. `npm run extract`
3. 必要なら `data/events.json` にイベントスキルを追記
4. `npm run bind-priority`（常用サポカID再紐付け）
