/**
 * イベント selection 分類（旧11種と同じ基準）
 *
 * - auto: 獲得スキルヒントが1系統のみ（他枝はステータス等・または選択肢なし）
 * - single: 異なるスキルヒント候補が2つ以上
 */
import { formatEventChoices } from "./format_event_choice_labels.mjs";

/** スキル集合の比較キー */
function skillSetKey(skills) {
  return (skills || [])
    .map((s) => `${s.skillName}\0${s.hintLevel}`)
    .sort()
    .join("|");
}

/** ヒント付き選択肢が2つ以上かつ、スキル集合が異なる → single */
export function shouldBeSingle(choices) {
  const withSkills = (choices || []).filter((c) => (c.skills || []).length > 0);
  if (withSkills.length <= 1) return false;
  const keys = new Set(withSkills.map((c) => skillSetKey(c.skills)));
  return keys.size > 1;
}

/** defaultChoiceId の選択肢、無ければ最初のヒント枝 */
export function pickDefaultSkills(evt) {
  const withSkills = (evt.choices || []).filter((c) => (c.skills || []).length > 0);
  if (withSkills.length === 0) return evt.skills || [];
  const picked =
    withSkills.find((c) => c.id === evt.defaultChoiceId) ?? withSkills[0];
  return picked.skills;
}

/**
 * selection / skills / choices を旧11種ルールで正規化する。
 * 既に auto で skills がある場合はそのまま（choices が無ければ）。
 */
export function normalizeEventSelection(evt) {
  const out = { ...evt };

  if (!out.choices?.length) {
    out.selection = "auto";
    delete out.defaultChoiceId;
    delete out.choices;
    return out;
  }

  if (shouldBeSingle(out.choices)) {
    out.selection = "single";
    out.choices = formatEventChoices(out.choices);
    if (!out.defaultChoiceId) {
      throw new Error(`event ${out.id}: single だが defaultChoiceId 無し`);
    }
    if (!out.choices.some((c) => c.id === out.defaultChoiceId)) {
      throw new Error(
        `event ${out.id}: defaultChoiceId "${out.defaultChoiceId}" が choices に無い`
      );
    }
    delete out.skills;
    return out;
  }

  out.selection = "auto";
  out.skills = pickDefaultSkills(out);
  if (!out.skills?.length) {
    throw new Error(`event ${out.id}: auto 化後の skills が空`);
  }
  delete out.defaultChoiceId;
  delete out.choices;
  return out;
}
