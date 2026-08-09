import {
  applyDesignSnapshot,
  captureDesignSnapshot,
  sanitizeDesignSnapshot,
} from "./designSnapshot.js";
import {
  loadSessionSnapshot,
  saveSessionSnapshot,
} from "./designSession.js";

/**
 * セッション自動保存・スナップショット復元
 * @param {{
 *   getState: () => any,
 *   readDesignOptions: () => object,
 *   getExcludedSkillIds: () => Set<number>,
 *   replaceExcludedSkillIds: (ids: Iterable<unknown>) => void,
 *   getCommittedSkillFilter: () => { ground: string, distance: string, style: string },
 *   setCommittedSkillFilter: (filter: { ground: string, distance: string, style: string }) => void,
 *   writeSkillFilterUI: (filter: object) => void,
 *   writeDesignOptions: (options: object) => void,
 *   readDesignTitle: () => string,
 *   setDesignTitle: (value: string) => void,
 *   setDesignTitleDefaultForCurrentCharacter: () => void,
 *   syncHiddenCharacterSelect: () => void,
 *   renderDeckDashboard: () => void,
 *   eventUi: { resolveEventChoiceId: (evt: object) => void, renderEvents: () => void },
 *   scenarioLinkUi: { renderScenarioLinkRadios: () => void, renderSeniorRmjRadios: () => void },
 *   recalc: () => void,
 *   clearPreviousTotal: () => void,
 * }} deps
 */
export function createDesignSessionUi(deps) {
  const {
    getState,
    readDesignOptions,
    getExcludedSkillIds,
    replaceExcludedSkillIds,
    getCommittedSkillFilter,
    setCommittedSkillFilter,
    writeSkillFilterUI,
    writeDesignOptions,
    readDesignTitle,
    setDesignTitle,
    setDesignTitleDefaultForCurrentCharacter,
    syncHiddenCharacterSelect,
    renderDeckDashboard,
    eventUi,
    scenarioLinkUi,
    recalc,
    clearPreviousTotal,
  } = deps;

  /** セッション自動保存の debounce */
  let sessionSaveTimer = null;

  /** セッション即時保存のイベント登録済み */
  let sessionFlushBound = false;

  /** 直近の復元で落とした不正 ID の警告（次の復元まで保持） */
  let lastRestoreIdWarnings = [];

  function applyDesignTitleFromSnapshot(snapshot) {
    const title = String(snapshot?.designTitle || "").trim();
    if (title) {
      setDesignTitle(title);
    } else {
      setDesignTitleDefaultForCurrentCharacter();
    }
  }

  /** 現在の画面状態をスナップショット化 */
  function captureCurrentDesign() {
    const state = getState();
    return captureDesignSnapshot({
      ui: state.ui,
      options: readDesignOptions(),
      excludedSkillIds: getExcludedSkillIds(),
      committedSkillFilter: getCommittedSkillFilter(),
      designTitle: readDesignTitle(),
    });
  }

  /** 前回セッションを debounce 保存（メモリ一覧とは別） */
  function scheduleSessionSave() {
    if (!getState()) return;
    clearTimeout(sessionSaveTimer);
    sessionSaveTimer = setTimeout(() => {
      sessionSaveTimer = null;
      if (!getState()) return;
      saveSessionSnapshot(captureCurrentDesign());
    }, 350);
  }

  /** 未保存の変更を即時書き込み（タブ閉じ・非表示時） */
  function flushSessionSave() {
    if (sessionSaveTimer != null) {
      clearTimeout(sessionSaveTimer);
      sessionSaveTimer = null;
    }
    if (!getState()) return;
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
    const state = getState();
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
        eventUi.resolveEventChoiceId(evt);
      }
    }

    writeDesignOptions(applied.options);
    replaceExcludedSkillIds(applied.excludedSkillIds);
    setCommittedSkillFilter({
      ground: applied.committedSkillFilter.ground || "",
      distance: applied.committedSkillFilter.distance || "",
      style: applied.committedSkillFilter.style || "",
    });
    writeSkillFilterUI(getCommittedSkillFilter());
    clearPreviousTotal();

    applyDesignTitleFromSnapshot(sanitized);

    syncHiddenCharacterSelect();
    renderDeckDashboard();
    eventUi.renderEvents();
    scenarioLinkUi.renderScenarioLinkRadios();
    scenarioLinkUi.renderSeniorRmjRadios();
    recalc();
    return true;
  }

  /** 初回ロード時に前回セッションを復元。失敗時は false */
  function tryRestoreLastSession() {
    const session = loadSessionSnapshot();
    return Boolean(session && restoreDesign(session));
  }

  function getLastRestoreIdWarnings() {
    return lastRestoreIdWarnings;
  }

  function clearRestoreIdWarnings() {
    lastRestoreIdWarnings = [];
  }

  return {
    captureCurrentDesign,
    restoreDesign,
    scheduleSessionSave,
    flushSessionSave,
    bindSessionFlushOnce,
    tryRestoreLastSession,
    getLastRestoreIdWarnings,
    clearRestoreIdWarnings,
  };
}
