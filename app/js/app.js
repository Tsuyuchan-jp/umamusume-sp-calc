import { buildSkillPlan } from "./aggregate.js";
import {
  characterImageUrl,
  getSupportTypeStyle,
  shortCharacterLabel,
  shortSupportLabel,
  supportImageUrl,
} from "./cardAssets.js";
import { createCardPicker } from "./cardPicker.js?v=1.0.4";
import {
  buildCharacterNameSearchText,
  normalizeSearchText,
} from "./searchText.js";
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
import { calcSkillCost } from "./spCost.js";
import {
  buildShareCardModel,
  copyShareCardPng,
  renderShareCardToMount,
  saveShareCardPng,
} from "./shareCard.js?v=1.0.4";

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
let shareCardCopyDefaultLabel = "";
let shareCardSaveDefaultLabel = "";

/** イベントヒント対応サポカ id（events.json の prioritySupportIds） */
/** @type {Set<number>} */
let prioritySupportIdSet = new Set();

/** 前回の合計SP（差分表示用） */
let previousTotal = null;

/** 差分ハイライトのタイマー */
let deltaHideTimer = null;

/** カードピッカー */
let cardPicker = null;

/** 前提チップのイベントを一度だけバインド */
let premiseChipsBound = false;

/** 継承パネルの開閉 */
let inheritPopoverOpen = false;

/** 継承パネルのイベントを一度だけバインド */
let inheritPopoverBound = false;

/** ピッカー内タイプ絞込（すべて = ""） */
let supportPickerTypeFilter = "";

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
  syncHiddenCharacterSelect,
  renderDeckDashboard,
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

const SUPPORT_TYPE_LABELS = {
  speed: "スピード",
  stamina: "スタミナ",
  power: "パワー",
  guts: "根性",
  wit: "賢さ",
  friend: "友人",
};

function getSupportFilterState() {
  const eventBtn = document.getElementById("picker-event-only");
  const ssrBtn = document.getElementById("picker-ssr-only");
  return {
    query: "",
    eventOnly: eventBtn?.classList.contains("is-on") ?? true,
    ssrOnly: ssrBtn?.classList.contains("is-on") ?? false,
    type: supportPickerTypeFilter,
  };
}

function supportSearchHaystack(s) {
  return normalizeSearchText(
    [s.name, s.title, s.characterName, s.rarity, SUPPORT_TYPE_LABELS[s.type] || s.type, s.type]
      .filter(Boolean)
      .join(" ")
  );
}

/**
 * サポカピッカー絞込。
 * keepId（枠の現在選択）は eventOnly / SSR のみすり抜け可。
 * タイプ絞込はすり抜けない（全タイプに選択中が出るバグ防止）。
 */
function supportMatchesFilters(s, filters, keepId) {
  if (filters.type && s.type !== filters.type) return false;
  if (filters.query && !supportSearchHaystack(s).includes(filters.query)) return false;
  if (keepId != null && s.id === keepId) return true;
  if (filters.eventOnly && !prioritySupportIdSet.has(s.id)) return false;
  if (filters.ssrOnly && s.rarity !== "SSR") return false;
  return true;
}

function formatCharacterDisplayName(name) {
  const m = String(name).match(/^\[([^\]]+)\](.+)$/);
  if (!m) return name;
  return `${m[2]}[${m[1]}]`;
}

function buildCardFaceHtml({
  imageUrl,
  typeStyle,
  rarity,
  label,
  empty = false,
  showTextOverlay = false,
  square = false,
}) {
  const faceClass = square ? "card-face card-face--square" : "card-face";
  if (empty) {
    return `<div class="${faceClass} card-face--empty" aria-hidden="true">＋</div>`;
  }
  const safeLabel = escapeHtml(label);
  const safeRarity = escapeHtml(rarity || "");
  const typeLabel = escapeHtml(typeStyle?.label || "");
  // 画像本体だけで足りるため、SSR/名前/黒帯は載せない
  const overlayHtml = showTextOverlay
    ? `${safeRarity ? `<span class="card-face__rarity">${safeRarity}</span>` : ""}
      <span class="card-face__label">${safeLabel}</span>`
    : "";
  return `
    <div class="${faceClass}" style="--card-bg:${typeStyle?.bg || "#e8e8e8"};--card-ink:${typeStyle?.ink || "#1c2420"}">
      <img class="card-face__img" src="${escapeHtml(imageUrl)}" alt=""
        onload="this.classList.add('is-loaded');this.nextElementSibling?.setAttribute('hidden','');"
        onerror="this.classList.add('is-failed');this.nextElementSibling?.removeAttribute('hidden');" />
      <div class="card-face__ph" hidden>
        <span class="card-face__ph-type">${typeLabel}</span>
        <span>${safeLabel}</span>
      </div>
      ${overlayHtml}
    </div>
  `;
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
  setInheritPopoverOpen(false);

  eventUi.closeSplitEvtPane();

  leaveDesignTitleEdit();
  setDesignTitleDefaultForCurrentCharacter();

  syncHiddenCharacterSelect();
  renderCharacterSelect();
  renderDeckDashboard();
  eventUi.renderEvents();
  scenarioLinkUi.renderScenarioLinkRadios();
  scenarioLinkUi.renderSeniorRmjRadios();
  eventUi.renderScenarioAuto();
  updateTotalBarChips();
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

function syncHiddenCharacterSelect() {
  const sel = document.getElementById("character-select");
  if (!sel || !state) return;
  if (sel.value !== String(state.ui.characterId)) {
    sel.value = String(state.ui.characterId);
  }
}

function renderDeckCharacter() {
  const btn = document.getElementById("deck-character");
  if (!btn || !state) return;
  const c = getCharacterById(state.ui.characterId);
  if (!c) {
    btn.innerHTML = `${buildCardFaceHtml({ empty: true, square: true })}
      <span class="deck-trainee-meta">
        <span class="deck-trainee-meta__lbl">育成</span>
        <span class="deck-trainee-meta__name">未選択</span>
      </span>`;
    return;
  }
  const label = formatCharacterDisplayName(c.name);
  const short = shortCharacterLabel(c.name);
  btn.innerHTML = `${buildCardFaceHtml({
    imageUrl: characterImageUrl(c.id),
    typeStyle: { bg: "linear-gradient(160deg,#d4dce4,#8a9aaa)", ink: "#1c2420", label: "ウマ" },
    rarity: "",
    label: short,
    square: true,
    showTextOverlay: false,
  })}
    <span class="deck-trainee-meta">
      <span class="deck-trainee-meta__lbl">育成</span>
      <span class="deck-trainee-meta__name">${escapeHtml(short)}</span>
    </span>`;
  btn.title = label;
}

function renderDeckSupports() {
  const container = document.getElementById("deck-supports");
  if (!container || !state) return;
  container.innerHTML = "";
  for (let i = 0; i < 6; i++) {
    const col = document.createElement("div");
    col.className = "deck-support-col" + (eventUi.getFocusSupportSlot() === i ? " is-focus" : "");
    col.dataset.slot = String(i);

    const id = state.ui.supportIds[i];
    const s = id != null ? getSupportById(id) : null;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "deck-slot";
    btn.dataset.slot = String(i);
    btn.setAttribute("aria-label", `枠${i + 1}を選択`);
    const badge = `<span class="deck-slot-badge" aria-hidden="true">${i + 1}</span>`;
    if (!s) {
      btn.innerHTML = badge + buildCardFaceHtml({ empty: true });
    } else {
      const typeStyle = getSupportTypeStyle(s.type);
      btn.innerHTML =
        badge +
        buildCardFaceHtml({
          imageUrl: supportImageUrl(s.id),
          typeStyle,
          rarity: s.rarity,
          label: shortSupportLabel(s),
          showTextOverlay: false,
        });
      btn.title = s.name;
    }
    btn.addEventListener("click", () => openSupportPicker(i));
    col.appendChild(btn);

    const eventsEl = document.createElement("div");
    eventsEl.className = "deck-slot-events";
    eventsEl.id = `deck-slot-events-${i}`;
    col.appendChild(eventsEl);

    container.appendChild(col);
  }
  eventUi.renderColumnEvents();
}

function renderDeckDashboard() {
  renderDeckCharacter();
  renderDeckSupports();
}

function bindPremiseChipsOnce() {
  if (premiseChipsBound) return;
  premiseChipsBound = true;

  const chipsEl = document.getElementById("total-sp-bar-chips");
  chipsEl?.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;

    if (t.id === "bar-premise-fast-learner" || t.closest("#bar-premise-fast-learner")) {
      const cb = document.getElementById("fast-learner");
      if (!cb) return;
      cb.checked = !cb.checked;
      updateTotalBarChips();
      recalc();
      return;
    }

    const lvBtn = t.closest("[data-training-lv]");
    if (lvBtn && chipsEl.contains(lvBtn)) {
      const lv = lvBtn.getAttribute("data-training-lv");
      const hidden = document.getElementById("training-hint-level");
      if (hidden && lv) hidden.value = lv;
      updateTotalBarChips();
      recalc();
      return;
    }

    if (t.id === "bar-premise-inherit" || t.closest("#bar-premise-inherit")) {
      e.stopPropagation();
      setInheritPopoverOpen(!inheritPopoverOpen);
    }
  });
}

function clampInheritCount(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 4;
  return Math.max(2, Math.min(6, Math.floor(v)));
}

function clampInheritHint(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 3;
  return Math.max(1, Math.min(5, Math.floor(v)));
}

function readInheritParams() {
  const countEl = document.getElementById("inherit-count");
  const hintEl = document.getElementById("inherit-hint");
  const baseEl = document.getElementById("inherit-base");
  const count = clampInheritCount(countEl?.value ?? 4);
  const hint = clampInheritHint(hintEl?.value ?? 3);
  if (countEl && String(count) !== countEl.value) countEl.value = String(count);
  if (hintEl && String(hint) !== hintEl.value) hintEl.value = String(hint);
  if (baseEl) baseEl.value = String(INHERIT_BASE_SP);
  return {
    enabled: Boolean(document.getElementById("inherit-enabled")?.checked),
    count,
    hint,
    base: INHERIT_BASE_SP,
    fast: Boolean(document.getElementById("fast-learner")?.checked),
  };
}

function setInheritSeg(root, attr, value) {
  if (!root) return;
  root.querySelectorAll("button").forEach((btn) => {
    btn.classList.toggle("is-on", String(btn.getAttribute(attr)) === String(value));
  });
}

/** 継承パネルのトグル・セグメント・計算式を DOM 値に同期 */
function syncInheritPopoverUi() {
  const params = readInheritParams();
  const pop = document.getElementById("inherit-popover");
  if (pop) pop.hidden = !inheritPopoverOpen;

  const tog = document.getElementById("inherit-tog-enabled");
  const togLabel = document.getElementById("inherit-tog-label");
  if (tog) {
    tog.classList.toggle("is-on", params.enabled);
    tog.setAttribute("aria-checked", params.enabled ? "true" : "false");
  }
  if (togLabel) {
    togLabel.textContent = params.enabled ? "ON" : "OFF";
    togLabel.classList.toggle("is-on", params.enabled);
  }

  setInheritSeg(document.getElementById("inherit-seg-count"), "data-inherit-count", params.count);
  setInheritSeg(document.getElementById("inherit-seg-hint"), "data-inherit-hint", params.hint);

  const unit = calcSkillCost(params.base, params.hint, params.fast);
  const total = unit * params.count;

  const unitEl = document.getElementById("inherit-formula-unit");
  const countEl = document.getElementById("inherit-formula-count");
  const totalEl = document.getElementById("inherit-formula-total");
  const metaEl = document.getElementById("inherit-formula-meta");
  const box = document.getElementById("inherit-formula");
  if (unitEl) unitEl.textContent = String(unit);
  if (countEl) countEl.textContent = String(params.count);
  if (totalEl) totalEl.textContent = String(total);
  if (box) box.classList.toggle("is-off", !params.enabled);
  if (metaEl) {
    if (!params.enabled) {
      metaEl.textContent = `加算OFF · ヒントLv${params.hint}`;
    } else if (params.fast) {
      metaEl.innerHTML = `ヒントLv${params.hint} · <em>切れ者あり</em>`;
    } else {
      metaEl.textContent = `ヒントLv${params.hint} · 切れ者なし`;
    }
  }

  const chip = document.getElementById("bar-premise-inherit");
  if (chip) {
    chip.setAttribute("aria-expanded", inheritPopoverOpen ? "true" : "false");
    chip.classList.toggle("premise-chip--open", inheritPopoverOpen);
  }
}

function setInheritPopoverOpen(open) {
  inheritPopoverOpen = Boolean(open);
  syncInheritPopoverUi();
  if (inheritPopoverOpen) {
    requestAnimationFrame(() => syncInheritPopoverAnchor());
  }
}

/**
 * 継承パネルを合計バーに追従させる。
 * gallery: バー直上 / split: 上部コマンド直下。隙間は --layout-stack。
 */
function syncInheritPopoverAnchor() {
  const pop = document.getElementById("inherit-popover");
  const bar = document.getElementById("total-sp-bar");
  if (!pop || !bar || !inheritPopoverOpen) return;

  const rootStyle = getComputedStyle(document.documentElement);
  const stackRaw = rootStyle.getPropertyValue("--layout-stack").trim() || "0.5rem";
  const rootFont = parseFloat(rootStyle.fontSize) || 16;
  const stackMatch = stackRaw.match(/^([\d.]+)rem$/i);
  const stackPx = stackMatch
    ? parseFloat(stackMatch[1]) * rootFont
    : Number.parseFloat(stackRaw) || 8;

  const rect = bar.getBoundingClientRect();
  const isSplit = document.body.classList.contains("layout-split");
  const gap = Math.round(stackPx);

  pop.classList.toggle("inherit-popover--below", isSplit);
  pop.classList.toggle("inherit-popover--above", !isSplit);

  if (isSplit) {
    pop.style.top = `${Math.round(rect.bottom + gap)}px`;
    pop.style.bottom = "auto";
  } else {
    pop.style.bottom = `${Math.round(window.innerHeight - rect.top + gap)}px`;
    pop.style.top = "auto";
  }
}

function updateTotalBarChips(excludedCount = excludedSkillIds.size) {
  const el = document.getElementById("total-sp-bar-chips");
  const excludedEl = document.getElementById("total-sp-bar-excluded");
  if (!el) return;

  const fast = document.getElementById("fast-learner")?.checked;
  const trainingLv = document.getElementById("training-hint-level")?.value || "5";
  const inherit = readInheritParams();
  const fastClass = fast ? "premise-chip premise-chip--on" : "premise-chip";
  const inheritClass = [
    "premise-chip",
    inherit.enabled ? "premise-chip--on" : "",
    inheritPopoverOpen ? "premise-chip--open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  el.innerHTML = `
    <button type="button" class="${fastClass}" id="bar-premise-fast-learner" aria-pressed="${fast ? "true" : "false"}">切れ者 ${fast ? "ON" : "OFF"}</button>
    <div class="premise-chip premise-chip--training" role="group" aria-label="トレヒントLv">
      <span class="premise-chip__prefix">トレLv</span>
      <button type="button" class="premise-lv${trainingLv === "3" ? " is-on" : ""}" data-training-lv="3">3</button>
      <button type="button" class="premise-lv${trainingLv === "4" ? " is-on" : ""}" data-training-lv="4">4</button>
      <button type="button" class="premise-lv${trainingLv === "5" ? " is-on" : ""}" data-training-lv="5">5</button>
    </div>
    <button type="button" class="${inheritClass}" id="bar-premise-inherit" aria-pressed="${inherit.enabled ? "true" : "false"}" aria-expanded="${inheritPopoverOpen ? "true" : "false"}" aria-controls="inherit-popover" title="継承パラメータを開く">継承 ${inherit.enabled ? `${inherit.count}本` : "OFF"}</button>
  `;

  if (excludedEl) {
    excludedEl.innerHTML =
      excludedCount > 0
        ? `<span class="premise-chip premise-chip--warn">除外 ${excludedCount}</span>`
        : "";
  }

  syncInheritPopoverUi();
}

function bindInheritPopover() {
  if (inheritPopoverBound) return;
  inheritPopoverBound = true;

  document.getElementById("inherit-popover-close")?.addEventListener("click", () => {
    setInheritPopoverOpen(false);
  });

  document.getElementById("inherit-tog-enabled")?.addEventListener("click", () => {
    const cb = document.getElementById("inherit-enabled");
    if (!cb) return;
    cb.checked = !cb.checked;
    syncInheritPopoverUi();
    recalc();
  });

  document.getElementById("inherit-seg-count")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-inherit-count]");
    if (!btn) return;
    const countEl = document.getElementById("inherit-count");
    if (!countEl) return;
    countEl.value = String(clampInheritCount(btn.getAttribute("data-inherit-count")));
    syncInheritPopoverUi();
    recalc();
  });

  document.getElementById("inherit-seg-hint")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-inherit-hint]");
    if (!btn) return;
    const hintEl = document.getElementById("inherit-hint");
    if (!hintEl) return;
    hintEl.value = String(clampInheritHint(btn.getAttribute("data-inherit-hint")));
    syncInheritPopoverUi();
    recalc();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && inheritPopoverOpen) {
      setInheritPopoverOpen(false);
    }
  });

  document.addEventListener("click", (e) => {
    if (!inheritPopoverOpen) return;
    const t = e.target;
    if (!(t instanceof Node)) return;
    if (t.closest?.("#inherit-popover") || t.closest?.("#bar-premise-inherit")) return;
    setInheritPopoverOpen(false);
  });

  window.addEventListener("resize", () => {
    if (inheritPopoverOpen) syncInheritPopoverAnchor();
  });
}

function buildCharacterPickerItems() {
  return [...state.characters]
    .map((c) => ({
      id: c.id,
      label: formatCharacterDisplayName(c.name),
      searchText: buildCharacterNameSearchText(c.name),
      html: buildCardFaceHtml({
        imageUrl: characterImageUrl(c.id),
        typeStyle: { bg: "linear-gradient(160deg,#d4dce4,#8a9aaa)", ink: "#1c2420", label: "ウマ" },
        rarity: "",
        label: shortCharacterLabel(c.name),
        square: true,
        showTextOverlay: false,
      }),
    }))
    .sort((a, b) => a.searchText.localeCompare(b.searchText, "ja"));
}

function buildCharacterPreview(characterId) {
  const c = getCharacterById(characterId);
  if (!c) return { imageUrl: "", label: "未選択" };
  return {
    imageUrl: characterImageUrl(c.id),
    label: formatCharacterDisplayName(c.name),
  };
}

function buildSupportPreview(supportId) {
  const s = getSupportById(supportId);
  if (!s) return { imageUrl: "", label: "未選択" };
  return {
    imageUrl: supportImageUrl(s.id),
    label: s.characterName || s.name,
  };
}

function buildSupportPickerItems(slotIndex) {
  const occupied = new Set(
    state.ui.supportIds.filter((id, idx) => id != null && idx !== slotIndex)
  );
  const filters = getSupportFilterState();

  return [...state.supports]
    .filter((s) => {
      if (occupied.has(s.id)) return false;
      return supportMatchesFilters(s, filters, state.ui.supportIds[slotIndex]);
    })
    .sort((a, b) => b.id - a.id)
    .map((s) => {
      const typeStyle = getSupportTypeStyle(s.type);
      return {
        id: s.id,
        label: s.characterName || s.name,
        searchText: buildCharacterNameSearchText(s.characterName || s.name),
        html: buildCardFaceHtml({
          imageUrl: supportImageUrl(s.id),
          typeStyle,
          rarity: s.rarity,
          label: shortSupportLabel(s),
          showTextOverlay: false,
        }),
      };
    });
}

function openCharacterPicker() {
  if (!cardPicker) return;
  const preview = buildCharacterPreview(state.ui.characterId);
  cardPicker.open({
    title: "育成ウマ娘を選択（覚醒Lv5想定）",
    mode: "character",
    previewImageUrl: preview.imageUrl,
    previewLabel: preview.label,
    items: buildCharacterPickerItems(),
    selectedId: state.ui.characterId,
    allowClear: false,
    onPick: (id) => {
      if (id == null) return;
      const prevId = state.ui.characterId;
      state.ui.characterId = id;
      syncHiddenCharacterSelect();
      applyDesignTitleOnCharacterChange(prevId, id);
      renderDeckCharacter();
      scenarioLinkUi.renderScenarioLinkRadios();
      recalc();
    },
  });
}

function openSupportPicker(slotIndex) {
  if (!cardPicker) return;
  renderPickerTypeChips();
  const preview = buildSupportPreview(state.ui.supportIds[slotIndex]);
  cardPicker.open({
    title: `サポートカード 枠${slotIndex + 1}`,
    mode: "support",
    previewImageUrl: preview.imageUrl,
    previewLabel: preview.label,
    getItems: () => buildSupportPickerItems(slotIndex),
    selectedId: state.ui.supportIds[slotIndex],
    allowClear: true,
    showSupportFilters: true,
    onFiltersChange: () => {
      const active = document.querySelector("#card-picker-type-chips .type-chip.is-active");
      supportPickerTypeFilter = active?.dataset?.type ?? "";
    },
    onPick: (id) => {
      state.ui.supportIds[slotIndex] = id;
      renderDeckSupports();
      eventUi.renderEvents();
      scenarioLinkUi.renderScenarioLinkRadios();
      recalc();
    },
  });
}

function renderPickerTypeChips() {
  const container = document.getElementById("card-picker-type-chips");
  if (!container) return;
  const types = [
    { value: "", label: "すべて" },
    { value: "speed", label: "スピ" },
    { value: "stamina", label: "スタ" },
    { value: "power", label: "パワ" },
    { value: "guts", label: "根性" },
    { value: "wit", label: "賢さ" },
    { value: "friend", label: "友人" },
  ];
  container.innerHTML = types
    .map(({ value, label }) => {
      const active = supportPickerTypeFilter === value;
      const dot = value
        ? `<span class="type-chip__dot type-chip__dot--${escapeHtml(value)}" aria-hidden="true"></span>`
        : "";
      return `<button type="button" class="type-chip${active ? " is-active" : ""}" data-type="${escapeHtml(value)}" aria-pressed="${active ? "true" : "false"}">${dot}${escapeHtml(label)}</button>`;
    })
    .join("");
}

function bindPickerFilters() {
  renderPickerTypeChips();
}

function renderCharacterSelect() {
  const sel = document.getElementById("character-select");
  if (!sel) return;

  const sorted = [...state.characters]
    .map((c) => ({
      ...c,
      displayName: formatCharacterDisplayName(c.name),
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "ja"));

  sel.innerHTML = sorted
    .map((c) => {
      const selected = c.id === state.ui.characterId ? " selected" : "";
      return `<option value="${c.id}"${selected}>${escapeHtml(c.displayName)}</option>`;
    })
    .join("");

  renderDeckCharacter();
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
  const inherit = readInheritParams();
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
    inheritCount.value = String(clampInheritCount(options.inheritCount));
  }

  const inheritHint = document.getElementById("inherit-hint");
  if (inheritHint && options.inheritHintLevel != null) {
    inheritHint.value = String(clampInheritHint(options.inheritHintLevel));
  }

  const inheritBase = document.getElementById("inherit-base");
  if (inheritBase) inheritBase.value = String(INHERIT_BASE_SP);

  syncInheritPopoverUi();
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

/** localStorage キー: レイアウト好み gallery | split（旧 auto は gallery へ移行） */
const LAYOUT_MODE_KEY = "umamusume-sp-calc-layout-mode";
const LAYOUT_NARROW_MQ = "(max-width: 1199px)";

function isLayoutNarrow() {
  return window.matchMedia(LAYOUT_NARROW_MQ).matches;
}

function normalizeLayoutPref(pref) {
  if (pref === "auto") return "gallery";
  return pref === "split" ? "split" : "gallery";
}

function resolveLayoutMode(pref) {
  if (isLayoutNarrow()) return "gallery";
  return normalizeLayoutPref(pref);
}

function placeLayoutShare(narrow) {
  const share = document.getElementById("layout-share");
  const modebar = document.querySelector(".layout-modebar");
  const panelSlot = document.getElementById("result-panel-share");
  if (!share) return;
  if (narrow && panelSlot) {
    panelSlot.appendChild(share);
    share.classList.add("layout-share--on-panel");
    share.classList.remove("layout-share--in-bar");
    panelSlot.hidden = false;
    panelSlot.removeAttribute("aria-hidden");
  } else if (modebar) {
    modebar.appendChild(share);
    share.classList.remove("layout-share--on-panel", "layout-share--in-bar");
    if (panelSlot) {
      panelSlot.hidden = true;
      panelSlot.setAttribute("aria-hidden", "true");
    }
  }
}

function placeTotalSpBar(enteringSplit) {
  const bar = document.getElementById("total-sp-bar");
  const modebar = document.querySelector(".layout-modebar");
  const main = document.querySelector(".app-main");
  const actions = document.querySelector(".header-actions");
  const brand = document.querySelector(".total-sp-bar__brand");
  const header = document.querySelector(".app-header");
  if (!bar) return;
  const narrow = isLayoutNarrow();
  const splitBar = enteringSplit && !narrow;
  bar.classList.toggle("total-sp-bar--split-cmd", splitBar);
  if (splitBar && modebar) {
    modebar.after(bar);
  } else if (main) {
    main.after(bar);
  }
  if (splitBar && brand && actions) {
    brand.appendChild(actions);
  } else if (header && actions) {
    header.appendChild(actions);
  }
  placeLayoutShare(narrow);
}

function applyLayoutMode(effective) {
  const enteringSplit = effective === "split";
  /* ギャラリーで下にスクロールしたまま split の overflow:hidden に入ると切替バーが画面外で操作不能になる */
  if (enteringSplit) {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  } else {
    eventUi.closeSplitEvtPane();
  }
  document.documentElement.classList.toggle("layout-split", enteringSplit);
  document.documentElement.classList.toggle("layout-gallery", !enteringSplit);
  document.body.classList.toggle("layout-split", enteringSplit);
  document.body.classList.toggle("layout-gallery", !enteringSplit);
  placeTotalSpBar(enteringSplit);
  if (inheritPopoverOpen) {
    requestAnimationFrame(() => syncInheritPopoverAnchor());
  }
}

function bindLayoutMode() {
  const hint = document.getElementById("layout-mode-hint");
  const buttons = document.querySelectorAll("[data-layout-mode]");
  let pref = normalizeLayoutPref(localStorage.getItem(LAYOUT_MODE_KEY) || "gallery");
  if (localStorage.getItem(LAYOUT_MODE_KEY) === "auto") {
    localStorage.setItem(LAYOUT_MODE_KEY, "gallery");
  }

  const sync = () => {
    const narrow = isLayoutNarrow();
    document.documentElement.classList.toggle("layout-narrow", narrow);
    document.body.classList.toggle("layout-narrow", narrow);
    const effective = resolveLayoutMode(pref);
    applyLayoutMode(effective);
    buttons.forEach((btn) => {
      btn.classList.toggle("is-on", btn.getAttribute("data-layout-mode") === pref);
    });
    if (hint) {
      hint.textContent =
        effective === "split"
          ? "スプリット: 上＝合計 · 左＝編成・イベント / 右＝結果"
          : "ギャラリー: 上段＝編成 / 下段＝結果";
    }
  };

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (isLayoutNarrow()) return;
      pref = normalizeLayoutPref(btn.getAttribute("data-layout-mode") || "gallery");
      localStorage.setItem(LAYOUT_MODE_KEY, pref);
      sync();
    });
  });
  window.addEventListener("resize", () => {
    sync();
    if (inheritPopoverOpen) {
      requestAnimationFrame(() => syncInheritPopoverAnchor());
    }
  });
  sync();
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

  const inherit = readInheritParams();
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
  updateTotalBarChips(effectiveExcluded.size);
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

/** 共有カード用のデータモデルを組み立て */
function getShareCardPayload() {
  return buildShareCardModel({
    plan: currentPlan,
    ui: state.ui,
    skills: state.skills,
    supports: state.supports,
    characters: state.characters,
    scenario: state.scenario,
    options: readDesignOptions(),
    committedSkillFilter,
    excludedSkillIds,
    reguExcludedCount: currentReguExcludedCount,
    designTitle: readDesignTitle(),
  });
}

/** スクショボタンの一時フィードバック */
function showShareCardButtonFeedback(btn, defaultLabel, message, isError = false) {
  if (!btn) return;
  btn.dataset.feedback = "1";
  btn.textContent = message;
  btn.classList.toggle("share-card-btn--error", isError);
  window.setTimeout(() => {
    delete btn.dataset.feedback;
    btn.classList.remove("share-card-btn--error");
    btn.textContent = defaultLabel;
  }, 2000);
}

function bindShareCardButtons() {
  const copyBtn = document.getElementById("copy-share-card");
  const saveBtn = document.getElementById("save-share-card");
  const mount = document.getElementById("share-card-mount");
  if (!copyBtn || !saveBtn || !mount) return;

  shareCardCopyDefaultLabel = copyBtn.textContent.trim();
  shareCardSaveDefaultLabel = saveBtn.textContent.trim();

  const cleanupMount = () => {
    mount.replaceChildren();
    mount.setAttribute("aria-hidden", "true");
  };

  const runShare = async (mode) => {
    if (!currentPlan || !state) return;
    const isCopy = mode === "copy";
    const btn = isCopy ? copyBtn : saveBtn;
    const defaultLabel = isCopy ? shareCardCopyDefaultLabel : shareCardSaveDefaultLabel;

    copyBtn.disabled = true;
    saveBtn.disabled = true;

    try {
      const model = getShareCardPayload();
      const card = await renderShareCardToMount(mount, model);
      if (isCopy) {
        const ok = await copyShareCardPng(card, mount);
        showShareCardButtonFeedback(
          btn,
          defaultLabel,
          ok ? "コピーしました" : "コピーに失敗",
          !ok
        );
      } else {
        await saveShareCardPng(card, mount, {
          title: model.title,
          totalSp: model.totalSp,
        });
        showShareCardButtonFeedback(btn, defaultLabel, "保存しました", false);
      }
    } catch (e) {
      console.error(e);
      showShareCardButtonFeedback(btn, defaultLabel, "失敗しました", true);
    } finally {
      cleanupMount();
      copyBtn.disabled = false;
      saveBtn.disabled = false;
    }
  };

  copyBtn.addEventListener("click", () => runShare("copy"));
  saveBtn.addEventListener("click", () => runShare("save"));
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
    renderCharacterSelect();
    syncHiddenCharacterSelect();

    cardPicker = createCardPicker({
      dialog: document.getElementById("card-picker"),
      titleEl: document.getElementById("card-picker-title"),
      previewThumbEl: document.getElementById("card-picker-preview-thumb"),
      previewNameEl: document.getElementById("card-picker-preview-name"),
      searchEl: document.getElementById("card-picker-search"),
      gridEl: document.getElementById("card-picker-grid"),
      closeBtn: document.getElementById("card-picker-close"),
      clearBtn: document.getElementById("card-picker-clear"),
      filtersEl: document.getElementById("card-picker-filters"),
    });

    document.getElementById("deck-character")?.addEventListener("click", openCharacterPicker);
    bindPremiseChipsOnce();
    bindPickerFilters();
    bindLayoutMode();
    eventUi.bindEventChoiceDialog();
    bindInheritPopover();
    renderDeckDashboard();
    updateTotalBarChips();

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
    bindShareCardButtons();
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
