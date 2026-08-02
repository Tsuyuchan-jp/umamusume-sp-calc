import assert from "node:assert/strict";
import {
  applyDesignSnapshot,
  captureDesignSnapshot,
  sanitizeDesignSnapshot,
} from "../app/js/designSnapshot.js";
import {
  DESIGN_MEMORY_MAX_ENTRIES,
  deleteEntry,
  getEntry,
  listEntries,
  saveEntry,
} from "../app/js/designMemory.js";
import {
  DESIGN_SESSION_STORAGE_KEY,
  loadSessionSnapshot,
  saveSessionSnapshot,
} from "../app/js/designSession.js";

/** @returns {Storage} */
function createMemoryStorage() {
  const map = new Map();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
  };
}

const ui = {
  characterId: 105801,
  supportIds: [null, null, null, null, 30301, 30201],
  enabledEventIds: new Set(["evt_a"]),
  eventChoiceIds: new Map([["foo", "bar"]]),
  scenarioLinkChoiceId: "link_dotou",
  seniorRmjChoiceId: "ramen_yokubari",
};

const options = {
  fastLearner: true,
  trainingHintLevel: 5,
  inheritEnabled: true,
  inheritCount: 4,
  inheritHintLevel: 3,
  inheritBaseSp: 200,
};

const snap = captureDesignSnapshot({
  ui,
  options,
  excludedSkillIds: new Set([200512]),
  committedSkillFilter: { ground: "turf", distance: "", style: "" },
  designTitle: "切れ者前提",
});

assert.equal(snap.version, 1);
assert.equal(snap.designTitle, "切れ者前提");
assert.equal(snap.characterId, 105801);
assert.deepEqual(snap.supportIds, ui.supportIds);
assert.deepEqual(snap.excludedSkillIds, [200512]);
assert.deepEqual(snap.eventChoiceIds, { foo: "bar" });
assert.deepEqual(snap.options, options);
assert.deepEqual(snap.committedSkillFilter, {
  ground: "turf",
  distance: "",
  style: "",
});

const restored = {
  characterId: 0,
  supportIds: [1, 2, 3, 4, 5, 6],
  enabledEventIds: new Set(),
  eventChoiceIds: new Map(),
  scenarioLinkChoiceId: "",
  seniorRmjChoiceId: "",
};

const applied = applyDesignSnapshot(snap, restored);
assert.ok(applied);
assert.equal(restored.characterId, 105801);
assert.deepEqual(restored.supportIds, ui.supportIds);
assert.deepEqual([...restored.enabledEventIds], ["evt_a"]);
assert.ok(restored.eventChoiceIds instanceof Map);
assert.equal(restored.eventChoiceIds.get("foo"), "bar");
assert.equal(applied.options.fastLearner, true);
assert.equal(applied.options.trainingHintLevel, 5);
assert.equal(applied.options.inheritCount, 4);
assert.deepEqual(applied.excludedSkillIds, [200512]);
assert.equal(applied.committedSkillFilter.ground, "turf");
assert.equal(applied.designTitle, "切れ者前提");

assert.equal(applyDesignSnapshot({ version: 99 }, restored), false);

// --- sanitizeDesignSnapshot（復元 ID 検証） ---
const catalogs = {
  characters: [{ id: 105801 }, { id: 999001 }],
  supports: [{ id: 30301 }, { id: 30201 }],
};
const dirty = {
  version: 1,
  characterId: 888888,
  supportIds: [30301, 999999, 30301, null, 30201, null],
};
const { snapshot: clean, warnings } = sanitizeDesignSnapshot(dirty, catalogs);
assert.equal(clean.characterId, 105801);
assert.deepEqual(clean.supportIds, [30301, null, null, null, 30201, null]);
assert.equal(warnings.length, 3);
assert.ok(warnings.some((w) => w.includes("育成ウマ娘")));
assert.ok(warnings.some((w) => w.includes("枠2")));
assert.ok(warnings.some((w) => w.includes("重複")));

// --- designMemory ---
const storage = createMemoryStorage();
const entry = saveEntry(
  { name: " 編成A ", snapshot: snap, totalSp: 12345 },
  storage
);
assert.equal(entry.name, "編成A");
assert.equal(entry.totalSp, 12345);
assert.ok(getEntry(entry.id, storage));

const listed = listEntries(storage);
assert.equal(listed.length, 1);
assert.equal(listed[0].id, entry.id);

assert.equal(deleteEntry(entry.id, storage), true);
assert.equal(listEntries(storage).length, 0);
assert.equal(deleteEntry("missing", storage), false);

// 上限超過で最古が落ちる
for (let i = 0; i < DESIGN_MEMORY_MAX_ENTRIES + 2; i++) {
  saveEntry(
    {
      name: `e${i}`,
      snapshot: snap,
      totalSp: i,
    },
    storage
  );
}
assert.equal(listEntries(storage).length, DESIGN_MEMORY_MAX_ENTRIES);

// --- designSession（メモリとは別キー） ---
const sessionStore = createMemoryStorage();
assert.equal(loadSessionSnapshot(sessionStore), null);
saveSessionSnapshot(snap, sessionStore);
assert.ok(sessionStore.getItem(DESIGN_SESSION_STORAGE_KEY));
const loaded = loadSessionSnapshot(sessionStore);
assert.equal(loaded.version, 1);
assert.equal(loaded.characterId, 105801);
saveSessionSnapshot({ version: 2 }, sessionStore);
assert.equal(loadSessionSnapshot(sessionStore)?.characterId, 105801);

console.log("test_design_snapshot: OK");
