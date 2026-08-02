import assert from "node:assert/strict";
import {
  defaultDesignTitleFromCharacterName,
  resolveDesignTitleOnCharacterChange,
} from "../app/js/designTitle.js";

assert.equal(
  defaultDesignTitleFromCharacterName("[The Changer]アーモンドアイ"),
  "アーモンドアイ",
  "称号除去の育成名"
);
assert.equal(
  defaultDesignTitleFromCharacterName("オグリキャップ"),
  "オグリキャップ",
  "称号なしはそのまま"
);

assert.equal(
  resolveDesignTitleOnCharacterChange("", "アーモンドアイ", "テイオー"),
  "テイオー",
  "空欄は新育成名へ"
);
assert.equal(
  resolveDesignTitleOnCharacterChange("アーモンドアイ", "アーモンドアイ", "テイオー"),
  "テイオー",
  "自動名と同じなら新育成名へ"
);
assert.equal(
  resolveDesignTitleOnCharacterChange("切れ者前提", "アーモンドアイ", "テイオー"),
  "切れ者前提",
  "手編集は維持"
);

console.log("test_design_title: all passed");
