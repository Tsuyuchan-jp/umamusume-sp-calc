import { buildSkillPlan } from "./aggregate.js";
import {
  getDeckLinkCharacterIds,
  resolveLinkSkill,
} from "./scenarioLink.js";

/** @type {object|null} */
let state = null;

/** @type {Set<number>} */
const excludedSkillIds = new Set();

async function loadJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

function showError(msg) {
  const el = document.getElementById("load-error");
  el.hidden = false;
  el.textContent = msg;
}

const SUPPORT_TYPE_LABELS = {
  speed: "スピード",
  stamina: "スタミナ",
  power: "パワー",
  guts: "根性",
  wit: "賢さ",
  friend: "友人",
};

function getSupportFilterState() {
  return {
    query: normalizeSearchText(document.getElementById("support-search")?.value || "").trim(),
    ssrOnly: document.getElementById("support-ssr-only")?.checked ?? false,
    type: document.getElementById("support-type-filter")?.value || "",
  };
}

function supportSearchHaystack(s) {
  return normalizeSearchText(
    [s.name, s.title, s.characterName, s.rarity, SUPPORT_TYPE_LABELS[s.type] || s.type, s.type]
      .filter(Boolean)
      .join(" ")
  );
}

function supportMatchesFilters(s, filters, keepId) {
  if (keepId != null && s.id === keepId) return true;
  if (filters.ssrOnly && s.rarity !== "SSR") return false;
  if (filters.type && s.type !== filters.type) return false;
  if (filters.query && !supportSearchHaystack(s).includes(filters.query)) return false;
  return true;
}

function buildSupportOptions(supports, selectedId, occupiedIds) {
  const filters = getSupportFilterState();
  const sorted = [...supports].sort((a, b) => b.id - a.id);
  const opts = ['<option value="">— 未選択 —</option>'];
  for (const s of sorted) {
    const isSelected = s.id === selectedId;
    if (!isSelected && occupiedIds.has(s.id)) continue;
    if (!supportMatchesFilters(s, filters, selectedId)) continue;
    const typeLabel = SUPPORT_TYPE_LABELS[s.type] || s.type;
    const sel = isSelected ? " selected" : "";
    opts.push(
      `<option value="${s.id}"${sel}>[${escapeHtml(s.rarity)}][${escapeHtml(typeLabel)}] ${escapeHtml(s.name)}</option>`
    );
  }
  return opts.join("");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** [衣装]キャラ名 → キャラ名[衣装] */
function formatCharacterDisplayName(name) {
  const m = String(name).match(/^\[([^\]]+)\](.+)$/);
  if (!m) return name;
  return `${m[2]}[${m[1]}]`;
}

/** ひらがなをカタカナへ（検索照合用） */
function toKatakana(s) {
  return String(s).replace(/[\u3041-\u3096]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) + 0x60)
  );
}

function normalizeSearchText(s) {
  return toKatakana(s).toLowerCase();
}

function renderSupportSlots() {
  const container = document.getElementById("support-slots");
  const selected = state.ui.supportIds;
  container.innerHTML = "";
  for (let i = 0; i < 6; i++) {
    const occupied = new Set(selected.filter((id, idx) => id != null && idx !== i));
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <label>枠 ${i + 1}</label>
      <select data-slot="${i}" class="support-select">
        ${buildSupportOptions(state.supports, selected[i] || "", occupied)}
      </select>
    `;
    container.appendChild(wrap);
  }
  container.querySelectorAll(".support-select").forEach((sel) => {
    sel.addEventListener("change", () => {
      const idx = Number(sel.dataset.slot);
      const v = sel.value ? Number(sel.value) : null;
      state.ui.supportIds[idx] = v;
      renderSupportSlots();
      renderEvents();
      renderScenarioLinkRadios();
      recalc();
    });
  });
}

function bindSupportFilters() {
  const refresh = () => {
    if (!state) return;
    renderSupportSlots();
  };
  document.getElementById("support-search").addEventListener("input", refresh);
  document.getElementById("support-ssr-only").addEventListener("change", refresh);
  document.getElementById("support-type-filter").addEventListener("change", refresh);
}

function filterCharacterOptions(query) {
  const sel = document.getElementById("character-select");
  const q = normalizeSearchText(query).trim();
  const selectedId = String(state.ui.characterId);
  for (const opt of sel.options) {
    const hay = opt.dataset.searchText || "";
    // 選択中は常に表示（フィルタ外でも値を見失わない）
    opt.hidden = q !== "" && opt.value !== selectedId && !hay.includes(q);
  }
}

function renderCharacterSelect() {
  const sel = document.getElementById("character-select");
  const search = document.getElementById("character-search");

  const sorted = [...state.characters]
    .map((c) => ({
      ...c,
      displayName: formatCharacterDisplayName(c.name),
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "ja"));

  sel.innerHTML = sorted
    .map((c) => {
      const selected = c.id === state.ui.characterId ? " selected" : "";
      const searchText = normalizeSearchText(c.displayName);
      return `<option value="${c.id}" data-search-text="${escapeHtml(searchText)}"${selected}>${escapeHtml(c.displayName)}</option>`;
    })
    .join("");

  sel.addEventListener("change", () => {
    state.ui.characterId = Number(sel.value);
    filterCharacterOptions(search.value);
    renderScenarioLinkRadios();
    recalc();
  });

  search.addEventListener("input", () => {
    filterCharacterOptions(search.value);
  });
}

function formatSkillList(skills) {
  return (skills || [])
    .map((sk) => `${sk.skillName} Lv${sk.hintLevel}`)
    .join("、");
}

function isEventSupportInDeck(evt) {
  const supportById = new Map(state.supports.map((s) => [s.id, s]));
  if (!evt.supportNameMatch) return true;
  return getSupportIds().some((id) => {
    const s = supportById.get(id);
    return s && s.name.includes(evt.supportNameMatch);
  });
}

function initEventChoiceIds(events) {
  const map = new Map();
  for (const evt of events.events || []) {
    if (evt.selection === "single") {
      map.set(evt.id, evt.defaultChoiceId ?? "none");
    }
  }
  return map;
}

function renderEvents() {
  const autoContainer = document.getElementById("event-auto");
  const autoCollapse = document.getElementById("event-auto-collapse");
  const autoSummary = document.getElementById("event-auto-summary");
  const singleContainer = document.getElementById("event-single");
  const emptyHint = document.getElementById("event-empty-hint");
  autoContainer.innerHTML = "";
  singleContainer.innerHTML = "";

  const events = (state.events.events || []).filter(isEventSupportInDeck);
  if (events.length === 0) {
    emptyHint.hidden = false;
    autoCollapse.hidden = true;
    return;
  }
  emptyHint.hidden = true;

  const autoEvents = events.filter((evt) => evt.selection === "auto");
  if (autoEvents.length === 0) {
    autoCollapse.hidden = true;
  } else {
    autoCollapse.hidden = false;
    autoSummary.textContent = `${autoEvents.length}件（自動計上）`;
  }

  for (const evt of events) {
    if (evt.selection === "auto") {
      const div = document.createElement("div");
      div.className = "event-auto-item";
      div.innerHTML = `
        <div class="event-auto-label">${escapeHtml(evt.label)}</div>
        <div class="hint">${escapeHtml(formatSkillList(evt.skills))}（自動計上）</div>
      `;
      autoContainer.appendChild(div);
      continue;
    }

    if (evt.selection === "single") {
      const group = document.createElement("fieldset");
      group.className = "event-single-group";
      const legend = document.createElement("legend");
      legend.textContent = evt.label;
      group.appendChild(legend);

      const current = state.ui.eventChoiceIds.get(evt.id) ?? "none";
      const choices = [
        ...(evt.choices || []),
        { id: "none", label: "未選択（発生しない）", skills: [] },
      ];

      for (const choice of choices) {
        const row = document.createElement("div");
        row.className = "radio-row";
        const inputId = `evt-${evt.id}-${choice.id}`;
        const checked = current === choice.id ? "checked" : "";
        row.innerHTML = `
          <input type="radio" name="evt-${evt.id}" id="${inputId}" value="${escapeHtml(choice.id)}" ${checked} />
          <label for="${inputId}">${escapeHtml(choice.label)}</label>
        `;
        group.appendChild(row);
        row.querySelector("input").addEventListener("change", (e) => {
          if (!e.target.checked) return;
          state.ui.eventChoiceIds.set(evt.id, choice.id);
          recalc();
        });
      }
      singleContainer.appendChild(group);
      continue;
    }

    // toggle（後方互換）
    const div = document.createElement("div");
    div.className = "checkbox-row";
    const checked = state.ui.enabledEventIds.has(evt.id) ? "checked" : "";
    div.innerHTML = `
      <input type="checkbox" id="evt-${evt.id}" data-id="${evt.id}" ${checked} />
      <label for="evt-${evt.id}">${escapeHtml(evt.label)}</label>
    `;
    singleContainer.appendChild(div);
    div.querySelector("input").addEventListener("change", (e) => {
      if (e.target.checked) state.ui.enabledEventIds.add(evt.id);
      else state.ui.enabledEventIds.delete(evt.id);
      recalc();
    });
  }
}

/** シナリオ自動計上（折りたたみ・確認用） */
function renderScenarioAuto() {
  const container = document.getElementById("scenario-auto");
  const summary = document.getElementById("scenario-auto-summary");
  container.innerHTML = "";

  const entries = state.scenario.scenarioAutoSkills || [];
  let skillCount = 0;
  for (const entry of entries) {
    skillCount += (entry.skills || []).length;
    const div = document.createElement("div");
    div.className = "event-auto-item";
    div.innerHTML = `
      <div class="event-auto-label">${escapeHtml(entry.label)}</div>
      <div class="hint">${escapeHtml(formatSkillList(entry.skills))}（自動計上）</div>
    `;
    container.appendChild(div);
  }
  summary.textContent = `${skillCount}スキル（自動計上）`;
}

/** シニア12月 RMJ ラーメン選択（相互排他ラジオ1択） */
function renderSeniorRmjRadios() {
  const container = document.getElementById("scenario-senior-rmj");
  container.innerHTML = "";
  const rmj = state.scenario.seniorRmjChoice;
  if (!rmj?.choices?.length) return;

  const group = document.createElement("fieldset");
  group.className = "event-single-group";
  const legend = document.createElement("legend");
  legend.textContent = rmj.label || "シニア12月 超盛況";
  group.appendChild(legend);

  const defaultId = rmj.defaultChoiceId ?? rmj.choices[0].id;
  const current = state.ui.seniorRmjChoiceId ?? defaultId;

  for (const choice of rmj.choices) {
    const row = document.createElement("div");
    row.className = "radio-row";
    const inputId = `scn-rmj-${choice.id}`;
    const checked = current === choice.id ? "checked" : "";
    const skillNote =
      choice.skills?.length > 0
        ? `<span class="hint"> — ${escapeHtml(formatSkillList(choice.skills))}</span>`
        : "";
    row.innerHTML = `
      <input type="radio" name="scenario-senior-rmj" id="${inputId}" value="${escapeHtml(choice.id)}" ${checked} />
      <label for="${inputId}">${escapeHtml(choice.label)}${skillNote}</label>
    `;
    group.appendChild(row);
    row.querySelector("input").addEventListener("change", (e) => {
      if (e.target.checked) {
        state.ui.seniorRmjChoiceId = choice.id;
        recalc();
      }
    });
  }
  container.appendChild(group);
}

/** 編成に応じたリンクヒント（白 or 金）を表示用に解決 */
function getResolvedLinkSkill(linkEntry) {
  const supportById = new Map(state.supports.map((s) => [s.id, s]));
  const deckIds = getDeckLinkCharacterIds(
    state.ui.characterId,
    getSupportIds(),
    supportById
  );
  return resolveLinkSkill(linkEntry, deckIds);
}

/** シナリオリンクは相互排他のラジオ1択（未選択なし・常に全リンク表示） */
function renderScenarioLinkRadios() {
  const container = document.getElementById("scenario-link");
  container.innerHTML = "";
  const links = state.scenario.linkSkills || [];
  if (links.length === 0) return;

  const group = document.createElement("fieldset");
  group.className = "event-single-group";
  const legend = document.createElement("legend");
  legend.textContent = "シナリオリンク（シニア9月前半）";
  group.appendChild(legend);

  const current = state.ui.scenarioLinkChoiceId ?? "link_dotou";

  for (const entry of links) {
    const row = document.createElement("div");
    row.className = "radio-row";
    const inputId = `scn-link-${entry.id}`;
    const checked = current === entry.id ? "checked" : "";
    const resolved = getResolvedLinkSkill(entry);
    const skillNote = resolved
      ? `<span class="hint"> — ${escapeHtml(resolved.skillName)} Lv${resolved.hintLevel}</span>`
      : "";
    row.innerHTML = `
      <input type="radio" name="scenario-link" id="${inputId}" value="${escapeHtml(entry.id)}" ${checked} />
      <label for="${inputId}">${escapeHtml(entry.label)}${skillNote}</label>
    `;
    group.appendChild(row);
    row.querySelector("input").addEventListener("change", (e) => {
      if (e.target.checked) {
        state.ui.scenarioLinkChoiceId = entry.id;
        recalc();
      }
    });
  }
  container.appendChild(group);
}

function buildEnabledScenarioEntryIds() {
  const enabled = new Set();
  const linkId = state.ui.scenarioLinkChoiceId ?? "link_dotou";
  if (linkId) enabled.add(linkId);
  return enabled;
}

function getSupportIds() {
  return state.ui.supportIds.filter((id) => id != null);
}

function recalc() {
  if (!state) return;

  const plan = buildSkillPlan({
    skills: state.skills,
    supports: state.supports,
    characters: state.characters,
    events: state.events,
    scenario: state.scenario,
    characterId: state.ui.characterId,
    supportIds: getSupportIds(),
    excludedSkillIds,
    fastLearner: document.getElementById("fast-learner").checked,
    inheritEnabled: document.getElementById("inherit-enabled").checked,
    inheritCount: Number(document.getElementById("inherit-count").value) || 0,
    inheritHintLevel: Number(document.getElementById("inherit-hint").value) || 1,
    inheritBaseSp: Number(document.getElementById("inherit-base").value) || 200,
    enabledEventIds: state.ui.enabledEventIds,
    eventChoiceIds: Object.fromEntries(state.ui.eventChoiceIds),
    enabledScenarioEntryIds: buildEnabledScenarioEntryIds(),
    seniorRmjChoiceId: state.ui.seniorRmjChoiceId,
  });

  document.getElementById("total-sp").textContent = plan.total.toLocaleString();

  const tbody = document.getElementById("result-body");
  tbody.innerHTML = "";
  for (const row of plan.rows) {
    const tr = document.createElement("tr");
    if (row.skillId != null && excludedSkillIds.has(row.skillId)) {
      tr.classList.add("excluded");
    }
    const checkId = row.skillId ?? `inherit-${row.name}`;
    const included =
      row.skillId == null || !excludedSkillIds.has(row.skillId);
    const costDetail =
      row.includesLower && row.lowerCost != null
        ? `${row.cost} <span class="hint">(白${row.lowerCost}+金${row.goldOnlyCost})</span>`
        : String(row.cost);

    tr.innerHTML = `
      <td>
        ${
          row.isInherit
            ? "—"
            : `<input type="checkbox" class="include-check" data-skill-id="${row.skillId}" ${included ? "checked" : ""} />`
        }
      </td>
      <td>${escapeHtml(row.name)}</td>
      <td>${row.hintLevel}</td>
      <td>${costDetail}</td>
      <td>${row.sources.map((s) => `<span class="badge">${escapeHtml(s)}</span>`).join("")}</td>
    `;
    tbody.appendChild(tr);

    const cb = tr.querySelector(".include-check");
    if (cb) {
      cb.addEventListener("change", () => {
        const sid = Number(cb.dataset.skillId);
        if (cb.checked) excludedSkillIds.delete(sid);
        else excludedSkillIds.add(sid);
        recalc();
      });
    }
  }
}

function bindOptions() {
  ["fast-learner", "inherit-enabled", "inherit-count", "inherit-hint", "inherit-base"].forEach(
    (id) => {
      document.getElementById(id).addEventListener("change", recalc);
      document.getElementById(id).addEventListener("input", recalc);
    }
  );
}

/** タイトル（＋任意でレアリティ・タイプ）でサポカを検索 */
function findSupportByTitle(title, options = {}) {
  const { rarity, type } = options;
  return state.supports.find((s) => {
    if (s.title !== title && !s.name.startsWith(`[${title}]`)) return false;
    if (rarity && s.rarity !== rarity) return false;
    if (type && s.type !== type) return false;
    return true;
  });
}

/** サポカ6枠の初期選択（1〜4: 未選択、5: フォーエバーヤング、6: たづな） */
function applyDefaultSupports() {
  const young = findSupportByTitle("Innovator", { rarity: "SSR", type: "wit" });
  const tazuna = findSupportByTitle("一杯のノスタルジア", { rarity: "SSR", type: "friend" });
  state.ui.supportIds = [
    null,
    null,
    null,
    null,
    young?.id ?? null,
    tazuna?.id ?? null,
  ];
}

async function init() {
  try {
    const [skills, supports, characters, events, scenario] = await Promise.all([
      loadJson("../data/skills.json"),
      loadJson("../data/supports.json"),
      loadJson("../data/characters.json"),
      loadJson("../data/events.json"),
      loadJson("../data/scenarios/toresenken.json"),
    ]);

    state = {
      skills,
      supports,
      characters,
      events,
      scenario,
      ui: {
        characterId: characters[0]?.id ?? 0,
        supportIds: [null, null, null, null, null, null],
        enabledEventIds: new Set(),
        eventChoiceIds: initEventChoiceIds(events),
        scenarioLinkChoiceId: "link_dotou",
        seniorRmjChoiceId:
          scenario.seniorRmjChoice?.defaultChoiceId ?? "ramen_shugyoku",
      },
    };

    applyDefaultSupports();
    renderCharacterSelect();
    renderSupportSlots();
    bindSupportFilters();

    renderEvents();
    renderScenarioLinkRadios();
    renderSeniorRmjRadios();
    renderScenarioAuto();

    bindOptions();
    recalc();
  } catch (e) {
    showError(
      `データの読み込みに失敗しました: ${e.message}\n\n` +
        "1. python scripts/extract_mdb.py を実行して data/*.json を生成\n" +
        "2. app フォルダで python -m http.server 8080 を起動して http://localhost:8080 を開く"
    );
    console.error(e);
  }
}

init();
