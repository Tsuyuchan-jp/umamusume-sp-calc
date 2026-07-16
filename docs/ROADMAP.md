# ロードマップ

ディスク上の実状態に基づく（2026-07-16 時点）。

用語は [GLOSSARY.md](./GLOSSARY.md) を参照。

## 完了

- [x] プロジェクト骨格（README, .gitignore, docs）
- [x] `scripts/extract_mdb.mjs` / `.py`（スキル / サポカ / 育成ウマ娘抽出）
- [x] **初回 extract 成功** — skills 2103 / supports 543 / characters 261（`data/meta.json`）
- [x] `scripts/test_sp.mjs` / `verify_data.mjs`
- [x] 計算コア: `spCost` / `hintResolve` / `goldLower` / `aggregate`
- [x] UI: 育成ウマ娘・6枠サポカ（検索・絞込・イベント対応のみデフォルトON）・切れ者・継承・イベント/シナリオ・除外・合計表示
- [x] `data/events.json` — 優先37サポカ・**102イベント**（U-tools+mdb 抽出正本 + preserve 2）
- [x] **イベント正本化 Phase F** — 抽出パイプライン・ゴールデン比較・`events.json` 置換（2026-07-14）
- [x] `data/scenarios/toresenken.json` — リンク白/金・RMJ自動計上・ラーメン3択・終了スキル（skillId 確定）
- [x] 常用デッキでのイベント表示・SP変化の実機確認
- [x] 育成ウマ娘所持スキル・白→金コストの実機確認（固有・覚醒進化はデータ源で自然に整合）
- [x] **常用デッキ＋シナリオ通し確認（実機）** — リンク白/金・RMJ・終了・イベント。問題・バグなし（2026-07）
- [x] 公開前レビュー High/Medium 対応（R01–R10）
- [x] GitHub Pages 向けデプロイ設定（workflow・ルートリダイレクト・`.nojekyll`）
- [x] **GitHub Pages 初回公開** — https://Tsuyuchan-jp.github.io/umamusume-sp-calc/app/ （スモークOK・2026-07）
- [x] **v0.1.3** — イベント U-tools 抽出正本化
- [x] **v0.1.4** — サポカ「イベント対応のみ」フィルタ（デフォルト ON）
- [x] **v0.1.5** — ユーザー向け説明書モーダル（ヘッダー「使い方」・`<dialog>`・5セクション・実機確認済み）
- [x] **v0.1.6** — 結果スキル発動条件タグ＋バ場／距離／作戦絞込による自動除外（`activation`・実機確認済み）
- [x] **v0.1.6（サイレント）** — 結果パネル見出し右にスキル数 ON/全件表示（実機確認済み）
- [x] **v0.1.7** — レギュ絞込の適用ボタン＋編成変更時の増分除外（draft/committed・実機確認済み）
- [x] **v0.1.8** — 含める ON スキル名のクリップボードコピー（カンマ区切り・継承除外・実機確認済み）
- [x] **v0.1.9** — オプション **トレヒントLv**（3/4/5・既定5・編成サポカ一括・実機確認済み）
- [x] **v0.1.10** — 継承固有をスキル数に個数分カウント（一覧1行のまま）

## 未完了 / 残作業

| 項目 | 状態 | メモ |
|------|------|------|
| UX 改善 | 任意 | 結果の由来表示、初期デッキ6枚化など。プリセットは当面スコープ外。※レギュ絞込適用ボタン v0.1.7・説明書 v0.1.5・発動条件タグ絞込 v0.1.6・スキル名コピー v0.1.8・トレヒントLv v0.1.9 で実装済み |
| 回帰テスト拡充 | 一部済 | デフォルト編成・リンク白/金・発動条件タグ絞込・トレヒントLvを `npm test` に追加（2026-07） |
| 表記ゆれ・名前マッチ | 必要時 | `verify_data.mjs` で検出したとき修正 |
| 既定 AppData の mdb | 無し | 再 extract は DMM パスを `--mdb` で指定 |
| Python 実体 / PATH | 注意 | WindowsApps スタブの可能性。再 extract は Node 推奨 |
| U-tools raw 再取得 | 運用 | ゲーム更新時は `extract:events`（ネットワーク or ローカルキャッシュ） |

## 不要と判断した作業（現行 extract のまま）

| 項目 | 理由 |
|------|------|
| 固有スキル本体の除外ロジック | `available_skill_set` に固有は含まれない（`skill_set` は別）。実機一致 |
| 覚醒進化の進化前金への置換 | 購入リストは進化前 ID のみ。進化後 ID は覚醒セットに 0 件 |
| 全539サポカイベント網羅 | mdb 単独でスキルヒント復元不可。U-tools 全件は運用・正本性の観点から撤回 |

将来、イベント/シナリオ JSON に進化後 ID を直書きした場合や extract 元を変えた場合は再検討。

## 推奨フェーズ（履歴）

### Phase A — 動かす ✅

1. mdb → extract
2. ローカルサーバーでアプリ表示
3. サポカトレヒント + 育成ウマ娘所持スキルで合計表示

### Phase B — データ充実 ✅

1. ~~`events.json` 優先サポカ拡充（+26種）~~ **済（2026-07・37種）**
2. ~~`toresenken.json` の RMJ / リンク / 終了具体化~~ **済**（自動計上＋ラーメン3択）
3. 名前マッチ漏れ・表記ゆれの修正 — **必要時**

### Phase C — 精度・運用 ✅（通し確認） / 継続（運用）

1. ~~常用デッキ + シナリオの通し確認~~ **済**（実機 OK・バグなし）
2. 金+白の実機例を別スキルでも再確認（回帰: `npm test`）— 任意拡充
3. ゲーム更新時の mdb 再 extract 手順の定着 — **済**（[GAME_UPDATE_RUNBOOK.md](./GAME_UPDATE_RUNBOOK.md)）

### Phase D — UX（任意）

1. ~~インアプリ説明書（ヘッダー「使い方」モーダル）~~ **済**（2026-07・実機 OK）
2. ~~結果スキル絞込（バ場／距離／作戦・発動条件タグ）~~ **済**（v0.1.6・実機 OK）
3. ~~結果パネルスキル数表示（ON/全件）~~ **済**（v0.1.6 サイレント・実機 OK）
4. ~~レギュ絞込の適用ボタン＋デッキ変更連動~~ **済**（v0.1.7・実機 OK）
5. 結果表の由来表示強化
6. 初期値を常用デッキ6枚に揃える
7. （需要が明確なら）プリセット — 現状スコープ外

### Phase E — 公開 ✅

1. ~~デプロイ先選定（GitHub Pages）~~ **済**
2. ~~workflow・ルートリダイレクト~~ **済**
3. ~~GitHub へ push~~ **済**（`Tsuyuchan-jp/umamusume-sp-calc`）
4. ~~README を公開利用者向けに整理・確定 URL 記載~~ **済**
5. ~~Pages デプロイ＋本番スモークテスト~~ **済**

### Phase F — イベント正本化（優先37のみ）✅

| 段階 | 状態 |
|------|------|
| 抽出パイプライン + ゴールデン比較 | **完了**（2026-07-14） |
| `events.json` 置換 + `events.id-aliases.json` | **完了**（2026-07-14） |

成果物: `extract_support_events.mjs`, `apply_extracted_events.mjs`, `compare_events_golden.mjs`, `npm run extract:events` / `apply:events` / `compare:events`。  
U-tools パース: [UTOOLS_EVENT_PARSE.md](./UTOOLS_EVENT_PARSE.md)。設計: [EVENT_EXTRACT_DESIGN.md](./EVENT_EXTRACT_DESIGN.md)

## スコープ外（当面やらない）

- トレセン軒以外のシナリオ
- **全サポカのイベント網羅**（優先37のみ）
- 継承固有の個別名前・親指定
- 常用デッキのクイック選択プリセット
- Electron / クラウドホスト必須化（※ GitHub Pages での静的公開は実施）
- U-tools を CI に載せる（ローカル手動運用）
