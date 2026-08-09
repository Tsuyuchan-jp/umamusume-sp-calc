import { buildSkillPlan } from "./aggregate.js";
import { shortSupportLabel } from "./cardAssets.js";
import { createLayoutMode } from "./layoutMode.js";
import { createDeckUi } from "./deckUi.js";
import { escapeHtml } from "./htmlEscape.js";
import { createEventUi } from "./eventUi.js";
import {
  copyTextToClipboard,
  formatIncludedSkillNames,
  getIncludedSkillRows,
} from "./copyIncludedSkills.js";
import {
  defaultDesignTitleFromCharacterName,
  resolveDesignTitleOnCharacterChange,
} from "./designTitle.js";
import { createDesignMemoryUi } from "./designMemoryUi.js";
import { createDesignSessionUi } from "./designSessionUi.js";
import { createScenarioLinkUi } from "./scenarioLinkUi.js";
import {
  getEffectiveExcludedSkillIds,
  getIncompatibleSkillIds,
  pruneManualExclusions,
} from "./skillActivation.js";
import { sortPlanRows } from "./skillSource.js";
import { createResultTable } from "./resultTable.js";
import { createShareCardUi } from "./shareCardUi.js";

/** 継承固有の baseSp（UIでは非編集・固定） */
const INHERIT_BASE_SP = 200;

/** @type {object|null} */
let state = null;

/** @type {Set<number>} 手動 OFF のみ（レギュ非互換は都度合成） */
const excludedSkillIds = new Set();

/** 確定済みレギュ絞込（セグメント選択で即更新） */
let committedSkillFilter = { ground: "", distance: "", style: "" };

/** 直近の計画（コピー用） */
let currentPlan = null;

let currentReguExcludedCount = 0;

/** コピーボタンの既定ラベル */
let copyIncludedSkillsDefaultLabel = "";

/** イベントヒント対応サポカ id（events.json の prioritySupportIds） */
/** @type {Set<number>} */
let prioritySupportIdSet = new Set();

/** 前回の合計SP（差分表示用） */
let previousTotal = null;

/** 差分ハイライトのタイマー */
let deltaHideTimer = null;

/** Pages の max-age キャッシュで古い events.json が残るのを防ぐ（版上げ時に更新） */
const DATA_CACHE_BUST = "1.0.4";

/** イベント選択 UI（関数宣言はホイストされるので deps で参照可） */
const eventUi = createEventUi({
  getState: () => state,
  getSupportById,
  shortSupportLabel,
  formatSkillList,
  getSkillByIdMap,
  recalc: () => recalc(),
  isEventSupportInDeck,
});

/** 結果表レンダ（関数宣言はホイストされるので deps で参照可） */
const resultTable = createResultTable({
  getSkillByIdMap,
  getExcludedSkillIds: () => excludedSkillIds,
  onIncludeChange: (skillId, checked) => {
    if (checked) excludedSkillIds.delete(skillId);
    else excludedSkillIds.add(skillId);
    recalc();
  },
});

/** シナリオリンク・RMJ チップ UI */
const scenarioLinkUi = createScenarioLinkUi({
  getState: () => state,
  getSupportIds,
  formatSkillList,
  recalc: () => recalc(),
});

/** 編成ダッシュボード・ピッカー・継承ポップオーバー */
const deckUi = createDeckUi({
  getState: () => state,
  getCharacterById,
  getSupportById,
  getPrioritySupportIdSet: () => prioritySupportIdSet,
  inheritBaseSp: INHERIT_BASE_SP,
  getExcludedCount: () => excludedSkillIds.size,
  eventUi,
  scenarioLinkUi,
  applyDesignTitleOnCharacterChange,
  scheduleSessionSave: () => designSessionUi.scheduleSessionSave(),
  recalc: () => recalc(),
});

/** セッション自動保存・スナップショット復元 */
const designSessionUi = createDesignSessionUi({
  getState: () => state,
  readDesignOptions,
  getExcludedSkillIds: () => excludedSkillIds,
  replaceExcludedSkillIds: (ids) => {
    excludedSkillIds.clear();
    for (const id of ids) {
      const n = Number(id);
      if (!Number.isNaN(n)) excludedSkillIds.add(n);
    }
  },
  getCommittedSkillFilter: () => committedSkillFilter,
  setCommittedSkillFilter: (filter) => {
    committedSkillFilter = filter;
  },
  writeSkillFilterUI,
  writeDesignOptions,
  readDesignTitle,
  setDesignTitle,
  setDesignTitleDefaultForCurrentCharacter,
  syncHiddenCharacterSelect: () => deckUi.syncHiddenCharacterSelect(),
  renderDeckDashboard: () => deckUi.renderDeckDashboard(),
  eventUi,
  scenarioLinkUi,
  recalc: () => recalc(),
  clearPreviousTotal: () => {
    previousTotal = null;
  },
});

/** 設計メモリダイアログ UI */
const designMemoryUi = createDesignMemoryUi({
  getState: () => state,
  readDesignTitle,
  captureCurrentDesign: () => designSessionUi.captureCurrentDesign(),
  restoreDesign: (snapshot) => designSessionUi.restoreDesign(snapshot),
  setDesignTitle,
  setDesignTitleDefaultForCurrentCharacter,
  scheduleSessionSave: () => designSessionUi.scheduleSessionSave(),
  getCurrentPlan: () => currentPlan,
});

/** ギャラリー⇔スプリット・合計バー DOM 移動 */
const layoutMode = createLayoutMode({
  eventUi,
  syncInheritPopoverAnchorIfOpen: () => deckUi.syncInheritPopoverAnchorIfOpen(),
});

/** 共有カードボタン（コピー／画像保存） */
const shareCardUi = createShareCardUi({
  getState: () => state,
  getCurrentPlan: () => currentPlan,
  readDesignOptions,
  getCommittedSkillFilter: () => committedSkillFilter,
  getExcludedSkillIds: () => excludedSkillIds,
  getReguExcludedCount: () => currentReguExcludedCount,
  readDesignTitle,
});

async function loadJson(path) {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${path}${sep}v=${encodeURIComponent(DATA_CACHE_BUST)}`;
  // no-cache: キャッシュがあっても再検証する（デプロイ直後の古い JSON 滞留を避ける）
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

function showError(msg) {
  const el = document.getElementById("load-error");
  el.hidden = false;
  el.textContent = msg;
}

function getCharacterById(id) {
  return state.characters.find((c) => c.id === id);
}

function getDesignTitleInput() {
  return document.getElementById("design-title-input");
}

function getDesignTitleWrap() {
  return document.getElementById("design-title-wrap");
}

function readDesignTitle() {
  return getDesignTitleInput()?.value.trim() ?? "";
}

function setDesignTitle(value) {
  const input = getDesignTitleInput();
  if (input) input.value = String(value ?? "");
}

function enterDesignTitleEdit() {
  const wrap = getDesignTitleWrap();
  const input = getDesignTitleInput();
  if (!wrap || !input) return;
  wrap.classList.add("is-editing");
  input.readOnly = false;
  input.focus();
  input.select();
}

function leaveDesignTitleEdit() {
  const wrap = getDesignTitleWrap();
  const input = getDesignTitleInput();
  if (!wrap || !input) return;
  wrap.classList.remove("is-editing");
  input.readOnly = true;
}

function getDefaultDesignTitleForCharacter(characterId) {
  const c = getCharacterById(characterId);
  return c ? defaultDesignTitleFromCharacterName(c.name) : "";
}

function setDesignTitleDefaultForCurrentCharacter() {
  setDesignTitle(getDefaultDesignTitleForCharacter(state?.ui?.characterId));
}

function applyDesignTitleOnCharacterChange(previousCharacterId, nextCharacterId) {
  const prevName = getCharacterById(previousCharacterId)?.name ?? "";
  const nextName = getCharacterById(nextCharacterId)?.name ?? "";
  const nextTitle = resolveDesignTitleOnCharacterChange(
    readDesignTitle(),
    defaultDesignTitleFromCharacterName(prevName),
    defaultDesignTitleFromCharacterName(nextName)
  );
  setDesignTitle(nextTitle);
  designSessionUi.scheduleSessionSave();
}

function bindDesignTitleInput() {
  const wrap = getDesignTitleWrap();
  const input = getDesignTitleInput();
  const editBtn = document.getElementById("design-title-edit");
  if (!wrap || !input) return;

  wrap.addEventListener("click", (e) => {
    if (e.target.closest("#design-title-edit")) return;
    if (input.readOnly) enterDesignTitleEdit();
  });

  editBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    enterDesignTitleEdit();
  });

  input.addEventListener("input", () => designSessionUi.scheduleSessionSave());
  input.addEventListener("blur", () => leaveDesignTitleEdit());
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === "Escape") {
      e.preventDefault();
      input.blur();
    }
  });
}

/** 起動時と同じ初期状態へ戻す（メモリ一覧は維持） */
function resetToInitialDesign() {
  if (!state) return;
  if (
    !window.confirm(
      "初期状態に戻しますか？\n現在の編成・前提・除外・タイトルは破棄されます（メモリ一覧は消えません）。"
    )
  ) {
    return;
  }

  applyDefaultCharacter();
  applyDefaultSupports();
  state.ui.enabledEventIds = new Set();
  state.ui.eventChoiceIds = initEventChoiceIds(state.events);
  state.ui.scenarioLinkChoiceId = "link_dotou";
  state.ui.seniorRmjChoiceId =
    state.scenario.seniorRmjChoice?.defaultChoiceId ?? "ramen_yokubari";

  writeDesignOptions({
    fastLearner: false,
    trainingHintLevel: 5,
    inheritEnabled: false,
    inheritCount: 4,
    inheritHintLevel: 3,
    inheritBaseSp: INHERIT_BASE_SP,
  });

  excludedSkillIds.clear();
  committedSkillFilter = { ground: "", distance: "", style: "" };
  writeSkillFilterUI(committedSkillFilter);
  setResultSortMode("skillId");
  previousTotal = null;
  designSessionUi.clearRestoreIdWarnings();
  deckUi.setInheritPopoverOpen(false);

  eventUi.closeSplitEvtPane();

  leaveDesignTitleEdit();
  setDesignTitleDefaultForCurrentCharacter();

  deckUi.syncHiddenCharacterSelect();
  deckUi.renderCharacterSelect();
  deckUi.renderDeckDashboard();
  eventUi.renderEvents();
  scenarioLinkUi.renderScenarioLinkRadios();
  scenarioLinkUi.renderSeniorRmjRadios();
  eventUi.renderScenarioAuto();
  deckUi.updateTotalBarChips();
  recalc();
  designSessionUi.flushSessionSave();
}

function bindDesignResetButton() {
  const btn = document.getElementById("design-reset-btn");
  if (!btn) return;
  btn.addEventListener("click", () => resetToInitialDesign());
}

function getSupportById(id) {
  return state.supports.find((s) => s.id === id);
}

function formatSkillList(skills) {
  return (skills || [])
    .map((sk) => `${sk.skillName} Lv${sk.hintLevel}`)
    .join("、");
}

function isEventSupportInDeck(evt) {
  const supportById = new Map(state.supports.map((s) => [s.id, s]));
  if (!evt.supportNameMatch) return true;
  return getSupportIds().some((id) => {
    const s = supportById.get(id);
    return s && s.name.includes(evt.supportNameMatch);
  });
}

function initEventChoiceIds(events) {
  const map = new Map();
  for (const evt of events.events || []) {
    if (evt.selection === "single") {
      const def = evt.defaultChoiceId ?? evt.choices?.[0]?.id;
      if (def) map.set(evt.id, def);
    }
  }
  return map;
}

function renderEventScopeNotice() {
  const names = state.events.prioritySupportNames || [];
  const list = document.getElementById("event-priority-support-list");
  const listTitle = document.getElementById("event-scope-list-title");
  const lead = document.getElementById("event-scope-lead");
  if (!list) return;

  list.innerHTML = names.map((name) => `<li>${escapeHtml(name)}</li>`).join("");
  if (listTitle) {
    listTitle.textContent = `対応サポカ一覧（${names.length}種）`;
  }
  if (lead && names.length > 0) {
    lead.textContent = `サポカイベントは優先${names.length}種のみ対応`;
  }
}

function bindEventScopeDisclosure() {
  /* 足元帯からは外し、使い方ダイアログ内に配置 */
}

/** ヘッダー「使い方」→ 説明書ダイアログ */
function bindHelpDialog() {
  const dialog = document.getElementById("help-dialog");
  const openBtn = document.getElementById("help-open");
  const closeBtn = document.getElementById("help-close");
  if (!dialog || !openBtn || !closeBtn) return;

  openBtn.addEventListener("click", () => {
    dialog.showModal();
    closeBtn.focus();
  });

  closeBtn.addEventListener("click", () => {
    dialog.close();
  });

  // backdrop（ダイアログ外）クリックで閉じる
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) {
      dialog.close();
    }
  });
}

/** 計算前提オプションを DOM から収集 */
function readDesignOptions() {
  const inherit = deckUi.readInheritParams();
  return {
    fastLearner: document.getElementById("fast-learner")?.checked ?? false,
    trainingHintLevel: Number(document.getElementById("training-hint-level")?.value) || 5,
    inheritEnabled: inherit.enabled,
    inheritCount: inherit.count,
    inheritHintLevel: inherit.hint,
    inheritBaseSp: inherit.base,
  };
}

/** 計算前提オプションを DOM へ書き戻し */
function writeDesignOptions(options = {}) {
  const fast = document.getElementById("fast-learner");
  if (fast) fast.checked = Boolean(options.fastLearner);

  const training = document.getElementById("training-hint-level");
  if (training && options.trainingHintLevel != null) {
    training.value = String(options.trainingHintLevel);
  }

  const inheritEnabled = document.getElementById("inherit-enabled");
  if (inheritEnabled) inheritEnabled.checked = Boolean(options.inheritEnabled);

  const inheritCount = document.getElementById("inherit-count");
  if (inheritCount && options.inheritCount != null) {
    inheritCount.value = String(deckUi.clampInheritCount(options.inheritCount));
  }

  const inheritHint = document.getElementById("inherit-hint");
  if (inheritHint && options.inheritHintLevel != null) {
    inheritHint.value = String(deckUi.clampInheritHint(options.inheritHintLevel));
  }

  const inheritBase = document.getElementById("inherit-base");
  if (inheritBase) inheritBase.value = String(INHERIT_BASE_SP);

  deckUi.syncInheritPopoverUi();
}

/** 確定レギュをセグメント UI に反映 */
function writeSkillFilterUI(filter = {}) {
  for (const axis of ["ground", "distance", "style"]) {
    const value = filter[axis] || "";
    const seg = document.querySelector(`.regu-seg[data-filter="${axis}"]`);
    if (!seg) continue;
    seg.querySelectorAll("button[data-value]").forEach((btn) => {
      const on = btn.dataset.value === value;
      btn.classList.toggle("is-on", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }
}

/** セグメント UI からレギュ絞込を読む */
function readSkillFilterFromUI() {
  const read = (axis) =>
    document
      .querySelector(`.regu-seg[data-filter="${axis}"] button.is-on`)
      ?.getAttribute("data-value") || "";
  return {
    ground: read("ground"),
    distance: read("distance"),
    style: read("style"),
  };
}

function getSupportIds() {
  return state.ui.supportIds.filter((id) => id != null);
}

/** 合計SPを画面下部バーと結果パネルに反映し、差分をハイライト */
function updateTotalDisplay(total) {
  const formatted = total.toLocaleString();
  document.getElementById("total-sp").textContent = formatted;
  document.getElementById("total-sp-bar-value").textContent = formatted;

  const bar = document.getElementById("total-sp-bar");
  const deltaEl = document.getElementById("total-sp-delta");

  if (deltaHideTimer) {
    clearTimeout(deltaHideTimer);
    deltaHideTimer = null;
  }

  bar.classList.remove("total-sp-bar--flash-up", "total-sp-bar--flash-down");
  deltaEl.classList.remove("total-sp-delta--up", "total-sp-delta--down", "total-sp-delta--fade");

  if (previousTotal !== null && previousTotal !== total) {
    const delta = total - previousTotal;
    const sign = delta > 0 ? "+" : "";
    deltaEl.textContent = `(${sign}${delta.toLocaleString()})`;
    deltaEl.hidden = false;

    if (delta > 0) {
      deltaEl.classList.add("total-sp-delta--up");
      bar.classList.add("total-sp-bar--flash-up");
    } else {
      deltaEl.classList.add("total-sp-delta--down");
      bar.classList.add("total-sp-bar--flash-down");
    }

    deltaHideTimer = setTimeout(() => {
      deltaEl.classList.add("total-sp-delta--fade");
      bar.classList.remove("total-sp-bar--flash-up", "total-sp-bar--flash-down");
      setTimeout(() => {
        deltaEl.hidden = true;
        deltaEl.classList.remove("total-sp-delta--fade");
      }, 400);
    }, 2500);
  } else if (previousTotal === null) {
    deltaEl.hidden = true;
  }

  previousTotal = total;
}

/** 結果件数用の行重み（継承固有は個数分、通常行は1） */
function rowSkillWeight(row) {
  return row.skillWeight != null ? row.skillWeight : 1;
}

/** 結果見出し右の「スキル数 ON/全件」を更新 */
function updateSkillCountDisplay(plan) {
  const el = document.getElementById("skill-count-meta");
  if (!el) return;
  let totalCount = 0;
  let onCount = 0;
  for (const row of plan.rows) {
    const w = rowSkillWeight(row);
    totalCount += w;
    if (!row.excluded) onCount += w;
  }
  el.innerHTML = `ONスキル数 <b>${onCount}</b>/<b>${totalCount}</b>`;
}

/** ONスキルコピーボタンの有効／無効を更新 */
function updateCopyIncludedSkillsButton(plan) {
  const btn = document.getElementById("copy-included-skills");
  if (!btn || btn.dataset.feedback === "1") return;
  const count = getIncludedSkillRows(plan.rows).length;
  btn.disabled = count === 0;
}

/** コピーボタンの一時フィードバック */
function showCopyIncludedSkillsFeedback(message, isError = false) {
  const btn = document.getElementById("copy-included-skills");
  if (!btn) return;
  btn.dataset.feedback = "1";
  btn.disabled = true;
  btn.textContent = message;
  btn.classList.toggle("copy-included-skills--error", isError);
  window.setTimeout(() => {
    delete btn.dataset.feedback;
    btn.classList.remove("copy-included-skills--error");
    btn.textContent = copyIncludedSkillsDefaultLabel;
    if (currentPlan) updateCopyIncludedSkillsButton(currentPlan);
  }, 2000);
}

function getSkillByIdMap() {
  return new Map(state.skills.map((s) => [s.id, s]));
}

function getResultSortMode() {
  const active = document.querySelector(".result-sort-seg__btn.is-active");
  const v = active?.dataset?.sort || "skillId";
  if (v === "kind" || v === "cost" || v === "skillId") return v;
  return "skillId";
}

function setResultSortMode(mode) {
  const next =
    mode === "kind" || mode === "cost" || mode === "skillId" ? mode : "skillId";
  document.querySelectorAll(".result-sort-seg__btn").forEach((btn) => {
    const on = btn.dataset.sort === next;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

function renderPlanWarnings(unresolved) {
  const el = document.getElementById("plan-warnings");
  if (!el) return;

  const restoreWarnings = designSessionUi.getLastRestoreIdWarnings();
  const parts = [];
  if (restoreWarnings.length) {
    parts.push("復元時の調整: " + restoreWarnings.join(" "));
  }
  if (unresolved?.length) {
    parts.push(
      "未解決スキル（合計から除外されています）: " +
        unresolved.map((u) => `${u.skillName}（${u.context}）`).join("、")
    );
  }

  if (!parts.length) {
    el.hidden = true;
    el.textContent = "";
    return;
  }

  el.hidden = false;
  el.textContent = parts.join(" / ");
  if (unresolved?.length) console.warn("未解決スキル:", unresolved);
  if (restoreWarnings.length) {
    console.warn("復元時の ID 調整:", restoreWarnings);
  }
}

function recalc() {
  if (!state) return;

  const inherit = deckUi.readInheritParams();
  const planParams = {
    skills: state.skills,
    supports: state.supports,
    characters: state.characters,
    events: state.events,
    scenario: state.scenario,
    characterId: state.ui.characterId,
    supportIds: getSupportIds(),
    excludedSkillIds: new Set(),
    fastLearner: document.getElementById("fast-learner").checked,
    inheritEnabled: inherit.enabled,
    inheritCount: inherit.count,
    inheritHintLevel: inherit.hint,
    inheritBaseSp: inherit.base,
    trainingHintLevel: Number(document.getElementById("training-hint-level").value) || 5,
    enabledEventIds: state.ui.enabledEventIds,
    eventChoiceIds: Object.fromEntries(state.ui.eventChoiceIds),
    enabledScenarioEntryIds: scenarioLinkUi.buildEnabledScenarioEntryIds(),
    seniorRmjChoiceId: state.ui.seniorRmjChoiceId,
  };

  let plan = buildSkillPlan(planParams);
  const skillById = getSkillByIdMap();
  pruneManualExclusions(excludedSkillIds, plan.rows, skillById);
  const reguExcluded = getIncompatibleSkillIds(
    plan.rows,
    committedSkillFilter,
    skillById
  );
  const effectiveExcluded = getEffectiveExcludedSkillIds(
    excludedSkillIds,
    plan.rows,
    committedSkillFilter,
    skillById
  );
  plan = buildSkillPlan({ ...planParams, excludedSkillIds: effectiveExcluded });

  currentPlan = plan;
  currentReguExcludedCount = reguExcluded.size;

  renderPlanWarnings(plan.unresolved);
  updateTotalDisplay(plan.total);
  deckUi.updateTotalBarChips(effectiveExcluded.size);
  updateSkillCountDisplay(plan);
  updateCopyIncludedSkillsButton(plan);

  const displayRows = sortPlanRows(plan.rows, getResultSortMode(), {
    supportIds: state.ui.supportIds,
  });
  resultTable.renderResultBody(displayRows, reguExcluded);

  designSessionUi.scheduleSessionSave();
}

function bindCopyIncludedSkills() {
  const btn = document.getElementById("copy-included-skills");
  if (!btn) return;
  copyIncludedSkillsDefaultLabel = btn.textContent.trim();
  btn.addEventListener("click", async () => {
    if (!currentPlan) return;
    const rows = getIncludedSkillRows(currentPlan.rows);
    if (!rows.length) return;
    const text = formatIncludedSkillNames(currentPlan.rows);
    const ok = await copyTextToClipboard(text);
    if (ok) {
      showCopyIncludedSkillsFeedback(`コピーしました（${rows.length}件）`);
    } else {
      showCopyIncludedSkillsFeedback("コピーに失敗しました", true);
    }
  });
}

function bindSkillFilters() {
  document.querySelectorAll(".regu-seg").forEach((seg) => {
    seg.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-value]");
      if (!btn || !seg.contains(btn)) return;
      seg.querySelectorAll("button[data-value]").forEach((b) => {
        const on = b === btn;
        b.classList.toggle("is-on", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
      committedSkillFilter = readSkillFilterFromUI();
      recalc();
    });
  });
}

function bindResultSort() {
  const seg = document.querySelector(".result-sort-seg");
  if (!seg) return;
  seg.addEventListener("click", (e) => {
    const btn = e.target.closest(".result-sort-seg__btn");
    if (!btn || !seg.contains(btn)) return;
    const mode = btn.dataset.sort;
    if (mode === getResultSortMode()) return;
    setResultSortMode(mode);
    if (!currentPlan) return;
    recalc();
  });
}

function bindOptions() {
  /* 継承は bindInheritPopover。切れ者・トレLvは bindPremiseChipsOnce */
}

/** タイトル（＋任意でレアリティ・タイプ）でサポカを検索 */
function findSupportByTitle(title, options = {}) {
  const { rarity, type } = options;
  return state.supports.find((s) => {
    if (s.title !== title && !s.name.startsWith(`[${title}]`)) return false;
    if (rarity && s.rarity !== rarity) return false;
    if (type && s.type !== type) return false;
    return true;
  });
}

/** 育成ウマ娘の初期選択（常用: [The Changer]アーモンドアイ） */
function applyDefaultCharacter() {
  const found = state.characters.find(
    (c) => c.name === "[The Changer]アーモンドアイ"
  );
  state.ui.characterId = found?.id ?? state.characters[0]?.id ?? 0;
}

/** サポカ6枠の初期選択（常用デッキ） */
function applyDefaultSupports() {
  const airGroove = findSupportByTitle("心覚えし、京の華", { rarity: "SSR", type: "speed" });
  const teio = findSupportByTitle("天才的ユートピア", { rarity: "SSR", type: "speed" });
  const tapDance = findSupportByTitle("刀光散らしてClash！", { rarity: "SSR", type: "speed" });
  const doto = findSupportByTitle("その執念は怒濤が如く", { rarity: "SSR", type: "stamina" });
  const young = findSupportByTitle("Innovator", { rarity: "SSR", type: "wit" });
  const tazuna = findSupportByTitle("一杯のノスタルジア", { rarity: "SSR", type: "friend" });
  state.ui.supportIds = [
    airGroove?.id ?? null,
    teio?.id ?? null,
    tapDance?.id ?? null,
    doto?.id ?? null,
    young?.id ?? null,
    tazuna?.id ?? null,
  ];
}

async function init() {
  try {
    const [skills, supports, characters, events, scenario] = await Promise.all([
      loadJson("../data/skills.json"),
      loadJson("../data/supports.json"),
      loadJson("../data/characters.json"),
      loadJson("../data/events.json"),
      loadJson("../data/scenarios/toresenken.json"),
    ]);

    prioritySupportIdSet = new Set(events.prioritySupportIds || []);

    state = {
      skills,
      supports,
      characters,
      events,
      scenario,
      ui: {
        characterId: 0,
        supportIds: [null, null, null, null, null, null],
        enabledEventIds: new Set(),
        eventChoiceIds: initEventChoiceIds(events),
        scenarioLinkChoiceId: "link_dotou",
        seniorRmjChoiceId:
          scenario.seniorRmjChoice?.defaultChoiceId ?? "ramen_yokubari",
      },
    };

    applyDefaultCharacter();
    applyDefaultSupports();
    deckUi.renderCharacterSelect();
    deckUi.syncHiddenCharacterSelect();

    deckUi.initCardPicker();
    deckUi.bindPremiseChipsOnce();
    deckUi.bindPickerFilters();
    layoutMode.bindLayoutMode();
    eventUi.bindEventChoiceDialog();
    deckUi.bindInheritPopover();
    deckUi.renderDeckDashboard();
    deckUi.updateTotalBarChips();

    renderEventScopeNotice();
    bindEventScopeDisclosure();
    bindHelpDialog();
    designMemoryUi.bindMemoryDialog();
    bindDesignTitleInput();
    bindDesignResetButton();
    eventUi.renderEvents();
    scenarioLinkUi.renderScenarioLinkRadios();
    scenarioLinkUi.renderSeniorRmjRadios();
    eventUi.renderScenarioAuto();

    bindOptions();
    bindSkillFilters();
    bindResultSort();
    bindCopyIncludedSkills();
    shareCardUi.bindShareCardButtons();
    designSessionUi.bindSessionFlushOnce();
    committedSkillFilter = readSkillFilterFromUI();

    if (!designSessionUi.tryRestoreLastSession()) {
      setDesignTitleDefaultForCurrentCharacter();
      recalc();
    }
  } catch (e) {
    showError(
      `データの読み込みに失敗しました: ${e.message}\n\n` +
        "対処:\n" +
        "1. リポジトリ直下で npm run serve を実行\n" +
        "2. ブラウザで http://localhost:8080/app/ を開く\n" +
        "3. data/*.json が無い場合は npm run extract を実行\n\n" +
        "※ index.html をダブルクリック（file://）では動きません。\n" +
        "※ app/ だけをサイトルートにすると ../data/ が読めません。"
    );
    console.error(e);
  }
}

init();
