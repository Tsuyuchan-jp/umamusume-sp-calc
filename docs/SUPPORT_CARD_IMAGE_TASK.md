# タスク起票: サポカ縦カード画像の高品質生成

新チャット継続用ブリーフ（2026-08-01）。  
**本ファイルを読んでから着手すること。**

関連: [ASSETS.md](./ASSETS.md) / [UX_PHILOSOPHY.md](./UX_PHILOSOPHY.md) / [AGENT_HANDOFF.md](./AGENT_HANDOFF.md)

---

## 1. ゴール

編成UI向けに、**ゲームのサポカ縦サムネに十分近い見た目**の画像を用意する。

- 対象: 優先サポカ40種（`data/priority-supports.json` の `id`）
- 出力規約（既存）: `assets/supports/{supportCardId}.webp`
- UI: `app/js/cardAssets.js` が URL 組み立て。欠落時はプレースホルダ
- **push / Pages 反映は v1.0.0 までしない**（ローカルコミットのみ）

### 非ゴール（やらない）
- 自前合成の低品質版を本番 `assets/` に載せる
- 攻略サイト画像の直リンク常時依存（[ASSETS.md](./ASSETS.md) 不採用）
- 全547サポカの網羅（Phase1は優先40）
- 育成ウマ娘画像の本改修（別途。現状は `piece_icon` / `chr_icon` 問題あり）

---

## 2. プロダクト文脈

- アプリ: ウマ娘 SP 計算機（ガチ層向け。近似計上しない）
- 画面: 二段構え。上段が編成ダッシュボード（視覚選択）
- 画像は「組み立てを速くする」ためのもの。計算結果には影響しない
- 現状: 優先40 + 育成107703 を `support_card_s`（**256×256正方形**）で同梱済み。表示自体は実機OK

ユーザー要望の変遷:
1. 正方形小カードでは物足りない → 縦長が欲しい
2. 参照: ゲーム編成画面の縦カード / [support-card-sp/img](https://github.com/Aston-Ma-chan/support-card-sp/tree/main/img) 風
3. 自前合成 v2 は **品質NG（本番不可）** と判定
4. 急がない・Quota余裕 → **高品質合成の再挑戦**を希望

---

## 3. 重要な技術事実（調査済み・崩さない）

### ゲーム内に「縦長完成カード」は無い
各サポカは実質この3つ（正方形）:
| アセット | 寸法 | 用途目安 |
|----------|------|----------|
| `supportcard/support{ID}/support_card_s_{ID}` | 256×256 | 枠・SSR等焼き付き小アイコン（**現行同梱**） |
| `.../support_thumb_{ID}` | 512×512 | 枠なし寄り |
| `.../tex_support_card_{ID}` | 2048×2048 | フルイラスト |

- 縦長に近いのは一部のみ `announce/.../support_announce_{ID}`（1024×2048・ガチャ告知）。全40非対応
- GitHub support-card-sp の `img/` は **160×213・連番**でゲームID直結ではない。クライアント直出しではない

### ゲーム画面の縦カードはランタイム合成と推定
正方形イラストを縦クロップし、SSR・タイプ・凸などを UI スプライトで重ねている可能性が高い。

### 抽出環境（このPC）
- DAT: `D:\DMM\umamusumeDMM\Umamusume\umamusume_Data\Persistent\dat`
- meta: Persistent の `meta` は暗号化。復号済みは `.cache/umamusu-utils-old-jp/storage/` 配下
- Python: システムPATH不可。`.cache/umamusu-utils-old-jp/.venv/Scripts/python.exe` を使う
- `.cache/` は gitignore

---

## 4. 失敗した合成（v1/v2）— 繰り返さないこと

スクリプト:
- `scripts/make_vertical_support_samples.py`（v1比較）
- `scripts/make_vertical_support_samples_v2.py`（v2）

やっていたこと（非エンジニア向け）:
1. `tex` を縦3:4クロップ
2. 共有マスクで角丸（汚く見えた）
3. 虹枠が無いので `support_card_s` の**縁色を引き伸ばし**（品質低い）
4. SSRを `support_card_s` 左上クロップ（欠けた）
5. タイプに `utx_ico_supportcharastatus_*` を使用 → **編成のタイプ印と違う系統**

ユーザー評価: **マスク汚い・タイプ違う・SSR欠け → 本番不可**

比較出力（ローカルのみ）:
- `.cache/asset-dump/compare-vertical/`
- `.cache/asset-dump/compare-vertical-v2/sheet_v2.png`

---

## 5. 採用する進め方（解決策マップ）

| 段階 | 内容 |
|------|------|
| **解決策1** | 編成UIが使う **正しい** 枠／SSR／タイプ／マスクの meta パスを特定し直す |
| **解決策3** | 正しい部品だけで高品質合成パイプラインを試作 → 目視OKなら優先40へ |
| **落としどころ = 解決策4** | 見つかった本物UIだけ重ねる。無い部品は**無理に近似しない**。絵は常にゲーム抽出 |

失敗・部品不足時の退避:
- **案A/B**: `support_card_s` または `tex`/`thumb` の公式抽出のみ（正方形）。合成は捨てる
- 外部CDN同梱（GameTora 128²、GameWith縦長 `sp_*` 等）は方針変更が必要。今回の本線ではない

---

## 6. 新チャットでの作業順

1. 本ファイル + [ASSETS.md](./ASSETS.md) を読む  
2. **解決策1スパイク**: 編成画面相当のタイプアイコン・SSR・枠・マスクを meta/dat から特定  
   - 出力: 部品一覧表（meta `n`・寸法・用途）と `.cache` への抽出サンプル  
3. 部品が揃う範囲で **解決策3の試作**（数枚）→ ユーザー目視  
4. OKなら `assets:extract` / `import` 系を更新し優先40を再生成。ASSETS / GAME_UPDATE 更新  
5. NGまたは部品不足なら **解決策4に縮退**（または A/B に戻す）を明示提案  
6. 変更は都度コミット。**push しない**

### 受け入れ（合成成功時）
- サンプル数枚でユーザーが「本番可」と判定
- 優先40が `assets/supports/{id}.webp` に配置され、ピッカー／上段で表示
- 総量目安: Phase1 で数MB〜許容範囲（過剰なら長辺を抑える）
- 低品質近似（縁伸ばしSSR欠け等）を本番に載せない

### 推奨言語モデル
**Grok 4.6 Medium〜High**（UI部品の再特定が主。見つからないときの判断込みなら High 検討）

| モデル | 向き |
|--------|------|
| Composer 2.5 | 部品確定後の量産スクリプト |
| Grok 4.6 Medium | ◎ 調査＋試作 |
| Grok 4.6 High | 部品特定が難航したとき |

---

## 7. 既存パイプライン（現状・正方形）

```text
npm run assets:extract  → .cache/asset-dump/flat/*.png
npm run assets:import   → assets/supports|characters/{id}.webp
```

- `scripts/extract_card_assets.py` … 現状 `support_card_s` / `piece_icon`
- `scripts/import_card_assets.mjs` … PNG→webp

縦カード化が成功したら、extract 元アセットと後処理（クロップ・合成）をここに組み込む。

---

## 8. 育成ウマ娘（メモ・本タスク外だが関連）

- 理想に近い例: `chr_icon_1077_107701_01`（`__tex` サフィックスは同一画像の別名）
- 初期カード **107703** には `chr_icon_1077_107703_*` が **DMM最新metaにも無い**
- 代替: `outgame/piece/piece_icon_107703`（下部星焼き付きの可能性）
- サポカ縦カードが一段落したら別チケットで扱う

---

## 9. コミット履歴の目安（画像まわり）

- `60ecdfe` … 優先枠 webp 同梱・extract/import
- `af0802a` … 表示失敗修正（キャッシュ回避等）
- `8d7e4d8` … 縦クロップ比較サンプル v1
- `e2a457e` … 比較 v2（低品質・本番不採用）

---

## 10. 新チャット起票文（コピー用）

```text
docs/SUPPORT_CARD_IMAGE_TASK.md を読んで続行。
サポカ縦カード画像: 解決策1（正しいUI部品の特定）→ 解決策3（高品質合成試作）。
落としどころは解決策4（本物だけ重ねる／無理な近似はしない）。
v2合成は本番不可。pushしない。
```
