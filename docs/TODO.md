# TODO — 作業キュー（人間・AI 共用）

このファイルは **今やる／次にやる作業** の正本です。  
会話のたびに古くなる「口頭の次ステップ」より、ここを優先してください。

関連:
- docs 入口 → [README.md](./README.md)
- 状態・ルールのブリーフ → [AGENT_HANDOFF.md](./AGENT_HANDOFF.md)
- 仕様 → [spec/](./spec/)
- 運用 → [ops/](./ops/)
- 公開履歴 → [CHANGELOG.md](./CHANGELOG.md)

---

## 使い方

| 誰 | やること |
|----|----------|
| **人間** | 優先度・受け入れ条件・「やらない」を更新する。作業指示は原則このファイルを指す |
| **AI** | 着手前に本ファイルを読む。完了したら該当項目を `[x]` にし、メモを1行残す。新規タスクは末尾ではなく優先度に挿入 |
| **両方** | 完了済みは「最近完了」へ移し、Open を短く保つ（目安: Open は 15 件以内） |

### ステータス記号

- `[ ]` 未着手
- `[~]` 進行中（誰が・何を、を括弧で書く）
- `[x]` 完了（日付 `YYYY-MM-DD` を付ける）
- `[!]` ブロック中（理由必須）

### 優先度

| 印 | 意味 |
|----|------|
| **P0** | 今スプリントで必ず進める |
| **P1** | 次に着手（P0の直後） |
| **P2** | 余裕があれば／需要が明確なら |
| **P3** | 控える・条件付き |

---

## 現在フォーカス（1行）

**P0 見た目** — 芝・幾何・左ゾーン済。ヘッダーは比較モックで選定待ち（[product/mockups/header-options.html](./product/mockups/header-options.html)）。

---

## Open

### P0

- [ ] **ヘッダー安定化＋見た目刷新** — 選定中（H-Mock / H-A / H-B / H-C）。比較: [product/mockups/header-options.html](./product/mockups/header-options.html)

### P1

- [ ] **結果作業台の見た目パリティ** — 含めるトグル・レギュ絞込等。列／要件は維持（backlog #2）
- [ ] **カードピッカー刷新** — 推奨（P-A＋薄い P-B）で実装。見たあと別案可（backlog #4）

- [ ] **育成 dress 流用カードのスポット目視**（任意だが短い）  
  - `chr_icon` が dress フォールバックのカードで、ピッカー上の衣装が明らかにおかしいものがないか数枚確認

### P2

- [ ] **style.css 旧色・旧ウェイト掃除** — foundation 後勝ちで見た目は済。メンテ用 chore
- [ ] **継承パラメータ編集UI**（個数・Lv・baseSp）— バー内インラインは崩れのため保留。案を再検討してから

- [ ] **編成スクショ機能**  
  - メモリ（localStorage）は済。共有用の画像書き出しは未着手  
  - 受け入れ: 上段編成を1枚に保存／コピーできる

- [ ] **タイプ印位置の最終微調整**（ユーザー指示があったときだけ）  
  - 現行: size=52 / top=-1 / right=4（[ops/ASSETS.md](./ops/ASSETS.md)）

- [ ] **回帰テスト拡充** — 実機で確認したケースを `npm test` に追加

### P3 / 条件付き

- [ ] **30307 / 30308 の U-tools 化**  
  - 条件: U-tools にキセキ（巻頭カラーの夏）・アーモンドアイ（夏空チルタイム）が掲載されたら  
  - 手順: `npm run extract:events` → `compare:events` → `apply:events` のあと、`events.preserve.json` から GameWith 一時手載せ6件（`evt_30307_*` / `evt_30308_*`）を削除。docs の件数・注記も更新  
  - 関連: [ops/GAME_UPDATE_RUNBOOK.md](./ops/GAME_UPDATE_RUNBOOK.md) / events preserve

- [ ] **v1.0.0 公開準備** — UX 残りが閉じたあと。CHANGELOG・README・**初 push / Pages 反映**  
  - 制約: それまで `git push` しない（[ops/ASSETS.md](./ops/ASSETS.md) / [ops/GAME_UPDATE_RUNBOOK.md](./ops/GAME_UPDATE_RUNBOOK.md)）

- [ ] **ゲーム更新追従** — 発生時のみ [ops/GAME_UPDATE_RUNBOOK.md](./ops/GAME_UPDATE_RUNBOOK.md)（mdb → events → assets:extract/import → verify）

---

## 最近完了（直近のみ残す）

- [x] 2026-08-02 **世界観背景に芝**・**幾何タイル bg.webp**・**スプリット左ゾーン分け**
- [x] 2026-08-02 **ヘッダー比較モック** — [product/mockups/header-options.html](./product/mockups/header-options.html)（選定待ち）
- [x] 2026-08-02 **実機デザイン指摘6点を backlog 化**
- [x] 2026-08-02 **B方針確定**・UI Round 1・デュアル骨格OK・スプリット足元／H1・ギャップ調査・FB反映・移植
- [x] 2026-08-02 Visual Foundation／質感パス／モック v1〜H5
- [x] 2026-08-01 由来表示・ピッカー検索・初期デッキ・docs・サポカ縦カード・育成264

---

## やらない（TODO に上げない）

### スコープ外（当面）

- トレセン軒以外のシナリオ
- **全サポカのイベント網羅**（優先枠のみ・新規は課金必須 SSR 原則）
- 継承固有の個別名前・親指定
- 常用デッキのクイック選択プリセット
- Electron / クラウドホスト必須化（※ GitHub Pages 静的公開は実施）
- U-tools を CI に載せる（ローカル手動運用）
- `piece_icon` を育成表示に採用すること
- 縁色引き伸ばし等の低品質近似枠（サポカ）

### 不要と判断した作業（現行 extract のまま）

| 項目 | 理由 |
|------|------|
| 固有スキル本体の除外ロジック | `available_skill_set` に固有は含まれない。実機一致 |
| 覚醒進化の進化前金への置換 | 購入リストは進化前 ID のみ |
| 全サポカイベント網羅 | mdb 単独でスキルヒント復元不可 |

### 運用メモ（Open に上げない）

| 項目 | メモ |
|------|------|
| 表記ゆれ・名前マッチ | `verify_data.mjs` で検出したとき修正 |
| 既定 AppData の mdb | 無し。DMM パスを `--mdb` で指定 |
| Python / PATH | 再 extract は Node 推奨 |

---

## AI 向けチェックリスト（タスク完了時）

1. Open の該当行を `[x]` にし、日付を付ける → 「最近完了」へ移動（Open から削除）
2. コード変更があればコミット（`feat`/`fix`/`chore`、push しない）
3. 受け入れ条件が残っていれば人間確認待ちとして `[~]` か Open に明示
4. 次フォーカスが変わったら「現在フォーカス」を1行で更新
