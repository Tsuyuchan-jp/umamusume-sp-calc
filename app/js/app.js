import { buildSkillPlan } from "./aggregate.js";
import {
  characterImageUrl,
  getSupportTypeStyle,
  shortCharacterLabel,
  shortSupportLabel,
  supportImageUrl,
} from "./cardAssets.js";
import { createCardPicker } from "./cardPicker.js";
import {
  buildCharacterNameSearchText,
  normalizeSearchText,
} from "./searchText.js";
import {
  copyTextToClipboard,
  formatIncludedSkillNames,
  getIncludedSkillRows,
} from "./copyIncludedSkills.js";
import {
  defaultDesignTitleFromCharacterName,
  resolveDesignTitleOnCharacterChange,
} from "./designTitle.js";
import {
  applyDesignSnapshot,
  captureDesignSnapshot,
  sanitizeDesignSnapshot,
} from "./designSnapshot.js";
import {
  deleteEntry as deleteMemoryEntry,
  listEntries as listMemoryEntries,
  saveEntry as saveMemoryEntry,
} from "./designMemory.js";
import {
  loadSessionSnapshot,
  saveSessionSnapshot,
} from "./designSession.js";
import {
  getDeckLinkCharacterIds,
  resolveLinkSkill,
} from "./scenarioLink.js";
import {
  formatActivationTagLabels,
  getDisplayActivation,
  getEffectiveExcludedSkillIds,
  getIncompatibleSkillIds,
  hasActivationConstraints,
  pruneManualExclusions,
} from "./skillActivation.js";
import {
  formatSourceKindLabel,
  sortPlanRows,
  orderSourcesByAdopted,
} from "./skillSource.js";
import { calcSkillCost } from "./spCost.js";
import {
  buildShareCardFilename,
  buildShareCardModel,
  copyShareCardPng,
  renderShareCardToMount,
  saveShareCardPng,
} from "./shareCard.js";

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

/** 直近の復元で落とした不正 ID の警告（次の復元まで保持） */
let lastRestoreIdWarnings = [];
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

/** セッション自動保存の debounce */
let sessionSaveTimer = null;

/** セッション即時保存のイベント登録済み */
let sessionFlushBound = false;

/** スプリット左ドックでフォーカス中のサポ枠（0–5）。ギャラリーでは未使用 */
let focusSupportSlot = null;

/** スプリット詳細ペインで開いているイベント（再タップ閉じ用） */
let splitEvtOpen = null;

/** ピッカー内タイプ絞込（すべて = ""） */
let supportPickerTypeFilter = "";

/** Pages の max-age キャッシュで古い events.json が残るのを防ぐ（版上げ時に更新） */
const DATA_CACHE_BUST = "0.1.15";

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

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** [衣装]キャラ名 → キャラ名[衣装] */
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
  scheduleSessionSave();
}

function applyDesignTitleFromSnapshot(snapshot) {
  const title = String(snapshot?.designTitle || "").trim();
  if (title) {
    setDesignTitle(title);
  } else {
    setDesignTitleDefaultForCurrentCharacter();
  }
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

  input.addEventListener("input", () => scheduleSessionSave());
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
  lastRestoreIdWarnings = [];
  focusSupportSlot = null;
  setInheritPopoverOpen(false);

  const splitPane = document.getElementById("split-evt-pane");
  if (splitPane) {
    splitPane.hidden = true;
    splitEvtOpen = null;
  }

  leaveDesignTitleEdit();
  setDesignTitleDefaultForCurrentCharacter();

  syncHiddenCharacterSelect();
  renderCharacterSelect();
  renderDeckDashboard();
  renderEvents();
  renderScenarioLinkRadios();
  renderSeniorRmjRadios();
  renderScenarioAuto();
  updateTotalBarChips();
  recalc();
  flushSessionSave();
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
    col.className = "deck-support-col" + (focusSupportSlot === i ? " is-focus" : "");
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
  renderColumnEvents();
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
      renderScenarioLinkRadios();
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
      renderEvents();
      renderScenarioLinkRadios();
      recalc();
    },
  });
}

function renderSupportSlots() {
  renderDeckDashboard();
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
        ? `<span class="type-chip__dot" data-type="${escapeHtml(value)}"></span>`
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

/** 現在の画面状態をスナップショット化 */
function captureCurrentDesign() {
  return captureDesignSnapshot({
    ui: state.ui,
    options: readDesignOptions(),
    excludedSkillIds,
    committedSkillFilter,
    designTitle: readDesignTitle(),
  });
}

/** 前回セッションを debounce 保存（メモリ一覧とは別） */
function scheduleSessionSave() {
  if (!state) return;
  clearTimeout(sessionSaveTimer);
  sessionSaveTimer = setTimeout(() => {
    sessionSaveTimer = null;
    if (!state) return;
    saveSessionSnapshot(captureCurrentDesign());
  }, 350);
}

/** 未保存の変更を即時書き込み（タブ閉じ・非表示時） */
function flushSessionSave() {
  if (sessionSaveTimer != null) {
    clearTimeout(sessionSaveTimer);
    sessionSaveTimer = null;
  }
  if (!state) return;
  saveSessionSnapshot(captureCurrentDesign());
}

/** タブ非表示・ページ離脱時にセッションを flush */
function bindSessionFlushOnce() {
  if (sessionFlushBound) return;
  sessionFlushBound = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushSessionSave();
  });
  window.addEventListener("pagehide", () => flushSessionSave());
}

/**
 * スナップショットを画面へ復元
 * @param {object} snapshot
 * @returns {boolean}
 */
function restoreDesign(snapshot) {
  if (!state) return false;
  lastRestoreIdWarnings = [];

  const { snapshot: sanitized, warnings } = sanitizeDesignSnapshot(snapshot, {
    characters: state.characters,
    supports: state.supports,
  });
  lastRestoreIdWarnings = warnings;

  const applied = applyDesignSnapshot(sanitized, state.ui);
  if (!applied) return false;

  // 未知イベント ID を落とす
  const knownEventIds = new Set((state.events.events || []).map((e) => e.id));
  state.ui.enabledEventIds = new Set(
    [...state.ui.enabledEventIds].filter((id) => knownEventIds.has(id))
  );
  for (const id of [...state.ui.eventChoiceIds.keys()]) {
    if (!knownEventIds.has(id)) state.ui.eventChoiceIds.delete(id);
  }
  // single イベントの欠落キーを既定で補完
  for (const evt of state.events.events || []) {
    if (evt.selection === "single" && !state.ui.eventChoiceIds.has(evt.id)) {
      const def = evt.defaultChoiceId ?? evt.choices?.[0]?.id;
      if (def) state.ui.eventChoiceIds.set(evt.id, def);
    } else if (evt.selection === "single") {
      // 旧「未選択」や不正IDを既定へ寄せる
      resolveEventChoiceId(evt);
    }
  }

  writeDesignOptions(applied.options);
  excludedSkillIds.clear();
  for (const id of applied.excludedSkillIds) {
    const n = Number(id);
    if (!Number.isNaN(n)) excludedSkillIds.add(n);
  }
  committedSkillFilter = {
    ground: applied.committedSkillFilter.ground || "",
    distance: applied.committedSkillFilter.distance || "",
    style: applied.committedSkillFilter.style || "",
  };
  writeSkillFilterUI(committedSkillFilter);
  previousTotal = null;

  applyDesignTitleFromSnapshot(sanitized);

  syncHiddenCharacterSelect();
  renderDeckDashboard();
  renderEvents();
  renderScenarioLinkRadios();
  renderSeniorRmjRadios();
  recalc();
  return true;
}

function formatMemoryUpdatedAt(ts) {
  try {
    return new Date(ts).toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function renderMemoryDeckThumbHtml(snapshot) {
  if (!snapshot) return "";
  const thumbCell = (url, empty = false) => {
    if (empty || !url) {
      return `<div class="memory-deck-thumb__cell memory-deck-thumb__cell--empty"></div>`;
    }
    return `<div class="memory-deck-thumb__cell"><img src="${escapeHtml(url)}" alt="" loading="lazy" decoding="async" /></div>`;
  };
  const charId = snapshot.characterId;
  const charCell = charId
    ? `<div class="memory-deck-thumb__char">${thumbCell(characterImageUrl(charId))}</div>`
    : `<div class="memory-deck-thumb__char">${thumbCell(null, true)}</div>`;
  const supportIds = Array.isArray(snapshot.supportIds) ? snapshot.supportIds : [];
  const supCells = [];
  for (let i = 0; i < 6; i++) {
    const id = supportIds[i];
    supCells.push(thumbCell(id != null ? supportImageUrl(id) : null, id == null));
  }
  return `<div class="memory-deck-thumb" aria-hidden="true">${charCell}<div class="memory-deck-thumb__grid">${supCells.join("")}</div></div>`;
}

function renderMemoryList() {
  const list = document.getElementById("memory-list");
  if (!list) return;
  const entries = listMemoryEntries();
  list.innerHTML = "";
  if (!entries.length) {
    list.innerHTML = '<li class="memory-list__empty">保存済みの設計はまだありません</li>';
    return;
  }
  for (const entry of entries) {
    const li = document.createElement("li");
    li.className = "memory-item";
    const sp =
      entry.totalSp == null ? "—" : `${Number(entry.totalSp).toLocaleString("ja-JP")} SP`;
    li.innerHTML = `
      ${renderMemoryDeckThumbHtml(entry.snapshot)}
      <div class="memory-item__meta">
        <div class="memory-item__name">${escapeHtml(entry.name)}</div>
        <div class="memory-item__sub">${escapeHtml(formatMemoryUpdatedAt(entry.updatedAt))} · ${escapeHtml(sp)}</div>
      </div>
      <div class="memory-item__actions">
        <button type="button" class="memory-restore-btn" data-id="${escapeHtml(entry.id)}">復元</button>
        <button type="button" class="memory-delete-btn" data-id="${escapeHtml(entry.id)}">削除</button>
      </div>
    `;
    list.appendChild(li);
  }
}

function bindMemoryDialog() {
  const dialog = document.getElementById("memory-dialog");
  const openBtn = document.getElementById("memory-open");
  const closeBtn = document.getElementById("memory-close");
  const saveBtn = document.getElementById("memory-save-btn");
  const nameInput = document.getElementById("memory-name-input");
  const list = document.getElementById("memory-list");
  if (!dialog || !openBtn || !closeBtn || !saveBtn || !nameInput || !list) return;

  openBtn.addEventListener("click", () => {
    renderMemoryList();
    nameInput.value = readDesignTitle();
    dialog.showModal();
    nameInput.focus();
    nameInput.select();
  });

  closeBtn.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });

  saveBtn.addEventListener("click", () => {
    if (!state) return;
    const snapshot = captureCurrentDesign();
    saveMemoryEntry({
      name: nameInput.value,
      snapshot,
      totalSp: currentPlan?.total ?? null,
    });
    nameInput.value = "";
    renderMemoryList();
  });

  nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveBtn.click();
    }
  });

  list.addEventListener("click", (e) => {
    const restoreBtn = e.target.closest(".memory-restore-btn");
    const deleteBtn = e.target.closest(".memory-delete-btn");
    if (restoreBtn) {
      const id = restoreBtn.dataset.id;
      const entries = listMemoryEntries();
      const entry = entries.find((x) => x.id === id);
      if (!entry?.snapshot) return;
      if (!window.confirm(`「${entry.name}」を復元しますか？\n現在の画面状態は上書きされます。`)) {
        return;
      }
      if (restoreDesign(entry.snapshot)) {
        const restoredTitle = String(entry.name || "").trim();
        if (restoredTitle) {
          setDesignTitle(restoredTitle);
        } else {
          setDesignTitleDefaultForCurrentCharacter();
        }
        scheduleSessionSave();
        dialog.close();
      } else {
        window.alert("この設計は復元できませんでした（形式が古い可能性があります）。");
      }
      return;
    }
    if (deleteBtn) {
      const id = deleteBtn.dataset.id;
      const entries = listMemoryEntries();
      const entry = entries.find((x) => x.id === id);
      if (!entry) return;
      if (!window.confirm(`「${entry.name}」を削除しますか？`)) return;
      deleteMemoryEntry(id);
      renderMemoryList();
    }
  });
}

function getEventsForSupport(support) {
  if (!support) return [];
  return (state.events.events || []).filter(
    (evt) => evt.supportNameMatch && support.name.includes(evt.supportNameMatch)
  );
}

/** 選択肢の種別: 金(rarity2) / 白 / ステのみ */
function choiceKind(choice) {
  const skills = choice?.skills || [];
  if (skills.length === 0) return "stat";
  const map = getSkillByIdMap();
  if (skills.some((sk) => map.get(sk.skillId)?.rarity === 2)) return "gold";
  return "white";
}

function kindBadgeHtml(kind) {
  if (kind === "gold") return '<span class="evt-badge evt-badge--gold">金</span>';
  if (kind === "white") return '<span class="evt-badge evt-badge--white">白</span>';
  if (kind === "stat") return '<span class="evt-badge evt-badge--stat">ステ</span>';
  if (kind === "auto") return '<span class="evt-badge evt-badge--auto">自動</span>';
  return "";
}

function sortChoicesGoldFirst(choices) {
  return [...(choices || [])].sort((a, b) => {
    const ka = choiceKind(a) === "gold" ? 0 : 1;
    const kb = choiceKind(b) === "gold" ? 0 : 1;
    return ka - kb;
  });
}

function shortChoiceLabel(choice) {
  return (choice?.label || "").replace(/^[①②③④⑤⑥⑦⑧⑨⑩]\s*/, "");
}

function goldSkillsFromList(skills) {
  const map = getSkillByIdMap();
  return (skills || [])
    .filter((sk) => map.get(sk.skillId)?.rarity === 2)
    .map((sk) => ({
      skillName: sk.skillName,
      hintLevel: sk.hintLevel,
    }));
}

function goldSkillNamesFromSkills(skills) {
  return goldSkillsFromList(skills).map((sk) => sk.skillName);
}

/** 列下・金スキル行（1スキル1行・Lv付き） */
function columnGoldSkillLinesHtml(skills) {
  const golds = goldSkillsFromList(skills);
  return golds
    .map(
      (sk) =>
        `<span class="deck-evt-sum__skill-line">${escapeHtml(`${sk.skillName} Lv${sk.hintLevel}`)}</span>`
    )
    .join("");
}

function columnGoldSkillTitleText(skills) {
  return goldSkillsFromList(skills)
    .map((sk) => `${sk.skillName} Lv${sk.hintLevel}`)
    .join("、");
}

/** single の選択IDを既定へ正規化（未選択なし） */
function resolveEventChoiceId(evt) {
  const choices = evt.choices || [];
  const def = evt.defaultChoiceId ?? choices[0]?.id;
  let cur = state.ui.eventChoiceIds.get(evt.id);
  if (!cur || cur === "none" || !choices.some((c) => c.id === cur)) {
    cur = def;
    if (cur) state.ui.eventChoiceIds.set(evt.id, cur);
  }
  return cur;
}

/** 選択肢パネル用。label と skills 一覧は同内容なので二重表示しない */
function choicePanelDescHtml(skills, emptyFallback) {
  if (skills && skills.length > 0) return "";
  return `<div class="evt-choice-panel__desc">${escapeHtml(emptyFallback)}</div>`;
}

function renderChoicePanelButtons(container, evt, onAfter) {
  container.innerHTML = "";
  if (evt.selection === "toggle") {
    const on = state.ui.enabledEventIds.has(evt.id);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "evt-choice-panel" + (on ? " is-on" : "");
    const title =
      formatSkillList(evt.skills) ||
      evt.label.replace(/^[①②③④⑤⑥⑦⑧⑨⑩]\s*/, "") ||
      "ON/OFF";
    btn.innerHTML = `
      <span class="evt-choice-panel__kind">${kindBadgeHtml("white")}</span>
      <span class="evt-choice-panel__main">
        <span class="evt-choice-panel__title">${escapeHtml(title)}</span>
      </span>
      <span class="evt-choice-panel__pick">${on ? "ON" : "OFF"}</span>`;
    btn.onclick = () => {
      if (state.ui.enabledEventIds.has(evt.id)) state.ui.enabledEventIds.delete(evt.id);
      else state.ui.enabledEventIds.add(evt.id);
      onAfter();
    };
    container.appendChild(btn);
    return;
  }

  const current = resolveEventChoiceId(evt);
  for (const choice of sortChoicesGoldFirst(evt.choices || [])) {
    const kind = choiceKind(choice);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "evt-choice-panel" + (current === choice.id ? " is-on" : "");
    btn.innerHTML = `
      <span class="evt-choice-panel__kind">${kindBadgeHtml(kind)}</span>
      <span class="evt-choice-panel__main">
        <span class="evt-choice-panel__title">${escapeHtml(shortChoiceLabel(choice))}</span>
        ${choicePanelDescHtml(choice.skills, "ステータス分岐など")}
      </span>
      <span class="evt-choice-panel__pick">${current === choice.id ? "選択中" : "選ぶ"}</span>`;
    btn.onclick = () => {
      state.ui.eventChoiceIds.set(evt.id, choice.id);
      onAfter();
    };
    container.appendChild(btn);
  }
}

function isSplitLayout() {
  return document.body.classList.contains("layout-split");
}

function setFocusSupportSlot(slotIndex) {
  focusSupportSlot = slotIndex;
  document.querySelectorAll(".deck-support-col").forEach((el) => {
    const i = Number(el.dataset.slot);
    el.classList.toggle("is-focus", focusSupportSlot === i);
  });
}

function closeSplitEvtPane() {
  const pane = document.getElementById("split-evt-pane");
  if (pane) pane.hidden = true;
  splitEvtOpen = null;
  setFocusSupportSlot(null);
}

function openEventChoicePane(evt, slotIndex) {
  const pane = document.getElementById("split-evt-pane");
  const title = document.getElementById("split-evt-pane-title");
  const sub = document.getElementById("split-evt-pane-sub");
  const body = document.getElementById("split-evt-pane-body");
  if (!pane || !body) return;

  if (typeof slotIndex === "number") setFocusSupportSlot(slotIndex);

  const support =
    typeof slotIndex === "number" && state?.ui?.supportIds[slotIndex] != null
      ? getSupportById(state.ui.supportIds[slotIndex])
      : null;
  const slotLabel =
    typeof slotIndex === "number" ? `${slotIndex + 1}. ` : "";
  const name = support ? shortSupportLabel(support) : "";
  title.textContent = `${slotLabel}${name || evt.label}`;
  sub.textContent = "カード帯・同じ項目・Esc で閉じる";

  const refresh = () => {
    renderColumnEvents();
    renderChoicePanelButtons(body, evt, () => {
      recalc();
      refresh();
    });
  };
  refresh();
  splitEvtOpen = { evtId: evt.id, slotIndex };
  pane.hidden = false;
}

function openEventChoiceDialog(evt) {
  const dialog = document.getElementById("event-choice-dialog");
  const title = document.getElementById("event-choice-dialog-title");
  const sub = document.getElementById("event-choice-dialog-sub");
  const body = document.getElementById("event-choice-dialog-body");
  if (!dialog || !body) return;
  title.textContent = evt.label;
  sub.textContent =
    evt.selection === "toggle" ? "ON/OFF を切り替え" : "金・白・ステから必ず1つ選びます";
  const refresh = () => {
    renderColumnEvents();
    renderChoicePanelButtons(body, evt, () => {
      recalc();
      refresh();
    });
  };
  refresh();
  if (typeof dialog.showModal === "function") dialog.showModal();
}

function openEventChoiceUi(evt, slotIndex) {
  if (isSplitLayout()) {
    const pane = document.getElementById("split-evt-pane");
    const sameOpen =
      pane &&
      !pane.hidden &&
      splitEvtOpen &&
      splitEvtOpen.evtId === evt.id &&
      splitEvtOpen.slotIndex === slotIndex;
    if (sameOpen) {
      closeSplitEvtPane();
      return;
    }
    openEventChoicePane(evt, slotIndex);
    return;
  }
  openEventChoiceDialog(evt);
}

function bindEventChoiceDialog() {
  const dialog = document.getElementById("event-choice-dialog");
  const closeBtn = document.getElementById("event-choice-close");
  closeBtn?.addEventListener("click", () => dialog?.close());
  dialog?.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });
  document.getElementById("split-evt-pane-close")?.addEventListener("click", () => {
    closeSplitEvtPane();
  });
  /* スプリット詳細のみ: Esc で閉じる（ギャラリーのダイアログはネイティブ Esc） */
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!isSplitLayout()) return;
    const pane = document.getElementById("split-evt-pane");
    if (!pane || pane.hidden) return;
    closeSplitEvtPane();
  });
  /* 編成上部（カード帯）クリックはモーダル風に先にペインを閉じる。要約は openEventChoiceUi 側 */
  document.querySelector(".deck-dashboard")?.addEventListener("click", (e) => {
    if (!isSplitLayout()) return;
    const pane = document.getElementById("split-evt-pane");
    if (!pane || pane.hidden) return;
    if (e.target.closest(".deck-evt-sum")) return;
    closeSplitEvtPane();
  });
}

/** 列下要約の並び: 金自動 → 金選択式 → 白/ステ選択式 → 非金自動 */
function columnEventSortKey(evt) {
  if (evt.selection === "auto") {
    return goldSkillNamesFromSkills(evt.skills).length > 0 ? 0 : 4;
  }
  return selectableEventSortKey(evt) + 1;
}

/** 選択式イベント内の並び: 金 → 白 → ステ/toggle */
function selectableEventSortKey(evt) {
  if (evt.selection === "toggle") return 2;
  const choices = evt.choices || [];
  const hasGold = choices.some((c) => choiceKind(c) === "gold");
  const choiceId = resolveEventChoiceId(evt);
  const current = choices.find((c) => c.id === choiceId);
  const curKind = current ? choiceKind(current) : "stat";
  if (curKind === "gold" || hasGold) return 0;
  if (curKind === "white") return 1;
  return 2;
}

/** 列下: Aは要約タップで詳細。Bサポカ自動は列下のみ（金なら金トーン） */
function renderColumnEvents() {
  if (!state) return;
  for (let i = 0; i < 6; i++) {
    const container = document.getElementById(`deck-slot-events-${i}`);
    if (!container) continue;
    container.innerHTML = "";
    const id = state.ui.supportIds[i];
    const support = id != null ? getSupportById(id) : null;
    if (!support) continue;

    const events = getEventsForSupport(support)
      .map((evt, index) => ({ evt, index }))
      .sort((a, b) => {
        const ka = columnEventSortKey(a.evt);
        const kb = columnEventSortKey(b.evt);
        if (ka !== kb) return ka - kb;
        return a.index - b.index;
      })
      .map(({ evt }) => evt);

    for (const evt of events) {
      if (evt.selection === "auto") {
        const golds = goldSkillsFromList(evt.skills);
        const isGold = golds.length > 0;
        const label = isGold
          ? columnGoldSkillLinesHtml(evt.skills)
          : escapeHtml(evt.skills?.[0]?.skillName || "自動");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className =
          "deck-evt-sum" +
          (isGold ? " deck-evt-sum--gold" : " deck-evt-sum--auto") +
          (isGold && golds.length === 1 ? " deck-evt-sum--gold-1line" : "");
        btn.title = isGold
          ? `${evt.label || "自動計上"} — ${columnGoldSkillTitleText(evt.skills)}`
          : evt.label || "自動計上";
        btn.innerHTML = `<span class="deck-evt-sum__bar" aria-hidden="true"></span><span class="deck-evt-sum__name">${label}</span><span class="deck-evt-sum__meta">自動</span>`;
        btn.addEventListener("click", () => {
          /* サポカ自動は列下で完結。編集不可のためダイアログは開かない */
        });
        container.appendChild(btn);
        continue;
      }

      const btn = document.createElement("button");
      btn.type = "button";
      const paneOpen =
        isSplitLayout() &&
        splitEvtOpen &&
        splitEvtOpen.evtId === evt.id &&
        splitEvtOpen.slotIndex === i;
      if (evt.selection === "toggle") {
        const on = state.ui.enabledEventIds.has(evt.id);
        const label = evt.label.replace(/^[^ ]+ /, "");
        btn.className = "deck-evt-sum deck-evt-sum--white";
        btn.title = on ? "ON · タップで詳細" : "OFF · タップで詳細";
        if (paneOpen) btn.title = "タップで閉じる";
        btn.innerHTML = `<span class="deck-evt-sum__bar" aria-hidden="true"></span><span class="deck-evt-sum__name">${escapeHtml(label)}</span><span class="deck-evt-sum__meta">${on ? "ON" : "OFF"}</span>`;
      } else {
        const choiceId = resolveEventChoiceId(evt);
        const choice = (evt.choices || []).find((c) => c.id === choiceId);
        const kind = choice ? choiceKind(choice) : "stat";
        const golds = kind === "gold" && choice ? goldSkillsFromList(choice.skills) : [];
        const nameHtml =
          kind === "gold" && choice
            ? columnGoldSkillLinesHtml(choice.skills)
            : escapeHtml(choice ? shortChoiceLabel(choice) : "選択");
        const n = (evt.choices || []).length;
        const kindClass =
          kind === "gold"
            ? "deck-evt-sum--gold"
            : kind === "white"
              ? "deck-evt-sum--white"
              : "deck-evt-sum--stat";
        btn.className =
          `deck-evt-sum ${kindClass}` +
          (kind === "gold" && golds.length === 1 ? " deck-evt-sum--gold-1line" : "");
        btn.title = paneOpen ? "タップで閉じる" : `全${n}択 · タップで詳細`;
        if (kind === "gold" && choice && !paneOpen) {
          btn.title = `${btn.title} — ${columnGoldSkillTitleText(choice.skills)}`;
        }
        btn.innerHTML = `<span class="deck-evt-sum__bar" aria-hidden="true"></span><span class="deck-evt-sum__name">${nameHtml}</span><span class="deck-evt-sum__meta">${n}</span>`;
      }
      btn.addEventListener("click", () => openEventChoiceUi(evt, i));
      container.appendChild(btn);
    }
  }
}

function renderEvents() {
  const emptyHint = document.getElementById("event-empty-hint");

  renderColumnEvents();

  const events = (state.events.events || []).filter(isEventSupportInDeck);
  if (emptyHint) emptyHint.hidden = events.length > 0;
}

/** シナリオ自動計上（折りたたみ・確認のみ） */
function renderScenarioAuto() {
  const container = document.getElementById("scenario-auto");
  const countEl = document.getElementById("scenario-auto-count");
  if (!container) return;
  container.innerHTML = "";

  const entries = state.scenario.scenarioAutoSkills || [];
  if (countEl) countEl.textContent = `${entries.length}件`;

  if (entries.length === 0) {
    container.innerHTML = `<p class="scenario-auto-empty">シナリオ自動なし</p>`;
    return;
  }
  for (const entry of entries) {
    const div = document.createElement("div");
    div.className = "scenario-auto-row";
    div.innerHTML = `
      <div class="scenario-auto-row__label">${escapeHtml(entry.label)}</div>
      <div class="scenario-auto-row__skills">${escapeHtml(formatSkillList(entry.skills))}</div>
    `;
    container.appendChild(div);
  }
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
    closeSplitEvtPane();
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

/** シニア12月 RMJ ラーメン選択（チップ1択・表示はスキル名／すべて金） */
function renderSeniorRmjRadios() {
  const container = document.getElementById("scenario-senior-rmj");
  if (!container) return;
  container.innerHTML = "";
  const rmj = state.scenario.seniorRmjChoice;
  if (!rmj?.choices?.length) return;

  const defaultId = rmj.defaultChoiceId ?? rmj.choices[0].id;
  const current = state.ui.seniorRmjChoiceId ?? defaultId;

  for (const choice of rmj.choices) {
    const skillName = choice.skills?.[0]?.skillName || choice.label || choice.id;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "scn-chip scn-chip--gold" + (current === choice.id ? " is-on" : "");
    btn.setAttribute("aria-pressed", current === choice.id ? "true" : "false");
    btn.innerHTML = `<span class="scn-chip__check" aria-hidden="true">✓</span><span class="scn-chip__gold-mark" aria-hidden="true">金</span>${escapeHtml(skillName)}`;
    const skillNote =
      choice.skills?.length > 0 ? formatSkillList(choice.skills) : "";
    btn.title = skillNote
      ? `${choice.label}（${skillNote}）`
      : choice.label || skillName;
    btn.addEventListener("click", () => {
      if (state.ui.seniorRmjChoiceId === choice.id) return;
      state.ui.seniorRmjChoiceId = choice.id;
      renderSeniorRmjRadios();
      recalc();
    });
    container.appendChild(btn);
  }
}

/** 編成に応じたリンクヒント（白 or 金）を表示用に解決 */
function getResolvedLinkSkill(linkEntry) {
  const supportById = new Map(state.supports.map((s) => [s.id, s]));
  const deckIds = getDeckLinkCharacterIds(
    state.ui.characterId,
    getSupportIds(),
    supportById
  );
  return resolveLinkSkill(linkEntry, deckIds);
}

/** リンク効果が金（対象キャラ編成あり）か */
function isLinkSkillGold(linkEntry) {
  const supportById = new Map(state.supports.map((s) => [s.id, s]));
  const deckIds = getDeckLinkCharacterIds(
    state.ui.characterId,
    getSupportIds(),
    supportById
  );
  const resolved = resolveLinkSkill(linkEntry, deckIds);
  return Boolean(
    resolved &&
      linkEntry.skillWithLink &&
      resolved.skillId === linkEntry.skillWithLink.skillId
  );
}

/** シナリオリンクは相互排他のチップ1択（表示は解決後スキル名） */
function renderScenarioLinkRadios() {
  const container = document.getElementById("scenario-link");
  if (!container) return;
  container.innerHTML = "";
  const links = state.scenario.linkSkills || [];
  if (links.length === 0) return;

  const current = state.ui.scenarioLinkChoiceId ?? "link_dotou";

  for (const entry of links) {
    const resolved = getResolvedLinkSkill(entry);
    const isGold = isLinkSkillGold(entry);
    const skillName = resolved?.skillName || entry.label || entry.id;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "scn-chip" +
      (current === entry.id ? " is-on" : "") +
      (isGold ? " scn-chip--gold" : "");
    btn.setAttribute("aria-pressed", current === entry.id ? "true" : "false");
    const check = `<span class="scn-chip__check" aria-hidden="true">✓</span>`;
    if (isGold) {
      btn.innerHTML = `${check}<span class="scn-chip__gold-mark" aria-hidden="true">金</span>${escapeHtml(skillName)}`;
    } else {
      btn.innerHTML = `${check}${escapeHtml(skillName)}`;
    }
    const linkShort = String(entry.label || "").replace(/リンク$/, "");
    btn.title = resolved
      ? `${linkShort} → ${resolved.skillName} Lv${resolved.hintLevel}${isGold ? "（リンク金）" : ""}`
      : entry.label || skillName;
    btn.addEventListener("click", () => {
      if (state.ui.scenarioLinkChoiceId === entry.id) return;
      state.ui.scenarioLinkChoiceId = entry.id;
      renderScenarioLinkRadios();
      recalc();
    });
    container.appendChild(btn);
  }
}

function buildEnabledScenarioEntryIds() {
  const enabled = new Set();
  const linkId = state.ui.scenarioLinkChoiceId ?? "link_dotou";
  if (linkId) enabled.add(linkId);
  return enabled;
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
  el.textContent = `ONスキル数 ${onCount}/${totalCount}`;
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

function renderActivationSubline(row) {
  if (row.isInherit || row.skillId == null) return "—";
  const skillById = getSkillByIdMap();
  const activation = getDisplayActivation(
    row.skillId,
    row.chainSkillIds || [row.skillId],
    skillById
  );
  if (!hasActivationConstraints(activation.tags)) {
    return '<span class="result-skill-sub__empty">条件なし</span>';
  }
  const labels = formatActivationTagLabels(activation.tags);
  return labels
    .map((label) => `<span class="badge badge--condition">${escapeHtml(label)}</span>`)
    .join("");
}

/**
 * 由来セル: 種別色バッジ + 詳細。title に スキル名・種別・Lv。採用 Lv 一致で強調。
 * @param {{ sources?: { kind: string, label: string, hintLevel: number, skillName?: string }[], hintLevel?: number }} row
 */
function renderSourceBadges(row) {
  const sources = orderSourcesByAdopted(row.sources || [], row.hintLevel);
  if (!sources.length) return "—";
  const adoptedLv = Number(row.hintLevel) || 0;
  return sources
    .map((src) => {
      const kindLabel = formatSourceKindLabel(src.kind);
      const adopted = src.hintLevel === adoptedLv;
      const classes = [
        "badge",
        `badge--source-${src.kind}`,
        adopted ? "badge--adopted" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const skillPart = src.skillName ? `${src.skillName} / ` : "";
      const title = `${skillPart}${kindLabel} Lv${src.hintLevel}`;
      const detail = src.label ? ` ${escapeHtml(src.label)}` : "";
      return `<span class="${classes}" title="${escapeHtml(title)}"><span class="badge__kind">${escapeHtml(kindLabel)}</span>${detail}</span>`;
    })
    .join("");
}

/** 狭幅: スキル名の下に折り返し表示する由来（読みやすさ優先） */
function renderSourceStacked(row) {
  const sources = orderSourcesByAdopted(row.sources || [], row.hintLevel);
  if (!sources.length) {
    return '<span class="result-skill-sources__empty">—</span>';
  }
  const adoptedLv = Number(row.hintLevel) || 0;
  return sources
    .map((src) => {
      const kindLabel = formatSourceKindLabel(src.kind);
      const adopted = src.hintLevel === adoptedLv;
      const lineClass = [
        "result-skill-source-line",
        adopted ? "result-skill-source-line--adopted" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const detail = src.label ? escapeHtml(src.label) : "—";
      return `<div class="${lineClass}"><span class="badge badge--source-${src.kind}"><span class="badge__kind">${escapeHtml(kindLabel)}</span></span><span class="result-skill-source-detail">${detail}</span><span class="result-skill-source-lv">Lv${src.hintLevel}</span></div>`;
    })
    .join("");
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

  const parts = [];
  if (lastRestoreIdWarnings.length) {
    parts.push("復元時の調整: " + lastRestoreIdWarnings.join(" "));
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
  if (lastRestoreIdWarnings.length) {
    console.warn("復元時の ID 調整:", lastRestoreIdWarnings);
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
    enabledScenarioEntryIds: buildEnabledScenarioEntryIds(),
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

  const tbody = document.getElementById("result-body");
  tbody.innerHTML = "";
  const displayRows = sortPlanRows(plan.rows, getResultSortMode(), {
    supportIds: state.ui.supportIds,
  });
  for (const row of displayRows) {
    const tr = document.createElement("tr");
    const isReguExcluded =
      row.skillId != null && reguExcluded.has(row.skillId);
    const isManualExcluded =
      row.skillId != null && excludedSkillIds.has(row.skillId);
    const included = row.skillId == null || !row.excluded;
    if (!included) tr.classList.add("is-off");

    const costDetail =
      row.includesLower && Array.isArray(row.chainCosts) && row.chainCosts.length > 1
        ? `${row.cost} <span class="result-sp-detail">(${row.chainCosts.join("+")})</span>`
        : String(row.cost);

    const toggleTitle = isReguExcluded
      ? "レギュ非互換のため OFF"
      : isManualExcluded
        ? "手動で OFF"
        : "";

    tr.innerHTML = `
      <td class="col-on">
        ${
          row.isInherit
            ? "—"
            : `<input type="checkbox" class="include-check" data-skill-id="${row.skillId}" ${included ? "checked" : ""} ${isReguExcluded ? "disabled" : ""} aria-label="ON" title="${escapeHtml(toggleTitle)}" />`
        }
      </td>
      <td class="result-skill-cell">
        <div class="result-skill-name">${escapeHtml(row.name)}<span class="result-skill-lv">Lv${row.hintLevel}</span></div>
        <div class="result-skill-sub">${renderActivationSubline(row)}</div>
        <div class="result-skill-sources result-skill-sources--narrow">${renderSourceStacked(row)}</div>
      </td>
      <td class="result-skill-sp col-sp">${costDetail}</td>
      <td class="skill-source-cell">${renderSourceBadges(row)}</td>
    `;
    tbody.appendChild(tr);

    const cb = tr.querySelector(".include-check");
    if (cb) {
      cb.addEventListener("change", () => {
        const sid = Number(cb.dataset.skillId);
        if (cb.checked) excludedSkillIds.delete(sid);
        else excludedSkillIds.add(sid);
        recalc();
      });
    }
  }

  scheduleSessionSave();
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
        const filename = buildShareCardFilename({
          title: model.title,
          totalSp: model.totalSp,
        });
        await saveShareCardPng(card, mount, filename);
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
    bindEventChoiceDialog();
    bindInheritPopover();
    renderDeckDashboard();
    updateTotalBarChips();

    renderEventScopeNotice();
    bindEventScopeDisclosure();
    bindHelpDialog();
    bindMemoryDialog();
    bindDesignTitleInput();
    bindDesignResetButton();
    renderEvents();
    renderScenarioLinkRadios();
    renderSeniorRmjRadios();
    renderScenarioAuto();

    bindOptions();
    bindSkillFilters();
    bindResultSort();
    bindCopyIncludedSkills();
    bindShareCardButtons();
    bindSessionFlushOnce();
    committedSkillFilter = readSkillFilterFromUI();

    const session = loadSessionSnapshot();
    if (session && restoreDesign(session)) {
      /* 前回セッションを復元（restoreDesign 内で recalc・編成タイトル反映） */
    } else {
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
