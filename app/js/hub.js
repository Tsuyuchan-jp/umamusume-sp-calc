/**
 * カード系マスタの取得元。
 * 既定は umamusume-data（GitHub raw）。失敗時や ?hub=local では同梱 data/ に戻す。
 */
export const DEFAULT_HUB_BASE =
  "https://raw.githubusercontent.com/Tsuyuchan-jp/umamusume-data/main/";

const LOCAL_DATA = new URL("../../data/", import.meta.url);

export function hubPreferenceFromSearch(search = "") {
  const raw = String(search || "");
  const q = new URLSearchParams(raw.startsWith("?") ? raw.slice(1) : raw);
  const v = q.get("hub");
  if (v === "0" || v === "local") return "local";
  if (v === "1" || v === "remote") return "remote";
  return "auto";
}

export function hubFileUrl(base, relPath, version = "") {
  const normalized = String(relPath || "").replace(/^\.\//, "");
  const url = new URL(normalized, base);
  if (version) url.searchParams.set("v", String(version));
  return url.href;
}

export async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);
  return res.json();
}

/** 対象サポカ = events にある ID ∩ 読み込んだ supports */
export function allowedSupportIds(supports, events) {
  const rows = Array.isArray(supports) ? supports : [];
  const eventIds = new Set((events?.prioritySupportIds || []).map(Number));
  if (eventIds.size) {
    return new Set(rows.filter((s) => eventIds.has(Number(s.id))).map((s) => s.id));
  }
  return new Set(rows.map((s) => s.id));
}

async function loadLocalCardDataset() {
  const [skills, supports, characters, events, scenario] = await Promise.all([
    fetchJson(new URL("skills.json", LOCAL_DATA).href),
    fetchJson(new URL("supports.json", LOCAL_DATA).href),
    fetchJson(new URL("characters.json", LOCAL_DATA).href),
    fetchJson(new URL("events.json", LOCAL_DATA).href),
    fetchJson(new URL("scenarios/toresenken.json", LOCAL_DATA).href),
  ]);
  return {
    source: "local",
    manifest: null,
    dataset: { skills, supports, characters, events, scenario },
    assetBase: null,
  };
}

async function loadHubCardDataset(base) {
  const manifest = await fetchJson(hubFileUrl(base, "manifest.json"));
  const files = manifest?.files;
  if (!files?.skills?.path || !files?.supports?.path || !files?.characters?.path) {
    throw new Error("manifest に第1波の files がありません");
  }
  if (!files.events?.path || !files.scenarios?.path) {
    throw new Error("manifest に events / scenarios がありません");
  }
  const version = manifest.datasetVersion || "";
  const [skills, supports, characters, events, scenario] = await Promise.all([
    fetchJson(hubFileUrl(base, files.skills.path, version)),
    fetchJson(hubFileUrl(base, files.supports.path, version)),
    fetchJson(hubFileUrl(base, files.characters.path, version)),
    fetchJson(hubFileUrl(base, files.events.path, version)),
    fetchJson(hubFileUrl(base, files.scenarios.path, version)),
  ]);
  return {
    source: "hub",
    manifest,
    dataset: { skills, supports, characters, events, scenario },
    assetBase: base,
  };
}

/**
 * @param {"auto"|"local"|"remote"} pref
 * @param {string} [hubBase]
 */
export async function loadCardDataset(pref = "auto", hubBase = DEFAULT_HUB_BASE) {
  if (pref !== "local") {
    try {
      return await loadHubCardDataset(hubBase);
    } catch (err) {
      if (pref === "remote") throw err;
      console.warn("ハブ取得に失敗したためローカル data/ を使います", err);
    }
  }
  return loadLocalCardDataset();
}
