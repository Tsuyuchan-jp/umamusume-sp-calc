import assert from "node:assert/strict";
import {
  applyDesignSnapshot,
  captureDesignSnapshot,
} from "../app/js/designSnapshot.js";

const ui = {
  characterId: 105801,
  supportIds: [null, null, null, null, 30301, 30201],
  enabledEventIds: new Set(["evt_a"]),
  eventChoiceIds: { foo: "bar" },
  scenarioLinkChoiceId: "link_dotou",
  seniorRmjChoiceId: "ramen_yokubari",
};

const snap = captureDesignSnapshot({
  ui,
  options: { fastLearner: true, trainingHintLevel: 5 },
  excludedSkillIds: new Set([200512]),
  committedSkillFilter: { ground: "turf", distance: "", style: "" },
});

assert.equal(snap.version, 1);
assert.equal(snap.characterId, 105801);
assert.deepEqual(snap.supportIds, ui.supportIds);
assert.deepEqual(snap.excludedSkillIds, [200512]);

const restored = {
  characterId: 0,
  supportIds: [1, 2, 3, 4, 5, 6],
  enabledEventIds: new Set(),
  eventChoiceIds: {},
  scenarioLinkChoiceId: "",
  seniorRmjChoiceId: "",
};

assert.equal(applyDesignSnapshot(snap, restored), true);
assert.equal(restored.characterId, 105801);
assert.deepEqual(restored.supportIds, ui.supportIds);
assert.deepEqual([...restored.enabledEventIds], ["evt_a"]);

console.log("test_design_snapshot: OK");
