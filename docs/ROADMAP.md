# ロードマップ

ディスク上の実状態に基づく（2026-07 時点の確認）。

## 完了

- [x] プロジェクト骨格（README, .gitignore, docs）
- [x] `scripts/extract_mdb.mjs` / `.py`（スキル / サポカ / ウマ娘抽出）
- [x] **初回 extract 成功**（Node 実績）— skills 2078 / supports 539 / characters 258（`data/meta.json`）
  - ソース: `D:\DMM\umamusumeDMM\Umamusume\umamusume_Data\Persistent\master\master.mdb`
- [x] `scripts/test_sp.mjs` / `verify_data.mjs`
- [x] 計算コア: `spCost` / `hintResolve` / `goldLower` / `aggregate`
- [x] UI: ウマ娘・6枠サポカ・切れ者・継承・イベント/シナリオ選択・除外・合計表示
- [x] `data/events.json` 枠組み + たづな stubs（2イベント）
- [x] `data/scenarios/toresenken.json` 初版（リンク・盛況・終了など）
- [x] 引き継ぎドキュメント一式（本 ROADMAP 含む）

## 未完了 / ブロッカー

| 項目 | 状態 | メモ |
|------|------|------|
| 優先11サポカのイベント記入 | **1/11** | たづなのみ stubs。残り10枚が主作業 |
| シナリオ `skillId` 埋め | ほぼ未 | 名前マッチ依存。skills.json から補完推奨 |
| ブラウザ通し確認 | 未確認 | http.server で合計表示を目視 |
| Python 実体 / PATH | 注意 | WindowsApps スタブの可能性。再 extract 時に要確認 |
| 既定 AppData の mdb | 無し | 再 extract は DMM パスを `--mdb` で指定 |
| 進化スキルの厳密な除外/置換 | 方針のみ | 実データでスポット検証 |
| 固有スキル本体の除外 | 方針のみ | 実データで固有判定を確認 |

## 推奨フェーズ

### Phase A — 動かす（ほぼ完了）

1. ~~mdb 発見 → extract~~ **済**
2. `python -m http.server`（または代替）でアプリ表示確認 ← **残り**
3. サポカ訓練ヒント + 覚醒だけで合計が出ることを確認 ← **残り**

### Phase B — データ充実（次の主戦場）

1. `events.json` に優先サポカ 2〜11 のイベントスキルを追加
2. `toresenken.json` の `skillId` を skills.json から埋める
3. 名前マッチ漏れ・表記ゆれを修正

### Phase C — 精度

1. 固有本体が合計に混ざっていないか検証
2. 進化スキルが進化前金で計上されているか検証
3. 金+白の実機例を別スキルでも再確認
4. 必要なら UI/UX 改善（検索、プリセットデッキ等）

## スコープ外（当面やらない）

- トレセン軒以外のシナリオ
- 全サポカのイベント網羅
- 継承固有の個別名前・親指定
- Electron / クラウドホスト必須化
