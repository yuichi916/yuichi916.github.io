// 一筆花火 — 祭りの外側のしくみ: 花火師の格（XP）・解放・腕だめし・札（お守りの段位シール）・実績・今日のおつかい・週のおつかい・続けた日数・図鑑。
// 純関数だけを置く（DOM・storage に触らない）。お守りの型と願い札の一覧だけは core.js から読む。テストは tests/hitofude_meta_test.mjs。
//
// 使い方（ページの側）
//   起動時:        meta = initMeta(保存してあった値)            … 壊れた値・古い値（12版の meta.v 1 も）でも、きれいな meta が返る
//                  （前の版から遊んでいる人には initMeta(null, { runs, cleared }) で 1 度だけおまけ）
//   お守りの候補:   core の offerCharms(..., { pool: charmPool(meta), level })。伝説の Lv の上限は charmCaps(meta)（下の「伝説の道」）
//   はじめの一つ:   features(meta) に 'startPick' があれば、ふつうの祭りの始めに core の startOffer(seed, charmPool(meta)) から 1 つ選ばせる
//   屋台:          features(meta) に 'focus' があれば、屋台に「型しぼり」（★2）を出す（core の offerCharms(..., { focus: 型 })。えらべる型は core の focusTags）
//   段位えらび:     0〜maxLevel(meta)。features(meta) に 'levels' があるときだけ出す
//   次のごほうび:   upcoming(meta) → [{ ...UNLOCKS の 1 つ, xpLeft }]（「あと 120 XP で花筏」）
//   腕だめし:      challenges(meta) → 一覧と進み（「連鎖 5/7 代」）。図鑑に出す
//   見たもの:       meta = noteSeen(meta, { charms: 出た候補, shells: 見た玉の種類, cast: 会った妖怪 })（候補が出るたびに 1 回）
//   おつかい:      todayQuests(meta, 今日) → 3 つと進み。'questSwap' があれば swapQuest(meta, 今日, 番号) で 1 日 1 回取りかえ
//                  週のおつかい: weeklyQuest(meta, 今日)（'weekly' があるときだけ）
//   次の目当て:     nextGoals(meta, 今日, 3) → 近いものから 3 行（「あと 120 XP で花筏」「連鎖 6/7 代」「札 3/5」）
//   祭りが終わったら: r = applyRun(meta, summary, 今日の日付) → meta = r.meta を保存し、
//                  r.parts（XP の内訳）・r.rankBefore / r.rankAfter（over = 格 30 から先の名人の星。r.overUp = ふえた数）・r.unlocked・
//                  r.challenges（達成した腕だめし）・r.challengeProgress（自己ベストの更新）・r.stickers（ふえた・上がった札）・
//                  r.levelUp（開いた段位）・r.achievements・r.quests・r.weekly・r.streak（guarded = 休みの札で続いた）を順に見せる
// meta は小さな JSON（よく遊んでも 3KB まで）で、ページの保存の中にそのまま入れてよい。
//
// summary（ページが作る、一回の祭りのまとめ）。無い項目は 0 / なしとして読む（古いページでも落ちない）
//   { mode: 'run', daily, level /*段位*/, cleared /*越えた夜 0..8*/, total, bestPops, retries /*予備の提灯を使った回数*/, outfit,
//     charms: { id: lv }（祭りで持ったお守りと、いちばん高い Lv。core の並び ['kinun','kinun'] でもよい）,
//     nights: [{ score, target, pass, stars: [b,b,b], allClear, pops, total, twist, boss, toriAdd, maxGen, goldTouched, lineTouched,
//                wish: { id, met, stars /*13版: その願いで払う ★ 1|2。無ければ 1*/ },
//                inkFrac /*13版: その夜に使った墨の割合 0..1（core の result.stats.inkFrac）*/,
//                charms  /*13版: その夜に持っていたお守り { id: lv }（夜の前の持ち物）*/ }] }
//   nights は一夜目から順に並べる（並びの番号が夜。night の値は見ない）。やり直した夜は、最後の 1 回だけ入れる。
//   大一番の妖怪は boss（無ければ twist から）で見る。勝ち = その夜の pass。
//   inkFrac が無い夜は、墨の腕だめし・おつかいが進まない。夜の charms が無ければ、祭りの charms を全部の夜に持っていたとみなす
//   （札は八夜目の charms で決める。無ければ祭りの charms）。retries が無いまとめでは「予備いらず」の実績はとれない。
//   今日の日付は core の jstDateKey で作る（壊れた日付なら、続けた日数とおつかいは動かさない）。
import { CHARMS as CORE_CHARMS, WISHES as CORE_WISHES } from './core.js';

export const META_VERSION = 2; // 1 = 12版、2 = 13版（読みこむときに 1 から上げる）

// ---------------------------------------------------------------- 共通の ID
export const NIGHTS = 8;
export const MAX_LEVEL = 8; // 段位は 0（ふつう）〜 8
// お守り 24 個。並びは図鑑の並び
export const CHARM_IDS = [
  'nagafude', 'nokorizumi', 'tairin', 'kinun', 'osobi', 'ichibanboshi', 'owaridama', 'kodou', 'mankai', 'mashidama',
  'nihitsu', 'nokoribi', 'chouchinshi', 'amayoke', 'kazekiri',
  'maneki', 'hanaikada', 'renjishi', 'suminagashi', 'senkou',
  'tengu', 'tanuki', 'kitsune', 'kamaitachi',
];
// はじめから候補に出る 9 個（墨と ×倍率 の取り合いが、はじめからある）
export const STARTER_CHARMS = ['kinun', 'kodou', 'tairin', 'chouchinshi', 'mashidama', 'amayoke', 'nokorizumi', 'maneki', 'senkou'];
// 伝説のお守り。その妖怪に初めて勝つと、候補に入る（ID は妖怪と同じ）
export const BOSSES = ['tengu', 'tanuki', 'kitsune', 'kamaitachi'];
export const LEGEND_CHARMS = BOSSES.slice();
export const TWIST_BOSS = { massugu: 'tengu', kagami: 'tanuki', yamiyo: 'kitsune', isshun: 'kamaitachi' };
export const CAST_IDS = [...BOSSES, 'neko'];
export const OUTFIT_IDS = ['hachimaki', 'kanzashi', 'omen', 'uchiwa', 'kingyo', 'kanmuri'];
// ヒノコの色（からだの炎の 4 色。芯から外へ。hinoko.js の drawHinoko(..., { body }) にそのまま渡す）。
// 花火合戦の相手（青・紫・緑・こがね・月白）と見分けがつく色だけにした
export const HINOKO_COLORS = [
  { id: 'sakura', ja: '桜色', en: 'Cherry', body: ['#fff3f8', '#ffc2da', '#ff7fae', '#e0457f'] },
  { id: 'beni', ja: '紅', en: 'Crimson', body: ['#ffece6', '#ff8a7a', '#e8323c', '#9c1028'] },
  { id: 'hotaru', ja: '蛍色', en: 'Firefly', body: ['#fbffe6', '#eaff8a', '#b4e636', '#5f8f12'] },
  { id: 'gin', ja: '銀', en: 'Silver', body: ['#ffffff', '#eceff3', '#b4bcc8', '#6c7584'] },
  { id: 'ume', ja: '梅', en: 'Plum', body: ['#fff0f8', '#f7a3d8', '#c8399a', '#6e1150'] },
  { id: 'sumi', ja: '墨色', en: 'Ink', body: ['#f6f1e8', '#bdb4a6', '#6f665b', '#2c2621'] },
  { id: 'kurogane', ja: '黒鉄', en: 'Black iron', body: ['#fff4c8', '#e8b844', '#5a4320', '#16110a'] },
  { id: 'nanairo', ja: '七色', en: 'Rainbow', body: ['#ffffff', '#ffe066', '#6fd3ff', '#c86bff'] },
];
export const COLOR_IDS = HINOKO_COLORS.map((c) => c.id);
// 遊び方の解放。daily・levels は 12版から。ほかは 13版で足した
//  startPick   ふつうの祭りの始めに、お守りを 3 つから 1 つ選ぶ（core の startOffer）
//  focus       屋台の「型しぼり」（★2）: 次の候補を、えらんだ型のお守りだけにする（core の offerCharms opts.focus）
//  appraise    目利き: 候補のお守りに、いま持っているお守りと同じ型の印と数を出す
//  bossPeek    大一番の予告: ふつうの祭りの始めに、三夜目と六夜目の大一番（core の twistFor）を見せる
//  wishPeek    願いの先読み: 屋台で、次の夜の願い札（core の wishFor）を見せる
//  weekly      週のおつかい（weeklyQuest）。meta が数える
//  questSwap   おつかいを 1 日 1 回取りかえる（swapQuest）。meta が数える
//  streakGuard 休みの札: 1 日あいても続けた日数が切れない（7 日に 1 度）。meta が数える
//  purse       がま口: ふつうの祭りを ★1 持って始める（今夜の一筆と勝負リンクでは無し）
export const FEATURE_IDS = ['daily', 'levels', 'startPick', 'focus', 'appraise', 'bossPeek', 'wishPeek', 'weekly', 'questSwap', 'streakGuard', 'purse'];
export const SHELL_TYPES = ['kiku', 'ootama', 'kin', 'senrin', 'chouchin', 'shime', 'shaku'];
// 願い札の ID（保存を読むための全部。w_tori8 は 12版の札で、13版の w_tori6 と同じ仲間として数える）
const WISH_KNOWN = [
  'w_lantern_first', 'w_all_gold', 'w_spare30', 'w_pops', 'w_touch_few', 'w_double', 'w_damp_all',
  'w_tori8', 'w_rope_all', 'w_no_cloud', 'w_gold_first', 'w_bloom', 'w_short', 'w_big_all', 'w_tori6',
];
const coreWishIds = (all) => (Array.isArray(CORE_WISHES) ? CORE_WISHES.filter((w) => w && typeof w.id === 'string' && (all || !w.legacy)).map((w) => w.id) : []);
export const WISH_IDS = [...WISH_KNOWN, ...coreWishIds(true).filter((id) => !WISH_KNOWN.includes(id))];
// いま core が出す願い札（「願い札あつめ」の分母。core で legacy のものは数えない）。w_tori8 と w_tori6 は 1 つに数える
const wishKind = (id) => (id === 'w_tori8' ? 'w_tori6' : id);
export const WISH_ACTIVE = [...new Set((coreWishIds(false).length ? coreWishIds(false) : WISH_KNOWN.filter((id) => id !== 'w_tori8')).map(wishKind))];
// お守りの型（core の CHARMS[].tags）。「金の型」などは、この型のお守りを何種類持っているかで見る
export const BUILD_TAGS = ['gold', 'lantern', 'chain', 'ink', 'finale', 'risk'];
const TAGS_OF = Object.fromEntries(CHARM_IDS.map((id) => {
  const c = Array.isArray(CORE_CHARMS) ? CORE_CHARMS.find((x) => x && x.id === id) : null;
  return [id, c && Array.isArray(c.tags) ? c.tags.slice() : []];
}));

// 解放の知らせに出す名前（core の CHARMS と cast.js の OUTFITS に合わせる。ここは見出しだけ）
const NAMES = {
  nagafude: ['長い筆', 'Long brush'], nokorizumi: ['残り墨', 'Spare ink'], osobi: ['遅火', 'Slow fuse'], ichibanboshi: ['一番星', 'First star'],
  owaridama: ['終わり玉', 'Finale'], mankai: ['満開の加護', 'Full bloom'], nihitsu: ['二筆目', 'Second stroke'], nokoribi: ['残り火', 'Embers'],
  kazekiri: ['風切り', 'Wind cutter'], maneki: ['招き猫', 'Lucky cat'], hanaikada: ['花筏', 'Petal raft'], renjishi: ['連獅子', 'Lion dance'],
  suminagashi: ['墨流し', 'Ink marbling'], senkou: ['線香花火', 'Sparkler'],
  tengu: ['天狗の団扇', 'Tengu fan'], tanuki: ['狸の葉っぱ', 'Tanuki leaf'], kitsune: ['狐火', 'Foxfire'], kamaitachi: ['鎌鼬の爪', 'Kamaitachi claw'],
  hachimaki: ['はちまき', 'Headband'], kanzashi: ['花かんざし', 'Flower hairpin'], omen: ['狐のお面', 'Fox mask'],
  uchiwa: ['うちわ', 'Paper fan'], kingyo: ['金魚', 'Goldfish'], kanmuri: ['王冠', 'Crown'],
  daily: ['今夜の一筆', 'Tonight\'s Stroke'], levels: ['段位えらび', 'Stakes'],
  startPick: ['はじめの一つ', 'Starting charm'], focus: ['型しぼり', 'Focus'], appraise: ['目利き', 'Appraisal'],
  bossPeek: ['大一番の予告', 'Boss preview'], wishPeek: ['願いの先読み', 'Wish preview'], weekly: ['週のおつかい', 'Weekly quest'],
  questSwap: ['おつかいの取りかえ', 'Quest swap'], streakGuard: ['休みの札', 'Day-off charm'], purse: ['がま口', 'Coin purse'],
  ...Object.fromEntries(HINOKO_COLORS.map((c) => [c.id, [`${c.ja}のヒノコ`, `${c.en} Hinoko`]])),
};
const YOKAI = { tengu: ['天狗', 'Tengu'], tanuki: ['狸', 'Tanuki'], kitsune: ['狐', 'Fox'], kamaitachi: ['鎌鼬', 'Kamaitachi'] };
const TWIST_NAME = { massugu: ['まっすぐ', 'Straight'], kagami: ['鏡', 'Mirror'], yamiyo: ['闇夜', 'Dark night'], isshun: ['一瞬', 'Snap'] };

// ---------------------------------------------------------------- 花火師の格
// 10 の位 × 3 段 = 30。位の名前ごとに、一・二・三と上がる。
// 上がるのに要る XP は 30, 70, 110 … 310（格 9 まで。はじめは 1 回で 1〜2 つ上がる）、そのあとは 325, 350 … 825 と少しずつ増える（合わせて 13,435）。
// 格 2〜30 は、上がるたびにちょうど 1 つ何かが開く（UNLOCKS）。テストの「ふつうに遊ぶ人」で、1 回目の祭りで格 3、10 回で 11、
// 20 回で 17（格で開くお守りは格 12 で出そろう）、58 回ほどで 30。ボットの上手な人（1 日 2〜3 回・段位をどんどん上げる）は 40〜45 回
const TIERS = [
  ['見習い', 'Apprentice'], ['火の番', 'Fire Keeper'], ['玉込め', 'Shell Packer'], ['打ち上げ手', 'Launcher'], ['花火師', 'Hanabi Maker'],
  ['腕利き', 'Expert'], ['親方', 'Master Hand'], ['名人', 'Master'], ['達人', 'Virtuoso'], ['大名人', 'Grand Master'],
];
// 格 lv から lv+1 へ上がるのに要る XP（lv = 1..29）
function rankCost(lv) { return lv <= 8 ? 40 * lv - 10 : 300 + 25 * (lv - 8); }
// 12版（meta.v 1）の式。読みこみで格を下げないために使う
function rankCostV1(lv) { return Math.round((40 + 18 * lv + 0.25 * lv * lv) / 10) * 10; }
function ladder(cost) {
  const xs = [0];
  for (let lv = 1; lv < TIERS.length * 3; lv++) xs.push(xs[lv - 1] + cost(lv));
  return xs;
}
export const RANKS = ladder(rankCost).map((xp, i) => {
  const lv = i + 1, [ja, en] = TIERS[Math.floor(i / 3)], step = i % 3;
  return { lv, xp, ja: `${ja} ${'一二三'[step]}`, en: `${en} ${['I', 'II', 'III'][step]}`, tier: Math.floor(i / 3), step: step + 1 };
});
export const MAX_RANK = RANKS.length;
const RANKS_V1 = ladder(rankCostV1);

// 格 30 から先は、OVER_XP ごとに「名人の星」が 1 つふえる（格はもう上がらないが、XP が無駄にならない。タイトルに「大名人 三 ★2」）
export const OVER_XP = 1000;
// 格のいま: lv・名前・この格の中で貯めた XP（cur）と、次の格までの幅（next）。いちばん上では next = 0, frac = 1。
// over は格 30 から先の星の数、overCur / OVER_XP が次の星までの進み（格 30 より下では 0）
export function rankOf(xp) {
  const x = typeof xp === 'number' ? int(xp, 0, XP_MAX, 0) : int(get(xp, 'xp'), 0, XP_MAX, 0);
  let i = 0;
  while (i + 1 < RANKS.length && RANKS[i + 1].xp <= x) i++;
  const r = RANKS[i], top = i + 1 >= RANKS.length;
  const next = top ? 0 : RANKS[i + 1].xp - r.xp, cur = x - r.xp;
  return {
    lv: r.lv, name: r.ja, nameEn: r.en, tier: r.tier, cur, next, frac: top ? 1 : cur / next, toNext: top ? 0 : next - cur, xp: x, max: top,
    over: top ? Math.floor(cur / OVER_XP) : 0, overCur: top ? cur % OVER_XP : 0,
  };
}

// ---------------------------------------------------------------- 腕だめし（やってみると、そのお守りの使い方が分かる課題）
// 祭りの中で一度でも goal に届けば達成。達成すると XP と、ごほうび（お守りは候補に入る・伝説は Lv3 まで育つ）。
// お守りの腕だめしは、格 lv でも開く（腕だめしをしない人も、いつかは全部そろう）。進み（いちばん良かった値）は meta.chb に残し、図鑑に「5/7」と出す。
// stat は、その祭りでのいちばん良い値（届かない・測れないときは null）。段位 4 からの伝説の道は、大一番の夜に勝った段位で見る
const CH = (id, reward, lv, goal, xp, ja, en, stat) => ({ id, reward, lv, goal, xp, ja, en, stat });
export const LEGEND_LV3_STAKE = 4; // 伝説のお守りが Lv3 まで育つのは、この段位から上でその妖怪に勝ったあと
const best = (xs) => (xs.length ? Math.max(...xs) : null);
const passedFrom = (s, from) => s.nights.filter((n) => n.pass && n.i >= from);
const CHALLENGE_DEFS = [
  CH('c_ink', 'suminagashi', 18, 60, 40, '六夜目から後の夜を、墨を 6 割残して越える', 'Clear night 6 or later with 60% of your ink left',
    (s) => best(passedFrom(s, 5).filter((n) => n.inkFrac != null).map((n) => Math.round((1 - n.inkFrac) * 100)))),
  CH('c_gen', 'renjishi', 20, 7, 40, '連鎖を 7 代つなげて夜を越える', 'Clear a night with a chain 7 generations deep',
    (s) => best(passedFrom(s, 0).map((n) => n.maxGen))),
  CH('c_bloom', 'mankai', 22, 1, 40, '六夜目から後の夜を、満開（玉を全部ひらく）にして越える', 'Clear night 6 or later with every shell burst',
    (s) => (passedFrom(s, 5).some((n) => n.allClear) ? 1 : passedFrom(s, 5).length ? 0 : null)),
  CH('c_tori', 'owaridama', 24, 7, 40, '大トリで倍率 +7 以上を出して越える', 'Clear a night with +7 mult or more from the grand shell',
    (s) => best(passedFrom(s, 0).filter((n) => n.i === NIGHTS - 1).map((n) => n.toriAdd))),
  CH('c_gold', 'ichibanboshi', 26, 3, 40, '線でじかに金の玉に 3 つふれて夜を越える', 'Clear a night touching 3 gold shells with your line',
    (s) => best(passedFrom(s, 0).map((n) => n.goldTouched))),
  ...BOSSES.map((b) => CH(`c_${b}`, b, null, LEGEND_LV3_STAKE, 60, `段位 4 から上で、${YOKAI[b][0]}に勝つ`, `Beat the ${YOKAI[b][1]} on Stakes 4 or higher`,
    (s) => (s.nights.some((n) => n.pass && n.boss === b) ? s.level : null))),
];
export const CHALLENGES = CHALLENGE_DEFS.map(({ stat, reward, ...c }) => {
  const legend = BOSSES.includes(reward);
  return { ...c, reward: { kind: legend ? 'legend' : 'charm', id: reward } };
});
const CH_IDS = CHALLENGE_DEFS.map((c) => c.id);

// ---------------------------------------------------------------- 解放
// 格 2〜30 は、上がるたびにちょうど 1 つ開く（お守り → 遊び方 → 着せかえ・ヒノコの色）。格で開くお守りは格 12 までに出そろう。
// lv が null のものは、格ではなく出来事で開く: by = 'boss'（その妖怪に初めて勝つ）/ 'clear'（八夜を初めて通す）/ 'level'（段位 8 で八夜を通す）/
// 'challenge'（腕だめし ch を達成する。lv があれば、その格でも開く）。kind 'legend' は伝説のお守りが Lv3 まで育つようになること
// 解放の知らせの説明（お守り・衣装はページが core / cast.js から出すので、ここは遊び方・色・伝説の道だけ）
const DESC = {
  daily: ['毎日ひとつ、みんな同じ夜。続けて遊ぶとおまけ', 'One shared festival a day. Keep a streak for bonus XP'],
  levels: ['八夜を通した段位の、ひとつ上をえらべる', 'Pick a harder Stakes after a full clear'],
  startPick: ['ふつうの祭りの始めに、お守りを 3 つから 1 つ選んで持っていける', 'Start each festival by picking 1 of 3 charms'],
  focus: ['屋台の「型しぼり」（★2）: 次の候補を、えらんだ型のお守りだけにする', 'Stall item (★2): the next offer is all one type of your choice'],
  appraise: ['候補のお守りに、いま持っているお守りと同じ型の印がつく', 'Offered charms show which types match your build'],
  bossPeek: ['祭りの始めに、三夜目と六夜目の大一番が分かる', 'See both boss nights when a festival starts'],
  wishPeek: ['屋台で、次の夜の願い札が見える', 'See the next night\'s wish card at the stall'],
  weekly: ['週にひとつ、大きめのおつかい', 'A bigger quest every week'],
  questSwap: ['今日のおつかいを、1 日 1 回取りかえられる', 'Swap one daily quest a day'],
  streakGuard: ['1 日あいても、続けた日数が切れない（7 日に 1 度）', 'Miss a day without losing your streak (once a week)'],
  purse: ['ふつうの祭りを ★1 持って始める', 'Start each festival with ★1'],
  color: ['ヒノコの炎の色を変えられる（着せかえ）', 'A new flame colour for Hinoko (dress-up)'],
  legend: ['伝説のお守りが Lv3 まで育つ', 'This legend charm can now reach Lv3'],
};
function U(lv, kind, id, extra = {}) {
  const [ja, en] = kind === 'legend' ? [`${NAMES[id][0]} Lv3`, `${NAMES[id][1]} Lv3`] : NAMES[id];
  const d = DESC[kind === 'feature' ? id : kind];
  const ch = extra.ch ? CHALLENGE_DEFS.find((c) => c.id === extra.ch) : null;
  const how = extra.by === 'boss' ? [`${YOKAI[extra.boss][0]}に初めて勝つ`, `Beat the ${YOKAI[extra.boss][1]}`]
    : extra.by === 'clear' ? ['八夜を初めて通す', 'Clear all 8 nights']
      : extra.by === 'level' ? [`段位 ${extra.level} で八夜を通す`, `Clear all 8 nights on Stakes ${extra.level}`]
        : ch ? (lv != null ? [`腕だめし「${ch.ja}」（格 ${lv} でも開く）`, `Challenge: ${ch.en} (or reach Rank ${lv})`] : [`腕だめし「${ch.ja}」`, `Challenge: ${ch.en}`])
          : [`格 ${lv}`, `Rank ${lv}`];
  return { lv, kind, id, ja, en, by: extra.by || 'rank', ...extra, how: how[0], howEn: how[1], ...(d ? { desc: d[0], descEn: d[1] } : {}) };
}
// 格の並び（格 2〜30 に 1 つずつ）
const RANK_LADDER = [
  [2, 'feature', 'daily'], [3, 'charm', 'hanaikada'], [4, 'outfit', 'hachimaki'], [5, 'charm', 'nokoribi'], [6, 'charm', 'nagafude'],
  [7, 'feature', 'appraise'], [8, 'charm', 'osobi'], [9, 'color', 'sakura'], [10, 'charm', 'nihitsu'], [11, 'outfit', 'kanzashi'],
  [12, 'charm', 'kazekiri'], [13, 'feature', 'startPick'], [14, 'feature', 'bossPeek'], [15, 'feature', 'focus'], [16, 'outfit', 'omen'],
  [17, 'feature', 'streakGuard'], [18, 'color', 'beni'], [19, 'feature', 'wishPeek'], [20, 'outfit', 'uchiwa'], [21, 'feature', 'weekly'],
  [22, 'color', 'hotaru'], [23, 'feature', 'questSwap'], [24, 'outfit', 'kingyo'], [25, 'color', 'gin'], [26, 'color', 'ume'],
  [27, 'feature', 'purse'], [28, 'color', 'sumi'], [29, 'color', 'kurogane'], [30, 'color', 'nanairo'],
];
export const UNLOCKS = [
  ...RANK_LADDER.map(([lv, kind, id]) => U(lv, kind, id)),
  ...CHALLENGE_DEFS.filter((c) => !BOSSES.includes(c.reward)).map((c) => U(c.lv, 'charm', c.reward, { by: 'challenge', ch: c.id })),
  U(null, 'feature', 'levels', { by: 'clear' }),
  ...BOSSES.map((b) => U(null, 'charm', b, { by: 'boss', boss: b })),
  ...BOSSES.map((b) => U(null, 'legend', b, { by: 'challenge', ch: `c_${b}`, boss: b })),
  U(null, 'outfit', 'kanmuri', { by: 'level', level: MAX_LEVEL }),
].sort((a, b) => (a.lv ?? 99) - (b.lv ?? 99));
const keyOf = (u) => `${u.kind}:${u.id}`;

function unlockedBy(m, u) {
  if (m.keep.includes(keyOf(u))) return true;
  if (u.by === 'rank') return rankOf(m.xp).lv >= u.lv;
  if (u.by === 'boss') return beatenN(m, u.boss) > 0;
  if (u.by === 'clear') return m.top >= 0;
  if (u.by === 'level') return m.top >= u.level;
  return m.ch.includes(u.ch) || (u.lv != null && rankOf(m.xp).lv >= u.lv); // challenge
}
function unlockedSet(meta) {
  const m = initMeta(meta);
  return UNLOCKS.filter((u) => unlockedBy(m, u));
}
const idsOf = (meta, kind, all) => { const got = new Set(unlockedSet(meta).filter((u) => u.kind === kind).map((u) => u.id)); return all.filter((id) => got.has(id)); };
// 候補に出してよいお守り（図鑑の並び）
export function charmPool(meta) {
  const got = new Set([...STARTER_CHARMS, ...unlockedSet(meta).filter((u) => u.kind === 'charm').map((u) => u.id)]);
  return CHARM_IDS.filter((id) => got.has(id));
}
export function outfits(meta) { return idsOf(meta, 'outfit', OUTFIT_IDS); }
export function colors(meta) { return idsOf(meta, 'color', COLOR_IDS); }
export function features(meta) { return idsOf(meta, 'feature', FEATURE_IDS); }
// 伝説の道: 伝説のお守りは、その妖怪に勝つと候補に入り Lv2 まで。段位 4 から上で勝つと Lv3 まで育つ。
// legendLv(meta, id) → そのお守りの Lv の上限（0 = まだ候補に出ない）。伝説でないお守りは、候補に出るなら 3
export function legendLv(meta, id) {
  const m = initMeta(meta);
  if (!CHARM_IDS.includes(id)) return 0;
  if (!BOSSES.includes(id)) return charmPool(m).includes(id) ? 3 : 0;
  if (!beatenN(m, id) && !m.keep.includes(`charm:${id}`)) return 0;
  return unlockedBy(m, UNLOCKS.find((u) => u.kind === 'legend' && u.id === id)) ? 3 : 2;
}
// 候補に出るお守りのうち、Lv3 まで育たないもの → { id: 上限 }。ページは、上限に届いたお守りの Lv 上げを候補に出さない（core の 'max' と同じに扱う）
export function charmCaps(meta) {
  const m = initMeta(meta), out = {};
  for (const id of charmPool(m)) { const lv = legendLv(m, id); if (lv < 3) out[id] = lv; }
  return out;
}
// えらべる段位のいちばん上。段位 n で八夜を通すと n+1 が開く（まだ通していなければ 0 だけ）
export function maxLevel(meta) { return Math.min(MAX_LEVEL, initMeta(meta).top + 1); }
// 次に格で開くもの（「あと ◯ XP で花筏」の表示用）。n 個まで、xpLeft つき。腕だめしで先に開いたものは飛ばす
export function upcoming(meta, n = 1) {
  const m = initMeta(meta), lv = rankOf(m.xp).lv;
  return UNLOCKS.filter((u) => u.lv != null && u.lv > lv && !unlockedBy(m, u)).slice(0, int(n, 0, 99, 1))
    .map((u) => ({ ...u, xpLeft: RANKS[u.lv - 1].xp - m.xp }));
}
// 次の目当て（タイトルと結果に 2〜3 行出す用）。近いもの（frac が大きいもの）から n 個。
// kind: rank（次の格の解放。格 30 から先は名人の星）/ challenge（腕だめし）/ level（次の段位）/ sticker（札の実績）/ quest（今日のおつかいの残り）/ weekly
// どれも { kind, id, ja, en, p, goal, frac }。dateKey が無ければ quest と weekly は出さない
export function nextGoals(meta, dateKey, n = 3) {
  const m = initMeta(meta), out = [];
  const add = (kind, id, ja, en, p, goal) => out.push({ kind, id, ja, en, p, goal, frac: goal > 0 ? Math.max(0, Math.min(1, p / goal)) : 0 });
  const up = upcoming(m, 1)[0];
  const rk = rankOf(m.xp);
  if (up) add('rank', up.id, `あと ${up.xpLeft} XP で「${up.ja}」`, `${up.xpLeft} XP to ${up.en}`, rk.cur, rk.cur + up.xpLeft);
  else if (rk.max) add('rank', 'over', `あと ${OVER_XP - rk.overCur} XP で名人の星 ${rk.over + 1} つ目`, `${OVER_XP - rk.overCur} XP to master star ${rk.over + 1}`, rk.overCur, OVER_XP);
  const ml = maxLevel(m);
  if (m.top >= 0 && m.top < MAX_LEVEL) add('level', `dan${ml}`, `段位 ${ml} で八夜を通すと、段位 ${ml + 1} が開く`, `Clear Stakes ${ml} to open Stakes ${ml + 1}`, m.top + 1, MAX_LEVEL);
  const sn = stickerN(m), sGoal = sn < 5 ? 5 : sn < CHARM_IDS.length ? CHARM_IDS.length : 0;
  if (sGoal && m.top >= 0) add('sticker', 'sticker', `札 ${sn}/${sGoal}（八夜を通すと、持っていたお守りに札）`, `Stickers ${sn}/${sGoal} (clear all 8 nights to sticker your charms)`, sn, sGoal);
  if (dayIndex(dateKey) != null) {
    const qs = todayQuests(m, dateKey), left = qs.filter((q) => !q.done);
    if (left.length) add('quest', left[0].id, `今日のおつかい「${left[0].ja}」`, `Today: ${left[0].en}`, left[0].p, left[0].goal);
    const w = weeklyQuest(m, dateKey);
    if (w && !w.done) add('weekly', w.id, `週のおつかい「${w.ja}」 ${w.p}/${w.goal}`, `Weekly: ${w.en} ${w.p}/${w.goal}`, w.p, w.goal);
  }
  for (const c of challenges(m)) {
    if (c.done || !c.open) continue;
    const p = Math.max(0, c.best ?? 0);
    add('challenge', c.id, `腕だめし「${c.ja}」${c.goal > 1 ? ` ${p}/${c.goal}` : ''}`, `Challenge: ${c.en}${c.goal > 1 ? ` ${p}/${c.goal}` : ''}`, p, c.goal);
  }
  return out.sort((a, b) => b.frac - a.frac).slice(0, int(n, 0, 99, 3));
}
// 図鑑の「解放」の一覧: UNLOCKS の 1 つずつに got（もう開いた）をつけたもの。kind と id の組で 1 つ（伝説は 'charm' と 'legend' の 2 つ）
export function unlockList(meta) {
  const m = initMeta(meta);
  return UNLOCKS.map((u) => ({ ...u, key: keyOf(u), got: unlockedBy(m, u) }));
}
// 腕だめしの一覧と進み（図鑑・タイトル用）。best は、これまでのいちばん良い値（まだなら null）
export function challenges(meta) {
  const m = initMeta(meta);
  return CHALLENGE_DEFS.map((c) => {
    const u = UNLOCKS.find((x) => x.ch === c.id), have = unlockedBy(m, u);
    return { id: c.id, ja: c.ja, en: c.en, goal: c.goal, xp: c.xp, lv: c.lv, best: own(m.chb, c.id) ? m.chb[c.id] : null, done: m.ch.includes(c.id),
      reward: { kind: u.kind, id: u.id, ja: u.ja, en: u.en, have }, open: !BOSSES.includes(c.reward) || beatenN(m, c.reward) > 0 };
  });
}

// ---------------------------------------------------------------- 実績
// やさしいものから順に。hidden は、とるまで名前を「？」にしておくもの
export const ACHIEVEMENTS = [
  { id: 'first_night', xp: 10, ja: '初めての夜', en: 'First Night', desc: '夜を 1 つ越える', descEn: 'Clear your first night' },
  { id: 'first_wish', xp: 10, ja: '願いがひとつ', en: 'A Wish Comes True', desc: '願い札を 1 つ叶える', descEn: 'Fulfil a wish card' },
  { id: 'daily1', xp: 15, ja: '今夜の一筆', en: 'Tonight\'s Stroke', desc: '今夜の一筆を遊ぶ', descEn: 'Play Tonight\'s Stroke' },
  { id: 'star3', xp: 20, ja: '三つ星', en: 'Three Stars', desc: '一夜で ★★★ をとる', descEn: 'Earn ★★★ on a night' },
  { id: 'first_boss', xp: 15, ja: '大一番', en: 'Showdown', desc: '大一番の夜を越える', descEn: 'Win a boss night' },
  { id: 'half', xp: 15, ja: '祭りの折り返し', en: 'Halfway There', desc: '一回の祭りで四夜越える', descEn: 'Clear 4 nights in one run' },
  { id: 'tori8', xp: 25, ja: '大トリ', en: 'Grand Finale', desc: '大トリで倍率 +8 以上', descEn: 'Get +8 mult or more from the grand shell' },
  { id: 'lv3', xp: 20, ja: '磨きぬいたお守り', en: 'Polished Charm', desc: 'お守りを Lv3 にする', descEn: 'Raise a charm to Lv3' },
  { id: 'regular', xp: 30, ja: '祭りの常連', en: 'Regular', desc: '祭りを 10 回遊ぶ', descEn: 'Play 10 runs' },
  ...BOSSES.map((b) => {
    const tw = Object.keys(TWIST_BOSS).find((k) => TWIST_BOSS[k] === b);
    return { id: `beat_${b}`, xp: 25, ja: `${YOKAI[b][0]}に勝つ`, en: `${YOKAI[b][1]} Beaten`, desc: `大一番「${TWIST_NAME[tw][0]}」で${YOKAI[b][0]}に勝つ`, descEn: `Beat the ${YOKAI[b][1]} on a ${TWIST_NAME[tw][1]} night` };
  }),
  { id: 'full_clear', xp: 50, ja: '八夜の花火師', en: 'Full Festival', desc: '一回の祭りで八夜をすべて越える', descEn: 'Clear all 8 nights in one run' },
  { id: 'sticker5', xp: 30, ja: '五枚の札', en: 'Five Stickers', desc: '5 種類のお守りに札をつける（札 = そのお守りを持って八夜を通した、いちばん高い段位）', descEn: 'Put a sticker on 5 charms (a sticker = the highest Stakes you cleared all 8 nights holding it)' },
  { id: 'ude3', xp: 40, ja: '腕だめし三つ', en: 'Three Challenges', desc: '腕だめしを 3 つ達成する', descEn: 'Complete 3 challenges' },
  { id: 'streak5', xp: 50, ja: '五日つづけて', en: 'Five-Day Streak', desc: '5 日つづけて遊ぶ', descEn: 'Play 5 days in a row' },
  { id: 'deep2', xp: 50, ja: '二つを極める', en: 'Two Polished', desc: 'Lv3 のお守りを 2 つ持って祭りを終える', descEn: 'Finish a run holding two Lv3 charms' },
  { id: 'pops40', xp: 40, ja: '四十連発', en: 'Forty Bursts', desc: '一夜で 40 発ひらく', descEn: 'Burst 40 shells in one night' },
  { id: 'quests20', xp: 60, ja: 'おつかい名人', en: 'Errand Expert', desc: '今日のおつかいを、合わせて 20 果たす', descEn: 'Complete 20 daily quests' },
  { id: 'onetag', xp: 50, ja: '型の花火師', en: 'True to Type', desc: '同じ型のお守り 3 つを持って八夜を通す', descEn: 'Clear all 8 nights holding 3 charms of one type' },
  { id: 'weekly1', xp: 40, ja: '週のおつかい', en: 'Weekly Errand', desc: '週のおつかいを果たす', descEn: 'Complete a weekly quest' },
  { id: 'all_yokai', xp: 80, ja: '妖怪の友だち', en: 'Yokai Friends', desc: '4 匹の妖怪みんなに勝つ', descEn: 'Beat all four yokai' },
  { id: 'level3', xp: 80, ja: '段位三', en: 'Stakes 3', desc: '段位 3 で八夜を通す', descEn: 'Clear all 8 nights on Stakes 3' },
  { id: 'no_retry', xp: 50, ja: '予備いらず', en: 'No Spares Needed', desc: '予備の提灯を使わずに八夜を通す', descEn: 'Clear all 8 nights without a spare lantern', hidden: true },
  { id: 'sticker_hi', xp: 80, ja: '高い札', en: 'High Stickers', desc: '8 種類のお守りに、段位 4 から上の札をつける', descEn: 'Put a Stakes 4+ sticker on 8 charms' },
  { id: 'zukan', xp: 100, ja: 'お守り図鑑', en: 'Charm Collector', desc: 'お守りを 24 種類すべて見る', descEn: 'See all 24 charms' },
  { id: 'wish_all', xp: 100, ja: '願い札あつめ', en: 'Wish Collector', desc: 'どの種類の願いも、1 度は叶える', descEn: 'Fulfil every kind of wish at least once' },
  { id: 'bloom8', xp: 100, ja: '八夜目の満開', en: 'Final Bloom', desc: '八夜目で、夜空の玉を全部ひらく', descEn: 'Burst every shell on night 8', hidden: true },
  { id: 'level6', xp: 120, ja: '段位六', en: 'Stakes 6', desc: '段位 6 で八夜を通す', descEn: 'Clear all 8 nights on Stakes 6' },
  { id: 'ude_all', xp: 150, ja: '腕だめし皆伝', en: 'All Challenges', desc: '腕だめしを全部達成する', descEn: 'Complete every challenge' },
  { id: 'stars24', xp: 150, ja: '満天の星', en: 'Starry Sky', desc: '一回の祭りで星を 24 個', descEn: 'Earn all 24 stars in one run', hidden: true },
  { id: 'wishes8', xp: 150, ja: '願いがみんな叶う', en: 'Every Wish', desc: '一回の祭りで、八夜の願いをみんな叶える', descEn: 'Fulfil all 8 wishes in one run', hidden: true },
  { id: 'sticker_all', xp: 200, ja: '札ぞろえ', en: 'Sticker Book', desc: '24 種類のお守りすべてに札をつける', descEn: 'Put a sticker on all 24 charms' },
  { id: 'level8', xp: 250, ja: '王冠の花火師', en: 'Crowned', desc: '段位 8 で八夜を通す（ヒノコに王冠）', descEn: 'Clear all 8 nights on Stakes 8 (Hinoko gets a crown)' },
];
// 実績の条件。c = { s: その回のまとめ（きれいにしたもの）, m: その回を足したあとの meta }
const stickerN = (m, lo = 0) => Object.values(m.sticker).filter((v) => v >= lo).length;
const ACH_TEST = {
  first_night: (c) => c.s.cleared >= 1,
  first_wish: (c) => c.s.wishes >= 1,
  daily1: (c) => c.s.daily,
  star3: (c) => c.s.nights.some((n) => n.stars === 3),
  first_boss: (c) => c.s.beaten.length >= 1,
  half: (c) => c.s.cleared >= 4,
  tori8: (c) => c.s.nights.some((n) => n.toriAdd >= 8),
  lv3: (c) => Object.values(c.s.charms).some((lv) => lv >= 3),
  regular: (c) => c.m.runs >= 10,
  full_clear: (c) => c.s.cleared >= NIGHTS,
  sticker5: (c) => stickerN(c.m) >= 5,
  ude3: (c) => c.m.ch.length >= 3,
  streak5: (c) => c.m.streak.n >= 5,
  deep2: (c) => Object.values(c.s.final).filter((lv) => lv >= 3).length >= 2,
  pops40: (c) => c.s.nights.some((n) => n.pops >= 40),
  quests20: (c) => c.m.qn >= 20,
  onetag: (c) => c.s.cleared >= NIGHTS && maxTag(c.s.final) >= 3,
  weekly1: (c) => c.m.wn >= 1,
  all_yokai: (c) => BOSSES.every((b) => beatenN(c.m, b) > 0),
  level3: (c) => c.m.top >= 3,
  no_retry: (c) => c.s.cleared >= NIGHTS && c.s.retries === 0, // retries が無いまとめでは、とれない
  sticker_hi: (c) => stickerN(c.m, 4) >= 8,
  zukan: (c) => CHARM_IDS.every((id) => c.m.charms[id] && c.m.charms[id][0] > 0),
  wish_all: (c) => WISH_ACTIVE.every((k) => Object.keys(c.m.wish).some((id) => wishKind(id) === k && c.m.wish[id] > 0)),
  bloom8: (c) => c.s.cleared >= NIGHTS && c.s.nights.length >= NIGHTS && c.s.nights[NIGHTS - 1].pass && c.s.nights[NIGHTS - 1].allClear,
  level6: (c) => c.m.top >= 6,
  ude_all: (c) => CH_IDS.every((id) => c.m.ch.includes(id)),
  stars24: (c) => c.s.stars >= NIGHTS * 3,
  wishes8: (c) => c.s.cleared >= NIGHTS && c.s.wishes >= NIGHTS,
  sticker_all: (c) => stickerN(c.m) >= CHARM_IDS.length,
  level8: (c) => c.m.top >= MAX_LEVEL,
};
for (const b of BOSSES) ACH_TEST[`beat_${b}`] = (c) => beatenN(c.m, b) > 0;
const ACH_IDS = ACHIEVEMENTS.map((a) => a.id);

// ---------------------------------------------------------------- 今日のおつかい
// 日付ごとに 3 つ（やさしい・ふつう・むずかしいから 1 つずつ）。その日の祭りを何回やっても、進みは足されていく。
// ただ遊ぶだけで済むものは入れない。どれも「今日はこう遊んでみる」という注文で、ふつうに遊ぶ人なら 2〜6 割の日に果たせる数にした
// kind: sum = その日の合計 / max = 一回の祭りでのいちばん / group が同じものは同じ日に並べない
const Q = (tier, id, ja, en, goal, kind, group, stat) => ({ id, tier, ja, en, goal, xp: [30, 45, 60][tier], kind, group, stat });
const nightsWhere = (s, f) => s.nights.filter(f).length;
const QUEST_DEFS = [
  Q(0, 'q_stars10', '一回の祭りで星を 10 個とる', 'Earn 10 stars in one run', 10, 'max', 'star', (s) => s.stars),
  Q(0, 'q_star2x3', '★★ を 3 回とる', 'Earn ★★ three times', 3, 'sum', 'star', (s) => nightsWhere(s, (n) => n.stars >= 2)),
  Q(0, 'q_wish3', '一回の祭りで願いを 3 つ叶える', 'Fulfil 3 wishes in one run', 3, 'max', 'wish', (s) => s.wishes),
  Q(0, 'q_ink50', '六夜目から後の夜を、墨を半分残して越える', 'Clear night 6 or later with half your ink left', 1, 'sum', 'ink', (s) => nightsWhere(s, (n) => n.pass && n.i >= 5 && n.inkFrac != null && n.inkFrac <= 0.5 + 1e-9)),
  Q(0, 'q_gold2', '線でじかに金の玉に 2 つふれて夜を越える', 'Clear a night touching 2 gold shells with your line', 1, 'sum', 'gold', (s) => nightsWhere(s, (n) => n.pass && n.goldTouched >= 2)),
  Q(0, 'q_daily8', '今夜の一筆で八夜を通す', 'Clear all 8 nights of Tonight\'s Stroke', 1, 'sum', 'daily', (s) => (s.daily && s.cleared >= NIGHTS ? 1 : 0)),
  Q(1, 'q_lv3x2', 'Lv3 のお守りを 2 つ持って祭りを終える', 'Finish a run holding two Lv3 charms', 1, 'sum', 'charm', (s) => (Object.values(s.final).filter((lv) => lv >= 3).length >= 2 ? 1 : 0)),
  Q(1, 'q_boss2', '大一番の夜を ★★ で越える', 'Win a boss night with ★★', 1, 'sum', 'boss', (s) => nightsWhere(s, (n) => n.boss && n.pass && n.stars >= 2)),
  Q(1, 'q_gen6', '連鎖を 6 代つなげて夜を越える', 'Clear a night with a chain 6 generations deep', 1, 'sum', 'chain', (s) => nightsWhere(s, (n) => n.pass && n.maxGen >= 6)),
  Q(1, 'q_touch3', '線でふれる玉 3 つまでで、三夜目から後の夜を越える', 'Clear night 3 or later touching at most 3 shells with your line', 1, 'sum', 'touch', (s) => nightsWhere(s, (n) => n.pass && n.i >= 2 && n.lineTouched > 0 && n.lineTouched <= 3)),
  Q(1, 'q_sweep95', '四夜目から後の夜を、玉を 9 割 5 分ひらいて越える', 'Clear night 4 or later with 95% of the shells burst', 1, 'sum', 'sweep', (s) => nightsWhere(s, (n) => n.pass && n.i >= 3 && n.total > 0 && n.pops >= 0.95 * n.total)),
  Q(1, 'q_wish4', '一回の祭りで願いを 4 つ叶える', 'Fulfil 4 wishes in one run', 4, 'max', 'wish', (s) => s.wishes),
  Q(2, 'q_goldboss', '金のお守りを 2 つ持って、大一番の夜を越える', 'Win a boss night holding 2 gold charms', 1, 'sum', 'gold', (s) => nightsWhere(s, (n) => n.boss && n.pass && (n.tags.gold || 0) >= 2)),
  Q(2, 'q_tori6', '大トリで倍率 +6 以上', 'Get +6 mult from the grand shell', 1, 'sum', 'tori', (s) => nightsWhere(s, (n) => n.toriAdd >= 6)),
  Q(2, 'q_tag3', '同じ型のお守りを 3 つ持って夜を越える', 'Clear a night holding 3 charms of one type', 1, 'sum', 'build', (s) => nightsWhere(s, (n) => n.pass && maxTag(n.charms) >= 3)),
  Q(2, 'q_ink60', '五夜目から後の夜を、墨を 6 割残して越える', 'Clear night 5 or later with 60% of your ink left', 1, 'sum', 'ink', (s) => nightsWhere(s, (n) => n.pass && n.i >= 4 && n.inkFrac != null && n.inkFrac <= 0.4 + 1e-9)),
  Q(2, 'q_pops40', '一夜で 40 発ひらいて越える', 'Clear a night bursting 40 shells', 1, 'sum', 'sweep', (s) => nightsWhere(s, (n) => n.pass && n.pops >= 40)),
  Q(2, 'q_star2x4', '★★ を 4 回とる', 'Earn ★★ four times', 4, 'sum', 'star', (s) => nightsWhere(s, (n) => n.stars >= 2)),
];
export const QUESTS = QUEST_DEFS.map(({ stat, ...q }) => q);
const QUEST_BY_ID = Object.fromEntries(QUEST_DEFS.map((q) => [q.id, q]));
const pub = (q) => ({ id: q.id, ja: q.ja, en: q.en, goal: q.goal, xp: q.xp, tier: q.tier });

// その日の 3 つ。swap（0..2）を渡すと、その番号を同じむずかしさの別のものに取りかえた並び（swapQuest のあと）
export function dailyQuests(dateKey, swap = -1) {
  const key = String(dateKey);
  const rnd = rng32(hashStr('hitofude-quest2:' + key));
  const out = [], groups = new Set();
  for (let tier = 0; tier < 3; tier++) {
    const list = QUEST_DEFS.filter((q) => q.tier === tier && !groups.has(q.group));
    const q = list[Math.floor(rnd() * list.length)];
    groups.add(q.group);
    out.push(q);
  }
  const k = typeof swap === 'number' && swap >= 0 && swap < 3 ? Math.floor(swap) : -1;
  if (k >= 0) {
    const others = new Set(out.filter((_, i) => i !== k).map((q) => q.group));
    const list = QUEST_DEFS.filter((q) => q.tier === out[k].tier && q.id !== out[k].id && !others.has(q.group));
    if (list.length) out[k] = list[Math.floor(rng32(hashStr(`hitofude-quest2-swap:${key}:${k}`))() * list.length)];
  }
  return out.map(pub);
}
// 今日の 3 つと、その進み（タイトル・結果の表示用）
export function todayQuests(meta, dateKey) {
  const m = initMeta(meta), today = m.quest.d === dateKey;
  return dailyQuests(dateKey, today ? m.quest.x : -1).map((q, i) => {
    const p = today ? m.quest.p[i] : 0;
    return { ...q, p, done: p >= q.goal };
  });
}
// おつかいを 1 つ取りかえる（features に 'questSwap' があるとき、1 日 1 回。果たしたものは取りかえない）。→ { ok, meta, quests }
export function swapQuest(meta, dateKey, slot) {
  const m = initMeta(meta), k = typeof slot === 'number' ? Math.floor(slot) : -1;
  const fail = { ok: false, meta: m, quests: dayIndex(dateKey) == null ? [] : todayQuests(m, dateKey) };
  if (dayIndex(dateKey) == null || k < 0 || k > 2 || !features(m).includes('questSwap')) return fail;
  if (m.quest.d !== dateKey) m.quest = { d: dateKey, p: [0, 0, 0], x: -1 };
  const was = dailyQuests(dateKey);
  if (m.quest.x >= 0 || m.quest.p[k] >= was[k].goal) return { ...fail, meta: initMeta(meta) };
  const now = dailyQuests(dateKey, k);
  if (now[k].id === was[k].id) return { ...fail, meta: initMeta(meta) };
  m.quest.x = k; m.quest.p[k] = 0;
  return { ok: true, meta: m, quests: todayQuests(m, dateKey) };
}

// ---------------------------------------------------------------- 週のおつかい（'weekly' が開いてから）
// 月曜はじまりの週ごとに 1 つ。その週の祭りで足されていく
const WQ = (id, ja, en, goal, stat) => ({ id, ja, en, goal, xp: 120, stat });
const WEEKLY_DEFS = [
  WQ('wk_clear3', '今週、八夜を 3 回通す', 'Clear all 8 nights 3 times this week', 3, (s) => (s.cleared >= NIGHTS ? 1 : 0)),
  WQ('wk_wish15', '今週、願いを 15 叶える', 'Fulfil 15 wishes this week', 15, (s) => s.wishes),
  WQ('wk_sticker3', '今週、札を 3 枚ふやすか上げる', 'Add or raise 3 stickers this week', 3, (s, x) => x.stickers),
  WQ('wk_quest6', '今週、今日のおつかいを 6 つ果たす', 'Complete 6 daily quests this week', 6, (s, x) => x.quests),
  WQ('wk_boss6', '今週、大一番の夜を 6 回越える', 'Win 6 boss nights this week', 6, (s) => s.bossWins),
  WQ('wk_star40', '今週、星を 40 個とる', 'Earn 40 stars this week', 40, (s) => s.stars),
];
export const WEEKLY = WEEKLY_DEFS.map(({ stat, ...q }) => q);
// 'YYYY-MM-DD' → その週の月曜の日付（ありえない日付は null）
export function weekOf(dateKey) {
  const d = dayIndex(dateKey);
  if (d == null) return null;
  const mon = d - ((d + 3) % 7); // 1970-01-01 は木曜
  return new Date(mon * 86400000).toISOString().slice(0, 10);
}
function weeklyDef(dateKey) {
  const wk = weekOf(dateKey);
  return wk ? WEEKLY_DEFS[Math.floor(rng32(hashStr('hitofude-week:' + wk))() * WEEKLY_DEFS.length)] : null;
}
// その週の 1 つと進み。'weekly' がまだ開いていなければ null
export function weeklyQuest(meta, dateKey) {
  const m = initMeta(meta), def = weeklyDef(dateKey);
  if (!def || !features(m).includes('weekly')) return null;
  const p = m.week.k === weekOf(dateKey) ? m.week.p : 0;
  return { id: def.id, ja: def.ja, en: def.en, goal: def.goal, xp: def.xp, week: weekOf(dateKey), p, done: p >= def.goal };
}

// ---------------------------------------------------------------- XP
// 一回の祭りの XP。夜を越えるほど、後の夜ほど多い。星・願い・大一番・完走に少しずつ。段位ひとつにつき +12.5%
export const XP = {
  play: 5, nights: [8, 10, 12, 14, 16, 18, 22, 26], star: 2, wish: 6, boss: 15, clear: 50, levelBonus: 0.125,
  sticker: 6, // 札が 1 枚ふえる・上がるごとに
  streakStep: 10, streakCap: 7, // 続けた日数のおまけ: その日の初めの 1 回に 10 × 日数（7 日で頭打ち）
};
const PART_NAME = {
  play: ['遊んだ', 'Played'], nights: ['越えた夜', 'Nights cleared'], stars: ['星', 'Stars'], wishes: ['叶った願い', 'Wishes'],
  bosses: ['大一番', 'Boss nights'], clear: ['八夜を通した', 'Full clear'], level: ['段位のおまけ', 'Stakes bonus'], streak: ['つづけて遊んだ日', 'Day streak'],
  stickers: ['札', 'Stickers'],
};
const part = (id, xp, n) => ({ id, ja: PART_NAME[id][0], en: PART_NAME[id][1], xp, n });

export function xpForRun(summary) { return runXp(cleanSummary(summary)); }
function runXp(s) {
  const parts = [part('play', XP.play, 1)];
  if (s.cleared) parts.push(part('nights', XP.nights.slice(0, s.cleared).reduce((a, b) => a + b, 0), s.cleared));
  if (s.stars) parts.push(part('stars', s.stars * XP.star, s.stars));
  if (s.wishes) parts.push(part('wishes', s.wishStars * XP.wish, s.wishes));
  if (s.bossWins) parts.push(part('bosses', s.bossWins * XP.boss, s.bossWins));
  if (s.cleared >= NIGHTS) parts.push(part('clear', XP.clear, 1));
  const base = parts.reduce((a, p) => a + p.xp, 0);
  if (s.level) parts.push(part('level', Math.round(base * XP.levelBonus * s.level), s.level));
  return { total: parts.reduce((a, p) => a + p.xp, 0), parts };
}

// ---------------------------------------------------------------- 祭りを足す
export function applyRun(meta, summary, dateKey) {
  const before = initMeta(meta), m = initMeta(meta), s = cleanSummary(summary);
  // まだ開いていない段位は、開いているいちばん上として数える（おかしな値で王冠が開かないように）
  s.level = Math.min(s.level, maxLevel(before));
  const rankBefore = rankOf(before.xp);
  const parts = runXp(s).parts;
  const featBefore = features(before);

  // 数を足す
  m.runs = cap(m.runs + 1);
  m.nights = cap(m.nights + s.cleared);
  m.stars = cap(m.stars + s.stars);
  m.wishes = cap(m.wishes + s.wishes);
  if (s.daily) m.daily = cap(m.daily + 1);
  if (s.cleared >= NIGHTS) { m.clears = cap(m.clears + 1); m.top = Math.max(m.top, s.level); }
  m.best = Math.max(m.best, s.total);
  m.pops = Math.max(m.pops, s.bestPops);
  // 妖怪: 会った・勝った
  const bossesBeaten = [];
  for (const n of s.nights) {
    if (!n.boss) continue;
    const e = m.cast[n.boss] || [0, 0];
    e[0] = cap(e[0] + 1);
    if (n.pass) { if (!e[1] && !bossesBeaten.includes(n.boss)) bossesBeaten.push(n.boss); e[1] = cap(e[1] + 1); }
    m.cast[n.boss] = e;
  }
  // 図鑑: 持っていたお守り（見た・使った・いちばん高い Lv）、叶えた願い
  for (const [id, lv] of Object.entries(s.charms)) {
    const e = m.charms[id] || [0, 0, 0];
    m.charms[id] = [Math.max(1, e[0]), cap(e[1] + 1), Math.max(e[2], lv)];
  }
  for (const n of s.nights) if (n.wish && n.wishMet) m.wish[n.wish] = cap((m.wish[n.wish] || 0) + 1);

  // 札: 八夜を通したら、八夜目に持っていたお守りに、その段位の札（前より高いときだけ上がる）
  const stickers = [];
  if (s.cleared >= NIGHTS) {
    for (const id of CHARM_IDS) {
      if (!s.final[id]) continue;
      const prev = own(m.sticker, id) ? m.sticker[id] : -1;
      if (s.level > prev) { m.sticker[id] = s.level; stickers.push({ id, level: s.level, prev }); }
    }
    if (stickers.length) parts.push(part('stickers', stickers.length * XP.sticker, stickers.length));
  }

  // 腕だめし: いちばん良い値を残し、goal に届いたら達成
  const challengesDone = [], challengeProgress = [];
  for (const c of CHALLENGE_DEFS) {
    const v = c.stat(s);
    if (v == null) continue;
    const prev = own(m.chb, c.id) ? m.chb[c.id] : null;
    if (prev == null || v > prev) { m.chb[c.id] = int(v, -1, 9999, 0); challengeProgress.push({ id: c.id, best: m.chb[c.id], prev, goal: c.goal }); }
    if (!m.ch.includes(c.id) && m.chb[c.id] >= c.goal) {
      m.ch = CH_IDS.filter((id) => id === c.id || m.ch.includes(id));
      challengesDone.push({ id: c.id, ja: c.ja, en: c.en, xp: c.xp });
      parts.push({ id: `ch:${c.id}`, ja: `腕だめし「${c.ja}」`, en: `Challenge: ${c.en}`, xp: c.xp, n: 1 });
    }
  }

  // 続けた日数（日付が前に進んだときだけ）。休みの札があれば、1 日あいても続く（7 日に 1 度）
  let streakXp = 0, guarded = false;
  const day = dayIndex(dateKey);
  if (day != null) {
    const last = dayIndex(m.streak.last);
    if (last == null || day > last) {
      const g = dayIndex(m.streak.g);
      if (last != null && day === last + 1) m.streak.n = Math.min(m.streak.n + 1, COUNT_MAX);
      else if (last != null && day === last + 2 && featBefore.includes('streakGuard') && (g == null || day - g >= 7)) {
        m.streak.n = Math.min(m.streak.n + 1, COUNT_MAX); m.streak.g = dateKey; guarded = true;
      } else m.streak.n = 1;
      m.streak.last = dateKey;
      m.streak.best = Math.max(m.streak.best, m.streak.n);
      streakXp = XP.streakStep * Math.min(m.streak.n, XP.streakCap);
      parts.push(part('streak', streakXp, m.streak.n));
    }
  }

  // 今日のおつかい
  const quests = [];
  let questsDone = 0;
  if (day != null) {
    if (m.quest.d !== dateKey) m.quest = { d: dateKey, p: [0, 0, 0], x: -1 };
    dailyQuests(dateKey, m.quest.x).forEach((q, i) => {
      const def = QUEST_BY_ID[q.id], was = m.quest.p[i], v = def.stat(s);
      const now = Math.min(q.goal, def.kind === 'max' ? Math.max(was, v) : was + v);
      m.quest.p[i] = now;
      const done = now >= q.goal, justDone = done && was < q.goal;
      if (justDone) { questsDone++; parts.push({ id: `quest:${q.id}`, ja: `おつかい「${q.ja}」`, en: `Quest: ${q.en}`, xp: q.xp, n: 1 }); }
      quests.push({ id: q.id, ja: q.ja, en: q.en, p: now, goal: q.goal, xp: q.xp, tier: q.tier, done, justDone });
    });
    m.qn = cap(m.qn + questsDone);
  }

  // 週のおつかい（開いていて、日付が読めるときだけ）
  let weekly = null;
  const wk = weekOf(dateKey), wdef = weeklyDef(dateKey);
  if (wk && wdef && featBefore.includes('weekly')) {
    if (m.week.k !== wk) m.week = { k: wk, p: 0 };
    const was = m.week.p, now = Math.min(wdef.goal, was + wdef.stat(s, { stickers: stickers.length, quests: questsDone }));
    m.week.p = now;
    const done = now >= wdef.goal, justDone = done && was < wdef.goal;
    if (justDone) { m.wn = cap(m.wn + 1); parts.push({ id: `weekly:${wdef.id}`, ja: `週のおつかい「${wdef.ja}」`, en: `Weekly: ${wdef.en}`, xp: wdef.xp, n: 1 }); }
    weekly = { id: wdef.id, ja: wdef.ja, en: wdef.en, p: now, goal: wdef.goal, xp: wdef.xp, week: wk, done, justDone };
  }

  // 実績（足したあとの meta で見る。一度とったものは二度と数えない）
  const have = new Set(m.ach), achievements = [];
  for (const a of ACHIEVEMENTS) {
    if (have.has(a.id) || !ACH_TEST[a.id]({ s, m })) continue;
    achievements.push(a.id); have.add(a.id);
    parts.push({ id: `ach:${a.id}`, ja: `実績「${a.ja}」`, en: `Achievement: ${a.en}`, xp: a.xp, n: 1 });
  }
  m.ach = ACH_IDS.filter((id) => have.has(id));

  const xp = parts.reduce((a, p) => a + p.xp, 0);
  m.xp = Math.min(XP_MAX, m.xp + xp);
  const rankAfter = rankOf(m.xp);
  const had = new Set(UNLOCKS.filter((u) => unlockedBy(before, u)));
  const unlocked = UNLOCKS.filter((u) => !had.has(u) && unlockedBy(m, u));
  // meta は読み直して、項目の並びを保存したときと同じにそろえる
  return {
    meta: initMeta(m), xp, parts, rankBefore, rankAfter, unlocked, achievements, quests, weekly, bossesBeaten, stickers,
    challenges: challengesDone, challengeProgress, levelUp: maxLevel(m) > maxLevel(before) ? maxLevel(m) : null, overUp: rankAfter.over - rankBefore.over,
    streak: { ...m.streak, xp: streakXp, guarded },
  };
}

// ---------------------------------------------------------------- 図鑑
// 見たものを書く: charms = 候補に出たお守り、shells = 見た玉の種類、cast = 会った妖怪・屋台の猫
export function noteSeen(meta, seen) {
  const m = initMeta(meta), charms = get(seen, 'charms'), shells = get(seen, 'shells'), cast = get(seen, 'cast');
  for (const id of list(charms)) if (CHARM_IDS.includes(id)) { const e = m.charms[id] || [0, 0, 0]; e[0] = cap(e[0] + 1); m.charms[id] = e; }
  const sh = new Set(m.shells);
  for (const t of list(shells)) if (SHELL_TYPES.includes(t)) sh.add(t);
  m.shells = SHELL_TYPES.filter((t) => sh.has(t));
  for (const id of list(cast)) if (CAST_IDS.includes(id)) { const e = m.cast[id] || [0, 0]; e[0] = Math.max(1, e[0]); m.cast[id] = e; }
  return m;
}
// 図鑑の中身。charms[id].sticker は札（0..8。まだなら null）、cap は Lv の上限（0 = まだ候補に出ない）
export function collection(meta) {
  const m = initMeta(meta), pool = new Set(charmPool(m));
  const charms = {}, cast = {}, achievements = {}, shells = {}, wishes = {};
  for (const id of CHARM_IDS) {
    const e = m.charms[id] || [0, 0, 0];
    charms[id] = { seen: e[0], used: e[1], maxLv: e[2], sticker: own(m.sticker, id) ? m.sticker[id] : null, open: pool.has(id), cap: legendLv(m, id) };
  }
  for (const id of CAST_IDS) { const e = m.cast[id] || [0, 0]; cast[id] = { met: e[0], beaten: e[1] }; }
  for (const id of ACH_IDS) achievements[id] = m.ach.includes(id);
  for (const t of SHELL_TYPES) shells[t] = m.shells.includes(t);
  for (const k of WISH_ACTIVE) wishes[k] = Object.keys(m.wish).filter((id) => wishKind(id) === k).reduce((a, id) => a + m.wish[id], 0);
  const n = (o, f) => Object.values(o).filter(f).length;
  const counts = {
    charms: n(charms, (c) => c.seen > 0), charmsTotal: CHARM_IDS.length, charmsUsed: n(charms, (c) => c.used > 0),
    stickers: stickerN(m), stickersHigh: stickerN(m, 4), stickerSum: Object.values(m.sticker).reduce((a, v) => a + v + 1, 0), stickersTotal: CHARM_IDS.length,
    cast: n(cast, (c) => c.met > 0), castTotal: CAST_IDS.length, bosses: BOSSES.filter((b) => cast[b].beaten > 0).length, bossesTotal: BOSSES.length,
    achievements: m.ach.length, achievementsTotal: ACH_IDS.length,
    challenges: m.ch.length, challengesTotal: CH_IDS.length,
    shells: m.shells.length, shellsTotal: SHELL_TYPES.length, wishes: n(wishes, (v) => v > 0), wishesTotal: WISH_ACTIVE.length,
    outfits: outfits(m).length, outfitsTotal: OUTFIT_IDS.length, colors: colors(m).length, colorsTotal: COLOR_IDS.length,
    runs: m.runs, nights: m.nights, stars: m.stars, clears: m.clears, best: m.best, bestPops: m.pops, quests: m.qn, weeklies: m.wn,
  };
  return { charms, cast, achievements, shells, wishes, counts };
}

// ---------------------------------------------------------------- 読みこみ（壊れた値に強く）
const XP_MAX = 1e8, COUNT_MAX = 1e7;
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
function get(o, k) { return isObj(o) && own(o, k) ? o[k] : undefined; }
function int(x, lo, hi, def = lo) { return typeof x === 'number' && Number.isFinite(x) ? Math.min(hi, Math.max(lo, Math.floor(x))) : def; }
const cap = (n) => Math.min(COUNT_MAX, n);
const list = (x) => (Array.isArray(x) ? x.filter((v) => typeof v === 'string') : typeof x === 'string' ? [x] : []);
function beatenN(m, b) { return m.cast[b] ? m.cast[b][1] : 0; }
// 持ち物 { id: lv } → 型ごとの種類の数 { gold: 2, ... }（BUILD_TAGS だけ）
function tagsOf(levels) {
  const out = {};
  for (const id of Object.keys(levels)) for (const t of TAGS_OF[id] || []) if (BUILD_TAGS.includes(t)) out[t] = (out[t] || 0) + 1;
  return out;
}
function maxTag(levels) { return Math.max(0, ...Object.values(tagsOf(levels))); }
// 'YYYY-MM-DD' → 日の通し番号（ありえない日付は null）
function dayIndex(key) {
  if (typeof key !== 'string') return null;
  const r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!r) return null;
  const t = Date.UTC(+r[1], +r[2] - 1, +r[3]), d = new Date(t);
  if (d.getUTCFullYear() !== +r[1] || d.getUTCMonth() !== +r[2] - 1 || d.getUTCDate() !== +r[3]) return null;
  return Math.round(t / 86400000);
}
const dateOr = (k, def = null) => (dayIndex(k) != null ? k : def);

// 12版（meta.v 1）の格の解放とはじめのお守り。読みこみで、もう開いていたものを閉じないために使う
const V1_STARTERS = ['nagafude', 'kinun', 'kodou', 'tairin', 'nokoribi', 'chouchinshi', 'mashidama', 'owaridama', 'amayoke'];
const V1_RANK_UNLOCKS = [
  [2, 'charm', 'maneki'], [2, 'feature', 'daily'], [3, 'outfit', 'hachimaki'], [4, 'charm', 'hanaikada'], [5, 'charm', 'nihitsu'],
  [6, 'outfit', 'kanzashi'], [7, 'charm', 'renjishi'], [8, 'charm', 'suminagashi'], [9, 'outfit', 'omen'], [10, 'charm', 'senkou'],
  [11, 'charm', 'osobi'], [12, 'outfit', 'uchiwa'], [13, 'charm', 'ichibanboshi'], [14, 'charm', 'nokorizumi'], [15, 'charm', 'mankai'],
  [16, 'charm', 'kazekiri'], [18, 'outfit', 'kingyo'],
];
function lvOnLadder(xs, xp) { let i = 0; while (i + 1 < xs.length && xs[i + 1] <= xp) i++; return i; }

// legacy: meta をまだ持たない（前の版から遊んでいる）人への、はじめの 1 回だけのおまけ。
// { runs: これまでの祭りの数, cleared: 八夜を通したことがあるか } → 1 回 50 XP（20 回まで）、通したことがあれば段位えらびも開く
export function initMeta(raw, legacy) {
  const r = isObj(raw) ? raw : {};
  const v = int(get(r, 'v'), 0, 999, 0);
  const m = {
    v: META_VERSION,
    xp: int(get(r, 'xp'), 0, XP_MAX, 0),
    runs: int(get(r, 'runs'), 0, COUNT_MAX, 0), nights: int(get(r, 'nights'), 0, COUNT_MAX, 0),
    stars: int(get(r, 'stars'), 0, COUNT_MAX, 0), wishes: int(get(r, 'wishes'), 0, COUNT_MAX, 0),
    clears: int(get(r, 'clears'), 0, COUNT_MAX, 0), daily: int(get(r, 'daily'), 0, COUNT_MAX, 0),
    best: int(get(r, 'best'), 0, Number.MAX_SAFE_INTEGER, 0), pops: int(get(r, 'pops'), 0, 9999, 0),
    top: int(get(r, 'top'), -1, MAX_LEVEL, -1),
    qn: int(get(r, 'qn'), 0, COUNT_MAX, 0), wn: int(get(r, 'wn'), 0, COUNT_MAX, 0),
    cast: {}, charms: {}, wish: {}, shells: [], ach: [], sticker: {}, ch: [], chb: {}, keep: [],
    streak: { last: null, n: 0, best: 0, g: null },
    quest: { d: null, p: [0, 0, 0], x: -1 },
    week: { k: null, p: 0 },
  };
  const cast = get(r, 'cast');
  for (const id of CAST_IDS) {
    const e = get(cast, id);
    if (!Array.isArray(e)) continue;
    const met = int(e[0], 0, COUNT_MAX, 0), won = id === 'neko' ? 0 : int(e[1], 0, COUNT_MAX, 0);
    if (met || won) m.cast[id] = [Math.max(met, won), won];
  }
  const charms = get(r, 'charms');
  for (const id of CHARM_IDS) {
    const e = get(charms, id);
    if (!Array.isArray(e)) continue;
    const used = int(e[1], 0, COUNT_MAX, 0), seen = Math.max(int(e[0], 0, COUNT_MAX, 0), used ? 1 : 0), lv = int(e[2], 0, 3, 0);
    if (seen || used || lv) m.charms[id] = [seen, used, used ? Math.max(1, lv) : lv];
  }
  const wish = get(r, 'wish');
  for (const id of WISH_IDS) { const n = int(get(wish, id), 0, COUNT_MAX, 0); if (n) m.wish[id] = n; }
  const sh = list(get(r, 'shells')), ach = list(get(r, 'ach'));
  m.shells = SHELL_TYPES.filter((t) => sh.includes(t));
  m.ach = ACH_IDS.filter((id) => ach.includes(id));
  const stk = get(r, 'sticker');
  for (const id of CHARM_IDS) { const n = get(stk, id); if (typeof n === 'number' && Number.isFinite(n) && n >= 0) m.sticker[id] = int(n, 0, MAX_LEVEL, 0); }
  const chl = list(get(r, 'ch'));
  m.ch = CH_IDS.filter((id) => chl.includes(id));
  const chb = get(r, 'chb');
  for (const id of CH_IDS) { const n = get(chb, id); if (typeof n === 'number' && Number.isFinite(n)) m.chb[id] = int(n, -1, 9999, 0); }
  const kp = list(get(r, 'keep'));
  m.keep = UNLOCKS.map(keyOf).filter((k, i, a) => a.indexOf(k) === i && kp.includes(k));
  const st = get(r, 'streak');
  const last = dateOr(get(st, 'last'));
  if (last) {
    m.streak.last = last;
    m.streak.n = int(get(st, 'n'), 1, COUNT_MAX, 1);
    m.streak.best = Math.max(m.streak.n, int(get(st, 'best'), 0, COUNT_MAX, 0));
  } else m.streak.best = int(get(st, 'best'), 0, COUNT_MAX, 0);
  m.streak.g = dateOr(get(st, 'g'));
  const q = get(r, 'quest'), qd = dateOr(get(q, 'd'));
  if (qd && v >= 2) {
    const p = get(q, 'p'), x = int(get(q, 'x'), -1, 2, -1), qs = dailyQuests(qd, x);
    m.quest = { d: qd, p: qs.map((t, i) => (Array.isArray(p) ? int(p[i], 0, t.goal, 0) : 0)), x };
  }
  const w = get(r, 'week'), wk = dateOr(get(w, 'k'));
  if (wk && weekOf(wk) === wk) { const def = weeklyDef(wk); m.week = { k: wk, p: int(get(w, 'p'), 0, def.goal, 0) }; }

  // 12版の meta（v 1）: 格の式と解放が変わったので、格は下げず、もう開いていたものは開いたままにする（今日のおつかいは新しいものから）
  if (v === 1) {
    const oldLv = lvOnLadder(RANKS_V1, m.xp) + 1;
    const i = Math.min(oldLv, RANKS.length) - 1, top = i + 1 >= RANKS.length;
    const frac = oldLv >= RANKS_V1.length ? 0 : (m.xp - RANKS_V1[oldLv - 1]) / (RANKS_V1[oldLv] - RANKS_V1[oldLv - 1]);
    m.xp = Math.min(XP_MAX, Math.max(m.xp, RANKS[i].xp + (top ? 0 : Math.floor(frac * (RANKS[i + 1].xp - RANKS[i].xp)))));
    const had = [...V1_STARTERS.map((id) => `charm:${id}`), ...V1_RANK_UNLOCKS.filter(([lv]) => oldLv >= lv).map(([, k, id]) => `${k}:${id}`)];
    const now = new Set(UNLOCKS.filter((u) => unlockedBy(m, u)).map(keyOf));
    m.keep = UNLOCKS.map(keyOf).filter((k, j, a) => a.indexOf(k) === j && (m.keep.includes(k) || (had.includes(k) && !now.has(k))));
  }
  // 前の版から遊んでいる人（meta がまだ無いときだけ）
  if (!own(r, 'v') && isObj(legacy)) {
    const runs = int(get(legacy, 'runs'), 0, COUNT_MAX, 0);
    m.runs = Math.max(m.runs, runs);
    m.xp = Math.max(m.xp, Math.min(runs, 20) * 50);
    if (get(legacy, 'cleared') === true) m.top = Math.max(m.top, 0);
  }
  return m;
}

// summary をきれいにする（足りない所は 0 / null、知らない ID は捨てる）
function levelsOf(ch) {
  const out = {};
  if (Array.isArray(ch)) { for (const id of ch) if (CHARM_IDS.includes(id)) out[id] = Math.min(3, (out[id] || 0) + 1); } else if (isObj(ch)) {
    for (const id of CHARM_IDS) { const lv = int(get(ch, id), 0, 3, 0); if (lv) out[id] = lv; }
  }
  return out;
}
function cleanSummary(raw) {
  const r = isObj(raw) ? raw : {};
  const charms = levelsOf(get(r, 'charms'));
  const rawNights = Array.isArray(get(r, 'nights')) ? r.nights.slice(0, NIGHTS) : [];
  const nights = rawNights.map((x, i) => {
    const n = isObj(x) ? x : {};
    const st = get(n, 'stars');
    const stars = Array.isArray(st) ? st.slice(0, 3).filter(Boolean).length : int(st, 0, 3, 0);
    const tw = get(n, 'twist'), b = get(n, 'boss');
    const twist = typeof tw === 'string' && own(TWIST_BOSS, tw) ? tw : null;
    const boss = typeof b === 'string' && BOSSES.includes(b) ? b : twist ? TWIST_BOSS[twist] : null;
    const w = get(n, 'wish'), wid = get(w, 'id');
    const score = get(n, 'score'), target = get(n, 'target'), ink = get(n, 'inkFrac');
    const held = get(n, 'charms') != null ? levelsOf(get(n, 'charms')) : charms;
    return {
      i, pass: get(n, 'pass') === true, stars, allClear: get(n, 'allClear') === true,
      pops: int(get(n, 'pops'), 0, 9999, 0), total: int(get(n, 'total'), 0, 9999, 0), toriAdd: int(get(n, 'toriAdd'), 0, 99, 0),
      maxGen: int(get(n, 'maxGen'), 0, 99, 0), goldTouched: int(get(n, 'goldTouched'), 0, 99, 0), lineTouched: int(get(n, 'lineTouched'), 0, 999, 0),
      inkFrac: typeof ink === 'number' && Number.isFinite(ink) ? Math.min(1, Math.max(0, ink)) : null,
      score: typeof score === 'number' && Number.isFinite(score) ? Math.max(0, score) : 0,
      target: typeof target === 'number' && Number.isFinite(target) ? Math.max(0, target) : 0,
      twist, boss, wish: typeof wid === 'string' && WISH_IDS.includes(wid) ? wid : null, wishMet: get(w, 'met') === true,
      wishStars: get(w, 'stars') === 2 ? 2 : 1, charms: held, tags: tagsOf(held),
    };
  });
  const passed = nights.filter((n) => n.pass);
  const c = get(r, 'cleared');
  const cleared = typeof c === 'number' && Number.isFinite(c) ? int(c, 0, NIGHTS, 0) : Math.min(NIGHTS, passed.length);
  const total = get(r, 'total');
  const met = nights.filter((n) => n.wish && n.wishMet);
  // 札を決める持ち物: 八夜目に持っていたお守り（夜の charms が無いページなら、祭りの charms）
  const last = nights[NIGHTS - 1];
  const final = last && get(rawNights[NIGHTS - 1], 'charms') != null ? last.charms : charms;
  return {
    daily: get(r, 'daily') === true, level: int(get(r, 'level'), 0, MAX_LEVEL, 0), cleared,
    total: typeof total === 'number' && Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0,
    bestPops: Math.max(int(get(r, 'bestPops'), 0, 9999, 0), ...nights.map((n) => n.pops), 0),
    retries: int(get(r, 'retries'), 0, 99, null),
    nights, passed, charms, final,
    stars: Math.min(NIGHTS * 3, nights.reduce((a, n) => a + n.stars, 0)),
    wishes: Math.min(NIGHTS, met.length), wishStars: met.reduce((a, n) => a + n.wishStars, 0),
    bossWins: nights.filter((n) => n.boss && n.pass).length,
    beaten: [...new Set(nights.filter((n) => n.boss && n.pass).map((n) => n.boss))],
    pops: nights.reduce((a, n) => a + n.pops, 0),
  };
}

// ---------------------------------------------------------------- 乱数（core.js と同じ式。ここだけで閉じる）
function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
function rng32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
