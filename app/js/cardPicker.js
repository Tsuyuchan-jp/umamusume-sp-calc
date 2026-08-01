/**
 * カード選択ダイアログ（育成ウマ娘・サポカ共通）
 */

import { normalizeSearchQuery } from "./searchText.js";

/**
 * @param {object} root
 * @param {HTMLDialogElement} root.dialog
 * @param {HTMLElement} root.titleEl
 * @param {HTMLInputElement} root.searchEl
 * @param {HTMLElement} root.gridEl
 * @param {HTMLButtonElement} root.closeBtn
 * @param {HTMLButtonElement} root.clearBtn
 * @param {HTMLElement} [root.filtersEl]
 */
export function createCardPicker(root) {
  /** @type {((id: number|null) => void)|null} */
  let onPick = null;
  /** @type {(() => void)|null} */
  let onFiltersChange = null;

  root.closeBtn.addEventListener("click", () => root.dialog.close());
  root.dialog.addEventListener("click", (e) => {
    if (e.target === root.dialog) root.dialog.close();
  });
  root.clearBtn.addEventListener("click", () => {
    onPick?.(null);
    root.dialog.close();
  });
  root.searchEl.addEventListener("input", () => renderGrid());

  if (root.filtersEl) {
    root.filtersEl.addEventListener("change", () => {
      onFiltersChange?.();
      if (root._getItems) {
        root._items = root._getItems();
      }
      renderGrid();
    });
    root.filtersEl.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-type]");
      if (!chip || !(chip instanceof HTMLElement)) return;
      const type = chip.dataset.type ?? "";
      const chips = root.filtersEl.querySelectorAll("[data-type]");
      for (const el of chips) {
        el.classList.toggle("is-active", el === chip);
        el.setAttribute("aria-pressed", el === chip ? "true" : "false");
      }
      root._typeFilter = type;
      onFiltersChange?.();
      if (root._getItems) {
        root._items = root._getItems();
      }
      renderGrid();
    });
  }

  function renderGrid() {
    // 英字はローマ字→かな（ai→アイ）。かな同士はひらがな/カタカナ同一視
    const q = normalizeSearchQuery(root.searchEl.value);
    const items = root._items || [];
    const filtered = items.filter((item) => {
      if (!q) return true;
      return item.searchText.includes(q);
    });

    root.gridEl.innerHTML = "";
    if (!filtered.length) {
      root.gridEl.innerHTML = '<p class="card-picker__empty">該当なし</p>';
      return;
    }

    for (const item of filtered) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "card-picker__item";
      if (item.id === root._selectedId) btn.classList.add("card-picker__item--selected");
      btn.innerHTML = item.html;
      btn.addEventListener("click", () => {
        onPick?.(item.id);
        root.dialog.close();
      });
      root.gridEl.appendChild(btn);
    }
  }

  return {
    /**
     * @param {object} opts
     * @param {string} opts.title
     * @param {{ id: number, searchText: string, html: string }[]} opts.items
     * @param {number|null} [opts.selectedId]
     * @param {boolean} [opts.allowClear]
     * @param {boolean} [opts.showSupportFilters]
     * @param {(() => { id: number, searchText: string, html: string }[])|null} [opts.getItems]
     * @param {(id: number|null) => void} opts.onPick
     * @param {(() => void)|null} [opts.onFiltersChange]
     */
    open(opts) {
      root.titleEl.textContent = opts.title;
      root._getItems = opts.getItems ?? null;
      root._items = root._getItems ? root._getItems() : opts.items || [];
      root._selectedId = opts.selectedId ?? null;
      onPick = opts.onPick;
      onFiltersChange = opts.onFiltersChange ?? null;
      root.clearBtn.hidden = !opts.allowClear;
      if (root.filtersEl) {
        root.filtersEl.hidden = !opts.showSupportFilters;
      }
      root.searchEl.value = "";
      renderGrid();
      root.searchEl.focus();
      root.dialog.showModal();
    },
  };
}
