# 個人開発スキルレビュー用リファレンス

本ディレクトリは、**運用ドキュメント（`docs/`）とは別に**、製作者自身の個人開発技能を定量・定性的に振り返るための資料置き場である。

| ファイル | 内容 | レビューで見る観点 |
|----------|------|-------------------|
| [development-environment.md](./development-environment.md) | 駆動開発環境・ツールチェーン・運用フロー | 環境設計力、再現性、自動化の範囲 |
| [product-specification.md](./product-specification.md) | 完成ツールの仕様詳細（利用者向け機能〜計算規則） | 要件定義・仕様化・スコープ制御 |
| [quantitative-snapshot.md](./quantitative-snapshot.md) | 規模・データ量・リリース履歴などの定量スナップショット | 成果の物量・速度・品質担保の度合い |

## 対象プロダクト

| 項目 | 値 |
|------|-----|
| 名称 | umamusume-sp-calc |
| 公開版 | **v0.1.7**（2026-07-14） |
| URL | https://Tsuyuchan-jp.github.io/umamusume-sp-calc/app/ |
| リポジトリ | https://github.com/Tsuyuchan-jp/umamusume-sp-calc |
| 形態 | 静的 SPA（HTML / CSS / Vanilla JS + JSON） |

## `docs/` との役割分担

| 場所 | 用途 |
|------|------|
| `docs/` | 開発継続・運用・エージェント引き継ぎの**正本**（仕様変更時はこちらを更新） |
| `doc/reference/` | 個人スキルレビュー・ポートフォリオ向けの**要約・スナップショット** |

仕様の最新正本は常に `docs/spec.md` / `docs/REQUIREMENTS.md` / `docs/DEV.md` を参照すること。本ディレクトリはレビュー時点の整理用であり、矛盾がある場合は `docs/` を優先する。

## 推奨レビュー手順

1. [quantitative-snapshot.md](./quantitative-snapshot.md) で規模・期間・リリース数を把握する  
2. [development-environment.md](./development-environment.md) で技術選定・CI・データパイプラインを評価する  
3. [product-specification.md](./product-specification.md) でドメイン複雑度・UX・スコープ境界を評価する  
4. 必要なら `docs/CHANGELOG.md` / `docs/ROADMAP.md` で意思決定の経緯を補完する  

---

最終更新: 2026-07-15（v0.1.7 公開後のスナップショット）
