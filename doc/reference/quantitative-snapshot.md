# 定量スナップショット（スキルレビュー用）

計測時点: **2026-07-15**（公開版 **v0.1.7** 反映後）  
このファイルは「その時点の数字」を残す。再計測したら日付と値を更新する。

## 1. 期間・リリース

| 指標 | 値 | メモ |
|------|-----|------|
| 初回コミット | 2026-07-13 | リポジトリ開始 |
| 最新コミット（計測時） | 2026-07-14 | v0.1.7 リリース含む |
| カレンダー上の集中開発期間 | 約 2 日 | 骨格〜公開〜v0.1.7 |
| Git コミット数 | **74** | `git rev-list --count HEAD` |
| 公開セマンティック版 | 0.1.0 → **0.1.7** | CHANGELOG 準拠（緩めの 0.1.x） |
| 公開 URL | GitHub Pages `/app/` | 本番スモーク済み |

### バージョン discrete 成果（CHANGELOG ベース）

| 版 | 主な成果 |
|----|----------|
| 0.1.0〜 | 公開骨格・Pages・計算コア |
| 0.1.3 | イベント U-tools 抽出正本化 |
| 0.1.4 | サポカ「イベント対応のみ」フィルタ |
| 0.1.5 | 説明書モーダル |
| 0.1.6 | 発動条件タグ＋レギュ絞込・スキル数表示 |
| 0.1.7 | 適用ボタン＋編成変更時の増分除外 |

→ **短期間で要件固定 → 実装 → 実機確認 → 公開 → 反復改修**まで一気通貫した点が、速度指標として使える。

## 2. コード規模（概算）

| 指標 | 値 |
|------|-----|
| `app/js/*.js` 行数合計 | **約 1,547**（空行除く Measure-Object Lines） |
| `scripts/*.mjs` ファイル数 | **22** |
| `scripts/*.mjs` 行数合計 | **約 3,239** |
| `docs/*.md` ファイル数 | **14**（運用正本） |
| `doc/reference/*.md` | 本ディレクトリ（レビュー用） |
| UI フレームワーク | なし（Vanilla） |
| 本番 npm 依存 | なし（`private`・scripts のみ） |

解釈の目安:

- **アプリ本体は 1.5k 行前後**でドメイン計算を完結させている（過剰なフロント肥大なし）
- **scripts 側がアプリより厚い** → ETL・検証・回帰に投資しているデータ駆動プロダクト

## 3. データ規模

`data/meta.json`（extract 時点）:

| 指標 | 値 |
|------|-----|
| skills | **2,103** |
| supports | **543** |
| characters | **261** |
| 優先イベント対象サポカ | **37** |
| イベント件数 | **102**（preserve 例外含む運用） |
| シナリオ | トレセン軒 1 本（手メンテ JSON） |

## 4. 品質・自動化

| 指標 | 値 / 内容 |
|------|-----------|
| テスト入口 | `npm test` = `test_sp.mjs` + `test_skill_activation.mjs` |
| CI | GitHub Actions: verify → test → Pages deploy |
| CI Node | 20 |
| デプロイゲート | テスト失敗で deploy しない |
| 実機確認 | 常用デッキ＋シナリオ通し OK（2026-07、ROADMAP / CHANGELOG） |
| 回帰の例 | デフォルト編成合計 SP、リンク白/金、金+白数値、絞込増分除外 |

## 5. モジュール分割（アプリ）

| ファイル | 責務の一言 |
|----------|------------|
| `spCost.js` | コスト式 |
| `hintResolve.js` | ヒント max |
| `goldLower.js` | 購入チェーン・表示 |
| `skillActivation.js` | 発動条件・絞込 |
| `scenarioLink.js` | リンク白/金 |
| `aggregate.js` | 集計入口 |
| `app.js` | UI・状態 |

→ 計算コアと UI の分離、絞込ロジックの pure 関数抽出（v0.1.7）が設計成熟度の指標になる。

## 6. ドキュメント資産

| 種別 | 代表ファイル | 役割 |
|------|--------------|------|
| 要件 | `REQUIREMENTS.md` | 変更禁止に近いルール |
| 仕様 | `spec.md` | 計算・データ解釈 |
| アーキテクチャ | `ARCHITECTURE.md` | 構成・データフロー |
| 開発 | `DEV.md` | 起動・extract |
| 運用 | `GAME_UPDATE_RUNBOOK.md` | パッチ後手順 |
| 引き継ぎ | `AGENT_HANDOFF.md` | 新チャット最短ブリーフ |
| 用語 | `GLOSSARY.md` | 混同防止 |
| 履歴 | `CHANGELOG.md` / `ROADMAP.md` | 公開履歴・残課題 |

運用 docs 14 + 本 reference。**コードだけでなく運用知識をリポジトリに残している**点が再現性指標。

## 7. 技術選定の定量的意味

| 選定 | トレードオフ（短評） |
|------|----------------------|
| Vanilla JS | 依存ゼロ・Pages 単純 ⇔ 大規模化時の型・部品化は弱い |
| 静的 JSON | オフラインに近い高速表示 ⇔ ゲーム更新は再 extract 運用が必要 |
| Node scripts | CI と同一ランタイム ⇔ Python mdb 経路は補助扱い |
| 優先37のみ | 実装完了可能 ⇔ 網羅性は意図的に捨てた |

## 8. 自己レビュー用スコアカード（記入欄）

採点例: 1（弱い）〜 5（強い）。メモ欄に根拠を1行。

| 観点 | スコア | メモ |
|------|--------|------|
| 要件の切れ味（スコープ制御） | /5 | |
| ドメイン理解の深さ（実機整合） | /5 | |
| 設計（モジュール・状態・データ境界） | /5 | |
| 実装速度（期間対成果） | /5 | |
| 品質（テスト・CI・実機） | /5 | |
| UX（本家メンタルモデル・説明書） | /5 | |
| 運用設計（Runbook・ドキュメント） | /5 | |
| AI 併用開発の制御（ルール・モデル選択） | /5 | |
| 公開・フィードバック導線 | /5 | |

### 次に伸ばす候補（ROADMAP より）

- 結果表の由来表示強化  
- 初期デッキ6枚化  
- 回帰テストのさらなる拡充  
- （需要が明確なら）プリセット  

## 9. 再計測コマンド（PowerShell）

```powershell
cd C:\Users\PC1\Projects\umamusume-sp-calc
git rev-list --count HEAD
git log --format=%ai --reverse | Select-Object -First 1
git log -1 --format=%ai
(Get-ChildItem app\js\*.js | ForEach-Object { (Get-Content $_.FullName | Measure-Object -Line).Lines } | Measure-Object -Sum).Sum
(Get-ChildItem scripts\*.mjs).Count
(Get-ChildItem scripts\*.mjs | ForEach-Object { (Get-Content $_.FullName | Measure-Object -Line).Lines } | Measure-Object -Sum).Sum
Get-Content data\meta.json -Raw
npm test
```

---

関連: [development-environment.md](./development-environment.md) / [product-specification.md](./product-specification.md) / [`docs/CHANGELOG.md`](../../docs/CHANGELOG.md)
