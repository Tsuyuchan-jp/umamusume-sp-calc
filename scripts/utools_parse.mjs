/**
 * U-tools SSR HTML から supportCard.events を抽出する。
 *
 * パース仕様: docs/UTOOLS_EVENT_PARSE.md
 */

/** RSC チャンクをデコードして結合 */
export function decodeRscChunks(html) {
  const rscChunks = [
    ...html.matchAll(/self\.__next_f\.push\(\[1,"((?:\\.|[^"\\])*)"\]\)/g),
  ];
  return rscChunks.map(([, c]) =>
    c.replace(/\\"/g, '"').replace(/\\n/g, "\n").replace(/\\\\/g, "\\")
  );
}

/** skill オブジェクト内の改行等で JSON.parse が壊れるため除去 */
export function stripNestedSkillObjects(jsonStr) {
  let out = "";
  let i = 0;
  while (i < jsonStr.length) {
    if (jsonStr.startsWith('"skill":{', i)) {
      i += '"skill":'.length;
      let depth = 0;
      while (i < jsonStr.length) {
        const ch = jsonStr[i];
        if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) {
            i++;
            break;
          }
        } else if (ch === '"') {
          i++;
          while (i < jsonStr.length) {
            if (jsonStr[i] === "\\") {
              i += 2;
              continue;
            }
            if (jsonStr[i] === '"') break;
            i++;
          }
        }
        i++;
      }
      out += '"skill":null';
    } else {
      out += jsonStr[i];
      i++;
    }
  }
  return out;
}

/** 文字列リテラルをスキップしつつ bracket match */
function extractBracketSlice(text, startIdx, openCh, closeCh) {
  let depth = 0;
  for (let i = startIdx; i < text.length; i++) {
    const ch = text[i];
    if (ch === openCh) depth++;
    else if (ch === closeCh) {
      depth--;
      if (depth === 0) return text.slice(startIdx, i + 1);
    } else if (ch === '"') {
      i++;
      while (i < text.length) {
        if (text[i] === "\\") {
          i += 2;
          continue;
        }
        if (text[i] === '"') break;
        i++;
      }
    }
  }
  throw new Error(`bracket match failed at ${startIdx}`);
}

/**
 * RSC 結合文字列から events 配列を取り出す。
 * @param {string} joined decodeRscChunks(...).join("")
 */
export function extractEventsArray(joined) {
  const marker = '"events":';
  const idx = joined.indexOf(marker);
  if (idx < 0) throw new Error("U-tools HTML に events が見つかりません");
  let i = idx + marker.length;
  while (joined[i] === " ") i++;
  if (joined[i] !== "[") throw new Error("events が配列ではありません");
  const raw = extractBracketSlice(joined, i, "[", "]");
  return JSON.parse(stripNestedSkillObjects(raw));
}

/** supportCardId から U-tools ページ URL */
export function utoolsSupportUrl(supportCardId) {
  return `https://xn--gck1f423k.xn--1bvt37a.tools/supports/${supportCardId}`;
}

/**
 * U-tools HTML を取得して events を返す。
 * @returns {Promise<{ supportCardId: number, events: object[], fetchedAt: string, sourceUrl: string }>}
 */
export async function fetchUtoolsEvents(supportCardId, { fetchFn = fetch } = {}) {
  const sourceUrl = utoolsSupportUrl(supportCardId);
  const res = await fetchFn(sourceUrl);
  if (!res.ok) {
    throw new Error(`U-tools fetch failed ${supportCardId}: HTTP ${res.status}`);
  }
  const html = await res.text();
  const events = extractEventsArray(decodeRscChunks(html).join(""));
  return {
    supportCardId,
    events,
    fetchedAt: new Date().toISOString(),
    sourceUrl,
  };
}

/** スキルヒント effect（type 311）か */
export const SKILL_HINT_EFFECT_TYPE = 311;

/** choice からスキルヒント [{ skillId, hintLevel }] を集める（pattern 最小＝成功想定、skillId ごとに max） */
export function collectChoiceSkillHints(choice) {
  const results = choice.results || [];
  if (!results.length) return [];

  const patterns = [...new Set(results.map((r) => r.pattern ?? 1))].sort((a, b) => a - b);
  const usePattern = patterns[0];
  const picked = results.filter((r) => (r.pattern ?? 1) === usePattern);

  const bySkill = new Map();
  for (const result of picked) {
    for (const ef of result.effects || []) {
      if (ef.type === SKILL_HINT_EFFECT_TYPE && ef.skillId) {
        const skillId = Number(ef.skillId);
        const hintLevel = Number(ef.val);
        const prev = bySkill.get(skillId);
        if (!prev || hintLevel > prev.hintLevel) {
          bySkill.set(skillId, { skillId, hintLevel });
        }
      }
    }
  }
  return [...bySkill.values()];
}

/** イベントにスキルヒント付き choice が1つでもあるか */
export function eventHasSkillHints(event) {
  return (event.choices || []).some((c) => collectChoiceSkillHints(c).length > 0);
}
