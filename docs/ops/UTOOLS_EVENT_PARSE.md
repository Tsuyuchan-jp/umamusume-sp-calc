# U-tools SSR イベント JSON パース仕様

**対象**: `https://ウマ娘.tools/supports/{supportCardId}` の HTML（Next.js RSC）

## 取得経路

1. HTML 内の `self.__next_f.push([1,"..."])` を全件抽出
2. エスケープ解除（`\"` → `"`, `\n` → 改行）
3. 結合文字列から `"events":[` を bracket match で切り出し
4. `"skill":{...}` ネストを `"skill":null` に置換（`skillDesc` 内改行で JSON が壊れるため）
5. `JSON.parse` → `UToolsEvent[]`

## UToolsEvent（1イベント）

| フィールド | 型 | 備考 |
|-----------|-----|------|
| `id` | string | story_id 相当（例: `801087002`, `830304003`） |
| `title` | string | イベント表示名 |
| `supportCharaId` | number | サポカキャラ ID |
| `supportCardId` | number | カード固有イベントでは 0 のことが多い |
| `choices` | array | 選択肢 |

## choice / effect

```json
{
  "id": "801087002002",
  "text": "華麗な辻写りの極意が知りたい",
  "results": [{
    "effects": [
      { "type": 221, "val": 5, "skillId": null },
      { "type": 311, "val": 2, "skillId": 202042, "skill": { "...": "省略" } }
    ]
  }]
}
```

### スキルヒント判定

- **type `311`** かつ **`skillId` 非 null** → スキルヒント
- `val` = ヒント Lv
- ステータス系（101/201/221 等）は **捨てる**

## 変換後（本プロジェクト）

- ヒント無し choice / ヒント無し event は登録しない
- `normalizeEventSelection`（`event_selection.mjs`）で auto / single 化
- 安定 id: `evt_{supportCardId}_{storyId}`（storyId は U-tools `event.id`）
