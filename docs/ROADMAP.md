# ロードマップ

ディスク上の実状態に基づく（2026-07 時点）。

用語は [GLOSSARY.md](./GLOSSARY.md) を参照。

## 完了

- [x] プロジェクト骨格（README, .gitignore, docs）
- [x] `scripts/extract_mdb.mjs` / `.py`（スキル / サポカ / 育成ウマ娘抽出）
- [x] **初回 extract 成功** — skills 2103 / supports 543 / characters 261（`data/meta.json`）
- [x] `scripts/test_sp.mjs` / `verify_data.mjs`
- [x] 計算コア: `spCost` / `hintResolve` / `goldLower` / `aggregate`
- [x] UI: 育成ウマ娘・6枠サポカ（検索・絞込）・切れ者・継承・イベント/シナリオ・除外・合計表示
- [x] `data/events.json` — 優先11サポカ・32イベント（`auto` / `single`、実機確認済み）
- [x] `data/scenarios/toresenken.json` — リンク白/金・RMJ自動計上・ラーメン3択・終了スキル（skillId 確定）
- [x] 常用デッキでのイベント表示・SP変化の実機確認
- [x] 育成ウマ娘所持スキル・白→金コストの実機確認（固有・覚醒進化はデータ源で自然に整合）
- [x] **常用デッキ＋シナリオ通し確認（実機）** — リンク白/金・RMJ・終了・イベント。問題・バグなし（2026-07）
- [x] 公開前レビュー High/Medium 対応（R01–R10）
- [x] GitHub Pages 向けデプロイ設定（workflow・ルートリダイレクト・`.nojekyll`）
- [x] **GitHub Pages 初回公開** — https://AkatsukiTanaka.github.io/umamusume-sp-calc/app/ （スモークOK・2026-07）

## 未完了 / 残作業

| 項目 | 状態 | メモ |
|------|------|------|
| UX 改善 | 任意 | 結果の由来表示、初期デッキ6枚化など。プリセットは当面スコープ外 |
| 回帰テスト拡充 | 一部済 | デフォルト編成・リンク白/金を `npm test` に追加（2026-07） |
| 表記ゆれ・名前マッチ | 必要時 | `verify_data.mjs` で検出したとき修正 |
| 既定 AppData の mdb | 無し | 再 extract は DMM パスを `--mdb` で指定 |
| Python 実体 / PATH | 注意 | WindowsApps スタブの可能性。再 extract は Node 推奨 |

## 不要と判断した作業（現行 extract のまま）

| 項目 | 理由 |
|------|------|
| 固有スキル本体の除外ロジック | `available_skill_set` に固有は含まれない（`skill_set` は別）。実機一致 |
| 覚醒進化の進化前金への置換 | 購入リストは進化前 ID のみ。進化後 ID は覚醒セットに 0 件 |

将来、イベント/シナリオ JSON に進化後 ID を直書きした場合や extract 元を変えた場合は再検討。

## 推奨フェーズ

### Phase A — 動かす ✅

1. mdb → extract
2. ローカルサーバーでアプリ表示
3. サポカ訓練ヒント + 育成ウマ娘所持スキルで合計表示

### Phase B — データ充実 ✅

1. ~~`events.json` 優先11サポカ~~ **済**
2. ~~`toresenken.json` の RMJ / リンク / 終了具体化~~ **済**（自動計上＋ラーメン3択）
3. 名前マッチ漏れ・表記ゆれの修正 — **必要時**

### Phase C — 精度・運用 ✅（通し確認） / 継続（運用）

1. ~~常用デッキ + シナリオの通し確認~~ **済**（実機 OK・バグなし）
2. 金+白の実機例を別スキルでも再確認（回帰: `npm test`）— 任意拡充
3. ゲーム更新時の mdb 再 extract 手順の定着 — パッチ時

### Phase D — UX（任意）

1. 結果表の由来表示強化
2. 初期値を常用デッキ6枚に揃える
3. （需要が明確なら）プリセット — 現状スコープ外

### Phase E — 公開 ✅

1. ~~デプロイ先選定（GitHub Pages）~~ **済**
2. ~~workflow・ルートリダイレクト~~ **済**
3. ~~GitHub へ push~~ **済**（`AkatsukiTanaka/umamusume-sp-calc`）
4. ~~README を公開利用者向けに整理・確定 URL 記載~~ **済**
5. ~~Pages デプロイ＋本番スモークテスト~~ **済**（合計SP表示・サポカ変更・ルート→/app/・スマホ幅）

## スコープ外（当面やらない）

- トレセン軒以外のシナリオ
- 全サポカのイベント網羅
- 継承固有の個別名前・親指定
- 常用デッキのクイック選択プリセット
- Electron / クラウドホスト必須化（※ GitHub Pages での静的公開は実施）
