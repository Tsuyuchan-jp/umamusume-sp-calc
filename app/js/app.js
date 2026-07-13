import { buildSkillPlan } from "./aggregate.js";

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

function buildSupportOptions(supports, selectedId) {
  const rarityOrder = { SSR: 0, SR: 1, R: 2 };
  const sorted = [...supports].sort((a, b) => {
    const ra = rarityOrder[a.rarity] ?? 9;
    const rb = rarityOrder[b.rarity] ?? 9;
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name, "ja");
  });
  const opts = ['<option value="">— 未選択 —</option>'];
  for (const s of sorted) {
    const sel = s.id === selectedId ? " selected" : "";
    opts.push(
      `<option value="${s.id}"${sel}>[${escapeHtml(s.rarity)}] ${escapeHtml(s.name)}</option>`
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

/** リスト展開時の表示行数 */
const CHARACTER_SELECT_LIST_SIZE = 10;

function updateCharacterSelectSize() {
  const sel = document.getElementById("character-select");
  if (!sel || document.activeElement !== sel) return;
  const visibleCount = [...sel.options].filter((o) => !o.hidden).length;
  sel.size = Math.min(CHARACTER_SELECT_LIST_SIZE, Math.max(1, visibleCount));
}

function setCharacterSelectExpanded(expanded) {
  const sel = document.getElementById("character-select");
  if (!sel) return;
  if (expanded) {
    updateCharacterSelectSize();
  } else {
    sel.size = 1;
  }
}

function renderSupportSlots() {
  const container = document.getElementById("support-slots");
  const selected = state.ui.supportIds;
  container.innerHTML = "";
  for (let i = 0; i < 6; i++) {
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <label>枠 ${i + 1}</label>
      <select data-slot="${i}" class="support-select">
        ${buildSupportOptions(state.supports, selected[i] || "")}
      </select>
    `;
    container.appendChild(wrap);
  }
  container.querySelectorAll(".support-select").forEach((sel) => {
    sel.addEventListener("change", () => {
      const idx = Number(sel.dataset.slot);
      const v = sel.value ? Number(sel.value) : null;
      state.ui.supportIds[idx] = v;
      recalc();
    });
  });
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
  updateCharacterSelectSize();
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

  sel.size = 1;

  sel.addEventListener("focus", () => {
    setCharacterSelectExpanded(true);
  });

  sel.addEventListener("blur", () => {
    // option クリックが blur より先に処理されるよう短い遅延
    setTimeout(() => setCharacterSelectExpanded(false), 120);
  });

  sel.addEventListener("change", () => {
    state.ui.characterId = Number(sel.value);
    filterCharacterOptions(search.value);
    recalc();
  });

  search.addEventListener("input", () => {
    filterCharacterOptions(search.value);
  });
}

function renderCheckboxes(containerId, items, storageSet, key) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  for (const item of items) {
    const id = item.id;
    const checked = storageSet.has(id) ? "checked" : "";
    const div = document.createElement("div");
    div.className = "checkbox-row";
    div.innerHTML = `
      <input type="checkbox" id="${key}-${id}" data-id="${id}" ${checked} />
      <label for="${key}-${id}">${escapeHtml(item.label)}</label>
    `;
    container.appendChild(div);
    div.querySelector("input").addEventListener("change", (e) => {
      if (e.target.checked) storageSet.add(id);
      else storageSet.delete(id);
      recalc();
    });
  }
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
    enabledScenarioEntryIds: state.ui.enabledScenarioEntryIds,
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

/** 常用サポカをタイトル優先で初期選択 */
function applyDefaultSupports() {
  const ids = [];
  const fromIds = state.events.prioritySupportIds || [];
  for (const id of fromIds) {
    if (ids.length >= 6) break;
    if (state.supports.some((s) => s.id === id) && !ids.includes(id)) {
      ids.push(id);
    }
  }
  if (ids.length < 6) {
    for (const pname of state.events.prioritySupportNames || []) {
      if (ids.length >= 6) break;
      const titleMatch = pname.match(/\[(.+?)\]/);
      const title = titleMatch?.[1];
      const found = state.supports.find(
        (s) =>
          (title && (s.title === title || s.name.includes(`[${title}]`))) ||
          s.name.includes(pname.replace(/\[.*?\]\s*/, "").trim())
      );
      if (found && !ids.includes(found.id)) ids.push(found.id);
    }
  }
  while (ids.length < 6) ids.push(null);
  state.ui.supportIds = ids.slice(0, 6);
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
        enabledEventIds: new Set(
          (events.events || []).filter((e) => e.skills?.some((s) => s.defaultOn)).map((e) => e.id)
        ),
        enabledScenarioEntryIds: new Set(),
      },
    };

    applyDefaultSupports();
    renderCharacterSelect();
    renderSupportSlots();

    const scenarioItems = [
      ...(scenario.linkSkills || []),
      ...(scenario.rmjSkills || []),
      ...(scenario.endSkills || []),
      ...(scenario.classicRmj || []),
    ];
    renderCheckboxes("event-checks", events.events || [], state.ui.enabledEventIds, "evt");
    renderCheckboxes(
      "scenario-checks",
      scenarioItems,
      state.ui.enabledScenarioEntryIds,
      "scn"
    );

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
