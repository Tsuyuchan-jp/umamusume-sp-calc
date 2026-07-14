# umamusume-sp-calc

ウマ娘プリティーダービー向け。育成完了時に「取得可能スキルをすべて取る」ための**理論必要 SP** をブラウザで算出するツールです。

## 使う（公開版）

**インストール不要。** 次の URL をブラウザで開くだけです。

**https://Tsuyuchan-jp.github.io/umamusume-sp-calc/app/**

| 項目 | URL |
|------|-----|
| アプリ入口 | https://Tsuyuchan-jp.github.io/umamusume-sp-calc/app/ |
| リポジトリ直下 | https://Tsuyuchan-jp.github.io/umamusume-sp-calc/ → `/app/` へ自動移動 |
| ソース | https://github.com/Tsuyuchan-jp/umamusume-sp-calc |

### 制限事項（告知用）

> ウマ娘 SP 計算ツール（**v0.1.7**）。**トレセン軒シナリオのみ**・**ガチ想定**（クラシック大盛況・シニア超盛況・育成終了スキル固定）・**優先37サポカのイベント**対応（U-tools+mdb 抽出正本）。ゲーム更新後はデータが古くなる場合があります。非公式・非商用です。

### 使い方の流れ

1. 育成ウマ娘を選ぶ（初期値あり）
2. サポカを最大6枚選ぶ（初期は**イベント対応37種**に絞込。全件表示は「イベント対応のみ」を外す）
3. イベント／シナリオ（リンク・ラーメン等）を必要なら調整
4. 画面下部の**合計 SP**を確認（除外・切れ者・継承固有も可）
5. 対人レギュ向けに、結果の**バ場／距離／作戦**絞込で合わないスキルを自動除外できる

わからないときは、画面上部ヘッダー右の **「使い方」** から説明書（ヒントLvの算出・よくある疑問など）を開けます。

## 注意

- **シナリオはトレセン軒のみ**（当面固定）
- **シナリオスキルはガチ想定** — 盛況段階の切替はなし（常に大盛況／超盛況＋終了を計上）
- **イベントは優先37サポカ** — 全サポカ網羅ではない（[一覧](docs/PRIORITY_SUPPORTS.md)）
- HTML をローカルでダブルクリックしても動きません（公開 URL か、開発者向けの HTTP 配信が必要）

## 機能

- 育成ウマ娘所持スキル（最大覚醒レベル想定・ヒントLv3）＋サポカ6枚（ヒントLv5）
- サポカ絞込（イベント対応のみ・デフォルトON、SSR、タイプ、検索）
- 結果スキル絞込（バ場／距離／作戦・発動条件タグ表示・自動除外）
- 結果パネルスキル数表示（ON/全件）
- イベント／シナリオスキル選択式
- 金＋白コスト合算（実機検証済み）
- 切れ者トグル・スキル除外
- 継承固有（汎用行・2〜6本・baseSp200・一律Lv）
- ヘッダー **「使い方」** 説明書モーダル（ヒントLv・FAQ・制限事項）

## 開発者向け

ローカル起動・データ再抽出・イベント再生成・テスト・GitHub Pages の技術メモは [docs/DEV.md](docs/DEV.md) を参照。  
**ゲーム本パッチ後のデータ更新手順**は [docs/GAME_UPDATE_RUNBOOK.md](docs/GAME_UPDATE_RUNBOOK.md) を参照。

用語は [docs/GLOSSARY.md](docs/GLOSSARY.md)、仕様は [docs/spec.md](docs/spec.md)。  
更新履歴は [docs/CHANGELOG.md](docs/CHANGELOG.md)。  
イベント対応サポカ37種の一覧は [docs/PRIORITY_SUPPORTS.md](docs/PRIORITY_SUPPORTS.md)（JSON: [data/priority-supports.json](data/priority-supports.json)）。

## フィードバック

不具合や要望は [GitHub リポジトリ](https://github.com/Tsuyuchan-jp/umamusume-sp-calc) をご参照ください。あわせて、製作者の [note](https://note.com/limber_alpaca292) や [X（DM）](https://x.com/tsuyurasu) からもお知らせいただけます。

## 免責

本ツールは非公式です。ゲームデータ・名称等の権利は各権利者に帰属します。
