# 駆動開発環境リファレンス

個人スキルレビュー用。運用手順の正本は [`docs/DEV.md`](../../docs/DEV.md)。

## 1. 環境サマリ

| 区分 | 内容 |
|------|------|
| OS | Windows 10/11（作業マシン実測） |
| ランタイム | Node.js（ローカル・CI は Node 20） |
| 言語 | JavaScript（ES modules）、補助として Python（mdb extract 代替） |
| UI | HTML5 + CSS + Vanilla JS（フレームワーク・バンドラなし） |
| パッケージ管理 | npm（`package.json` のみ。本番依存パッケージなし） |
| エディタ / AI | Cursor（エージェントルール・モデル選択ガイド運用） |
| バージョン管理 | Git / GitHub（public） |
| 公開 | GitHub Pages（Actions デプロイ） |
| ローカル配信 | `npx serve`（`npm run serve`） |

### 明示的に採用しなかったもの

| 非採用 | 理由（設計意図） |
|--------|------------------|
| React / Vue 等 | 単一画面の計算ツール。状態は DOM + モジュール変数で十分 |
| TypeScript / バンドラ | 静的配信・学習コスト・デプロイ単純性を優先 |
| Electron / バックエンド | 「ブラウザで開くだけ」を要件化 |
| NotebookLM 等 | 要件で非対象 |

→ **制約下で最小構成を選ぶ判断**が、この環境設計の中核スキル指標になる。

## 2. リポジトリ構成（開発視点）

```text
umamusume-sp-calc/
  app/                 # 実行時 UI（静的 SPA）
    index.html
    css/style.css
    js/                # 計算コア + UI（ES modules）
  data/                # 生成・手メンテ JSON（アプリが fetch）
  scripts/             # extract / verify / test / イベント正本化
  docs/                # 運用・仕様・引き継ぎ正本
  doc/reference/       # 本ディレクトリ（スキルレビュー用）
  .github/workflows/   # Pages デプロイ + 検証
```

| レイヤ | 役割 | スキル観点 |
|--------|------|------------|
| `app/js/` | ドメイン計算・UI バインド | モジュール分割、純粋関数化 |
| `scripts/` | ETL・回帰・検証 | データパイプライン設計 |
| `data/` | 正本 JSON | 生成物と手メンテの境界設計 |
| `docs/` | 知識の外部化 | ドキュメント駆動・引き継ぎ可能性 |
| CI | verify + test → deploy | 品質ゲートの自動化 |

## 3. ツールチェーンと npm scripts

| コマンド | 用途 |
|----------|------|
| `npm run serve` | ローカル HTTP（リポジトリ直下ルート、入口 `/app/`） |
| `npm run extract` | `master.mdb` → skills / supports / characters |
| `npm run patch:activation` | 既存 skills に発動条件タグを付与 |
| `npm run extract:events` | U-tools + mdb → イベント抽出中間物 |
| `npm run apply:events` | 抽出結果を `events.json` に適用（preserve マージ） |
| `npm run compare:events` | ゴールデン比較 |
| `npm run verify` | データ健全性の簡易確認 |
| `npm test` | SP コスト回帰 + 発動条件タグ／絞込ロジック |

補助: `relink-skills` / `bind-priority` / `render:priority-supports` 等。

### データ源の二系統

```text
master.mdb（ゲームクライアント）
    └─ extract_mdb.mjs ──► skills / supports / characters

U-tools SSR + mdb
    └─ extract_support_events.mjs ──► events.extracted.json
           └─ apply_extracted_events.mjs (+ preserve) ──► events.json
```

- **訓練ヒント**は mdb 自動、**イベントスキル**は U-tools 抽出、少数例外は `events.preserve.json`
- 混ぜない境界が設計上の重要ポイント（[`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md)）

## 4. ローカル駆動条件

| 条件 | 詳細 |
|------|------|
| HTTP 必須 | `file://` では `fetch` が失敗する |
| サイトルート | **リポジトリ直下**（`data/` と `app/` が兄弟） |
| 入口 URL | `http://localhost:8080/app/` |
| 再 extract | DMM/Steam 版の `master.mdb` パスが必要 |

典型起動:

```powershell
cd C:\Users\PC1\Projects\umamusume-sp-calc
npm run serve
# → http://localhost:8080/app/
```

## 5. CI / CD

Workflow: `.github/workflows/deploy-pages.yml`

| 段階 | 内容 |
|------|------|
| トリガ | `master` push / 手動 `workflow_dispatch` |
| verify job | Node 20 → `npm run verify` → `npm test` |
| deploy job | verify 成功後にリポジトリ直下を Pages 配信 |
| 入口 | `/app/`（ルート `index.html` はリダイレクト） |
| Jekyll | `.nojekyll` で無効化 |

**品質ゲート**: テスト失敗時はデプロイされない。  
スキルレビュー上は「手動確認だけに頼らない公開フロー」を評価ポイントにできる。

## 6. 品質担保の仕組み

| 種別 | 実装 | 何を守るか |
|------|------|------------|
| 単体／回帰 | `scripts/test_sp.mjs` | SP 式、金+白、○+◎、デフォルト編成合計、リンク白/金 |
| 単体／回帰 | `scripts/test_skill_activation.mjs` | 発動条件パース、絞込互換、増分除外 |
| データ検証 | `scripts/verify_data.mjs` | 抽出データの目視・整合チェック補助 |
| 実機確認 | 常用デッキ通し（CHANGELOG / ROADMAP に記録） | ゲーム仕様との一致 |
| ドキュメント | REQUIREMENTS / spec / HANDOFF / RUNBOOK | 仕様ドリフト防止 |

## 7. 開発プロセス上の慣習

| 慣習 | 内容 | 技能として読める点 |
|------|------|-------------------|
| 毎作業コミット | PowerShell では `git add` と `git commit` を分離 | 復元点の習慣化 |
| push は明示時のみ | 公開タイミングを人間が制御 | リリース判断 |
| ゲーム更新 Runbook | [`docs/GAME_UPDATE_RUNBOOK.md`](../../docs/GAME_UPDATE_RUNBOOK.md) | 運用設計 |
| AI モデル選択 | 4択から Quota 節約寄りに推奨（[`docs/MODEL_SELECTION.md`](../../docs/MODEL_SELECTION.md)） | AI 併用開発のコスト意識 |
| Cursor ルール | `.cursor/rules/` | エージェント作業の再現性 |

## 8. スキルレビュー用チェックリスト（環境編）

自己評価時に Yes/No または 1–5 で採点する想定。

- [ ] 本番依存を増やさず、静的配信で要件を満たせているか  
- [ ] データ生成（extract）とアプリ実行時の責務が分離されているか  
- [ ] 回帰テストが「実機で一度通った数値」を固定化しているか  
- [ ] CI が verify/test をデプロイ前に強制しているか  
- [ ] ゲーム更新時の手順が Runbook として外部化されているか  
- [ ] `file://` 失敗などよくある落とし穴が文書化されているか  
- [ ] フレームワーク非採用のトレードオフを説明できるか  

---

関連: [`docs/DEV.md`](../../docs/DEV.md) / [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) / [`docs/GAME_UPDATE_RUNBOOK.md`](../../docs/GAME_UPDATE_RUNBOOK.md)
