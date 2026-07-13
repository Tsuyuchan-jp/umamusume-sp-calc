# 開発・セットアップ

## 前提

- Windows（本プロジェクトの作業環境）
- ブラウザ（Chrome / Edge 等）
- Python 3（mdb 抽出と簡易 HTTP サーバー用）
- DMM/Steam 版ウマ娘の `master.mdb`（抽出時）

## 1. リポジトリ

```powershell
cd C:\Users\PC1\Projects\umamusume-sp-calc
```

既にファイルがある。Git 未初期化なら:

```powershell
git init
```

## 2. master.mdb 抽出

**推奨（実績あり）: Node.js** — Python PATH 問題を回避できる。

```powershell
node scripts/extract_mdb.mjs
# または
node scripts/extract_mdb.mjs --mdb "D:\DMM\umamusumeDMM\Umamusume\umamusume_Data\Persistent\master\master.mdb"
```

`extract_mdb.mjs` は次を順に探す: AppData 既定 → DMM Persistent → `D:\Umamusume\...`

Python 版（PATH に実体がある場合）:

```powershell
python scripts/extract_mdb.py --mdb "D:\DMM\umamusumeDMM\Umamusume\umamusume_Data\Persistent\master\master.mdb"
```

成功すると `data/skills.json`, `supports.json`, `characters.json`, `meta.json` が生成される（初回 extract 済みなら上書き更新）。

検証ヘルパー:

```powershell
node scripts/verify_data.mjs
node scripts/test_sp.mjs
```

ゲームパッチ後は再実行。`events.json` / `toresenken.json` は上書きされない。

## 3. ローカルサーバー

`file://` だと `fetch` が失敗することがある。

```powershell
cd C:\Users\PC1\Projects\umamusume-sp-calc\app
python -m http.server 8080
```

ブラウザ: http://localhost:8080

Python が無い場合の代替例:

```powershell
npx --yes serve -l 8080
```

（Node が入っている場合）

## Python / py が PATH に無いとき

過去作業で `python` / `py` が見つからず extract が止まった。

### 確認

```powershell
where.exe python
where.exe py
where.exe python3
Get-Command python, py, python3 -ErrorAction SilentlyContinue
```

### 対処

1. [python.org](https://www.python.org/downloads/) から Python 3 をインストール
2. インストーラで **「Add python.exe to PATH」** にチェック
3. ターミナルを開き直して再確認
4. Microsoft Store のスタブだけが入っている場合は、実体の Python を入れるか Store スタブを無効化
5. `py` ランチャーのみの環境なら: `py -3 scripts/extract_mdb.py`

### master.mdb が無いとき

1. 既定パスを確認:  
   `%USERPROFILE%\AppData\LocalLow\Cygames\umamusume\master\master.mdb`
2. 無ければクライアントでデータダウンロード完了を確認
3. 見つかったパスを `--mdb` で渡す

## Git コミット方針（必須）

このプロジェクトでは作業のたびにコミットする（ユーザー規則）。

PowerShell（`&&` 禁止）:

```powershell
git add .
git commit -m "feat: 変更内容の要約"
```

- 例: `feat:` / `fix:` / `chore:` / `docs:`
- **push は明示依頼時のみ**
- 秘密情報（`.env` 等）はコミットしない

## エージェント / チャット運用

次にやることが決まっているとき、エージェントは **実装着手前に推奨言語モデル（4択）を提示する**（Quota 節約優先）。  
詳細: [MODEL_SELECTION.md](./MODEL_SELECTION.md) / `.cursor/rules/model-recommendation.mdc`

## よくある失敗

| 症状 | 原因 | 対処 |
|------|------|------|
| ロードエラー | skills 等が無い | extract 実行 |
| CORS / fetch 失敗 | file:// で開いた | http.server 使用 |
| `python` 不明 | PATH | 上記トラブルシュート |
| イベントが効かない | skillId/名前不一致 or サポカ未選択 | events.json とデッキを確認 |
