import { escapeHtml } from "./htmlEscape.js";
import {
  formatActivationTagLabels,
  getDisplayActivation,
  hasActivationConstraints,
} from "./skillActivation.js";
import { formatSourceKindLabel, orderSourcesByAdopted } from "./skillSource.js";

/**
 * 結果表（#result-body）のレンダリング
 * @param {{
 *   getSkillByIdMap: () => Map,
 *   getExcludedSkillIds: () => Set,
 *   onIncludeChange: (skillId: number, checked: boolean) => void,
 * }} deps
 */
export function createResultTable(deps) {
  const { getSkillByIdMap, getExcludedSkillIds, onIncludeChange } = deps;

  function renderActivationSubline(row) {
    if (row.isInherit || row.skillId == null) return "—";
    const skillById = getSkillByIdMap();
    const activation = getDisplayActivation(
      row.skillId,
      row.chainSkillIds || [row.skillId],
      skillById
    );
    if (!hasActivationConstraints(activation.tags)) {
      return '<span class="result-skill-sub__empty">条件なし</span>';
    }
    const labels = formatActivationTagLabels(activation.tags);
    return labels
      .map((label) => `<span class="badge badge--condition">${escapeHtml(label)}</span>`)
      .join("");
  }

  /**
   * 由来セル: 種別色バッジ + 詳細。title に スキル名・種別・Lv。採用 Lv 一致で強調。
   * @param {{ sources?: { kind: string, label: string, hintLevel: number, skillName?: string }[], hintLevel?: number }} row
   */
  function renderSourceBadges(row) {
    const sources = orderSourcesByAdopted(row.sources || [], row.hintLevel);
    if (!sources.length) return "—";
    const adoptedLv = Number(row.hintLevel) || 0;
    return sources
      .map((src) => {
        const kindLabel = formatSourceKindLabel(src.kind);
        const adopted = src.hintLevel === adoptedLv;
        const classes = [
          "badge",
          `badge--source-${src.kind}`,
          adopted ? "badge--adopted" : "",
        ]
          .filter(Boolean)
          .join(" ");
        const skillPart = src.skillName ? `${src.skillName} / ` : "";
        const title = `${skillPart}${kindLabel} Lv${src.hintLevel}`;
        const detail = src.label ? ` ${escapeHtml(src.label)}` : "";
        return `<span class="${classes}" title="${escapeHtml(title)}"><span class="badge__kind">${escapeHtml(kindLabel)}</span>${detail}</span>`;
      })
      .join("");
  }

  /** 狭幅: スキル名の下に折り返し表示する由来（読みやすさ優先） */
  function renderSourceStacked(row) {
    const sources = orderSourcesByAdopted(row.sources || [], row.hintLevel);
    if (!sources.length) {
      return '<span class="result-skill-sources__empty">—</span>';
    }
    const adoptedLv = Number(row.hintLevel) || 0;
    return sources
      .map((src) => {
        const kindLabel = formatSourceKindLabel(src.kind);
        const adopted = src.hintLevel === adoptedLv;
        const lineClass = [
          "result-skill-source-line",
          adopted ? "result-skill-source-line--adopted" : "",
        ]
          .filter(Boolean)
          .join(" ");
        const detail = src.label ? escapeHtml(src.label) : "—";
        return `<div class="${lineClass}"><span class="badge badge--source-${src.kind}"><span class="badge__kind">${escapeHtml(kindLabel)}</span></span><span class="result-skill-source-detail">${detail}</span><span class="result-skill-source-lv">Lv${src.hintLevel}</span></div>`;
      })
      .join("");
  }

  /**
   * @param {object[]} displayRows - 既にソート済み
   * @param {Set} reguExcluded
   */
  function renderResultBody(displayRows, reguExcluded) {
    const tbody = document.getElementById("result-body");
    tbody.innerHTML = "";
    const excludedSkillIds = getExcludedSkillIds();

    for (const row of displayRows) {
      const tr = document.createElement("tr");
      const isReguExcluded =
        row.skillId != null && reguExcluded.has(row.skillId);
      const isManualExcluded =
        row.skillId != null && excludedSkillIds.has(row.skillId);
      const included = row.skillId == null || !row.excluded;
      if (!included) tr.classList.add("is-off");

      const costDetail =
        row.includesLower && Array.isArray(row.chainCosts) && row.chainCosts.length > 1
          ? `${row.cost} <span class="result-sp-detail">(${row.chainCosts.join("+")})</span>`
          : String(row.cost);

      const toggleTitle = isReguExcluded
        ? "レギュ非互換のため OFF"
        : isManualExcluded
          ? "手動で OFF"
          : "";

      tr.innerHTML = `
      <td class="col-on">
        ${
          row.isInherit
            ? "—"
            : `<input type="checkbox" class="include-check" data-skill-id="${row.skillId}" ${included ? "checked" : ""} ${isReguExcluded ? "disabled" : ""} aria-label="ON" title="${escapeHtml(toggleTitle)}" />`
        }
      </td>
      <td class="result-skill-cell">
        <div class="result-skill-name">${escapeHtml(row.name)}<span class="result-skill-lv">Lv${row.hintLevel}</span></div>
        <div class="result-skill-sub">${renderActivationSubline(row)}</div>
        <div class="result-skill-sources result-skill-sources--narrow">${renderSourceStacked(row)}</div>
      </td>
      <td class="result-skill-sp col-sp">${costDetail}</td>
      <td class="skill-source-cell">${renderSourceBadges(row)}</td>
    `;
      tbody.appendChild(tr);

      const cb = tr.querySelector(".include-check");
      if (cb) {
        cb.addEventListener("change", () => {
          const sid = Number(cb.dataset.skillId);
          onIncludeChange(sid, cb.checked);
        });
      }
    }
  }

  return {
    renderResultBody,
    renderActivationSubline,
    renderSourceBadges,
    renderSourceStacked,
  };
}
