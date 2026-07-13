/**
 * 優先9サポカのイベント定義を events.json に追記
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const eventsPath = path.join(__dirname, "../data/events.json");

const NEW_EVENTS = [
  // --- サトノダイヤモンド ---
  {
    id: "evt_diamond_gamushara",
    supportNameMatch: "永久の誓い、永久の輝き",
    label: "ダイヤ まず、知るより始めよう",
    selection: "auto",
    skills: [{ skillName: "がむしゃら", hintLevel: 1, skillId: 202422 }],
  },
  {
    id: "evt_diamond_nigetam",
    supportNameMatch: "永久の誓い、永久の輝き",
    label: "ダイヤ 新しいもの、大好きです！",
    selection: "auto",
    skills: [{ skillName: "逃げためらい", hintLevel: 1, skillId: 200851 }],
  },
  {
    id: "evt_diamond_chain",
    supportNameMatch: "永久の誓い、永久の輝き",
    label: "ダイヤ そして、未来を誓う（連続3・金分岐）",
    selection: "single",
    defaultChoiceId: "rensa",
    choices: [
      {
        id: "rensa",
        label: "① 連鎖反応 Lv1 + 一所懸命 Lv1",
        skills: [
          { skillName: "連鎖反応", hintLevel: 1, skillId: 203241 },
          { skillName: "一所懸命", hintLevel: 1, skillId: 203561 },
        ],
      },
      {
        id: "kouki",
        label: "② 一所懸命 Lv1 + 光輝燦然 Lv1",
        skills: [
          { skillName: "一所懸命", hintLevel: 1, skillId: 203561 },
          { skillName: "光輝燦然", hintLevel: 1, skillId: 204381 },
        ],
      },
    ],
  },
  // --- タップダンスシチー ---
  {
    id: "evt_taiki_nigeru",
    supportNameMatch: "刀光散らしてClash！",
    label: "シチー 心のカギは",
    selection: "auto",
    skills: [{ skillName: "逃げるが勝ち！", hintLevel: 1, skillId: 204092 }],
  },
  {
    id: "evt_taiki_sentou",
    supportNameMatch: "刀光散らしてClash！",
    label: "シチー いざ求めん、夢多きTreasure",
    selection: "auto",
    skills: [{ skillName: "先頭プライド", hintLevel: 1, skillId: 201272 }],
  },
  {
    id: "evt_taiki_chain",
    supportNameMatch: "刀光散らしてClash！",
    label: "シチー 仲間というロマン（連続3・金3択）",
    selection: "single",
    defaultChoiceId: "conc_top",
    choices: [
      {
        id: "conc_top",
        label: "① コンセントレーション Lv1 + トップランナー Lv2",
        skills: [
          { skillName: "コンセントレーション", hintLevel: 1, skillId: 200431 },
          { skillName: "トップランナー", hintLevel: 2, skillId: 201271 },
        ],
      },
      {
        id: "conc_hiryu",
        label: "② コンセントレーション Lv1 + 飛竜乗雲 Lv2",
        skills: [
          { skillName: "コンセントレーション", hintLevel: 1, skillId: 200431 },
          { skillName: "飛竜乗雲", hintLevel: 2, skillId: 203401 },
        ],
      },
      {
        id: "top_hiryu",
        label: "③ トップランナー Lv2 + 飛竜乗雲 Lv1",
        skills: [
          { skillName: "トップランナー", hintLevel: 2, skillId: 201271 },
          { skillName: "飛竜乗雲", hintLevel: 1, skillId: 203401 },
        ],
      },
    ],
  },
  // --- アグネスデジタル ---
  {
    id: "evt_digital_emo",
    supportNameMatch: "全てに挑む勇ましき者",
    label: "デジタル エモのためなら雨の中でも！",
    selection: "single",
    defaultChoiceId: "ame",
    choices: [
      {
        id: "ame",
        label: "① 雨の日○ Lv1",
        skills: [{ skillName: "雨の日○", hintLevel: 1, skillId: 200232 }],
      },
      {
        id: "dou",
        label: "② 道悪○ Lv1",
        skills: [{ skillName: "道悪○", hintLevel: 1, skillId: 200162 }],
      },
    ],
  },
  {
    id: "evt_digital_yuuo",
    supportNameMatch: "全てに挑む勇ましき者",
    label: "デジタル 逃げぬ者、戦う者（連続3）",
    selection: "auto",
    skills: [
      { skillName: "勇往邁進", hintLevel: 1, skillId: 202151 },
      { skillName: "一騎当千", hintLevel: 2, skillId: 204351 },
    ],
  },
  {
    id: "evt_digital_me",
    supportNameMatch: "全てに挑む勇ましき者",
    label: "デジタル おお！汝目覚めよ！（連続2）",
    selection: "auto",
    skills: [{ skillName: "一歩ずつ前へ", hintLevel: 1, skillId: 203362 }],
  },
  // --- デアリングハート ---
  {
    id: "evt_heart_aggressive",
    supportNameMatch: "白に至る覚悟",
    label: "ハート Away in the Mountains",
    selection: "auto",
    skills: [{ skillName: "アグレッシブ", hintLevel: 1, skillId: 203222 }],
  },
  {
    id: "evt_heart_stack",
    supportNameMatch: "白に至る覚悟",
    label: "ハート 積み重ねられた『今』（連続3）",
    selection: "auto",
    skills: [
      { skillName: "優位形成", hintLevel: 1, skillId: 202531 },
      { skillName: "十全十美", hintLevel: 1, skillId: 202741 },
    ],
  },
  {
    id: "evt_heart_charm",
    supportNameMatch: "白に至る覚悟",
    label: "ハート もっとも輝く『魅力』（連続2・白金分岐）",
    selection: "single",
    defaultChoiceId: "mukou",
    choices: [
      {
        id: "mukou",
        label: "① 向こう見ず Lv1",
        skills: [{ skillName: "向こう見ず", hintLevel: 1, skillId: 202502 }],
      },
      {
        id: "shinnen",
        label: "② 揺るがぬ信念 Lv1",
        skills: [{ skillName: "揺るがぬ信念", hintLevel: 1, skillId: 203052 }],
      },
    ],
  },
  // --- フォーエバーヤング ---
  {
    id: "evt_young_vitality",
    supportNameMatch: "Innovator",
    label: "ヤング Young & Unstoppable",
    selection: "auto",
    skills: [{ skillName: "バイタリティ", hintLevel: 1, skillId: 203982 }],
  },
  {
    id: "evt_young_light",
    supportNameMatch: "Innovator",
    label: "ヤング やっちゃお！イノベーション",
    selection: "auto",
    skills: [{ skillName: "灯を胸に", hintLevel: 1, skillId: 204052 }],
  },
  {
    id: "evt_young_dreams",
    supportNameMatch: "Innovator",
    label: "ヤング Dreams are Forever（連続3・成功時）",
    selection: "single",
    defaultChoiceId: "dirt",
    choices: [
      {
        id: "dirt",
        label: "① 二段構え Lv1 + アプローチ Lv1 + コール&レスポンス Lv1 + イノベーション Lv1",
        skills: [
          { skillName: "二段構え", hintLevel: 1, skillId: 202832 },
          { skillName: "アプローチ", hintLevel: 1, skillId: 204192 },
          { skillName: "コール&レスポンス", hintLevel: 1, skillId: 202831 },
          { skillName: "イノベーション", hintLevel: 1, skillId: 204191 },
        ],
      },
      {
        id: "general",
        label: "② 尻尾の滝登り Lv1 + 前人未到 Lv1",
        skills: [
          { skillName: "尻尾の滝登り", hintLevel: 1, skillId: 201612 },
          { skillName: "前人未到", hintLevel: 1, skillId: 204181 },
        ],
      },
    ],
  },
  // --- ファインモーション ---
  {
    id: "evt_fine_step",
    supportNameMatch: "ゆかし、きらめきの旅路",
    label: "ファイン ロイヤル推し活ライフ",
    selection: "auto",
    skills: [{ skillName: "素直な一歩", hintLevel: 1, skillId: 203032 }],
  },
  {
    id: "evt_fine_corner",
    supportNameMatch: "ゆかし、きらめきの旅路",
    label: "ファイン 思い出クローバー",
    selection: "auto",
    skills: [{ skillName: "コーナー巧者○", hintLevel: 1, skillId: 200332 }],
  },
  {
    id: "evt_fine_look",
    supportNameMatch: "ゆかし、きらめきの旅路",
    label: "ファイン Look at me（連続3）",
    selection: "single",
    defaultChoiceId: "gold",
    choices: [
      {
        id: "gold",
        label: "① かっとばせ！ Lv1 + 順風満帆 Lv1",
        skills: [
          { skillName: "かっとばせ！", hintLevel: 1, skillId: 202761 },
          { skillName: "順風満帆", hintLevel: 1, skillId: 204071 },
        ],
      },
      {
        id: "scenario",
        label: "② 気持ちを乗せて Lv5 + レースの真髄・体 Lv5 + 陽の加護 Lv5",
        skills: [
          { skillName: "気持ちを乗せて", hintLevel: 5, skillId: 204072 },
          { skillName: "レースの真髄・体", hintLevel: 5, skillId: 210101 },
          { skillName: "陽の加護", hintLevel: 5, skillId: 210262 },
        ],
      },
    ],
  },
  // --- エアグルーヴ ---
  {
    id: "evt_groove_taiki",
    supportNameMatch: "心覚えし、京の華",
    label: "グルーヴ 峻厳にして優渥",
    selection: "auto",
    skills: [{ skillName: "臨機応変", hintLevel: 1, skillId: 200502 }],
  },
  {
    id: "evt_groove_shadow",
    supportNameMatch: "心覚えし、京の華",
    label: "グルーヴ そのアイシャドウは繋がって（連続2・白3択）",
    selection: "single",
    defaultChoiceId: "yume",
    choices: [
      {
        id: "yume",
        label: "① 夢への挑戦 Lv2",
        skills: [{ skillName: "夢への挑戦", hintLevel: 2, skillId: 203632 }],
      },
      {
        id: "jibun",
        label: "② 己を信じて Lv2",
        skills: [{ skillName: "己を信じて", hintLevel: 2, skillId: 203422 }],
      },
      {
        id: "junbi",
        label: "③ 下準備 Lv2",
        skills: [{ skillName: "下準備", hintLevel: 2, skillId: 203332 }],
      },
    ],
  },
  {
    id: "evt_groove_makeup",
    supportNameMatch: "心覚えし、京の華",
    label: "グルーヴ そのメイクは誰がために（連続3・金2択）",
    selection: "single",
    defaultChoiceId: "osu_kin",
    choices: [
      {
        id: "osu_kin",
        label: "① 王手 Lv2 + 千鍛万錬 Lv1",
        skills: [
          { skillName: "王手", hintLevel: 2, skillId: 202711 },
          { skillName: "千鍛万錬", hintLevel: 1, skillId: 204031 },
        ],
      },
      {
        id: "kin_kin",
        label: "② 千鍛万錬 Lv2 + 錦上添花 Lv2",
        skills: [
          { skillName: "千鍛万錬", hintLevel: 2, skillId: 204031 },
          { skillName: "錦上添花", hintLevel: 2, skillId: 204041 },
        ],
      },
    ],
  },
  // --- トウカイテイオー ---
  {
    id: "evt_teo_weapon",
    supportNameMatch: "天才的ユートピア",
    label: "テイオー ボクの武器",
    selection: "auto",
    skills: [{ skillName: "先行直線○", hintLevel: 1, skillId: 201312 }],
  },
  {
    id: "evt_teo_koukou",
    supportNameMatch: "天才的ユートピア",
    label: "テイオー 孝行はしたい時分に（連続2）",
    selection: "single",
    defaultChoiceId: "hirui",
    choices: [
      {
        id: "hirui",
        label: "① 比類なき Lv1",
        skills: [{ skillName: "比類なき", hintLevel: 1, skillId: 203502 }],
      },
      {
        id: "yaku",
        label: "② 躍動 Lv1",
        skills: [{ skillName: "躍動", hintLevel: 1, skillId: 203432 }],
      },
    ],
  },
  {
    id: "evt_teo_weather",
    supportNameMatch: "天才的ユートピア",
    label: "テイオー まったり孝行日和（連続3・金2択）",
    selection: "single",
    defaultChoiceId: "seisei",
    choices: [
      {
        id: "seisei",
        label: "① 迸る気迫 Lv2 + 正々堂々 Lv1",
        skills: [
          { skillName: "迸る気迫", hintLevel: 2, skillId: 204001 },
          { skillName: "正々堂々", hintLevel: 1, skillId: 203421 },
        ],
      },
      {
        id: "yume",
        label: "② 迸る気迫 Lv2 + 夢の舞台へ Lv1",
        skills: [
          { skillName: "迸る気迫", hintLevel: 2, skillId: 204001 },
          { skillName: "夢の舞台へ", hintLevel: 1, skillId: 203441 },
        ],
      },
    ],
  },
  // --- エイシンフラッシュ ---
  {
    id: "evt_flash_shop",
    supportNameMatch: "Zirkus der Träume",
    label: "フラッシュ 想定外への対応",
    selection: "auto",
    skills: [{ skillName: "徹底マーク○", hintLevel: 1, skillId: 200292 }],
  },
  {
    id: "evt_flash_try",
    supportNameMatch: "Zirkus der Träume",
    label: "フラッシュ 美しきトライ",
    selection: "auto",
    skills: [{ skillName: "下準備", hintLevel: 1, skillId: 203332 }],
  },
  {
    id: "evt_flash_fruit",
    supportNameMatch: "Zirkus der Träume",
    label: "フラッシュ 美しき結実（連続3）",
    selection: "single",
    defaultChoiceId: "gold",
    choices: [
      {
        id: "gold",
        label: "① 千里の道 Lv1 + 陽炎 Lv1",
        skills: [
          { skillName: "千里の道", hintLevel: 1, skillId: 202641 },
          { skillName: "陽炎", hintLevel: 1, skillId: 203671 },
        ],
      },
      {
        id: "scenario",
        label: "② レースの真髄・速 Lv5 + 前だけ見据えて Lv5 + 綺羅星 Lv5",
        skills: [
          { skillName: "レースの真髄・速", hintLevel: 5, skillId: 210091 },
          { skillName: "前だけ見据えて", hintLevel: 5, skillId: 210082 },
          { skillName: "綺羅星", hintLevel: 5, skillId: 210062 },
        ],
      },
    ],
  },
];

const data = JSON.parse(fs.readFileSync(eventsPath, "utf8"));
const existingIds = new Set(data.events.map((e) => e.id));
const toAdd = NEW_EVENTS.filter((e) => !existingIds.has(e.id));
if (toAdd.length === 0) {
  console.log("追記対象なし（既に全件存在）");
  process.exit(0);
}
data.events.push(...toAdd);
fs.writeFileSync(eventsPath, JSON.stringify(data, null, 2) + "\n", "utf8");
console.log(`追記: ${toAdd.length} 件（合計 ${data.events.length} 件）`);
