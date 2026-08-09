/** localStorage キー: レイアウト好み gallery | split（旧 auto は gallery へ移行） */
export const LAYOUT_MODE_KEY = "umamusume-sp-calc-layout-mode";

const LAYOUT_NARROW_MQ = "(max-width: 1199px)";

/**
 * ギャラリー⇔スプリット・合計バー／共有ボタンの DOM 移動
 * @param {{
 *   eventUi: { closeSplitEvtPane: () => void },
 *   syncInheritPopoverAnchorIfOpen: () => void,
 * }} deps
 */
export function createLayoutMode(deps) {
  const { eventUi, syncInheritPopoverAnchorIfOpen } = deps;

  function isLayoutNarrow() {
    return window.matchMedia(LAYOUT_NARROW_MQ).matches;
  }

  function normalizeLayoutPref(pref) {
    if (pref === "auto") return "gallery";
    return pref === "split" ? "split" : "gallery";
  }

  function resolveLayoutMode(pref) {
    if (isLayoutNarrow()) return "gallery";
    return normalizeLayoutPref(pref);
  }

  function placeLayoutShare(narrow) {
    const share = document.getElementById("layout-share");
    const modebar = document.querySelector(".layout-modebar");
    const panelSlot = document.getElementById("result-panel-share");
    if (!share) return;
    if (narrow && panelSlot) {
      panelSlot.appendChild(share);
      share.classList.add("layout-share--on-panel");
      share.classList.remove("layout-share--in-bar");
      panelSlot.hidden = false;
      panelSlot.removeAttribute("aria-hidden");
    } else if (modebar) {
      modebar.appendChild(share);
      share.classList.remove("layout-share--on-panel", "layout-share--in-bar");
      if (panelSlot) {
        panelSlot.hidden = true;
        panelSlot.setAttribute("aria-hidden", "true");
      }
    }
  }

  function placeTotalSpBar(enteringSplit) {
    const bar = document.getElementById("total-sp-bar");
    const modebar = document.querySelector(".layout-modebar");
    const main = document.querySelector(".app-main");
    const actions = document.querySelector(".header-actions");
    const brand = document.querySelector(".total-sp-bar__brand");
    const header = document.querySelector(".app-header");
    if (!bar) return;
    const narrow = isLayoutNarrow();
    const splitBar = enteringSplit && !narrow;
    bar.classList.toggle("total-sp-bar--split-cmd", splitBar);
    if (splitBar && modebar) {
      modebar.after(bar);
    } else if (main) {
      main.after(bar);
    }
    if (splitBar && brand && actions) {
      brand.appendChild(actions);
    } else if (header && actions) {
      header.appendChild(actions);
    }
    placeLayoutShare(narrow);
  }

  function applyLayoutMode(effective) {
    const enteringSplit = effective === "split";
    /* ギャラリーで下にスクロールしたまま split の overflow:hidden に入ると切替バーが画面外で操作不能になる */
    if (enteringSplit) {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    } else {
      eventUi.closeSplitEvtPane();
    }
    document.documentElement.classList.toggle("layout-split", enteringSplit);
    document.documentElement.classList.toggle("layout-gallery", !enteringSplit);
    document.body.classList.toggle("layout-split", enteringSplit);
    document.body.classList.toggle("layout-gallery", !enteringSplit);
    placeTotalSpBar(enteringSplit);
    syncInheritPopoverAnchorIfOpen();
  }

  function bindLayoutMode() {
    const hint = document.getElementById("layout-mode-hint");
    const buttons = document.querySelectorAll("[data-layout-mode]");
    let pref = normalizeLayoutPref(localStorage.getItem(LAYOUT_MODE_KEY) || "gallery");
    if (localStorage.getItem(LAYOUT_MODE_KEY) === "auto") {
      localStorage.setItem(LAYOUT_MODE_KEY, "gallery");
    }

    const sync = () => {
      const narrow = isLayoutNarrow();
      document.documentElement.classList.toggle("layout-narrow", narrow);
      document.body.classList.toggle("layout-narrow", narrow);
      const effective = resolveLayoutMode(pref);
      applyLayoutMode(effective);
      buttons.forEach((btn) => {
        btn.classList.toggle("is-on", btn.getAttribute("data-layout-mode") === pref);
      });
      if (hint) {
        hint.textContent =
          effective === "split"
            ? "スプリット: 上＝合計 · 左＝編成・イベント / 右＝結果"
            : "ギャラリー: 上段＝編成 / 下段＝結果";
      }
    };

    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        if (isLayoutNarrow()) return;
        pref = normalizeLayoutPref(btn.getAttribute("data-layout-mode") || "gallery");
        localStorage.setItem(LAYOUT_MODE_KEY, pref);
        sync();
      });
    });
    window.addEventListener("resize", () => {
      sync();
      syncInheritPopoverAnchorIfOpen();
    });
    sync();
  }

  return { bindLayoutMode };
}
