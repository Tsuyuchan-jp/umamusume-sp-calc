/**
 * 編成スクショ共有カード — 正本モック v28.1 忠実移植
 * データ組み立て・DOM 描画・溢れ measure・画像化
 */

import { characterImageUrl, supportImageUrl } from "./cardAssets.js";
import {
  getDeckLinkCharacterIds,
  resolveLinkSkill,
} from "./scenarioLink.js";
import { GROUND_LABELS } from "./skillActivation.js";
import { buildSupportOrderMap } from "./skillSource.js";
import { formatTrainingSourceLabel, shortNameForSupport } from "./supportShortName.js";

/** スクショ用レギュ表示（モック準拠のフル表記） */
const SHARE_DISTANCE_LABELS = {
  short: "短距離",
  mile: "マイル",
  mid: "中距離",
  long: "長距離",
};

const SHARE_STYLE_LABELS = {
  nige: "逃げ",
  senko: "先行",
  sashi: "差し",
  oikomi: "追込",
};

const CARD_WIDTH_PX = 1080;
let html2canvasPromise = null;

/**
 * @param {number} n
 * @returns {string}
 */
function formatSp(n) {
  return Number(n).toLocaleString("ja-JP");
}

/**
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {{ ground?: string, distance?: string, style?: string }} filter
 * @returns {string}
 */
function formatReguLine(filter = {}) {
  const parts = [];
  if (filter.ground && GROUND_LABELS[filter.ground]) {
    parts.push(GROUND_LABELS[filter.ground]);
  }
  if (filter.distance && SHARE_DISTANCE_LABELS[filter.distance]) {
    parts.push(SHARE_DISTANCE_LABELS[filter.distance]);
  }
  if (filter.style && SHARE_STYLE_LABELS[filter.style]) {
    parts.push(SHARE_STYLE_LABELS[filter.style]);
  }
  return parts.length ? parts.join(" · ") : "—";
}

/**
 * @param {object[]} rows
 * @returns {{ on: number, total: number }}
 */
function countSkills(rows) {
  let on = 0;
  let total = 0;
  for (const row of rows) {
    const w = row.skillWeight != null ? row.skillWeight : 1;
    total += w;
    if (!row.excluded) on += w;
  }
  return { on, total };
}

/**
 * シナリオ由来金の分類用 ID 集合
 * @param {object} scenario
 * @param {object} ui
 * @param {object[]} supports
 * @returns {{ rmjIds: Set<number>, linkIds: Set<number> }}
 */
function buildScenarioGoldSkillIds(scenario, ui, supports) {
  const rmjIds = new Set();
  const linkIds = new Set();
  const supportById = new Map(supports.map((s) => [s.id, s]));
  const deckIds = getDeckLinkCharacterIds(
    ui.characterId,
    ui.supportIds,
    supportById
  );

  const rmj = scenario?.seniorRmjChoice;
  if (rmj?.choices) {
    for (const choice of rmj.choices) {
      for (const sk of choice.skills || []) {
        if (sk.skillId != null) rmjIds.add(Number(sk.skillId));
      }
    }
  }

  for (const entry of scenario?.linkSkills || []) {
    const resolved = resolveLinkSkill(entry, deckIds);
    if (resolved?.skillId != null) linkIds.add(Number(resolved.skillId));
  }

  return { rmjIds, linkIds };
}

/**
 * 計上 ON の金スキルをグループ化
 * @param {object} params
 * @returns {{ label: string, isScn: boolean, order: number, skills: string[] }[]}
 */
function collectGoldGroups(params) {
  const { plan, ui, supports, scenario, skillById } = params;
  const supportById = new Map(supports.map((s) => [s.id, s]));
  const supportOrder = buildSupportOrderMap(ui.supportIds);
  const { rmjIds, linkIds } = buildScenarioGoldSkillIds(scenario, ui, supports);

  /** @type {Map<string, { label: string, isScn: boolean, order: number, skills: string[] }>} */
  const groups = new Map();

  const addSkill = (key, label, isScn, order, skillName) => {
    if (!groups.has(key)) {
      groups.set(key, { label, isScn, order, skills: [] });
    }
    const group = groups.get(key);
    if (!group.skills.includes(skillName)) {
      group.skills.push(skillName);
    }
  };

  for (const row of plan.rows) {
    if (row.excluded || row.isInherit || row.rarity !== 2) continue;

    const sources = row.sources || [];
    const nonOwned = sources.filter((src) => src.kind !== "owned");
    if (nonOwned.length === 0) continue;

    const supportSrc = nonOwned.find(
      (src) =>
        (src.kind === "event" || src.kind === "training") && src.supportId != null
    );
    if (supportSrc) {
      const support = supportById.get(supportSrc.supportId);
      const label =
        formatTrainingSourceLabel(support) || shortNameForSupport(support) || "サポ";
      const order = supportOrder.get(supportSrc.supportId) ?? 50;
      addSkill(`sup:${supportSrc.supportId}`, label, false, order, row.name);
      continue;
    }

    if (nonOwned.some((src) => src.kind === "scenario")) {
      const sid = row.skillId;
      let label = "シナリオ";
      let order = 102;
      if (sid != null && rmjIds.has(sid)) {
        label = "RMJ";
        order = 100;
      } else if (sid != null && linkIds.has(sid)) {
        label = "リンク";
        order = 101;
      }
      addSkill(`scn:${label}`, label, true, order, row.name);
      continue;
    }

    const eventSrc = nonOwned.find((src) => src.kind === "event");
    if (eventSrc) {
      addSkill(
        `evt:${eventSrc.label || row.name}`,
        eventSrc.label || "イベント",
        false,
        90,
        row.name
      );
    }
  }

  return [...groups.values()].sort((a, b) => a.order - b.order);
}

/**
 * 手動除外スキル名（レギュ除外は含めない）
 * @param {Set<number>|number[]} excludedSkillIds
 * @param {Map<number, object>} skillById
 * @returns {string[]}
 */
function collectManualExcludedNames(excludedSkillIds, skillById) {
  const names = [];
  for (const sid of excludedSkillIds) {
    const skill = skillById.get(Number(sid));
    if (skill?.name) names.push(skill.name);
  }
  return names.sort((a, b) => a.localeCompare(b, "ja"));
}

/**
 * @param {object} params
 * @returns {object}
 */
export function buildShareCardModel(params) {
  const {
    plan,
    ui,
    supports,
    characters,
    scenario,
    options,
    committedSkillFilter,
    excludedSkillIds,
    reguExcludedCount = 0,
    designTitle = "",
  } = params;

  const skillById = new Map((params.skills || []).map((s) => [s.id, s]));
  const character = (characters || []).find((c) => c.id === ui.characterId);
  const counts = countSkills(plan.rows);
  const goldGroups = collectGoldGroups({
    plan,
    ui,
    supports,
    scenario,
    skillById,
  });
  const manualExcluded = collectManualExcludedNames(excludedSkillIds, skillById);

  const title =
    String(designTitle || "").trim() ||
    (character?.displayName
      ? character.displayName.replace(/^\[[^\]]+\]/, "").trim()
      : "編成設計");

  return {
    totalSp: plan.total,
    skillCountOn: counts.on,
    skillCountTotal: counts.total,
    reguExcludedCount,
    reguLine: formatReguLine(committedSkillFilter),
    trainingLine: `トレヒント Lv${options.trainingHintLevel}`,
    inheritLine: options.inheritEnabled
      ? `継承 ×${options.inheritCount} Lv${options.inheritHintLevel}`
      : "継承 OFF",
    fastLearner: Boolean(options.fastLearner),
    title,
    subtitle: character?.displayName || "",
    characterId: ui.characterId,
    supportIds: [...ui.supportIds],
    goldGroups,
    manualExcluded,
  };
}

/**
 * @param {string} name
 * @returns {HTMLElement}
 */
function makeOffChip(name) {
  const chip = document.createElement("span");
  chip.className = "off-chip";
  chip.textContent = name;
  return chip;
}

/**
 * 金確保後の残り高さに収まる除外チップ数を決定
 * @param {HTMLElement} cardEl
 * @param {string[]} names
 */
function fitManualExclusions(cardEl, names) {
  const offPanel = cardEl.querySelector(".panel--off");
  const offBody = cardEl.querySelector(".off-body");
  const offList = cardEl.querySelector(".off-list");
  const moreChip = cardEl.querySelector(".off-chip--more");

  if (!offPanel || !offBody || !offList || !moreChip) return;

  if (!names.length) {
    offPanel.classList.add("is-empty");
    return;
  }

  offPanel.classList.remove("is-empty");
  const gap = 6;
  let visible = names.length;

  while (true) {
    offList.replaceChildren();
    for (let i = 0; i < visible; i += 1) {
      offList.appendChild(makeOffChip(names[i]));
    }

    const hidden = names.length - visible;
    if (hidden > 0) {
      moreChip.textContent = `他 ${hidden} 件`;
      moreChip.hidden = false;
    } else {
      moreChip.hidden = true;
    }

    const moreH = hidden > 0 ? moreChip.offsetHeight : 0;
    const needed = offList.offsetHeight + (hidden > 0 ? gap + moreH : 0);
    if (needed <= offBody.clientHeight || visible <= 0) break;
    visible -= 1;
  }

  if (visible <= 0 && names.length > 0) {
    offList.replaceChildren();
    moreChip.textContent = `他 ${names.length} 件`;
    moreChip.hidden = false;
  }
}

/**
 * @param {object} model
 * @returns {HTMLElement}
 */
export function renderShareCardElement(model) {
  const article = document.createElement("article");
  article.className = "share";
  article.setAttribute("aria-label", "編成共有カード");

  const goldRowsHtml = model.goldGroups
    .map((group) => {
      const rowClass = group.isScn ? "gold-row is-scn" : "gold-row";
      const chips = group.skills
        .map(
          (name) =>
            `<span class="gold-chip"><span class="gold-chip__name">${escapeHtml(name)}</span></span>`
        )
        .join("");
      return `<div class="${rowClass}"><span class="gold-row__src">${escapeHtml(group.label)}</span>${chips}</div>`;
    })
    .join("");

  const supportFigures = model.supportIds
    .map((id) => {
      if (id == null) {
        return "<figure></figure>";
      }
      const url = supportImageUrl(id);
      return `<figure><img src="${escapeHtml(url)}" alt="" crossorigin="anonymous" /></figure>`;
    })
    .join("");

  const charUrl = model.characterId != null ? characterImageUrl(model.characterId) : "";

  article.innerHTML = `
    <section class="left">
      <div class="strip">
        <div class="strip__cell">
          <div class="strip__lab">必要SP</div>
          <div class="strip__sp">${formatSp(model.totalSp)}<em>SP</em></div>
        </div>
        <div class="strip__cell">
          <div class="strip__lab">計上スキル数</div>
          <div class="strip__count">
            <span class="strip__count-on">${model.skillCountOn}</span><span class="strip__count-den">/${model.skillCountTotal}</span>
          </div>
          <div class="strip__val"><small>レギュ除外 ${model.reguExcludedCount}</small></div>
        </div>
        <div class="strip__cell">
          <div class="strip__lab">レギュ</div>
          <div class="strip__regu">${escapeHtml(model.reguLine)}</div>
          <div class="strip__prem">
            <span>${escapeHtml(model.trainingLine)}</span>
            <span>${escapeHtml(model.inheritLine)}</span>
          </div>
        </div>
      </div>
      <div class="body">
        <div class="head">
          <div>
            <h2 class="head__title">${escapeHtml(model.title)}</h2>
            <p class="head__sub">${escapeHtml(model.subtitle)}</p>
          </div>
          <div class="fast-inline${model.fastLearner ? "" : " is-off"}" title="切れ者 ${model.fastLearner ? "ON" : "OFF"}">
            <span class="fast-inline__mark">切れ者</span>
            <span class="fast-inline__state">${model.fastLearner ? "ON" : "OFF"}</span>
          </div>
        </div>
        <div class="work">
          <div class="panel panel--gold">
            <div class="panel__lab">金スキル</div>
            <div class="gold-board">${goldRowsHtml}</div>
          </div>
          <div class="panel panel--off${model.manualExcluded.length ? "" : " is-empty"}">
            <div class="panel__lab">除外</div>
            <div class="off-body">
              <div class="off-list"></div>
              <span class="off-chip off-chip--more" hidden>他 0 件</span>
            </div>
          </div>
        </div>
      </div>
    </section>
    <section class="right">
      <div class="right__trainee">
        <img src="${escapeHtml(charUrl)}" alt="" crossorigin="anonymous" />
        <div>
          <div class="right__trainee-lab">育成ウマ娘</div>
          <p class="right__trainee-name">${escapeHtml(model.subtitle)}</p>
        </div>
      </div>
      <div class="grid-stage">
        <div class="grid-bleed" aria-label="サポートカード">${supportFigures}</div>
      </div>
    </section>
  `;

  fitManualExclusions(article, model.manualExcluded);
  return article;
}

/**
 * マウントへ描画してカード要素を返す
 * @param {HTMLElement} mount
 * @param {object} model
 * @returns {Promise<HTMLElement>}
 */
export async function renderShareCardToMount(mount, model) {
  mount.replaceChildren();
  mount.hidden = false;
  mount.removeAttribute("aria-hidden");

  const card = renderShareCardElement(model);
  mount.appendChild(card);

  const images = [...card.querySelectorAll("img")];
  await Promise.all(
    images.map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        })
    )
  );

  fitManualExclusions(card, model.manualExcluded);
  return card;
}

/**
 * @returns {Promise<Function>}
 */
async function loadHtml2Canvas() {
  if (!html2canvasPromise) {
    html2canvasPromise = import(
      "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/+esm"
    ).then((mod) => mod.default);
  }
  return html2canvasPromise;
}

/**
 * @param {HTMLElement} cardEl
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function captureShareCardElement(cardEl) {
  const html2canvas = await loadHtml2Canvas();
  return html2canvas(cardEl, {
    width: CARD_WIDTH_PX,
    scale: 2,
    useCORS: true,
    allowTaint: false,
    backgroundColor: "#ffffff",
    logging: false,
  });
}

/**
 * @param {HTMLCanvasElement} canvas
 * @returns {Promise<Blob|null>}
 */
function canvasToBlob(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

/**
 * @param {HTMLElement} cardEl
 * @returns {Promise<boolean>}
 */
export async function copyShareCardPng(cardEl) {
  const canvas = await captureShareCardElement(cardEl);
  const blob = await canvasToBlob(canvas);
  if (!blob) return false;

  if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * @param {HTMLElement} cardEl
 * @param {string} [filename]
 */
export async function saveShareCardPng(cardEl, filename = "umamusume-formation.png") {
  const canvas = await captureShareCardElement(cardEl);
  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  link.click();
}
