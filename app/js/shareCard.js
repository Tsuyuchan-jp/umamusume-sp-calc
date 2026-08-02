/**
 * 編成スクショ共有カード — 正本モック v28.1 直移植
 * DOM 骨格はモックと同一。JS はテキスト／画像／金行・除外の差し替えのみ。
 */

import { characterImageUrl, characterBaseName, supportImageUrl } from "./cardAssets.js";
import {
  getDeckLinkCharacterIds,
  resolveLinkSkill,
} from "./scenarioLink.js";
import { GROUND_LABELS } from "./skillActivation.js";
import { buildSupportOrderMap } from "./skillSource.js";
import {
  formatTrainingSourceLabel,
  shortNameForSupport,
} from "./supportShortName.js";

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
const CARD_HEIGHT_PX = 608;
let snapdomPromise = null;

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
 * @returns {{ rmjIds: Set<number>, linkIds: Set<number>, autoIds: Set<number> }}
 */
function buildScenarioGoldSkillIds(scenario, ui, supports) {
  const rmjIds = new Set();
  const linkIds = new Set();
  const autoIds = new Set();
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
    const withLink = entry.skillWithLink?.skillId;
    const without = entry.skillWithoutLink?.skillId;
    if (withLink != null) linkIds.add(Number(withLink));
    if (without != null) linkIds.add(Number(without));
    const resolved = resolveLinkSkill(entry, deckIds);
    if (resolved?.skillId != null) linkIds.add(Number(resolved.skillId));
  }

  for (const entry of scenario?.scenarioAutoSkills || []) {
    for (const sk of entry.skills || []) {
      if (sk.skillId != null) autoIds.add(Number(sk.skillId));
    }
  }

  return { rmjIds, linkIds, autoIds };
}

/**
 * 金行の表示由来は「その金スキル自身」の sources だけ使う。
 * チェーン下位のサポ由来を拾うと RMJ/たづな等が誤帰属する。
 * @param {object} row
 * @returns {object[]}
 */
function sourcesForGoldRow(row) {
  const sources = row.sources || [];
  const own = sources.filter(
    (src) => src.skillId == null || Number(src.skillId) === Number(row.skillId)
  );
  return own.length ? own : sources.filter((src) => src.kind !== "owned");
}

/**
 * 計上 ON の金スキルをグループ化（モックの gold-row 単位）
 * @param {object} params
 * @returns {{ label: string, isScn: boolean, order: number, skills: string[] }[]}
 */
function collectGoldGroups(params) {
  const { plan, ui, supports, scenario } = params;
  const supportById = new Map(supports.map((s) => [s.id, s]));
  const supportOrder = buildSupportOrderMap(ui.supportIds);
  const { rmjIds, linkIds, autoIds } = buildScenarioGoldSkillIds(
    scenario,
    ui,
    supports
  );

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

    const sources = sourcesForGoldRow(row).filter((src) => src.kind !== "owned");
    if (!sources.length) continue;

    const sid = row.skillId != null ? Number(row.skillId) : null;

    // シナリオ系を優先（チェーン下位のサポ由来より）
    if (sources.some((src) => src.kind === "scenario") || (sid != null && (rmjIds.has(sid) || linkIds.has(sid) || autoIds.has(sid)))) {
      let label = "シナリオ";
      let order = 102;
      if (sid != null && rmjIds.has(sid)) {
        label = "RMJ";
        order = 100;
      } else if (sid != null && linkIds.has(sid)) {
        label = "リンク";
        order = 101;
      } else if (sid != null && autoIds.has(sid)) {
        label = "シナリオ";
        order = 102;
      }
      addSkill(`scn:${label}`, label, true, order, row.name);
      continue;
    }

    const supportSrc = sources.find(
      (src) =>
        (src.kind === "event" || src.kind === "training") && src.supportId != null
    );
    if (supportSrc) {
      const support = supportById.get(supportSrc.supportId);
      const label =
        formatTrainingSourceLabel(support) ||
        shortNameForSupport(support) ||
        "サポ";
      const order = supportOrder.get(Number(supportSrc.supportId)) ?? 50;
      addSkill(`sup:${supportSrc.supportId}`, label, false, order, row.name);
      continue;
    }

    const eventSrc = sources.find((src) => src.kind === "event");
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
  const character = (characters || []).find(
    (c) => Number(c.id) === Number(ui.characterId)
  );
  const counts = countSkills(plan.rows);
  const goldGroups = collectGoldGroups({
    plan,
    ui,
    supports,
    scenario,
    skillById,
  });
  const manualExcluded = collectManualExcludedNames(excludedSkillIds, skillById);

  // characters.json は name 正本（displayName はピッカー用の一時フィールド）
  const characterName = character?.name || "";
  const title =
    String(designTitle || "").trim() ||
    (characterName ? characterBaseName(characterName) : "編成設計");

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
    subtitle: characterName,
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
  const offList = cardEl.querySelector(".off-list");
  const moreChip = cardEl.querySelector(".off-chip--more");
  const offBody = cardEl.querySelector(".off-body");

  if (!offList || !moreChip || !offBody) return;

  if (!names.length) {
    offList.replaceChildren();
    moreChip.classList.remove("is-shown");
    return;
  }

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
      moreChip.classList.add("is-shown");
    } else {
      moreChip.classList.remove("is-shown");
    }

    const moreH = hidden > 0 ? moreChip.offsetHeight : 0;
    const needed = offList.offsetHeight + (hidden > 0 ? gap + moreH : 0);
    if (needed <= offBody.clientHeight || visible <= 0) break;
    visible -= 1;
  }

  if (visible <= 0 && names.length > 0) {
    offList.replaceChildren();
    moreChip.textContent = `他 ${names.length} 件`;
    moreChip.classList.add("is-shown");
  }
}

/**
 * モック DOM 骨格そのまま＋データ差し替え
 * @param {object} model
 * @returns {HTMLElement}
 */
export function renderShareCardElement(model) {
  const article = document.createElement("article");
  article.className = "share";
  article.setAttribute("aria-label", "共有カード主案 v28.1");

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

  const supportFigures = Array.from({ length: 6 }, (_, i) => {
    const id = model.supportIds[i];
    if (id == null) return "<figure></figure>";
    return `<figure><img src="${escapeHtml(supportImageUrl(id))}" alt="" /></figure>`;
  }).join("");

  const charUrl =
    model.characterId != null ? characterImageUrl(model.characterId) : "";
  const fastOn = model.fastLearner;

  // DOM 骨格はモック article.share と同一
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
            <div class="fast-inline${fastOn ? "" : " is-off"}" title="切れ者 ${fastOn ? "ON" : "OFF"}">
              <span class="fast-inline__mark">切れ者</span>
              <span class="fast-inline__state">${fastOn ? "ON" : "OFF"}</span>
            </div>
          </div>

          <div class="work">
            <div class="panel panel--gold">
              <div class="panel__lab">金スキル</div>
              <div class="gold-board">${goldRowsHtml}</div>
            </div>

            <div class="panel panel--off">
              <div class="panel__lab">除外</div>
              <div class="off-body">
                <div class="off-list"></div>
                <span class="off-chip off-chip--more">他 0 件</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="right">
        <div class="right__trainee">
          <img src="${escapeHtml(charUrl)}" alt="" />
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
 * @param {HTMLElement} mount
 * @param {object} model
 * @returns {Promise<HTMLElement>}
 */
export async function renderShareCardToMount(mount, model) {
  mount.replaceChildren();
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

  await new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  );
  fitManualExclusions(card, model.manualExcluded);

  return card;
}

/**
 * @returns {Promise<{ toCanvas: Function, toBlob: Function, toPng: Function }>}
 */
async function loadSnapdom() {
  if (!snapdomPromise) {
    snapdomPromise = import(
      "https://cdn.jsdelivr.net/npm/@zumer/snapdom@2.23.1/+esm"
    ).then((mod) => mod.snapdom);
  }
  return snapdomPromise;
}

/**
 * @param {HTMLElement} cardEl
 * @param {HTMLElement} [_mount] 互換のため残す（画面外マウント想定）
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function captureShareCardElement(cardEl, _mount) {
  const snapdom = await loadSnapdom();

  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  void cardEl.offsetHeight;

  // 画面外マウントのままキャプチャ（一時可視化しない）
  return snapdom.toCanvas(cardEl, {
    width: CARD_WIDTH_PX,
    height: CARD_HEIGHT_PX,
    scale: 2,
    embedFonts: true,
    fontStylesheetDomains: ["fonts.googleapis.com", "fonts.gstatic.com"],
  });
}

/** 保存用 WebP 品質（見た目とサイズのバランス） */
const SHARE_SAVE_WEBP_QUALITY = 0.95;

/**
 * @param {HTMLCanvasElement} canvas
 * @param {string} [type]
 * @param {number} [quality]
 * @returns {Promise<Blob|null>}
 */
function canvasToBlob(canvas, type = "image/png", quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

/**
 * Blob 先頭が WebP か（type 欠落時の判定用）
 * @param {Blob} blob
 * @returns {Promise<boolean>}
 */
async function blobLooksLikeWebp(blob) {
  if (blob.type === "image/webp") return true;
  try {
    const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
    // RIFF .... WEBP
    return (
      head[0] === 0x52 &&
      head[1] === 0x49 &&
      head[2] === 0x46 &&
      head[3] === 0x46 &&
      head[8] === 0x57 &&
      head[9] === 0x45 &&
      head[10] === 0x42 &&
      head[11] === 0x50
    );
  } catch {
    return false;
  }
}

/**
 * 保存用 Blob（WebP 優先。非対応時は JPEG → PNG）
 * @param {HTMLCanvasElement} canvas
 * @returns {Promise<{ blob: Blob, ext: "webp"|"jpg"|"png" }|null>}
 */
async function canvasToSaveBlob(canvas) {
  const webp = await canvasToBlob(canvas, "image/webp", SHARE_SAVE_WEBP_QUALITY);
  if (webp && webp.size > 0 && (await blobLooksLikeWebp(webp))) {
    return { blob: webp, ext: "webp" };
  }
  const jpeg = await canvasToBlob(canvas, "image/jpeg", 0.95);
  if (jpeg && jpeg.size > 0) {
    return { blob: jpeg, ext: "jpg" };
  }
  const png = await canvasToBlob(canvas, "image/png");
  if (png && png.size > 0) return { blob: png, ext: "png" };
  return null;
}

/**
 * @param {HTMLElement} cardEl
 * @param {HTMLElement} mount
 * @returns {Promise<boolean>}
 */
export async function copyShareCardPng(cardEl, mount) {
  const canvas = await captureShareCardElement(cardEl, mount);
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
 * ファイル名に使えない文字を除去（Windows 禁止文字など）
 * @param {string} name
 * @returns {string}
 */
export function sanitizeShareFilenamePart(name) {
  const cleaned = String(name || "")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/\.+$/g, "")
    .slice(0, 80);
  return cleaned || "編成設計";
}

/**
 * 保存名: `{名前}-{YYYYMMDD}-{SP}sp.webp`（既定）
 * 名前は編成タイトル入力欄（空なら育成名 → 編成設計）
 * @param {{ title?: string, totalSp?: number, date?: Date, ext?: string }} params
 * @returns {string}
 */
export function buildShareCardFilename({
  title = "",
  totalSp = 0,
  date = new Date(),
  ext = "webp",
} = {}) {
  const namePart = sanitizeShareFilenamePart(title);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const sp = Math.round(Number(totalSp) || 0);
  const safeExt = String(ext || "webp").replace(/^\./, "") || "webp";
  return `${namePart}-${y}${m}${d}-${sp}sp.${safeExt}`;
}

/**
 * 共有カードをファイル保存（WebP 優先・Blob URL）
 * @param {HTMLElement} cardEl
 * @param {HTMLElement} mount
 * @param {{ title?: string, totalSp?: number }} [nameParts]
 */
export async function saveShareCardPng(cardEl, mount, nameParts = {}) {
  const canvas = await captureShareCardElement(cardEl, mount);
  const saved = await canvasToSaveBlob(canvas);
  if (!saved) throw new Error("画像の生成に失敗しました");

  const filename = buildShareCardFilename({
    title: nameParts.title,
    totalSp: nameParts.totalSp,
    ext: saved.ext,
  });

  // data URL は大きい画像でブラウザの上限に当たり本番で DL できないことがある
  const url = URL.createObjectURL(saved.blob);
  const link = document.createElement("a");
  link.download = filename;
  link.href = url;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}
