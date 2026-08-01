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
 */
export function createCardPicker(root) {
  /** @type {((id: number|null) => void)|null} */
  let onPick = null;

  root.closeBtn.addEventListener("click", () => root.dialog.close());
  root.dialog.addEventListener("click", (e) => {
    if (e.target === root.dialog) root.dialog.close();
  });
  root.clearBtn.addEventListener("click", () => {
    onPick?.(null);
    root.dialog.close();
  });
  root.searchEl.addEventListener("input", () => renderGrid());

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
     * @param {(id: number|null) => void} opts.onPick
     */
    open(opts) {
      root.titleEl.textContent = opts.title;
      root._items = opts.items;
      root._selectedId = opts.selectedId ?? null;
      onPick = opts.onPick;
      root.clearBtn.hidden = !opts.allowClear;
      root.searchEl.value = "";
      renderGrid();
      root.searchEl.focus();
      root.dialog.showModal();
    },
  };
}
