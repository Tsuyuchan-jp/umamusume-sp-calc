import { resolveHintLevels } from "./hintResolve.js";
import {
  calcAcquisitionCost,
  filterDisplaySkills,
  getEffectiveHintLevel,
} from "./goldLower.js";
import { calcSkillCost } from "./spCost.js";
import {
  getDeckLinkCharacterIds,
  resolveLinkSkill,
} from "./scenarioLink.js";
import { mergeSourceInto } from "./skillSource.js";
import { formatTrainingSourceLabel } from "./supportShortName.js";
import { characterBaseName } from "./cardAssets.js";

const TRAINING_HINT = 5;
const CHARA_HINT = 3;

/** トレヒントLv（3–5）。未指定・不正時は既定5 */
function normalizeTrainingHintLevel(level) {
  const n = Number(level);
  if (!Number.isFinite(n)) return TRAINING_HINT;
  return Math.max(3, Math.min(5, n | 0));
}

function isEventSupportInDeck(evt, supportIds, supportById) {
  if (!evt.supportNameMatch) return true;
  return supportIds
    .map((id) => supportById.get(id))
    .some((s) => s && s.name.includes(evt.supportNameMatch));
}

/** デッキ内で supportNameMatch に一致するより左のサポカ ID */
function resolveEventSupportId(supportNameMatch, supportIds, supportById) {
  if (!supportNameMatch) return null;
  for (const sid of supportIds || []) {
    if (sid == null) continue;
    const s = supportById.get(sid);
    if (s && s.name.includes(supportNameMatch)) return sid;
  }
  return null;
}

function resolveSkillRef(sk, nameToId, unresolved, context) {
  const skillId = sk.skillId ?? nameToId.get(sk.skillName);
  if (!skillId) {
    unresolved.push({ skillName: sk.skillName ?? "(名前なし)", context });
    return null;
  }
  return skillId;
}

function appendEventSkills(
  hintEntries,
  skills,
  label,
  nameToId,
  unresolved,
  supportId
) {
  for (const sk of skills || []) {
    const skillId = resolveSkillRef(sk, nameToId, unresolved, `イベント: ${label}`);
    if (!skillId) continue;
    const entry = {
      skillId,
      hintLevel: sk.hintLevel,
      kind: "event",
      label,
    };
    if (supportId != null) entry.supportId = supportId;
    hintEntries.push(entry);
  }
}

/**
 * @param {object} params
 * @param {object[]} params.skills
 * @param {object[]} params.supports
 * @param {object[]} params.characters
 * @param {object} params.events
 * @param {object} params.scenario
 * @param {number} params.characterId
 * @param {number[]} params.supportIds 長さ6
 * @param {Set<number>} params.excludedSkillIds
 * @param {boolean} params.fastLearner
 * @param {boolean} params.inheritEnabled
 * @param {number} params.inheritCount 2-6
 * @param {number} params.inheritHintLevel 1-5
 * @param {number} params.inheritBaseSp default 200
 * @param {Set<string>} [params.enabledEventIds] selection=toggle 用（後方互換）
 * @param {Record<string, string|null>} [params.eventChoiceIds] selection=single の選択
 * @param {Set<string>} params.enabledScenarioEntryIds シナリオリンク選択 ID
 * @param {string} [params.seniorRmjChoiceId] シニア12月ラーメン選択
 * @param {number} [params.trainingHintLevel] サポカトレヒントLv（3–5、既定5）
 */
export function buildSkillPlan(params) {
  const trainingHintLevel = normalizeTrainingHintLevel(
    params.trainingHintLevel ?? TRAINING_HINT
  );
  const skillById = new Map(params.skills.map((s) => [s.id, s]));
  const supportById = new Map(params.supports.map((s) => [s.id, s]));
  const nameToId = new Map(params.skills.map((s) => [s.name, s.id]));
  const unresolved = [];

  const hintEntries = [];

  // サポカトレヒント
  for (const sid of params.supportIds) {
    const sup = supportById.get(sid);
    if (!sup) continue;
    for (const skillId of sup.hintSkillIds || []) {
      hintEntries.push({
        skillId,
        hintLevel: trainingHintLevel,
        kind: "training",
        label: formatTrainingSourceLabel(sup),
        supportId: sid,
      });
    }
  }

  // 育成ウマ娘所持スキル（育成ウマ娘覚醒レベル最大想定: 全ランク合算、ヒントLv3）
  const chara = params.characters.find((c) => c.id === params.characterId);
  if (chara?.skillsByAwakening) {
    const seen = new Set();
    for (const skillIds of Object.values(chara.skillsByAwakening)) {
      for (const skillId of skillIds || []) {
        const id = Number(skillId);
        if (seen.has(id)) continue;
        seen.add(id);
        hintEntries.push({
          skillId: id,
          hintLevel: CHARA_HINT,
          kind: "owned",
          label: characterBaseName(chara.name),
        });
      }
    }
  }

  // イベント
  for (const evt of params.events.events || []) {
    if (!isEventSupportInDeck(evt, params.supportIds, supportById)) continue;
    const eventSupportId = resolveEventSupportId(
      evt.supportNameMatch,
      params.supportIds,
      supportById
    );

    const selection = evt.selection ?? "toggle";
    if (selection === "auto") {
      appendEventSkills(
        hintEntries,
        evt.skills,
        evt.label,
        nameToId,
        unresolved,
        eventSupportId
      );
    } else if (selection === "single") {
      const choiceId = params.eventChoiceIds?.[evt.id];
      if (!choiceId || choiceId === "none") continue;
      const choice = (evt.choices || []).find((c) => c.id === choiceId);
      if (choice) {
        appendEventSkills(
          hintEntries,
          choice.skills,
          `${evt.label}`,
          nameToId,
          unresolved,
          eventSupportId
        );
      }
    } else if (params.enabledEventIds?.has(evt.id)) {
      appendEventSkills(
        hintEntries,
        evt.skills,
        evt.label,
        nameToId,
        unresolved,
        eventSupportId
      );
    }
  }

  // シナリオリンク（選択1件・編成に応じて白 or 金の1スキルのみ）
  const deckLinkIds = getDeckLinkCharacterIds(
    params.characterId,
    params.supportIds,
    supportById
  );
  for (const entry of params.scenario.linkSkills || []) {
    if (!params.enabledScenarioEntryIds.has(entry.id)) continue;
    const sk = resolveLinkSkill(entry, deckLinkIds);
    if (!sk) continue;
    const skillId = resolveSkillRef(
      sk,
      nameToId,
      unresolved,
      `シナリオリンク: ${entry.label}`
    );
    if (!skillId) continue;
    hintEntries.push({
      skillId,
      hintLevel: sk.hintLevel,
      kind: "scenario",
      label: entry.label,
    });
  }

  // シナリオ自動計上（ガチ想定: クラシック大盛況・超盛況固定・育成終了）
  for (const entry of params.scenario.scenarioAutoSkills || []) {
    for (const sk of entry.skills || []) {
      const skillId = resolveSkillRef(
        sk,
        nameToId,
        unresolved,
        `シナリオ自動: ${entry.label}`
      );
      if (!skillId) continue;
      hintEntries.push({
        skillId,
        hintLevel: sk.hintLevel,
        kind: "scenario",
        label: entry.label,
      });
    }
  }

  // シニア12月 超盛況 ラーメン選択金
  const rmj = params.scenario.seniorRmjChoice;
  const rmjChoiceId =
    params.seniorRmjChoiceId ?? rmj?.defaultChoiceId ?? null;
  if (rmj && rmjChoiceId) {
    const choice = (rmj.choices || []).find((c) => c.id === rmjChoiceId);
    if (choice) {
      for (const sk of choice.skills || []) {
        const skillId = resolveSkillRef(
          sk,
          nameToId,
          unresolved,
          `シナリオRMJ: ${choice.label}`
        );
        if (!skillId) continue;
        hintEntries.push({
          skillId,
          hintLevel: sk.hintLevel,
          kind: "scenario",
          label: choice.label,
        });
      }
    }
  }

  const hintMap = resolveHintLevels(hintEntries);
  const allSkillIds = [...hintMap.keys()];
  const displayIds = filterDisplaySkills(allSkillIds, skillById);

  const rows = [];
  let total = 0;

  for (const skillId of displayIds) {
    const skill = skillById.get(skillId);
    if (!skill) continue;
    const acq = calcAcquisitionCost(skill, skillById, hintMap, params.fastLearner);
    const excluded = params.excludedSkillIds.has(skillId);
    if (!excluded) {
      total += acq.cost;
    }

    // 合算行はチェーン内スキルの由来を併記する（ツールチップ用に各由来のスキル名も付与）
    const sources = [];
    for (const cid of acq.chainSkillIds || [skillId]) {
      const chainSkill = skillById.get(cid);
      const chainName = chainSkill?.name || "";
      for (const src of hintMap.get(cid)?.sources ?? []) {
        mergeSourceInto(sources, {
          ...src,
          skillId: cid,
          skillName: chainName,
        });
      }
    }

    rows.push({
      skillId,
      name: skill.name,
      hintLevel: getEffectiveHintLevel(skill, skillById, hintMap),
      sources,
      baseSp: skill.baseSp,
      cost: acq.cost,
      includesLower: acq.includesLower,
      lowerSkillId: acq.lowerSkillId,
      lowerCost: acq.lowerCost,
      goldOnlyCost: acq.goldOnlyCost,
      chainCosts: acq.chainCosts,
      chainSkillIds: acq.chainSkillIds,
      rarity: skill.rarity,
      excluded,
    });
  }

  // 並びは UI 側（skillSource.sortPlanRows）。ここでは名前順の安定した既定順のみ付与
  rows.sort((a, b) => a.name.localeCompare(b.name, "ja"));

  if (params.inheritEnabled && params.inheritCount > 0) {
    const inheritCost = calcSkillCost(
      params.inheritBaseSp,
      params.inheritHintLevel,
      params.fastLearner
    );
    total += inheritCost * params.inheritCount;
    rows.push({
      skillId: null,
      name: `継承固有 × ${params.inheritCount}`,
      hintLevel: params.inheritHintLevel,
      sources: [
        {
          kind: "inherit",
          label: "汎用",
          hintLevel: params.inheritHintLevel,
        },
      ],
      baseSp: params.inheritBaseSp,
      cost: inheritCost * params.inheritCount,
      isInherit: true,
      skillWeight: params.inheritCount,
    });
  }

  return { rows, total, hintMap, unresolved };
}
