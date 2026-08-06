import { characterImageUrl, supportImageUrl } from "./cardAssets.js";
import {
  deleteEntry as deleteMemoryEntry,
  listEntries as listMemoryEntries,
  saveEntry as saveMemoryEntry,
} from "./designMemory.js";
import { escapeHtml } from "./htmlEscape.js";

/**
 * 設計メモリダイアログ（一覧・サムネ・保存／復元／削除）
 * @param {{
 *   getState: () => any,
 *   readDesignTitle: () => string,
 *   captureCurrentDesign: () => object,
 *   restoreDesign: (snapshot: object) => boolean,
 *   setDesignTitle: (value: string) => void,
 *   setDesignTitleDefaultForCurrentCharacter: () => void,
 *   scheduleSessionSave: () => void,
 *   getCurrentPlan: () => { total?: number } | null,
 * }} deps
 */
export function createDesignMemoryUi(deps) {
  const {
    getState,
    readDesignTitle,
    captureCurrentDesign,
    restoreDesign,
    setDesignTitle,
    setDesignTitleDefaultForCurrentCharacter,
    scheduleSessionSave,
    getCurrentPlan,
  } = deps;

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
      if (!getState()) return;
      const snapshot = captureCurrentDesign();
      saveMemoryEntry({
        name: nameInput.value,
        snapshot,
        totalSp: getCurrentPlan()?.total ?? null,
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

  return {
    bindMemoryDialog,
    renderMemoryList,
  };
}
