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
    query: normalizeSearchText(document.getElementById("support-search")?.value || "").trim(),
    eventOnly: document.getElementById("support-event-only")?.checked ?? true,
    ssrOnly: document.getElementById("support-ssr-only")?.checked ?? false,
    type: document.getElementById("support-type-filter")?.value || "",
  };
}

function supportSearchHaystack(s) {
  return normalizeSearchText(
    [s.name, s.title, s.characterName, s.rarity, SUPPORT_TYPE_LABELS[s.type] || s.type, s.type]
      .filter(Boolean)
      .join(" ")
  );
}

function supportMatchesFilters(s, filters, keepId) {
  if (keepId != null && s.id === keepId) return true;
  if (filters.eventOnly && !prioritySupportIdSet.has(s.id)) return false;
  if (filters.ssrOnly && s.rarity !== "SSR") return false;
  if (filters.type && s.type !== filters.type) return false;
  if (filters.query && !supportSearchHaystack(s).includes(filters.query)) return false;
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
    btn.innerHTML = buildCardFaceHtml({ empty: true, square: true });
    return;
  }
  const label = formatCharacterDisplayName(c.name);
  btn.innerHTML = buildCardFaceHtml({
    imageUrl: characterImageUrl(c.id),
    typeStyle: { bg: "linear-gradient(160deg,#d4dce4,#8a9aaa)", ink: "#1c2420", label: "ウマ" },
    rarity: "",
    label: shortCharacterLabel(c.name),
    square: true,
    showTextOverlay: false,
  });
  btn.title = label;
}

function renderDeckSupports() {
  const container = document.getElementById("deck-supports");
  if (!container || !state) return;
  container.innerHTML = "";
  for (let i = 0; i < 6; i++) {
    const id = state.ui.supportIds[i];
    const s = id != null ? getSupportById(id) : null;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "deck-slot";
    btn.dataset.slot = String(i);
    btn.setAttribute("aria-label", `枠${i + 1}を選択`);
    if (!s) {
      btn.innerHTML = buildCardFaceHtml({ empty: true });
    } else {
      const typeStyle = getSupportTypeStyle(s.type);
      btn.innerHTML = buildCardFaceHtml({
        imageUrl: supportImageUrl(s.id),
        typeStyle,
        rarity: s.rarity,
        label: shortSupportLabel(s),
        showTextOverlay: false,
      });
      btn.title = s.name;
    }
    btn.addEventListener("click", () => openSupportPicker(i));
    container.appendChild(btn);
  }
}

function renderDeckDashboard() {
  renderDeckCharacter();
  renderDeckSupports();
  updateDeckPremiseChips();
}

function bindPremiseChipsOnce() {
  if (premiseChipsBound) return;
  premiseChipsBound = true;

  document.getElementById("deck-premise")?.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (t.id === "premise-fast-learner" || t.closest("#premise-fast-learner")) {
      const cb = document.getElementById("fast-learner");
      if (!cb) return;
      cb.checked = !cb.checked;
      updateDeckPremiseChips();
      updateTotalBarChips();
      recalc();
    }
  });

  document.getElementById("deck-premise")?.addEventListener("change", (e) => {
    if (e.target?.id === "premise-training-hint") {
      const hidden = document.getElementById("training-hint-level");
      if (hidden) hidden.value = e.target.value;
      updateDeckPremiseChips();
      updateTotalBarChips();
      recalc();
    }
  });

  document.getElementById("total-sp-bar-chips")?.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (t.id === "bar-premise-fast-learner" || t.closest("#bar-premise-fast-learner")) {
      const cb = document.getElementById("fast-learner");
      if (!cb) return;
      cb.checked = !cb.checked;
      updateDeckPremiseChips();
      updateTotalBarChips();
      recalc();
    }
  });
}

function buildPremiseChipsHtml({ excludedCount = 0 } = {}) {
  const fast = document.getElementById("fast-learner")?.checked;
  const trainingLv = document.getElementById("training-hint-level")?.value || "5";
  const inheritOn = document.getElementById("inherit-enabled")?.checked;
  const inheritCount = document.getElementById("inherit-count")?.value || "0";

  const fastClass = fast ? "premise-chip premise-chip--on" : "premise-chip";
  const fastLabel = fast ? "切れ者 ON" : "切れ者 OFF";

  let html = `
    <button type="button" class="${fastClass}" id="premise-fast-learner" aria-pressed="${fast ? "true" : "false"}">${fastLabel}</button>
    <span class="premise-chip">トレヒント
      <select id="premise-training-hint" aria-label="トレヒントLv">
        <option value="5"${trainingLv === "5" ? " selected" : ""}>Lv5</option>
        <option value="4"${trainingLv === "4" ? " selected" : ""}>Lv4</option>
        <option value="3"${trainingLv === "3" ? " selected" : ""}>Lv3</option>
      </select>
    </span>
    <span class="premise-chip${inheritOn ? " premise-chip--on" : ""}">継承 ${inheritOn ? `${inheritCount}個` : "OFF"}</span>
  `;
  if (excludedCount > 0) {
    html += `<span class="premise-chip premise-chip--warn">手動除外 ${excludedCount}</span>`;
  }
  return html;
}

function updateDeckPremiseChips(excludedCount = excludedSkillIds.size) {
  const el = document.getElementById("deck-premise");
  if (!el) return;
  el.innerHTML = buildPremiseChipsHtml({ excludedCount });
}

function updateTotalBarChips(excludedCount = excludedSkillIds.size) {
  const el = document.getElementById("total-sp-bar-chips");
  if (!el) return;
  const fast = document.getElementById("fast-learner")?.checked;
  const trainingLv = document.getElementById("training-hint-level")?.value || "5";
  const fastClass = fast ? "premise-chip premise-chip--on" : "premise-chip";
  let html = `
    <button type="button" class="${fastClass}" id="bar-premise-fast-learner">切れ者 ${fast ? "ON" : "OFF"}</button>
    <span class="premise-chip">トレ Lv${escapeHtml(trainingLv)}</span>
  `;
  if (excludedCount > 0) {
    html += `<span class="premise-chip premise-chip--warn">除外${excludedCount}</span>`;
  }
  el.innerHTML = html;
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
  const externalQuery = normalizeSearchText(
    document.getElementById("support-search")?.value || ""
  ).trim();

  return [...state.supports]
    .filter((s) => {
      if (occupied.has(s.id)) return false;
      if (!supportMatchesFilters(s, filters, state.ui.supportIds[slotIndex])) return false;
      if (externalQuery && !supportSearchHaystack(s).includes(externalQuery)) return false;
      return true;
    })
    .sort((a, b) => b.id - a.id)
    .map((s) => {
      const typeStyle = getSupportTypeStyle(s.type);
      return {
        id: s.id,
        // キャラ名のみ（衣装タイトル除外）＋ローマ字
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
  cardPicker.open({
    title: `サポートカード 枠${slotIndex + 1}`,
    items: buildSupportPickerItems(slotIndex),
    selectedId: state.ui.supportIds[slotIndex],
    allowClear: true,
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

function bindSupportFilters() {
  const refresh = () => {
    if (!state) return;
    renderDeckSupports();
  };
  document.getElementById("support-search").addEventListener("input", refresh);
  document.getElementById("support-event-only").addEventListener("change", refresh);
  document.getElementById("support-ssr-only").addEventListener("change", refresh);
  document.getElementById("support-type-filter").addEventListener("change", refresh);
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
      map.set(evt.id, evt.defaultChoiceId ?? "none");
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
  const trigger = document.getElementById("event-scope-trigger");
  const panel = document.getElementById("event-scope-panel");
  if (!trigger || !panel) return;

  trigger.addEventListener("click", () => {
    const open = panel.hidden;
    panel.hidden = !open;
    trigger.setAttribute("aria-expanded", String(open));
  });
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
      state.ui.eventChoiceIds.set(evt.id, evt.defaultChoiceId ?? "none");
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

function renderEvents() {
  const autoContainer = document.getElementById("event-auto");
  const autoCollapse = document.getElementById("event-auto-collapse");
  const autoSummary = document.getElementById("event-auto-summary");
  const singleContainer = document.getElementById("event-single");
  const emptyHint = document.getElementById("event-empty-hint");
  autoContainer.innerHTML = "";
  singleContainer.innerHTML = "";

  const events = (state.events.events || []).filter(isEventSupportInDeck);
  if (events.length === 0) {
    emptyHint.hidden = false;
    autoCollapse.hidden = true;
    return;
  }
  emptyHint.hidden = true;

  const autoEvents = events.filter((evt) => evt.selection === "auto");
  if (autoEvents.length === 0) {
    autoCollapse.hidden = true;
  } else {
    autoCollapse.hidden = false;
    autoSummary.textContent = `${autoEvents.length}件（自動計上）`;
  }

  for (const evt of events) {
    if (evt.selection === "auto") {
      const div = document.createElement("div");
      div.className = "event-auto-item";
      div.innerHTML = `
        <div class="event-auto-label">${escapeHtml(evt.label)}</div>
        <div class="hint">${escapeHtml(formatSkillList(evt.skills))}（自動計上）</div>
      `;
      autoContainer.appendChild(div);
      continue;
    }

    if (evt.selection === "single") {
      const group = document.createElement("fieldset");
      group.className = "event-single-group";
      const legend = document.createElement("legend");
      legend.textContent = evt.label;
      group.appendChild(legend);

      const current = state.ui.eventChoiceIds.get(evt.id) ?? "none";
      const choices = [
        ...(evt.choices || []),
        { id: "none", label: "未選択（発生しない）", skills: [] },
      ];

      for (const choice of choices) {
        const row = document.createElement("div");
        row.className = "radio-row";
        const inputId = `evt-${evt.id}-${choice.id}`;
        const checked = current === choice.id ? "checked" : "";
        row.innerHTML = `
          <input type="radio" name="evt-${evt.id}" id="${inputId}" value="${escapeHtml(choice.id)}" ${checked} />
          <label for="${inputId}">${escapeHtml(choice.label)}</label>
        `;
        group.appendChild(row);
        row.querySelector("input").addEventListener("change", (e) => {
          if (!e.target.checked) return;
          state.ui.eventChoiceIds.set(evt.id, choice.id);
          recalc();
        });
      }
      singleContainer.appendChild(group);
      continue;
    }

    // toggle（後方互換）
    const div = document.createElement("div");
    div.className = "checkbox-row";
    const checked = state.ui.enabledEventIds.has(evt.id) ? "checked" : "";
    div.innerHTML = `
      <input type="checkbox" id="evt-${evt.id}" data-id="${evt.id}" ${checked} />
      <label for="evt-${evt.id}">${escapeHtml(evt.label)}</label>
    `;
    singleContainer.appendChild(div);
    div.querySelector("input").addEventListener("change", (e) => {
      if (e.target.checked) state.ui.enabledEventIds.add(evt.id);
      else state.ui.enabledEventIds.delete(evt.id);
      recalc();
    });
  }
}

/** シナリオ自動計上（折りたたみ・確認用） */
function renderScenarioAuto() {
  const container = document.getElementById("scenario-auto");
  const summary = document.getElementById("scenario-auto-summary");
  container.innerHTML = "";

  const entries = state.scenario.scenarioAutoSkills || [];
  let skillCount = 0;
  for (const entry of entries) {
    skillCount += (entry.skills || []).length;
    const div = document.createElement("div");
    div.className = "event-auto-item";
    div.innerHTML = `
      <div class="event-auto-label">${escapeHtml(entry.label)}</div>
      <div class="hint">${escapeHtml(formatSkillList(entry.skills))}（自動計上）</div>
    `;
    container.appendChild(div);
  }
  summary.textContent = `${skillCount}スキル（自動計上）`;
}

/** シニア12月 RMJ ラーメン選択（相互排他ラジオ1択） */
function renderSeniorRmjRadios() {
  const container = document.getElementById("scenario-senior-rmj");
  container.innerHTML = "";
  const rmj = state.scenario.seniorRmjChoice;
  if (!rmj?.choices?.length) return;

  const group = document.createElement("fieldset");
  group.className = "event-single-group";
  const legend = document.createElement("legend");
  legend.textContent = rmj.label || "シニア12月 超盛況";
  group.appendChild(legend);

  const defaultId = rmj.defaultChoiceId ?? rmj.choices[0].id;
  const current = state.ui.seniorRmjChoiceId ?? defaultId;

  for (const choice of rmj.choices) {
    const row = document.createElement("div");
    row.className = "radio-row";
    const inputId = `scn-rmj-${choice.id}`;
    const checked = current === choice.id ? "checked" : "";
    const skillNote =
      choice.skills?.length > 0
        ? `<span class="hint"> — ${escapeHtml(formatSkillList(choice.skills))}</span>`
        : "";
    row.innerHTML = `
      <input type="radio" name="scenario-senior-rmj" id="${inputId}" value="${escapeHtml(choice.id)}" ${checked} />
      <label for="${inputId}">${escapeHtml(choice.label)}${skillNote}</label>
    `;
    group.appendChild(row);
    row.querySelector("input").addEventListener("change", (e) => {
      if (e.target.checked) {
        state.ui.seniorRmjChoiceId = choice.id;
        recalc();
      }
    });
  }
  container.appendChild(group);
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

/** シナリオリンクは相互排他のラジオ1択（未選択なし・常に全リンク表示） */
function renderScenarioLinkRadios() {
  const container = document.getElementById("scenario-link");
  container.innerHTML = "";
  const links = state.scenario.linkSkills || [];
  if (links.length === 0) return;

  const group = document.createElement("fieldset");
  group.className = "event-single-group";
  const legend = document.createElement("legend");
  legend.textContent = "シナリオリンク（シニア9月前半）";
  group.appendChild(legend);

  const current = state.ui.scenarioLinkChoiceId ?? "link_dotou";

  for (const entry of links) {
    const row = document.createElement("div");
    row.className = "radio-row";
    const inputId = `scn-link-${entry.id}`;
    const checked = current === entry.id ? "checked" : "";
    const resolved = getResolvedLinkSkill(entry);
    const skillNote = resolved
      ? `<span class="hint"> — ${escapeHtml(resolved.skillName)} Lv${resolved.hintLevel}</span>`
      : "";
    row.innerHTML = `
      <input type="radio" name="scenario-link" id="${inputId}" value="${escapeHtml(entry.id)}" ${checked} />
      <label for="${inputId}">${escapeHtml(entry.label)}${skillNote}</label>
    `;
    group.appendChild(row);
    row.querySelector("input").addEventListener("change", (e) => {
      if (e.target.checked) {
        state.ui.scenarioLinkChoiceId = entry.id;
        recalc();
      }
    });
  }
  container.appendChild(group);
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
  updateDeckPremiseChips(excludedSkillIds.size);
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
  const onOptionChange = () => {
    updateDeckPremiseChips();
    updateTotalBarChips();
    recalc();
  };
  [
    "fast-learner",
    "training-hint-level",
    "inherit-enabled",
    "inherit-count",
    "inherit-hint",
    "inherit-base",
  ].forEach((id) => {
    const el = document.getElementById(id);
    el.addEventListener("change", onOptionChange);
    el.addEventListener("input", onOptionChange);
  });
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
    });

    document.getElementById("deck-character")?.addEventListener("click", openCharacterPicker);
    bindPremiseChipsOnce();
    renderDeckDashboard();
    bindSupportFilters();

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
