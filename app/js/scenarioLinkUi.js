import { escapeHtml } from "./htmlEscape.js";
import { getDeckLinkCharacterIds, resolveLinkSkill } from "./scenarioLink.js";

/**
 * シナリオリンク・シニア RMJ のチップ UI
 * @param {{
 *   getState: () => any,
 *   getSupportIds: () => number[],
 *   formatSkillList: (skills: any) => string,
 *   recalc: () => void,
 * }} deps
 */
export function createScenarioLinkUi(deps) {
  const { getState, getSupportIds, formatSkillList, recalc } = deps;

  /** 編成に応じたリンクヒント（白 or 金）を表示用に解決 */
  function getResolvedLinkSkill(linkEntry) {
    const state = getState();
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
    const state = getState();
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

  /** シニア12月 RMJ ラーメン選択（チップ1択・表示はスキル名／すべて金） */
  function renderSeniorRmjRadios() {
    const state = getState();
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

  /** シナリオリンクは相互排他のチップ1択（表示は解決後スキル名） */
  function renderScenarioLinkRadios() {
    const state = getState();
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
    const state = getState();
    const enabled = new Set();
    const linkId = state.ui.scenarioLinkChoiceId ?? "link_dotou";
    if (linkId) enabled.add(linkId);
    return enabled;
  }

  return {
    renderSeniorRmjRadios,
    renderScenarioLinkRadios,
    buildEnabledScenarioEntryIds,
  };
}
