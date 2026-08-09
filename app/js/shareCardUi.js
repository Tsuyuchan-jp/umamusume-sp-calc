import {
  buildShareCardModel,
  copyShareCardPng,
  renderShareCardToMount,
  saveShareCardPng,
} from "./shareCard.js?v=1.0.5";

/**
 * 共有カードボタン配線（コピー／画像保存）
 * @param {{
 *   getState: () => any,
 *   getCurrentPlan: () => object | null,
 *   readDesignOptions: () => object,
 *   getCommittedSkillFilter: () => object,
 *   getExcludedSkillIds: () => Set<number>,
 *   getReguExcludedCount: () => number,
 *   readDesignTitle: () => string,
 * }} deps
 */
export function createShareCardUi(deps) {
  const {
    getState,
    getCurrentPlan,
    readDesignOptions,
    getCommittedSkillFilter,
    getExcludedSkillIds,
    getReguExcludedCount,
    readDesignTitle,
  } = deps;

  let copyDefaultLabel = "";
  let saveDefaultLabel = "";

  function getShareCardPayload() {
    const state = getState();
    return buildShareCardModel({
      plan: getCurrentPlan(),
      ui: state.ui,
      skills: state.skills,
      supports: state.supports,
      characters: state.characters,
      scenario: state.scenario,
      options: readDesignOptions(),
      committedSkillFilter: getCommittedSkillFilter(),
      excludedSkillIds: getExcludedSkillIds(),
      reguExcludedCount: getReguExcludedCount(),
      designTitle: readDesignTitle(),
    });
  }

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

    copyDefaultLabel = copyBtn.textContent.trim();
    saveDefaultLabel = saveBtn.textContent.trim();

    const cleanupMount = () => {
      mount.replaceChildren();
      mount.setAttribute("aria-hidden", "true");
    };

    const runShare = async (mode) => {
      if (!getCurrentPlan() || !getState()) return;
      const isCopy = mode === "copy";
      const btn = isCopy ? copyBtn : saveBtn;
      const defaultLabel = isCopy ? copyDefaultLabel : saveDefaultLabel;

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

  return { bindShareCardButtons };
}
