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
  applyDesignSnapshot,
  captureDesignSnapshot,
} from "./designSnapshot.js";
import {
  deleteEntry as deleteMemoryEntry,
  listEntries as listMemoryEntries,
  saveEntry as saveMemoryEntry,
} from "./designMemory.js";
import {
  getDeckLinkCharacterIds,
  resolveLinkSkill,
} from "./scenarioLink.js";
import {
  applyFullFilterExclusions,
  applyIncrementalFilterExclusions,
  collectPlanSkillIds,
  formatActivationTagLabels,
  getDisplayActivation,
  hasActivationConstraints,
  skillFiltersEqual,
} from "./skillActivation.js";
import {
  formatSourceKindLabel,
  sortPlanRows,
  orderSourcesByAdopted,
} from "./skillSource.js";

/** @type {object|null} */
let state = null;

/** @type {Set<number>} */
const excludedSkillIds = new Set();

/** 確定済みレギュ絞込（適用ボタンで更新） */
let committedSkillFilter = { ground: "", distance: "", style: "" };

/** 前回 plan の skillId 集合（増分絞込用） */
let previousPlanSkillIds = new Set();

/** 直近の計画（コピー用） */
let currentPlan = null;

/** コピーボタンの既定ラベル */
let copyIncludedSkillsDefaultLabel = "";

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

/** スプリット左ドックでフォーカス中のサポ枠（0–5）。ギャラリーでは未使用 */
let focusSupportSlot = null;

/** スプリット詳細ペインで開いているイベント（再タップ閉じ用） */
let splitEvtOpen = null;

/** ピッカー内タイプ絞込（すべて = ""） */
let supportPickerTypeFilter = "";

/** Pages の max-age キャッシュで古い events.json が残るのを防ぐ（版上げ時に更新） */
const DATA_CACHE_BUST = "0.1.14";

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
  return {
    query: "",
    eventOnly: document.getElementById("picker-event-only")?.checked ?? true,
    ssrOnly: document.getElementById("picker-ssr-only")?.checked ?? false,
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
      const cb = document.getElementById("inherit-enabled");
      if (!cb) return;
      cb.checked = !cb.checked;
      updateTotalBarChips();
      recalc();
    }
  });
}

function updateTotalBarChips(excludedCount = excludedSkillIds.size) {
  const el = document.getElementById("total-sp-bar-chips");
  if (!el) return;

  const fast = document.getElementById("fast-learner")?.checked;
  const trainingLv = document.getElementById("training-hint-level")?.value || "5";
  const inheritOn = document.getElementById("inherit-enabled")?.checked;
  const inheritCount = document.getElementById("inherit-count")?.value || "4";
  const inheritHint = document.getElementById("inherit-hint")?.value || "3";
  const inheritBase = document.getElementById("inherit-base")?.value || "200";
  const fastClass = fast ? "premise-chip premise-chip--on" : "premise-chip";
  const inheritClass = inheritOn ? "premise-chip premise-chip--on" : "premise-chip";

  /* 継承の個数/Lv/base 編集UIはデザイン確定まで保留。値は hidden で維持 */
  el.innerHTML = `
    <button type="button" class="${fastClass}" id="bar-premise-fast-learner" aria-pressed="${fast ? "true" : "false"}">切れ者 ${fast ? "ON" : "OFF"}</button>
    <div class="premise-chip premise-chip--training" role="group" aria-label="トレヒントLv">
      <span class="premise-chip__prefix">トレLv</span>
      <button type="button" class="premise-lv${trainingLv === "3" ? " is-on" : ""}" data-training-lv="3">3</button>
      <button type="button" class="premise-lv${trainingLv === "4" ? " is-on" : ""}" data-training-lv="4">4</button>
      <button type="button" class="premise-lv${trainingLv === "5" ? " is-on" : ""}" data-training-lv="5">5</button>
    </div>
    <button type="button" class="${inheritClass}" id="bar-premise-inherit" aria-pressed="${inheritOn ? "true" : "false"}" title="個数・Lv・base の編集UIは後日">継承 ${inheritOn ? `${inheritCount}本` : "OFF"}</button>
    <input type="hidden" id="inherit-count" value="${escapeHtml(String(inheritCount))}" />
    <input type="hidden" id="inherit-hint" value="${escapeHtml(String(inheritHint))}" />
    <input type="hidden" id="inherit-base" value="${escapeHtml(String(inheritBase))}" />
    ${excludedCount > 0 ? `<span class="premise-chip premise-chip--warn">除外 ${excludedCount}</span>` : ""}
  `;
}

function bindInheritInlineFields() {
  /* 継承インライン編集は保留 */
}

function buildCharacterPickerItems() {
  return [...state.characters]
    .map((c) => ({
      id: c.id,
      // キャラ名のみ（衣装タイトル除外）＋ローマ字
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
  cardPicker.open({
    title: "育成ウマ娘を選択（覚醒Lv5想定）",
    items: buildCharacterPickerItems(),
    selectedId: state.ui.characterId,
    allowClear: false,
    onPick: (id) => {
      if (id == null) return;
      state.ui.characterId = id;
      syncHiddenCharacterSelect();
      renderDeckCharacter();
      renderScenarioLinkRadios();
      recalc();
    },
  });
}

function openSupportPicker(slotIndex) {
  if (!cardPicker) return;
  renderPickerTypeChips();
  cardPicker.open({
    title: `サポートカード 枠${slotIndex + 1}`,
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
      return `<button type="button" class="type-chip${active ? " is-active" : ""}" data-type="${escapeHtml(value)}" aria-pressed="${active ? "true" : "false"}">${escapeHtml(label)}</button>`;
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
  return {
    fastLearner: document.getElementById("fast-learner")?.checked ?? false,
    trainingHintLevel: Number(document.getElementById("training-hint-level")?.value) || 5,
    inheritEnabled: document.getElementById("inherit-enabled")?.checked ?? false,
    inheritCount: Number(document.getElementById("inherit-count")?.value) || 0,
    inheritHintLevel: Number(document.getElementById("inherit-hint")?.value) || 1,
    inheritBaseSp: Number(document.getElementById("inherit-base")?.value) || 200,
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
    inheritCount.value = String(options.inheritCount);
  }

  const inheritHint = document.getElementById("inherit-hint");
  if (inheritHint && options.inheritHintLevel != null) {
    inheritHint.value = String(options.inheritHintLevel);
  }

  const inheritBase = document.getElementById("inherit-base");
  if (inheritBase && options.inheritBaseSp != null) {
    inheritBase.value = String(options.inheritBaseSp);
  }
}

/** 確定レギュをドラフト UI に反映 */
function writeSkillFilterDraft(filter = {}) {
  const ground = document.getElementById("skill-filter-ground");
  const distance = document.getElementById("skill-filter-distance");
  const style = document.getElementById("skill-filter-style");
  if (ground) ground.value = filter.ground || "";
  if (distance) distance.value = filter.distance || "";
  if (style) style.value = filter.style || "";
}

/** 現在の画面状態をスナップショット化 */
function captureCurrentDesign() {
  return captureDesignSnapshot({
    ui: state.ui,
    options: readDesignOptions(),
    excludedSkillIds,
    committedSkillFilter,
  });
}

/**
 * スナップショットを画面へ復元
 * @param {object} snapshot
 * @returns {boolean}
 */
function restoreDesign(snapshot) {
  if (!state) return false;
  const applied = applyDesignSnapshot(snapshot, state.ui);
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
  writeSkillFilterDraft(committedSkillFilter);
  previousPlanSkillIds = new Set();
  previousTotal = null;

  syncHiddenCharacterSelect();
  renderDeckDashboard();
  renderEvents();
  renderScenarioLinkRadios();
  renderSeniorRmjRadios();
  updateSkillFilterBoxUI();
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
    dialog.showModal();
    nameInput.focus();
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

function goldSkillNamesFromSkills(skills) {
  const map = getSkillByIdMap();
  return (skills || [])
    .filter((sk) => map.get(sk.skillId)?.rarity === 2)
    .map((sk) => sk.skillName);
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
      <div class="evt-choice-panel__kind">${kindBadgeHtml("white")}</div>
      <div>
        <div class="evt-choice-panel__title">${escapeHtml(title)}</div>
      </div>
      <div class="evt-choice-panel__pick">${on ? "ON" : "OFF"}</div>`;
    btn.onclick = () => {
      if (state.ui.enabledEventIds.has(evt.id)) state.ui.enabledEventIds.delete(evt.id);
      else state.ui.enabledEventIds.add(evt.id);
      onAfter();
    };
    container.appendChild(btn);
    return;
  }

  const hint = document.createElement("p");
  hint.className = "evt-choice-hint";
  hint.textContent = "1つ選択 · 金スキルがある選択肢を上に表示（未選択なし）";
  container.appendChild(hint);

  const current = resolveEventChoiceId(evt);
  for (const choice of sortChoicesGoldFirst(evt.choices || [])) {
    const kind = choiceKind(choice);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "evt-choice-panel" + (current === choice.id ? " is-on" : "");
    btn.innerHTML = `
      <div class="evt-choice-panel__kind">${kindBadgeHtml(kind)}</div>
      <div>
        <div class="evt-choice-panel__title">${escapeHtml(shortChoiceLabel(choice))}</div>
        ${choicePanelDescHtml(choice.skills, "ステータス分岐など")}
      </div>
      <div class="evt-choice-panel__pick">${current === choice.id ? "選択中" : "選ぶ"}</div>`;
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
  title.textContent = `A · ${slotLabel}${name || evt.label}`;
  sub.textContent =
    evt.selection === "toggle"
      ? "複数・ON/OFF · 同じ要約で閉じる / Esc"
      : "単一選択 · 金を最上段 · 同じ要約で閉じる / Esc";

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
  title.textContent = `A · ${evt.label}`;
  sub.textContent =
    evt.selection === "toggle" ? "複数・ON/OFF" : "単一選択 · 金を最上段";
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
}

function setInheritPopoverOpen(_open) {
  /* 上展開は廃止。継承パラメータはトータルバー内インライン */
}

function syncInheritPopoverVisibility() {}

function bindInheritPopover() {}

/** 列下要約の並び: 金（選択中 or 選択肢に金あり）→ 白/ステ → 自動 */
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

    const events = getEventsForSupport(support);
    const selectables = events
      .filter((evt) => evt.selection === "single" || evt.selection === "toggle")
      .sort((a, b) => selectableEventSortKey(a) - selectableEventSortKey(b));
    const autos = events.filter((evt) => evt.selection === "auto");

    for (const evt of selectables) {
      const btn = document.createElement("button");
      btn.type = "button";
      const paneOpen =
        isSplitLayout() &&
        splitEvtOpen &&
        splitEvtOpen.evtId === evt.id &&
        splitEvtOpen.slotIndex === i;
      if (evt.selection === "toggle") {
        const on = state.ui.enabledEventIds.has(evt.id);
        btn.className = "deck-evt-sum";
        btn.innerHTML = `${kindBadgeHtml("white")}${escapeHtml(evt.label.replace(/^[^ ]+ /, ""))}<span class="deck-evt-sum__more">${on ? "ON" : "OFF"} · ${paneOpen ? "再タップで閉じる" : "タップで詳細"}</span>`;
      } else {
        const choiceId = resolveEventChoiceId(evt);
        const choice = (evt.choices || []).find((c) => c.id === choiceId);
        const kind = choice ? choiceKind(choice) : "stat";
        const label = choice ? shortChoiceLabel(choice) : "選択";
        const n = (evt.choices || []).length;
        btn.className = "deck-evt-sum" + (kind === "gold" ? " deck-evt-sum--gold" : "");
        btn.innerHTML = `${kindBadgeHtml(kind)}${escapeHtml(label)}<span class="deck-evt-sum__more">${paneOpen ? "再タップで閉じる" : `全${n}択 · タップで詳細`}</span>`;
      }
      btn.addEventListener("click", () => openEventChoiceUi(evt, i));
      container.appendChild(btn);
    }

    for (const evt of autos) {
      const golds = goldSkillNamesFromSkills(evt.skills);
      const isGold = golds.length > 0;
      const label = golds[0] || evt.skills?.[0]?.skillName || "自動";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "deck-evt-sum" + (isGold ? " deck-evt-sum--gold" : " deck-evt-sum--auto");
      btn.innerHTML = `${kindBadgeHtml(isGold ? "gold" : "auto")}${escapeHtml(label)}<span class="deck-evt-sum__more">自動計上（確認のみ）</span>`;
      btn.title = evt.label || "自動計上";
      btn.addEventListener("click", () => {
        /* サポカ自動は列下で完結。編集不可のためダイアログは開かない */
      });
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

/** localStorage キー: レイアウト好み gallery | split | auto */
const LAYOUT_MODE_KEY = "umamusume-sp-calc-layout-mode";

function resolveLayoutMode(pref) {
  if (pref === "auto") {
    return window.matchMedia("(min-width: 1200px)").matches ? "split" : "gallery";
  }
  return pref === "split" ? "split" : "gallery";
}

function placeTotalSpBar(enteringSplit) {
  const bar = document.getElementById("total-sp-bar");
  const modebar = document.querySelector(".layout-modebar");
  const main = document.querySelector(".app-main");
  const actions = document.querySelector(".header-actions");
  const brand = document.querySelector(".total-sp-bar__brand");
  const header = document.querySelector(".app-header");
  if (!bar) return;
  const narrow = window.matchMedia("(max-width: 900px)").matches;
  bar.classList.toggle("total-sp-bar--split-cmd", enteringSplit);
  if (enteringSplit && modebar) {
    modebar.after(bar);
  } else if (main) {
    main.after(bar);
  }
  /* 狭幅ではヘッダーを残すので、アクションはヘッダー側へ */
  if (enteringSplit && !narrow && brand && actions) {
    brand.appendChild(actions);
  } else if (header && actions) {
    header.appendChild(actions);
  }
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
}

function bindLayoutMode() {
  const hint = document.getElementById("layout-mode-hint");
  const buttons = document.querySelectorAll("[data-layout-mode]");
  let pref = localStorage.getItem(LAYOUT_MODE_KEY) || "gallery";
  if (!["gallery", "split", "auto"].includes(pref)) pref = "gallery";

  const sync = () => {
    const effective = resolveLayoutMode(pref);
    applyLayoutMode(effective);
    buttons.forEach((btn) => {
      btn.classList.toggle("is-on", btn.getAttribute("data-layout-mode") === pref);
    });
    if (hint) {
      if (pref === "auto") {
        hint.textContent = `自動: いま ${effective === "split" ? "スプリット" : "ギャラリー"}（境界 1200px）`;
      } else if (effective === "split") {
        hint.textContent = "スプリット: 上=合計 · 左=2×3ドック+A詳細 · 右=作業台";
      } else {
        hint.textContent = "ギャラリー: 上段編成・下段作業台 · A列下詳細";
      }
    }
  };

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      pref = btn.getAttribute("data-layout-mode") || "gallery";
      localStorage.setItem(LAYOUT_MODE_KEY, pref);
      sync();
    });
  });
  window.addEventListener("resize", () => {
    if (pref === "auto") sync();
    else placeTotalSpBar(resolveLayoutMode(pref) === "split");
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
    btn.innerHTML = `<span class="scn-chip__gold-mark" aria-hidden="true">金</span>${escapeHtml(skillName)}`;
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
    if (isGold) {
      btn.innerHTML = `<span class="scn-chip__gold-mark" aria-hidden="true">金</span>${escapeHtml(skillName)}`;
    } else {
      btn.textContent = skillName;
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
  el.textContent = `スキル数 ${onCount}/${totalCount}`;
}

/** 含めるスキルコピーボタンの有効／無効を更新 */
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

function getDraftSkillFilterState() {
  return {
    ground: document.getElementById("skill-filter-ground")?.value || "",
    distance: document.getElementById("skill-filter-distance")?.value || "",
    style: document.getElementById("skill-filter-style")?.value || "",
  };
}

function getSkillByIdMap() {
  return new Map(state.skills.map((s) => [s.id, s]));
}

/** 絞込ボックスの未適用表示を更新 */
function updateSkillFilterBoxUI() {
  const box = document.getElementById("skill-filter-box");
  const btn = document.getElementById("skill-filter-apply");
  const status = document.getElementById("skill-filter-pending");
  if (!box || !btn) return;

  const pending = !skillFiltersEqual(getDraftSkillFilterState(), committedSkillFilter);
  box.classList.toggle("skill-filter-box--pending", pending);
  btn.disabled = !pending;
  if (status) status.hidden = !pending;
}

function renderActivationTags(row) {
  if (row.isInherit || row.skillId == null) return "—";
  const skillById = getSkillByIdMap();
  const activation = getDisplayActivation(
    row.skillId,
    row.chainSkillIds || [row.skillId],
    skillById
  );
  if (!hasActivationConstraints(activation.tags)) return "—";
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
  if (!unresolved?.length) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  el.hidden = false;
  el.textContent =
    "未解決スキル（合計から除外されています）: " +
    unresolved.map((u) => `${u.skillName}（${u.context}）`).join("、");
  console.warn("未解決スキル:", unresolved);
}

function recalc({ resetFilterExclusions = false } = {}) {
  if (!state) return;

  const planParams = {
    skills: state.skills,
    supports: state.supports,
    characters: state.characters,
    events: state.events,
    scenario: state.scenario,
    characterId: state.ui.characterId,
    supportIds: getSupportIds(),
    excludedSkillIds,
    fastLearner: document.getElementById("fast-learner").checked,
    inheritEnabled: document.getElementById("inherit-enabled").checked,
    inheritCount: Number(document.getElementById("inherit-count").value) || 0,
    inheritHintLevel: Number(document.getElementById("inherit-hint").value) || 1,
    inheritBaseSp: Number(document.getElementById("inherit-base").value) || 200,
    trainingHintLevel: Number(document.getElementById("training-hint-level").value) || 5,
    enabledEventIds: state.ui.enabledEventIds,
    eventChoiceIds: Object.fromEntries(state.ui.eventChoiceIds),
    enabledScenarioEntryIds: buildEnabledScenarioEntryIds(),
    seniorRmjChoiceId: state.ui.seniorRmjChoiceId,
  };

  let plan = buildSkillPlan(planParams);
  const skillById = getSkillByIdMap();

  if (resetFilterExclusions) {
    applyFullFilterExclusions(
      excludedSkillIds,
      plan.rows,
      committedSkillFilter,
      skillById
    );
    plan = buildSkillPlan({ ...planParams, excludedSkillIds });
    previousPlanSkillIds = collectPlanSkillIds(plan.rows);
  } else {
    previousPlanSkillIds = applyIncrementalFilterExclusions(
      excludedSkillIds,
      plan.rows,
      previousPlanSkillIds,
      committedSkillFilter,
      skillById
    );
    plan = buildSkillPlan({ ...planParams, excludedSkillIds });
  }

  updateSkillFilterBoxUI();

  currentPlan = plan;

  renderPlanWarnings(plan.unresolved);
  updateTotalDisplay(plan.total);
  updateTotalBarChips(excludedSkillIds.size);
  updateSkillCountDisplay(plan);
  updateCopyIncludedSkillsButton(plan);

  const tbody = document.getElementById("result-body");
  tbody.innerHTML = "";
  const displayRows = sortPlanRows(plan.rows, getResultSortMode(), {
    supportIds: state.ui.supportIds,
  });
  for (const row of displayRows) {
    const tr = document.createElement("tr");
    if (row.skillId != null && excludedSkillIds.has(row.skillId)) {
      tr.classList.add("excluded");
    }
    const included =
      row.skillId == null || !excludedSkillIds.has(row.skillId);
    const costDetail =
      row.includesLower && Array.isArray(row.chainCosts) && row.chainCosts.length > 1
        ? `${row.cost} <span class="hint">(${row.chainCosts.join("+")})</span>`
        : String(row.cost);

    tr.innerHTML = `
      <td>
        ${
          row.isInherit
            ? "—"
            : `<input type="checkbox" class="include-check" data-skill-id="${row.skillId}" ${included ? "checked" : ""} />`
        }
      </td>
      <td>${escapeHtml(row.name)}</td>
      <td class="skill-condition-cell">${renderActivationTags(row)}</td>
      <td>${row.hintLevel}</td>
      <td>${costDetail}</td>
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
  const onDraftChange = () => updateSkillFilterBoxUI();
  ["skill-filter-ground", "skill-filter-distance", "skill-filter-style"].forEach(
    (id) => {
      document.getElementById(id)?.addEventListener("change", onDraftChange);
    }
  );
  document.getElementById("skill-filter-apply")?.addEventListener("click", () => {
    committedSkillFilter = getDraftSkillFilterState();
    recalc({ resetFilterExclusions: true });
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
  /* 継承入力は updateTotalBarChips → bindInheritInlineFields で都度配線 */
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
    renderEvents();
    renderScenarioLinkRadios();
    renderSeniorRmjRadios();
    renderScenarioAuto();

    bindOptions();
    bindSkillFilters();
    bindResultSort();
    bindCopyIncludedSkills();
    committedSkillFilter = getDraftSkillFilterState();
    recalc();
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
