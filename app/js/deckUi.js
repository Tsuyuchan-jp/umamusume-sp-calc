import { createCardPicker } from "./cardPicker.js?v=1.0.5";
import {
  characterImageUrl,
  getSupportTypeStyle,
  shortCharacterLabel,
  shortSupportLabel,
  supportImageUrl,
} from "./cardAssets.js";
import { buildCharacterNameSearchText, normalizeSearchText } from "./searchText.js";
import { escapeHtml } from "./htmlEscape.js";
import { calcSkillCost } from "./spCost.js";

const SUPPORT_TYPE_LABELS = {
  speed: "スピード",
  stamina: "スタミナ",
  power: "パワー",
  guts: "根性",
  wit: "賢さ",
  friend: "友人",
};

/**
 * 編成ダッシュボード・カードピッカー・継承ポップオーバー
 * @param {{
 *   getState: () => any,
 *   getCharacterById: (id: number) => object | undefined,
 *   getSupportById: (id: number) => object | undefined,
 *   getPrioritySupportIdSet: () => Set<number>,
 *   inheritBaseSp: number,
 *   getExcludedCount: () => number,
 *   eventUi: {
 *     getFocusSupportSlot: () => number | null,
 *     renderColumnEvents: () => void,
 *     renderEvents: () => void,
 *   },
 *   scenarioLinkUi: { renderScenarioLinkRadios: () => void },
 *   applyDesignTitleOnCharacterChange: (prevId: number, nextId: number) => void,
 *   scheduleSessionSave: () => void,
 *   recalc: () => void,
 * }} deps
 */
export function createDeckUi(deps) {
  const {
    getState,
    getCharacterById,
    getSupportById,
    getPrioritySupportIdSet,
    inheritBaseSp,
    getExcludedCount,
    eventUi,
    scenarioLinkUi,
    applyDesignTitleOnCharacterChange,
    scheduleSessionSave,
    recalc,
  } = deps;

  /** @type {ReturnType<typeof createCardPicker> | null} */
  let cardPicker = null;

  let premiseChipsBound = false;
  let inheritPopoverOpen = false;
  let inheritPopoverBound = false;
  let supportPickerTypeFilter = "";

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

  function supportMatchesFilters(s, filters, keepId) {
    if (filters.type && s.type !== filters.type) return false;
    if (filters.query && !supportSearchHaystack(s).includes(filters.query)) return false;
    if (keepId != null && s.id === keepId) return true;
    if (filters.eventOnly && !getPrioritySupportIdSet().has(s.id)) return false;
    if (filters.ssrOnly && s.rarity !== "SSR") return false;
    return true;
  }

  function syncHiddenCharacterSelect() {
    const state = getState();
    const sel = document.getElementById("character-select");
    if (!sel || !state) return;
    if (sel.value !== String(state.ui.characterId)) {
      sel.value = String(state.ui.characterId);
    }
  }

  function renderDeckCharacter() {
    const state = getState();
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
    const state = getState();
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
    if (baseEl) baseEl.value = String(inheritBaseSp);
    return {
      enabled: Boolean(document.getElementById("inherit-enabled")?.checked),
      count,
      hint,
      base: inheritBaseSp,
      fast: Boolean(document.getElementById("fast-learner")?.checked),
    };
  }

  function setInheritSeg(root, attr, value) {
    if (!root) return;
    root.querySelectorAll("button").forEach((btn) => {
      btn.classList.toggle("is-on", String(btn.getAttribute(attr)) === String(value));
    });
  }

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

  function syncInheritPopoverAnchorIfOpen() {
    if (inheritPopoverOpen) {
      requestAnimationFrame(() => syncInheritPopoverAnchor());
    }
  }

  function updateTotalBarChips(excludedCount = getExcludedCount()) {
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
      syncInheritPopoverAnchorIfOpen();
    });
  }

  function buildCharacterPickerItems() {
    const state = getState();
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
    const state = getState();
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
    const state = getState();
    if (!cardPicker || !state) return;
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
    const state = getState();
    if (!cardPicker || !state) return;
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
    const state = getState();
    const sel = document.getElementById("character-select");
    if (!sel || !state) return;

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

  function initCardPicker() {
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
  }

  return {
    renderDeckDashboard,
    syncHiddenCharacterSelect,
    renderCharacterSelect,
    updateTotalBarChips,
    readInheritParams,
    clampInheritCount,
    clampInheritHint,
    setInheritPopoverOpen,
    syncInheritPopoverUi,
    syncInheritPopoverAnchorIfOpen,
    bindPremiseChipsOnce,
    bindInheritPopover,
    bindPickerFilters,
    initCardPicker,
  };
}
