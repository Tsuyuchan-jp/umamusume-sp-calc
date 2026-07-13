import { writeFileSync } from "fs";

const skill = (skillName, hintLevel) => ({
  skillName: skillName.replace(/◯/g, "○"),
  hintLevel,
  skillId: null,
});

const sources = {
  30301: { gameWith: "https://gamewith.jp/uma-musume/article/show/561921", game8: "https://game8.jp/umamusume/785657", uTools: "https://xn--gck1f423k.xn--1bvt37a.tools/supports/30301" },
  30300: { gameWith: "https://gamewith.jp/uma-musume/article/show/560385", game8: null, uTools: "https://xn--gck1f423k.xn--1bvt37a.tools/supports/30300" },
  30296: { gameWith: "https://gamewith.jp/uma-musume/article/show/555216", game8: null, uTools: "https://xn--gck1f423k.xn--1bvt37a.tools/supports/30296" },
  30293: { gameWith: "https://gamewith.jp/uma-musume/article/show/551777", game8: null, uTools: "https://xn--gck1f423k.xn--1bvt37a.tools/supports/30293" },
  30292: { gameWith: "https://gamewith.jp/uma-musume/article/show/548286", game8: null, uTools: "https://xn--gck1f423k.xn--1bvt37a.tools/supports/30292" },
  30287: { gameWith: "https://gamewith.jp/uma-musume/article/show/541893", game8: null, uTools: "https://xn--gck1f423k.xn--1bvt37a.tools/supports/30287" },
  30286: { gameWith: "https://gamewith.jp/uma-musume/article/show/541892", game8: null, uTools: "https://xn--gck1f423k.xn--1bvt37a.tools/supports/30286" },
  30285: { gameWith: "https://gamewith.jp/uma-musume/article/show/538641", game8: null, uTools: "https://xn--gck1f423k.xn--1bvt37a.tools/supports/30285" },
  30281: { gameWith: "https://gamewith.jp/uma-musume/article/show/534224", game8: null, uTools: "https://xn--gck1f423k.xn--1bvt37a.tools/supports/30281" },
  30279: { gameWith: "https://gamewith.jp/uma-musume/article/show/531843", game8: null, uTools: "https://xn--gck1f423k.xn--1bvt37a.tools/supports/30279" },
  30278: { gameWith: "https://gamewith.jp/uma-musume/article/show/531844", game8: null, uTools: "https://xn--gck1f423k.xn--1bvt37a.tools/supports/30278" },
  30277: { gameWith: "https://gamewith.jp/uma-musume/article/show/528906", game8: null, uTools: "https://xn--gck1f423k.xn--1bvt37a.tools/supports/30277" },
  30274: { gameWith: "https://gamewith.jp/uma-musume/article/show/522600", game8: null, uTools: "https://xn--gck1f423k.xn--1bvt37a.tools/supports/30274" },
  30271: { gameWith: "https://gamewith.jp/uma-musume/article/show/521035", game8: null, uTools: "https://xn--gck1f423k.xn--1bvt37a.tools/supports/30271" },
  30270: { gameWith: "https://gamewith.jp/uma-musume/article/show/517684", game8: null, uTools: "https://xn--gck1f423k.xn--1bvt37a.tools/supports/30270" },
  30267: { gameWith: "https://gamewith.jp/uma-musume/article/show/515324", game8: null, uTools: "https://xn--gck1f423k.xn--1bvt37a.tools/supports/30267" },
  30265: { gameWith: "https://gamewith.jp/uma-musume/article/show/514478", game8: null, uTools: "https://xn--gck1f423k.xn--1bvt37a.tools/supports/30265" },
  30264: { gameWith: "https://gamewith.jp/uma-musume/article/show/514477", game8: null, uTools: "https://xn--gck1f423k.xn--1bvt37a.tools/supports/30264" },
  30262: { gameWith: "https://gamewith.jp/uma-musume/article/show/511947", game8: null, uTools: "https://xn--gck1f423k.xn--1bvt37a.tools/supports/30262" },
  30261: { gameWith: "https://gamewith.jp/uma-musume/article/show/511948", game8: null, uTools: "https://xn--gck1f423k.xn--1bvt37a.tools/supports/30261" },
  30258: { gameWith: "https://gamewith.jp/uma-musume/article/show/507006", game8: null, uTools: "https://xn--gck1f423k.xn--1bvt37a.tools/supports/30258" },
  30256: { gameWith: "https://gamewith.jp/uma-musume/article/show/504763", game8: null, uTools: "https://xn--gck1f423k.xn--1bvt37a.tools/supports/30256" },
  30253: { gameWith: "https://gamewith.jp/uma-musume/article/show/499940", game8: null, uTools: "https://xn--gck1f423k.xn--1bvt37a.tools/supports/30253" },
  30248: { gameWith: "https://gamewith.jp/uma-musume/article/show/492831", game8: null, uTools: "https://xn--gck1f423k.xn--1bvt37a.tools/supports/30248" },
  30246: { gameWith: "https://gamewith.jp/uma-musume/article/show/491827", game8: null, uTools: "https://xn--gck1f423k.xn--1bvt37a.tools/supports/30246" },
  30242: { gameWith: "https://gamewith.jp/uma-musume/article/show/485769", game8: null, uTools: "https://xn--gck1f423k.xn--1bvt37a.tools/supports/30242" },
};

function withMeta(supportId, supportNameMatch, evt) {
  return {
    supportId,
    supportNameMatch,
    _source: sources[supportId],
    ...evt,
  };
}

const raw = [
  // 30301 スマイル・エバーアフター
  withMeta(30301, "スマイル・エバーアフター", { id: "evt_gran_seicho", label: "成長のヒント", selection: "auto", skills: [skill("足任せ", 4)] }),
  withMeta(30301, "スマイル・エバーアフター", { id: "evt_gran_muse_final", label: "最強のミューズへ", selection: "auto", skills: [skill("天真爛漫", 1), skill("元気溌剌", 2)] }),
  withMeta(30301, "スマイル・エバーアフター", { id: "evt_gran_mile_way", label: "ゴー・マイル・ウェイ", selection: "single", defaultChoiceId: "mile_line", choices: [{ id: "other", label: "力強いマイルへの情熱を感じるな", skills: [] }, { id: "mile_line", label: "マイル一直線、って感じだな！", skills: [skill("マイル直線○", 1)] }] }),
  withMeta(30301, "スマイル・エバーアフター", { id: "evt_gran_milestone", label: "勝利へのマイルストーン", selection: "auto", skills: [skill("ハイピッチ", 1)], _note: "Game8のみ掲載（GameWith未確認）" }),

  // 30300 賑やかな未来を乗せて走れ！
  withMeta(30300, "賑やかな未来を乗せて走れ！", { id: "evt_chiyo_dosukoi", label: "どすこいカード列伝！", selection: "auto", skills: [skill("強者の証", 2), skill("継続は力なり", 2)] }),
  withMeta(30300, "賑やかな未来を乗せて走れ！", { id: "evt_chiyo_spring", label: "いつか咲く、その日まで……", selection: "single", defaultChoiceId: "spring", choices: [{ id: "self", label: "自分らしさも大事かと", skills: [] }, { id: "spring", label: "きっとなれる！", skills: [skill("春ウマ娘○", 1)] }] }),

  // 30296 単焦点でつかまえて
  withMeta(30296, "単焦点でつかまえて", { id: "evt_aman_tuber", label: "ターちゃんマーちゃん、行くのです！", selection: "single", defaultChoiceId: "rival", choices: [{ id: "walk", label: "お散歩動画", skills: [] }, { id: "rival", label: "ライバルコンビへ突撃動画", skills: [skill("危険回避", 1)] }, { id: "edit", label: "いっそ編集風景を動画に！", skills: [skill("スプリントギア", 1)] }] }),
  withMeta(30296, "単焦点でつかまえて", { id: "evt_aman_kaori", label: "この香りが残りますように", selection: "single", defaultChoiceId: "gold", choices: [{ id: "doll", label: "あの人形って……", skills: [skill("匠のステアリング", 2), skill("圧倒", 1)] }, { id: "gold", label: "あ、アストンマーチャン？", skills: [skill("押せ押せムード", 5), skill("海の加護", 5), skill("いつまでも健やかに", 5)] }] }),
  withMeta(30296, "単焦点でつかまえて", { id: "evt_aman_mimamori", label: "いつもそばから見つめてる", selection: "single", defaultChoiceId: "capture", choices: [{ id: "cute", label: "かわいくって、癒される", skills: [] }, { id: "capture", label: "見張られているようで、きびきび走れそう", skills: [skill("捕捉", 1)] }] }),
  withMeta(30296, "単焦点でつかまえて", { id: "evt_aman_photo", label: "いつも写真から見つめてる", selection: "single", defaultChoiceId: "kehai", choices: [{ id: "other", label: "（非ヒント選択肢）", skills: [] }, { id: "kehai", label: "華麗な辻写りの極意が知りたい", skills: [skill("軽い足取り", 2)] }] }),

  // 30293 白に至る純真
  withMeta(30293, "白に至る純真", { id: "evt_tact_tsutae", label: "伝え、繋いで", selection: "single", defaultChoiceId: "ashikari", choices: [{ id: "other", label: "たくましいんだね！", skills: [] }, { id: "taguru", label: "まだまだ伸びしろがありそうだ……！", skills: [skill("滾る想い", 1)] }, { id: "ashikari", label: "ふたりを尊敬してるんだね", skills: [skill("足がかり", 1)] }] }),
  withMeta(30293, "白に至る純真", { id: "evt_tact_cinderella", label: "シンデレラの行く末", selection: "auto", skills: [skill("闘争本能", 1), skill("燃ゆる魂", 1)] }),
  withMeta(30293, "白に至る純真", { id: "evt_tact_survival", label: "私を育てた場所", selection: "single", defaultChoiceId: "ichi", choices: [{ id: "sensei", label: "はい先生！", skills: [] }, { id: "ichi", label: "匠のサバイバルスキルだ……", skills: [skill("一歩ずつ前へ", 1)] }] }),

  // 30292 響け、二人の凱歌
  withMeta(30292, "響け、二人の凱歌", { id: "evt_mars_kanshin", label: "募る不安", selection: "single", defaultChoiceId: "kokoro", choices: [{ id: "other", label: "（非ヒント選択肢）", skills: [] }, { id: "kokoro", label: "バズった絵はどんな気持ちで描いたの？", skills: [skill("心惹かれて", 1)] }] }),
  withMeta(30292, "響け、二人の凱歌", { id: "evt_mars_ai", label: "重なる愛", selection: "auto", skills: [skill("点滴穿石", 1), skill("優雅な砂浴び", 1)] }),
  withMeta(30292, "響け、二人の凱歌", { id: "evt_mars_koe", label: "溢れている愛", selection: "single", defaultChoiceId: "kyo", choices: [{ id: "other", label: "（非ヒント選択肢）", skills: [] }, { id: "kyo", label: "マルシュロレーヌの絵を描いてみるとか？", skills: [skill("轟く足音", 1)] }] }),

  // 30287 星跨ぐメッセージ
  withMeta(30287, "星跨ぐメッセージ", { id: "evt_neo_signal", label: "Forシグナル100%", selection: "single", defaultChoiceId: "ichi", choices: [{ id: "other", label: "（非ヒント選択肢）", skills: [] }, { id: "ichi", label: "……もしかして困ってる？", skills: [skill("一歩ずつ前へ", 1)] }] }),
  withMeta(30287, "星跨ぐメッセージ", { id: "evt_neo_crewmate", label: "You Areクルーメイト", selection: "auto", skills: [skill("ルミネセンス", 1), skill("怜悧清澄", 2)] }),
  withMeta(30287, "星跨ぐメッセージ", { id: "evt_neo_encounter", label: "観測者との遭遇", selection: "single", defaultChoiceId: "shutsu", choices: [{ id: "other", label: "（非ヒント選択肢）", skills: [] }, { id: "shutsu", label: "外宇宙進出には夢があるよな！", skills: [skill("進出開始", 1)] }] }),

  // 30286 吉兆招福チョコ来たる
  withMeta(30286, "吉兆招福チョコ来たる", { id: "evt_fuku_kitto", label: "吉日・良縁ハグハグ！", selection: "auto", skills: [skill("快刀乱麻", 2)] }),

  // 30285 私のためのショッピング
  withMeta(30285, "私のためのショッピング", { id: "evt_king_ikikoi", label: "学ぶは、一流の息抜き！", selection: "single", defaultChoiceId: "oshi", choices: [{ id: "other", label: "いま感じてる充実感と同じ？", skills: [] }, { id: "oshi", label: "自分のことも助けなきゃ", skills: [skill("押し通る！", 1)] }] }),
  withMeta(30285, "私のためのショッピング", { id: "evt_king_ren", label: "学びを繋げて", selection: "auto", skills: [skill("突撃魂", 1), skill("有志竟成", 1)] }),
  withMeta(30285, "私のためのショッピング", { id: "evt_king_advice", label: "助言する権利をあげる！", selection: "single", defaultChoiceId: "matsubi", choices: [{ id: "other", label: "昨今の根性論について討論する", skills: [] }, { id: "matsubi", label: "仕掛けるタイミングについて話す", skills: [skill("末脚", 1)] }] }),

  // 30281 故郷に錦を飾るんでい！
  withMeta(30281, "故郷に錦を飾るんでい！", { id: "evt_inari_iki", label: "粋の魅せ方、魂で語れ", selection: "single", defaultChoiceId: "dai", choices: [{ id: "dai", label: "似たもの……みんなギャルっぽいとか？", skills: [skill("大急ぎ", 1)] }, { id: "other", label: "確かに！みんな“粋“な感じだね！", skills: [] }] }),
  withMeta(30281, "故郷に錦を飾るんでい！", { id: "evt_inari_namida", label: "熱き涙の理由", selection: "auto", skills: [skill("無我夢中", 1), skill("用意周到", 1)] }),
  withMeta(30281, "故郷に錦を飾るんでい！", { id: "evt_inari_kyoto", label: "神輿だワッショイ", selection: "single", defaultChoiceId: "kyoto", choices: [{ id: "other", label: "突き進む躍動感？", skills: [] }, { id: "kyoto", label: "観客がいないからでは？", skills: [skill("京都レース場○", 1)] }] }),

  // 30279 ぬくもりのノエル
  withMeta(30279, "ぬくもりのノエル", { id: "evt_pheno_mame", label: "マメちん堕落計画！", selection: "single", defaultChoiceId: "jichido", choices: [{ id: "jichido", label: "ゴールドシップのようにもっと自由に", skills: [skill("地道に重ねて", 1)] }, { id: "other", label: "ナカヤマフェスタのように肩の力を抜いて", skills: [] }] }),
  withMeta(30279, "ぬくもりのノエル", { id: "evt_pheno_kisei", label: "いかなる時も矜持は揺るがず", selection: "auto", skills: [skill("真打", 1), skill("一点集中", 1)] }),
  withMeta(30279, "ぬくもりのノエル", { id: "evt_pheno_kowamote", label: "あぶないコワモテ刑事？", selection: "single", defaultChoiceId: "nerai", choices: [{ id: "other", label: "気持ちが伝わってよかったね", skills: [] }, { id: "nerai", label: "名演だったね、おまわりさん！", skills: [skill("狙いを定めて", 1)] }] }),

  // 30278 激録！爆走トナカイ事件
  withMeta(30278, "激録！爆走トナカイ事件", { id: "evt_gold_kyozo", label: "虚像をぶち壊せ", selection: "single", defaultChoiceId: "kiki", choices: [{ id: "kiki", label: "これなら問題なさそうだな", skills: [skill("好機を捉えて", 1)] }, { id: "other", label: "とにかくみんな無事で何よりだよ", skills: [] }] }),
  withMeta(30278, "激録！爆走トナカイ事件", { id: "evt_gold_ougon", label: "黄金二人旅", selection: "auto", skills: [skill("迫る影", 1), skill("心頭滅却", 1)] }),
  withMeta(30278, "激録！爆走トナカイ事件", { id: "evt_gold_yakisoba", label: "甦れ！ゴルシ印のソース焼きそば！", selection: "single", defaultChoiceId: "hanshin", choices: [{ id: "other", label: "……味に磨きをかけたら？", skills: [] }, { id: "hanshin", label: "……明石焼きを売ったら？", skills: [skill("阪神レース場○", 1)] }] }),

  // 30277 無機の闘志
  withMeta(30277, "無機の闘志", { id: "evt_bourbon_hatsu", label: "発火:熱を帯びて", selection: "single", defaultChoiceId: "position", choices: [{ id: "position", label: "(またすごい気迫だ……！)", skills: [skill("ポジションセンス", 1)] }, { id: "other", label: "(追い込んでるけど……大丈夫かな)", skills: [] }] }),
  withMeta(30277, "無機の闘志", { id: "evt_bourbon_hibana", label: "火花:夢焦がれ", selection: "auto", skills: [skill("先手必勝", 1), skill("傑出", 1)] }),
  withMeta(30277, "無機の闘志", { id: "evt_bourbon_order", label: "命令は守らなければならない", selection: "single", defaultChoiceId: "focus", choices: [{ id: "focus", label: "開店直前から待機しておこう", skills: [skill("集中力", 1)] }, { id: "other", label: "昼休みになったらダッシュ！", skills: [] }] }),

  // 30274 決意のフローラ
  withMeta(30274, "決意のフローラ", { id: "evt_karen_masou", label: "奏で合う幸福", selection: "auto", skills: [skill("円弧のマエストロ", 1), skill("開花", 1)] }),
  withMeta(30274, "決意のフローラ", { id: "evt_karen_chowa", label: "争いの種は咲かせない", selection: "single", defaultChoiceId: "takami", choices: [{ id: "other", label: "君を見ていると、なんとなくわかる", skills: [] }, { id: "takami", label: "その『調和』が、優しさに繋がってるのかも", skills: [skill("さらなる高みへ", 1)] }] }),

  // 30271 壇上より魔法を込めて
  withMeta(30271, "壇上より魔法を込めて", { id: "evt_fuji_maho", label: "魔法使いの秘密", selection: "auto", skills: [skill("不抜の気概", 2)] }),
  withMeta(30271, "壇上より魔法を込めて", { id: "evt_fuji_sleight", label: "スライハンド", selection: "single", defaultChoiceId: "ryuko", choices: [{ id: "other", label: "さっきこっそり入れ――", skills: [] }, { id: "ryuko", label: "すごいマジックパワーだ……！", skills: [skill("流星光底", 1)] }] }),
  withMeta(30271, "壇上より魔法を込めて", { id: "evt_fuji_miss", label: "ミスディレクション", selection: "single", defaultChoiceId: "nukedashi", choices: [{ id: "nukedashi", label: "最終コーナーのコツ", skills: [skill("抜け出し準備", 1)] }, { id: "other", label: "走りのテクニック", skills: [] }] }),

  // 30270 Inseparable
  withMeta(30270, "Inseparable", { id: "evt_ruby_akadama", label: "紅玉の誓約", selection: "auto", skills: [skill("至宝の輝き", 2)] }),
  withMeta(30270, "Inseparable", { id: "evt_ruby_ganka", label: "華麗なる旋律", selection: "single", defaultChoiceId: "tsume", choices: [{ id: "other", label: "言葉を尽くしてスキルを褒める！", skills: [] }, { id: "tsume", label: "素直な気持ちを勢いよく伝える！", skills: [skill("詰め寄り", 1)] }] }),

  // 30267 カルストンライトオ、猫です
  withMeta(30267, "カルストンライトオ、猫です", { id: "evt_carlton_sokyu", label: "速い&真っ直ぐは世界を救う！", selection: "auto", skills: [skill("意気衝天", 1), skill("問答無用", 1)] }),
  withMeta(30267, "カルストンライトオ、猫です", { id: "evt_carlton_saisoku", label: "『最速』はすばらしい", selection: "single", defaultChoiceId: "chokusen_course", choices: [{ id: "chokusen_course", label: "動画を止めないと……！", skills: [skill("直線コース○", 1)] }, { id: "other", label: "お、落ち着いて……！！", skills: [] }] }),
  withMeta(30267, "カルストンライトオ、猫です", { id: "evt_carlton_massugu", label: "『真っ直ぐ』はすばらしい", selection: "single", defaultChoiceId: "chokusen2", choices: [{ id: "chokusen2", label: "真っ直ぐな形のソファを選ぼう！", skills: [skill("直線巧者", 1)] }, { id: "other", label: "やっぱり巻き尺を買おう！", skills: [] }] }),

  // 30265 氷結晶の静域
  withMeta(30265, "氷結晶の静域", { id: "evt_groove_kyuukou", label: "孤高の休日", selection: "single", defaultChoiceId: "overflow", choices: [{ id: "other", label: "傘持ってないなら貸すよ", skills: [] }, { id: "overflow", label: "……何があった？大丈夫？", skills: [skill("溢れる情熱", 1)] }] }),
  withMeta(30265, "氷結晶の静域", { id: "evt_groove_shomei", label: "孤高の証明", selection: "auto", skills: [skill("天賦の才", 1), skill("才色兼備", 1)] }),
  withMeta(30265, "氷結晶の静域", { id: "evt_groove_wan", label: "ひとりが好きなクラスメイトさん", selection: "single", defaultChoiceId: "wan", choices: [{ id: "wan", label: "すごい力作だな", skills: [skill("ワンチャンス", 1)] }, { id: "other", label: "トレーナーの間でも話題だからな", skills: [] }] }),

  // 30264 気まぐれ渡り星
  withMeta(30264, "気まぐれ渡り星", { id: "evt_stay_over17", label: "Over 17 Lights", selection: "single", defaultChoiceId: "hirui", choices: [{ id: "hirui", label: "大レースに勝利した？", skills: [skill("比類なき", 1)] }, { id: "other", label: "海の幸をいっぱい食べた？", skills: [] }] }),
  withMeta(30264, "気まぐれ渡り星", {
    id: "evt_stay_shinryou",
    label: "新しい旅へ",
    selection: "single",
    defaultChoiceId: "unknown",
    choices: [
      { id: "unknown", label: "まったく未知の旅を（大成功想定）", skills: [skill("ネバーギブアップ", 2), skill("好奇心", 2)] },
      { id: "past", label: "かつての旅をもう一度（大成功想定）", skills: [skill("ネバーギブアップ", 2), skill("自由奔放", 2)] },
    ],
    _note: "成功時は各ヒントLv+1",
  }),
  withMeta(30264, "気まぐれ渡り星", { id: "evt_stay_kin", label: "黄金を探し求めて", selection: "single", defaultChoiceId: "chokusen", choices: [{ id: "chokusen", label: "また次の旅、かな", skills: [skill("直線巧者", 1)] }, { id: "other", label: "（非ヒント選択肢）", skills: [] }] }),

  // 30262 Tranquillo
  withMeta(30262, "Tranquillo", { id: "evt_dura_kawaii_power", label: "可愛いの真の力！", selection: "single", defaultChoiceId: "pafe", choices: [{ id: "pafe", label: "ふたりとも、パフェのおかわりする？", skills: [skill("飛翔脚", 1), skill("残影", 1)] }, { id: "other", label: "それでいうと、笑顔は――", skills: [] }], _note: "GameWith表記は飛影だが所持スキルは残影" }),
  withMeta(30262, "Tranquillo", { id: "evt_dura_ou", label: "追うべき背中", selection: "single", defaultChoiceId: "ignition", choices: [{ id: "other", label: "……体が心配になるよ", skills: [] }, { id: "ignition", label: "じゃあ、走りで調子が戻ればいいな", skills: [skill("イグニッション", 1)] }] }),

  // 30261 水面のプリンシパル
  withMeta(30261, "水面のプリンシパル", { id: "evt_win_near", label: "潜在的ソウルメイト", selection: "single", defaultChoiceId: "hirui", choices: [{ id: "hirui", label: "寄り道してきた？", skills: [skill("比類なき", 1)] }, { id: "other", label: "はちみーは、水分補給に向かないよ……", skills: [] }] }),
  withMeta(30261, "水面のプリンシパル", { id: "evt_win_cheer", label: "大衆的チアフレンド", selection: "auto", skills: [skill("エネルギッシュ", 1), skill("内的体験", 1)] }),
  withMeta(30261, "水面のプリンシパル", { id: "evt_win_gran", label: "グラン・ジュテ～いつの日か～", selection: "single", defaultChoiceId: "chokyori", choices: [{ id: "other", label: "もう終わり……？", skills: [] }, { id: "chokyori", label: "マ、マイペースだな。オルフェーヴルは", skills: [skill("長距離コーナー○", 1)] }] }),

  // 30258 瞳に闘志を胸に勝利の渇望を
  withMeta(30258, "瞳に闘志を胸に勝利の渇望を", { id: "evt_ryan_muscle", label: "マッスル、ただひたすらに", selection: "auto", skills: [skill("秘めた闘魂", 2)] }),
  withMeta(30258, "瞳に闘志を胸に勝利の渇望を", { id: "evt_ryan_pace", label: "あくまで薦められただけ", selection: "single", defaultChoiceId: "pace", choices: [{ id: "pace", label: "ペースを考えたほうがいいよ", skills: [skill("ペースキープ", 1)] }, { id: "other", label: "一気読みは体力使うよ？", skills: [] }] }),

  // 30256 白き稲妻の如く
  withMeta(30256, "白き稲妻の如く", { id: "evt_tamamo_dareka", label: "誰かの道を照らすなら", selection: "single", defaultChoiceId: "slip", choices: [{ id: "slip", label: "それ、あの子には伝えたのか？", skills: [skill("スリップストリーム", 1)] }, { id: "joshu", label: "面倒見がいい先輩だね", skills: [skill("序盤巧者", 1)] }] }),
  withMeta(30256, "白き稲妻の如く", { id: "evt_tamamo_tooku", label: "遠くで光るその走り", selection: "single", defaultChoiceId: "mirai", choices: [{ id: "mirai", label: "将来が楽しみだ！", skills: [skill("神速", 2), skill("真骨頂", 1)] }, { id: "omo", label: "君の想いは、継がれたみたいだな", skills: [skill("神速", 2), skill("悠久走破", 1)] }] }),
  withMeta(30256, "白き稲妻の如く", { id: "evt_tamamo_lose", label: "負けられん戦い！", selection: "single", defaultChoiceId: "uma", choices: [{ id: "uma", label: "人の流れを掴め！", skills: [skill("ウマ込み冷静", 1)] }, { id: "other", label: "ライバルをよく観察しよう", skills: [] }] }),

  // 30253 Unveiled Dream
  withMeta(30253, "Unveiled Dream", { id: "evt_line_letter", label: "拝啓、お父さん", selection: "auto", skills: [skill("ギアチェンジ", 1), skill("ハイボルテージ", 1)] }),
  withMeta(30253, "Unveiled Dream", { id: "evt_line_wakuwaku", label: "ワクワクでキラキラな夢", selection: "single", defaultChoiceId: "mile_corner", choices: [{ id: "mile_corner", label: "もっと先輩の研究をするとかかな", skills: [skill("マイルコーナー○", 1)] }, { id: "other", label: "早くトレーニングコースへ行こう！", skills: [] }] }),

  // 30248 無垢の白妙
  withMeta(30248, "無垢の白妙", { id: "evt_muku_earth", label: "母なる大地の教え", selection: "auto", skills: [skill("しとやかな足取り", 1)] }),
  withMeta(30248, "無垢の白妙", { id: "evt_muku_wild", label: "Innocent Wildflower", selection: "auto", skills: [skill("独立独歩", 1), skill("迅速果断", 1)] }),
  withMeta(30248, "無垢の白妙", { id: "evt_muku_survival", label: "私を育てた場所", selection: "single", defaultChoiceId: "ichi", choices: [{ id: "other", label: "はい先生！", skills: [] }, { id: "ichi", label: "匠のサバイバルスキルだ……", skills: [skill("一歩ずつ前へ", 1)] }] }),

  // 30246 誘うは夢心地
  withMeta(30246, "誘うは夢心地", { id: "evt_dj_shop", label: "それはただただ咲き誇る", selection: "single", defaultChoiceId: "kaikaku", choices: [{ id: "kaikaku", label: "ドリームジャーニー、こういうお店来るんだ", skills: [skill("打開策", 2)] }, { id: "other", label: "（非ヒント選択肢）", skills: [] }] }),
  withMeta(30246, "誘うは夢心地", { id: "evt_dj_bloom", label: "そして今日も花が咲く", selection: "single", defaultChoiceId: "kanzen", choices: [{ id: "kanzen", label: "そんなものいらないよ", skills: [skill("完全燃焼", 1), skill("肉薄", 1)] }, { id: "other", label: "（非ヒント選択肢）", skills: [] }] }),
  withMeta(30246, "誘うは夢心地", { id: "evt_dj_imouto", label: "用意周到で妹想い", selection: "single", defaultChoiceId: "tsu", choices: [{ id: "tsu", label: "いや……お姉ちゃんは大変だね", skills: [skill("推力十分", 1)] }, { id: "other", label: "（非ヒント選択肢）", skills: [] }] }),

  // 30242 世界を変える眼差し
  withMeta(30242, "世界を変える眼差し", {
    id: "evt_almond_endless",
    label: "果てしなきアーモンドアイ",
    selection: "single",
    defaultChoiceId: "symboli",
    choices: [
      { id: "symboli", label: "シンボリルドルフらの反応を見る（大成功想定）", skills: [skill("シンギュラリティ", 2), skill("才気爆発", 2)] },
      { id: "around", label: "周囲の反応を見る（大成功想定）", skills: [skill("ハヤテ一文字", 2), skill("弧線のプロフェッサー", 2)] },
    ],
    _note: "失敗時は各ヒントLv+1",
  }),
  withMeta(30242, "世界を変える眼差し", { id: "evt_almond_mental", label: "アーモンドアイは見逃さない", selection: "single", defaultChoiceId: "kou", choices: [{ id: "kou", label: "そのメンタル、見習いたいな", skills: [skill("品行方正", 1)] }, { id: "other", label: "（非ヒント選択肢）", skills: [] }] }),
];

// ヒント無し選択肢をchoicesから除外（空skillsのchoiceは残して分岐表現）
const events = raw.map((e) => {
  if (e.selection === "single" && e.choices) {
    const hintChoices = e.choices.filter((c) => c.skills.length > 0);
    if (hintChoices.length === 1 && e.choices.length === 2) {
      // 1択のみヒント → そのまま
    }
  }
  return e;
});

const out = {
  description: "26枚SSRサポカのイベントスキルヒント調査（GameWith中心、Game8一部照合）",
  extractedAt: "2026-07-13",
  skillIdNote: "skillIdは未解決のためnull",
  eventCount: events.length,
  events,
};

writeFileSync("data/support-events-research-26.json", JSON.stringify(events, null, 2));
console.log(`Wrote ${events.length} events to data/support-events-research-26.json`);
