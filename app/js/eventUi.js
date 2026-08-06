import { escapeHtml } from "./htmlEscape.js";

/**
 * サポカイベント選択 UI（列下要約・スプリットペイン・ダイアログ）
 * @param {{
 *   getState: () => any,
 *   getSupportById: (id: number) => any,
 *   shortSupportLabel: (s: any) => string,
 *   formatSkillList: (skills: any) => string,
 *   getSkillByIdMap: () => Map,
 *   recalc: () => void,
 *   isEventSupportInDeck: (evt: any) => boolean,
 * }} deps
 */
export function createEventUi(deps) {
  const {
    getState,
    getSupportById,
    shortSupportLabel,
    formatSkillList,
    getSkillByIdMap,
    recalc,
    isEventSupportInDeck,
  } = deps;

  /** スプリット左ドックでフォーカス中のサポ枠（0–5）。ギャラリーでは未使用 */
  let focusSupportSlot = null;

  /** スプリット詳細ペインで開いているイベント（再タップ閉じ用） */
  let splitEvtOpen = null;

  function getEventsForSupport(support) {
    const state = getState();
    if (!support) return [];
    return (state.events.events || []).filter(
      (evt) => evt.supportNameMatch && support.name.includes(evt.supportNameMatch)
    );
  }

  /** 選択肢の種別: 金(rarity2) / 白 / ステのみ */
  function choiceKind(choice) {
    const skills = choice?.skills || [];
    if (skills.length === 0) return "stat";
    const map = getSkillByIdMap();
    if (skills.some((sk) => map.get(sk.skillId)?.rarity === 2)) return "gold";
    return "white";
  }

  function kindBadgeHtml(kind) {
    if (kind === "gold") return '<span class="evt-badge evt-badge--gold">金</span>';
    if (kind === "white") return '<span class="evt-badge evt-badge--white">白</span>';
    if (kind === "stat") return '<span class="evt-badge evt-badge--stat">ステ</span>';
    if (kind === "auto") return '<span class="evt-badge evt-badge--auto">自動</span>';
    return "";
  }

  function sortChoicesGoldFirst(choices) {
    return [...(choices || [])].sort((a, b) => {
      const ka = choiceKind(a) === "gold" ? 0 : 1;
      const kb = choiceKind(b) === "gold" ? 0 : 1;
      return ka - kb;
    });
  }

  function shortChoiceLabel(choice) {
    return (choice?.label || "").replace(/^[①②③④⑤⑥⑦⑧⑨⑩]\s*/, "");
  }

  function goldSkillsFromList(skills) {
    const map = getSkillByIdMap();
    return (skills || [])
      .filter((sk) => map.get(sk.skillId)?.rarity === 2)
      .map((sk) => ({
        skillName: sk.skillName,
        hintLevel: sk.hintLevel,
      }));
  }

  function goldSkillNamesFromSkills(skills) {
    return goldSkillsFromList(skills).map((sk) => sk.skillName);
  }

  /** 列下・金スキル行（1スキル1行・Lv付き） */
  function columnGoldSkillLinesHtml(skills) {
    const golds = goldSkillsFromList(skills);
    return golds
      .map(
        (sk) =>
          `<span class="deck-evt-sum__skill-line">${escapeHtml(`${sk.skillName} Lv${sk.hintLevel}`)}</span>`
      )
      .join("");
  }

  function columnGoldSkillTitleText(skills) {
    return goldSkillsFromList(skills)
      .map((sk) => `${sk.skillName} Lv${sk.hintLevel}`)
      .join("、");
  }

  /** single の選択IDを既定へ正規化（未選択なし） */
  function resolveEventChoiceId(evt) {
    const state = getState();
    const choices = evt.choices || [];
    const def = evt.defaultChoiceId ?? choices[0]?.id;
    let cur = state.ui.eventChoiceIds.get(evt.id);
    if (!cur || cur === "none" || !choices.some((c) => c.id === cur)) {
      cur = def;
      if (cur) state.ui.eventChoiceIds.set(evt.id, cur);
    }
    return cur;
  }

  /** 選択肢パネル用。label と skills 一覧は同内容なので二重表示しない */
  function choicePanelDescHtml(skills, emptyFallback) {
    if (skills && skills.length > 0) return "";
    return `<div class="evt-choice-panel__desc">${escapeHtml(emptyFallback)}</div>`;
  }

  function renderChoicePanelButtons(container, evt, onAfter) {
    const state = getState();
    container.innerHTML = "";
    if (evt.selection === "toggle") {
      const on = state.ui.enabledEventIds.has(evt.id);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "evt-choice-panel" + (on ? " is-on" : "");
      const title =
        formatSkillList(evt.skills) ||
        evt.label.replace(/^[①②③④⑤⑥⑦⑧⑨⑩]\s*/, "") ||
        "ON/OFF";
      btn.innerHTML = `
      <span class="evt-choice-panel__kind">${kindBadgeHtml("white")}</span>
      <span class="evt-choice-panel__main">
        <span class="evt-choice-panel__title">${escapeHtml(title)}</span>
      </span>
      <span class="evt-choice-panel__pick">${on ? "ON" : "OFF"}</span>`;
      btn.onclick = () => {
        if (state.ui.enabledEventIds.has(evt.id)) state.ui.enabledEventIds.delete(evt.id);
        else state.ui.enabledEventIds.add(evt.id);
        onAfter();
      };
      container.appendChild(btn);
      return;
    }

    const current = resolveEventChoiceId(evt);
    for (const choice of sortChoicesGoldFirst(evt.choices || [])) {
      const kind = choiceKind(choice);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "evt-choice-panel" + (current === choice.id ? " is-on" : "");
      btn.innerHTML = `
      <span class="evt-choice-panel__kind">${kindBadgeHtml(kind)}</span>
      <span class="evt-choice-panel__main">
        <span class="evt-choice-panel__title">${escapeHtml(shortChoiceLabel(choice))}</span>
        ${choicePanelDescHtml(choice.skills, "ステータス分岐など")}
      </span>
      <span class="evt-choice-panel__pick">${current === choice.id ? "選択中" : "選ぶ"}</span>`;
      btn.onclick = () => {
        state.ui.eventChoiceIds.set(evt.id, choice.id);
        onAfter();
      };
      container.appendChild(btn);
    }
  }

  function isSplitLayout() {
    return document.body.classList.contains("layout-split");
  }

  function setFocusSupportSlot(slotIndex) {
    focusSupportSlot = slotIndex;
    document.querySelectorAll(".deck-support-col").forEach((el) => {
      const i = Number(el.dataset.slot);
      el.classList.toggle("is-focus", focusSupportSlot === i);
    });
  }

  function closeSplitEvtPane() {
    const pane = document.getElementById("split-evt-pane");
    if (pane) pane.hidden = true;
    splitEvtOpen = null;
    setFocusSupportSlot(null);
  }

  function openEventChoicePane(evt, slotIndex) {
    const state = getState();
    const pane = document.getElementById("split-evt-pane");
    const title = document.getElementById("split-evt-pane-title");
    const sub = document.getElementById("split-evt-pane-sub");
    const body = document.getElementById("split-evt-pane-body");
    if (!pane || !body) return;

    if (typeof slotIndex === "number") setFocusSupportSlot(slotIndex);

    const support =
      typeof slotIndex === "number" && state?.ui?.supportIds[slotIndex] != null
        ? getSupportById(state.ui.supportIds[slotIndex])
        : null;
    const slotLabel =
      typeof slotIndex === "number" ? `${slotIndex + 1}. ` : "";
    const name = support ? shortSupportLabel(support) : "";
    title.textContent = `${slotLabel}${name || evt.label}`;
    sub.textContent = "カード帯・同じ項目・Esc で閉じる";

    const refresh = () => {
      renderColumnEvents();
      renderChoicePanelButtons(body, evt, () => {
        recalc();
        refresh();
      });
    };
    refresh();
    splitEvtOpen = { evtId: evt.id, slotIndex };
    pane.hidden = false;
  }

  function openEventChoiceDialog(evt) {
    const dialog = document.getElementById("event-choice-dialog");
    const title = document.getElementById("event-choice-dialog-title");
    const sub = document.getElementById("event-choice-dialog-sub");
    const body = document.getElementById("event-choice-dialog-body");
    if (!dialog || !body) return;
    title.textContent = evt.label;
    sub.textContent =
      evt.selection === "toggle" ? "ON/OFF を切り替え" : "金・白・ステから必ず1つ選びます";
    const refresh = () => {
      renderColumnEvents();
      renderChoicePanelButtons(body, evt, () => {
        recalc();
        refresh();
      });
    };
    refresh();
    if (typeof dialog.showModal === "function") dialog.showModal();
  }

  function openEventChoiceUi(evt, slotIndex) {
    if (isSplitLayout()) {
      const pane = document.getElementById("split-evt-pane");
      const sameOpen =
        pane &&
        !pane.hidden &&
        splitEvtOpen &&
        splitEvtOpen.evtId === evt.id &&
        splitEvtOpen.slotIndex === slotIndex;
      if (sameOpen) {
        closeSplitEvtPane();
        return;
      }
      openEventChoicePane(evt, slotIndex);
      return;
    }
    openEventChoiceDialog(evt);
  }

  function bindEventChoiceDialog() {
    const dialog = document.getElementById("event-choice-dialog");
    const closeBtn = document.getElementById("event-choice-close");
    closeBtn?.addEventListener("click", () => dialog?.close());
    dialog?.addEventListener("click", (e) => {
      if (e.target === dialog) dialog.close();
    });
    document.getElementById("split-evt-pane-close")?.addEventListener("click", () => {
      closeSplitEvtPane();
    });
    /* スプリット詳細のみ: Esc で閉じる（ギャラリーのダイアログはネイティブ Esc） */
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!isSplitLayout()) return;
      const pane = document.getElementById("split-evt-pane");
      if (!pane || pane.hidden) return;
      closeSplitEvtPane();
    });
    /* 編成上部（カード帯）クリックはモーダル風に先にペインを閉じる。要約は openEventChoiceUi 側 */
    document.querySelector(".deck-dashboard")?.addEventListener("click", (e) => {
      if (!isSplitLayout()) return;
      const pane = document.getElementById("split-evt-pane");
      if (!pane || pane.hidden) return;
      if (e.target.closest(".deck-evt-sum")) return;
      closeSplitEvtPane();
    });
  }

  /** 列下要約の並び: 金自動 → 金選択式 → 白/ステ選択式 → 非金自動 */
  function columnEventSortKey(evt) {
    if (evt.selection === "auto") {
      return goldSkillNamesFromSkills(evt.skills).length > 0 ? 0 : 4;
    }
    return selectableEventSortKey(evt) + 1;
  }

  /** 選択式イベント内の並び: 金 → 白 → ステ/toggle */
  function selectableEventSortKey(evt) {
    if (evt.selection === "toggle") return 2;
    const choices = evt.choices || [];
    const hasGold = choices.some((c) => choiceKind(c) === "gold");
    const choiceId = resolveEventChoiceId(evt);
    const current = choices.find((c) => c.id === choiceId);
    const curKind = current ? choiceKind(current) : "stat";
    if (curKind === "gold" || hasGold) return 0;
    if (curKind === "white") return 1;
    return 2;
  }

  /** 列下: Aは要約タップで詳細。Bサポカ自動は列下のみ（金なら金トーン） */
  function renderColumnEvents() {
    const state = getState();
    if (!state) return;
    for (let i = 0; i < 6; i++) {
      const container = document.getElementById(`deck-slot-events-${i}`);
      if (!container) continue;
      container.innerHTML = "";
      const id = state.ui.supportIds[i];
      const support = id != null ? getSupportById(id) : null;
      if (!support) continue;

      const events = getEventsForSupport(support)
        .map((evt, index) => ({ evt, index }))
        .sort((a, b) => {
          const ka = columnEventSortKey(a.evt);
          const kb = columnEventSortKey(b.evt);
          if (ka !== kb) return ka - kb;
          return a.index - b.index;
        })
        .map(({ evt }) => evt);

      for (const evt of events) {
        if (evt.selection === "auto") {
          const golds = goldSkillsFromList(evt.skills);
          const isGold = golds.length > 0;
          const label = isGold
            ? columnGoldSkillLinesHtml(evt.skills)
            : escapeHtml(evt.skills?.[0]?.skillName || "自動");
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className =
            "deck-evt-sum" +
            (isGold ? " deck-evt-sum--gold" : " deck-evt-sum--auto") +
            (isGold && golds.length === 1 ? " deck-evt-sum--gold-1line" : "");
          btn.title = isGold
            ? `${evt.label || "自動計上"} — ${columnGoldSkillTitleText(evt.skills)}`
            : evt.label || "自動計上";
          btn.innerHTML = `<span class="deck-evt-sum__bar" aria-hidden="true"></span><span class="deck-evt-sum__name">${label}</span><span class="deck-evt-sum__meta">自動</span>`;
          btn.addEventListener("click", () => {
            /* サポカ自動は列下で完結。編集不可のためダイアログは開かない */
          });
          container.appendChild(btn);
          continue;
        }

        const btn = document.createElement("button");
        btn.type = "button";
        const paneOpen =
          isSplitLayout() &&
          splitEvtOpen &&
          splitEvtOpen.evtId === evt.id &&
          splitEvtOpen.slotIndex === i;
        if (evt.selection === "toggle") {
          const on = state.ui.enabledEventIds.has(evt.id);
          const label = evt.label.replace(/^[^ ]+ /, "");
          btn.className = "deck-evt-sum deck-evt-sum--white";
          btn.title = on ? "ON · タップで詳細" : "OFF · タップで詳細";
          if (paneOpen) btn.title = "タップで閉じる";
          btn.innerHTML = `<span class="deck-evt-sum__bar" aria-hidden="true"></span><span class="deck-evt-sum__name">${escapeHtml(label)}</span><span class="deck-evt-sum__meta">${on ? "ON" : "OFF"}</span>`;
        } else {
          const choiceId = resolveEventChoiceId(evt);
          const choice = (evt.choices || []).find((c) => c.id === choiceId);
          const kind = choice ? choiceKind(choice) : "stat";
          const golds = kind === "gold" && choice ? goldSkillsFromList(choice.skills) : [];
          const nameHtml =
            kind === "gold" && choice
              ? columnGoldSkillLinesHtml(choice.skills)
              : escapeHtml(choice ? shortChoiceLabel(choice) : "選択");
          const n = (evt.choices || []).length;
          const kindClass =
            kind === "gold"
              ? "deck-evt-sum--gold"
              : kind === "white"
                ? "deck-evt-sum--white"
                : "deck-evt-sum--stat";
          btn.className =
            `deck-evt-sum ${kindClass}` +
            (kind === "gold" && golds.length === 1 ? " deck-evt-sum--gold-1line" : "");
          btn.title = paneOpen ? "タップで閉じる" : `全${n}択 · タップで詳細`;
          if (kind === "gold" && choice && !paneOpen) {
            btn.title = `${btn.title} — ${columnGoldSkillTitleText(choice.skills)}`;
          }
          btn.innerHTML = `<span class="deck-evt-sum__bar" aria-hidden="true"></span><span class="deck-evt-sum__name">${nameHtml}</span><span class="deck-evt-sum__meta">${n}</span>`;
        }
        btn.addEventListener("click", () => openEventChoiceUi(evt, i));
        container.appendChild(btn);
      }
    }
  }

  function renderEvents() {
    const state = getState();
    const emptyHint = document.getElementById("event-empty-hint");

    renderColumnEvents();

    const events = (state.events.events || []).filter(isEventSupportInDeck);
    if (emptyHint) emptyHint.hidden = events.length > 0;
  }

  /** シナリオ自動計上（折りたたみ・確認のみ） */
  function renderScenarioAuto() {
    const state = getState();
    const container = document.getElementById("scenario-auto");
    const countEl = document.getElementById("scenario-auto-count");
    if (!container) return;
    container.innerHTML = "";

    const entries = state.scenario.scenarioAutoSkills || [];
    if (countEl) countEl.textContent = `${entries.length}件`;

    if (entries.length === 0) {
      container.innerHTML = `<p class="scenario-auto-empty">シナリオ自動なし</p>`;
      return;
    }
    for (const entry of entries) {
      const div = document.createElement("div");
      div.className = "scenario-auto-row";
      div.innerHTML = `
      <div class="scenario-auto-row__label">${escapeHtml(entry.label)}</div>
      <div class="scenario-auto-row__skills">${escapeHtml(formatSkillList(entry.skills))}</div>
    `;
      container.appendChild(div);
    }
  }

  return {
    bindEventChoiceDialog,
    renderEvents,
    renderColumnEvents,
    renderScenarioAuto,
    closeSplitEvtPane,
    resolveEventChoiceId,
    getFocusSupportSlot: () => focusSupportSlot,
  };
}
