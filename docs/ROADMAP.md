# ロードマップ

日次キューは [TODO.md](./TODO.md)。版ごとの履歴は [CHANGELOG.md](./CHANGELOG.md) が正本。  
docs 入口: [README.md](./README.md)。

## 未完了 / 残作業

| 項目 | 状態 | メモ |
|------|------|------|
| UX 改善 | 進行中 | [TODO.md](./TODO.md)。画像（サポカ縦40＋育成全264）済。由来・初期6枚・スクショ・質感パスは Open |
| 回帰テスト拡充 | 一部済 | デフォルト編成・リンク白/金・発動条件タグ絞込・トレヒントLvを `npm test` に追加済み。実機ケースの追加は任意 |
| 表記ゆれ・名前マッチ | 必要時 | `verify_data.mjs` で検出したとき修正 |
| 既定 AppData の mdb | 無し | 再 extract は DMM パスを `--mdb` で指定 |
| Python 実体 / PATH | 注意 | WindowsApps スタブの可能性。再 extract は Node 推奨 |
| U-tools raw 再取得 | 運用 | ゲーム更新時は `extract:events`（[GAME_UPDATE_RUNBOOK.md](./GAME_UPDATE_RUNBOOK.md)） |
| v1.0.0 公開準備 | 条件付き | UX 残りが閉じたあと。それまで push しない |

## 不要と判断した作業（現行 extract のまま）

| 項目 | 理由 |
|------|------|
| 固有スキル本体の除外ロジック | `available_skill_set` に固有は含まれない（`skill_set` は別）。実機一致 |
| 覚醒進化の進化前金への置換 | 購入リストは進化前 ID のみ。進化後 ID は覚醒セットに 0 件 |
| 全サポカイベント網羅 | mdb 単独でスキルヒント復元不可。U-tools 全件は運用・正本性の観点から撤回 |

将来、イベント/シナリオ JSON に進化後 ID を直書きした場合や extract 元を変えた場合は再検討。

## スコープ外（当面やらない）

- トレセン軒以外のシナリオ
- **全サポカのイベント網羅**（優先枠のみ・新規は課金必須 SSR 原則）
- 継承固有の個別名前・親指定
- 常用デッキのクイック選択プリセット
- Electron / クラウドホスト必須化（※ GitHub Pages での静的公開は実施）
- U-tools を CI に載せる（ローカル手動運用）
- `piece_icon` を育成表示に採用すること
- 縁色引き伸ばし等の低品質近似枠（サポカ）

## 補足

- イベント正本化・Phase 履歴の設計メモ: [archive/EVENT_EXTRACT_DESIGN.md](./archive/EVENT_EXTRACT_DESIGN.md)
- U-tools パース: [UTOOLS_EVENT_PARSE.md](./UTOOLS_EVENT_PARSE.md)
- 画像方針: [ASSETS.md](./ASSETS.md)
