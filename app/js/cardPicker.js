/**
 * カード選択ダイアログ（育成ウマ娘・サポカ共通）
 * 見た目: R3 土台（紫クロム＋統合プレビュー）＋ R1 部品（トグル・色ドット・選択バッジ）
 */

import { normalizeSearchQuery } from "./searchText.js";

const SELECTED_BADGE = '<span class="card-picker__badge" aria-hidden="true">選択中</span>';

/**
 * @param {object} root
 * @param {HTMLDialogElement} root.dialog
 * @param {HTMLElement} root.titleEl
 * @param {HTMLElement} root.previewThumbEl
 * @param {HTMLElement} root.previewNameEl
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
    root.filtersEl.addEventListener("click", (e) => {
      const tog = e.target.closest("[data-filter]");
      if (tog && root.filtersEl.contains(tog)) {
        const on = tog.classList.toggle("is-on");
        tog.setAttribute("aria-pressed", on ? "true" : "false");
        onFiltersChange?.();
        refreshItems();
        renderGrid();
        return;
      }

      const chip = e.target.closest("button.type-chip[data-type]");
      if (!chip || !(chip instanceof HTMLElement) || !root.filtersEl.contains(chip)) {
        return;
      }
      const type = chip.dataset.type ?? "";
      const chips = root.filtersEl.querySelectorAll("button.type-chip[data-type]");
      for (const el of chips) {
        el.classList.toggle("is-active", el === chip);
        el.setAttribute("aria-pressed", el === chip ? "true" : "false");
      }
      root._typeFilter = type;
      onFiltersChange?.();
      refreshItems();
      renderGrid();
    });
  }

  function refreshItems() {
    if (root._getItems) {
      root._items = root._getItems();
    }
  }

  function setPreview(opts) {
    const square = opts.mode === "character";
    root.dialog.classList.toggle("card-picker--character", square);
    if (root.previewThumbEl) {
      root.previewThumbEl.classList.toggle("card-picker__preview-thumb--sq", square);
      if (opts.previewImageUrl) {
        const img = document.createElement("img");
        img.className = "card-picker__preview-img";
        img.src = opts.previewImageUrl;
        img.alt = "";
        img.decoding = "async";
        root.previewThumbEl.replaceChildren(img);
      } else {
        root.previewThumbEl.innerHTML =
          '<span class="card-picker__preview-empty" aria-hidden="true">＋</span>';
      }
    }
    if (root.previewNameEl) {
      root.previewNameEl.textContent = opts.previewLabel || "未選択";
    }
  }

  function renderGrid() {
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
      const selected = item.id === root._selectedId;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "card-picker__item";
      if (selected) btn.classList.add("card-picker__item--selected");
      btn.setAttribute("aria-pressed", selected ? "true" : "false");
      btn.setAttribute("aria-label", item.label ? `${item.label}${selected ? "（選択中）" : ""}` : "");
      btn.innerHTML = (selected ? SELECTED_BADGE : "") + item.html;
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
     * @param {{ id: number, searchText: string, html: string, label?: string }[]} opts.items
     * @param {number|null} [opts.selectedId]
     * @param {boolean} [opts.allowClear]
     * @param {boolean} [opts.showSupportFilters]
     * @param {"character"|"support"} [opts.mode]
     * @param {string} [opts.previewImageUrl]
     * @param {string} [opts.previewLabel]
     * @param {(() => { id: number, searchText: string, html: string, label?: string }[])|null} [opts.getItems]
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
      setPreview({
        mode: opts.mode ?? "support",
        previewImageUrl: opts.previewImageUrl ?? "",
        previewLabel: opts.previewLabel ?? "未選択",
      });
      root.searchEl.value = "";
      renderGrid();
      root.searchEl.focus();
      root.dialog.showModal();
    },
  };
}
