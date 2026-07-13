# ロードマップ

ディスク上の実状態に基づく（2026-07 時点）。

用語は [GLOSSARY.md](./GLOSSARY.md) を参照。

## 完了

- [x] プロジェクト骨格（README, .gitignore, docs）
- [x] `scripts/extract_mdb.mjs` / `.py`（スキル / サポカ / 育成ウマ娘抽出）
- [x] **初回 extract 成功** — skills 2078 / supports 539 / characters 258（`data/meta.json`）
- [x] `scripts/test_sp.mjs` / `verify_data.mjs`
- [x] 計算コア: `spCost` / `hintResolve` / `goldLower` / `aggregate`
- [x] UI: 育成ウマ娘・6枠サポカ（検索・絞込）・切れ者・継承・イベント/シナリオ・除外・合計表示
- [x] `data/events.json` — 優先11サポカ・33イベント（`auto` / `single`、実機確認済み）
- [x] `data/scenarios/toresenken.json` 初版（リンク・盛況・終了など）
- [x] 常用デッキでのイベント表示・SP変化の実機確認
- [x] 育成ウマ娘所持スキル・白→金コストの実機確認（固有・覚醒進化はデータ源で自然に整合）

## 未完了 / 残作業

| 項目 | 状態 | メモ |
|------|------|------|
| トレセン軒 RMJ 盛況スキル | **プレースホルダ** | `選択金スキル` の skillId 未確定。要手メンテ or UI |
| シナリオ通し確認 | 一部 | リンク・終了は skillId 済み。RMJ ON/OFF の実機目視は残り |
| 既定 AppData の mdb | 無し | 再 extract は DMM パスを `--mdb` で指定 |
| Python 実体 / PATH | 注意 | WindowsApps スタブの可能性 |

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

### Phase B — データ充実 ✅（イベント） / 進行中（シナリオ）

1. ~~`events.json` 優先11サポカ~~ **済**
2. `toresenken.json` の RMJ 盛況スキル具体化
3. 名前マッチ漏れ・表記ゆれの修正

### Phase C — 精度・運用

1. 常用デッキ + シナリオリンクの通し確認
2. 金+白の実機例を別スキルでも再確認（回帰: `npm test`）
3. ゲーム更新時の mdb 再 extract 手順の定着

## スコープ外（当面やらない）

- トレセン軒以外のシナリオ
- 全サポカのイベント網羅
- 継承固有の個別名前・親指定
- 常用デッキのクイック選択プリセット
- Electron / クラウドホスト必須化
