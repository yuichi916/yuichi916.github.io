// 一筆花火 — 線を1本ひくと、それが導火線になる。純関数と、決定的なシミュレーションだけを置く
// （DOM・音・storage に触らない）。ページは hitofude.html、テストは tests/hitofude_core_test.mjs。
//
// 座標は W×H の論理単位。シミュレーションは 1/60 秒ずつ進め、同じ夜・同じ線なら必ず同じ結果になる
// （挑戦状と再生リンクは、これを前提にしている）。

export const W = 360;
export const H = 640;
export const DT = 1 / 60;
// ---------------------------------------------------------------- ステージ
// 八夜で1ステージ。今遊べるのはステージ1だけで、次のステージは反響を見てアップデートで足す
// （景色と仕掛けを変えて続ける）。夜ごとの仕掛け・大一番・景色は、今はステージ1のものだけを持つ
export const STAGES = [
  { id: 1, ja: '川辺の夏祭り', en: 'Riverside Festival', nights: 8, ready: true },
  { id: 2, ja: '準備中', en: 'Coming soon', nights: 8, ready: false },
];
export const STAGE = STAGES[0];
export const NIGHTS = STAGE.nights;
export function nextStage(id) { return STAGES.find((s) => s.id === id + 1) || null; }
// ステージを完走した記録: { <id>: { first: 初めて完走した日, best: 完走したときの最高点 } }（もとの記録は書き換えない）
export function recordStageClear(rec, id, total, dateKey) {
  const out = { ...(rec || {}) };
  const cur = out[id];
  out[id] = cur ? { first: cur.first, best: Math.max(cur.best || 0, total) } : { first: dateKey, best: total };
  return out;
}

// ---------------------------------------------------------------- 乱数・日付・月
export function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
export function rng32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const DAY_MS = 86400000;
function keyToUTC(key) { return Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10)); }
// お題は日本時間の 0 時で切り替わる
export function jstDateKey(date) { return new Date(date.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10); }
export const FIRST_DAY = '2026-09-26';
export function dayNumber(key) { return Math.round((keyToUTC(key) - keyToUTC(FIRST_DAY)) / DAY_MS) + 1; }
export function addDays(key, n) { return new Date(keyToUTC(key) + n * DAY_MS).toISOString().slice(0, 10); }
// その日の 21 時（日本時間）の月齢。0 = 新月、0.5 = 満月
export function moonPhase(key) {
  const jd = (keyToUTC(key) + 12 * 3600 * 1000) / DAY_MS + 2440587.5;
  const p = ((jd - 2451550.26) / 29.530588853) % 1;
  return p < 0 ? p + 1 : p;
}

// 今夜の月で、ルールが 1 つ変わる。番号は挑戦状に入るので並びを変えない
export const MOONS = [
  { id: 'shingetsu', ja: '新月', name: '闇夜', en: 'New moon', rule: '金の玉が2倍出る', ruleEn: 'Twice as many gold shells', fx: { goldDouble: true } },
  { id: 'mikazuki', ja: '三日月', name: '細い月', en: 'Crescent', rule: '千輪が3つ増える（千輪が出てくる夜から）', ruleEn: 'Three extra star shells (once they appear)', fx: { extraSenrin: 3 } },
  { id: 'jougen', ja: '上弦の月', name: '筆ののびる夜', en: 'First quarter', rule: '墨 +20%・導火線の火が届く幅 ×2', ruleEn: 'Ink +20% and fuse reach ×2', fx: { ink: 1.2, reach: 2 } },
  { id: 'juusanya', ja: '十三夜', name: '満ちてゆく月', en: 'Waxing gibbous', rule: '大玉が2倍出る（大玉が出てくる夜から）', ruleEn: 'Twice as many big shells (once they appear)', fx: { bigDouble: true } },
  { id: 'mangetsu', ja: '満月', name: '大輪の夜', en: 'Full moon', rule: '連鎖しても、玉が小さくなりにくい', ruleEn: 'Chained bursts shrink less', fx: { radius: 1.12, bloomDecay: true } },
  { id: 'nemachi', ja: '寝待月', name: '欠けてゆく月', en: 'Waning gibbous', rule: '倍率が +1 から始まる', ruleEn: 'Multiplier starts at +1', fx: { startMult: 1 } },
  { id: 'kagen', ja: '下弦の月', name: '残り火の夜', en: 'Last quarter', rule: 'ひらいた玉の 2/5 が、もう一度はじける', ruleEn: '2 in 5 bursts pop again', fx: { afterglow: 0.4 } },
  { id: 'ariake', ja: '有明の月', name: '明け方の月', en: 'Waning crescent', rule: '墨（線の長さ）+25%', ruleEn: 'Ink +25%', fx: { ink: 1.25 } },
];
export function moonIndex(phase) { return Math.floor(((phase + 1 / 16) % 1) * 8) % 8; }

// ---------------------------------------------------------------- 花火玉とお守り
export const SHELLS = {
  kiku: { r: 9, R: 50, pts: 10 },      // 菊: ふつうの玉
  ootama: { r: 14, R: 80, pts: 30 },   // 大玉: 大きくひらく
  kin: { r: 8, R: 40, pts: 5 },        // 金: 倍率 +1
  senrin: { r: 10, R: 30, pts: 15 },   // 千輪: 火花をまっすぐ飛ばす
  chouchin: { r: 11, R: 40, pts: 10 }, // 提灯: 灯ったあとの玉は点が 2 倍
  shime: { r: 10, R: 50, pts: 25 },    // 湿った玉: 線の火が触れるとひらく。爆発だけなら、別々の火が 2 回いる
  shaku: { r: 22, R: 170, pts: 200 },  // 尺玉（大トリ）: 線の火でしかひらかない。先にひらいた玉が多いほど倍率が上がる（+1〜+13）
  kuro: { r: 12, R: 120, pts: 60 },    // 黒玉（花火合戦のお邪魔玉）: 最初に届いた線の火を消し、別の線の火が届くと大爆発。倍率 +1
};
export const TYPES = ['kiku', 'ootama', 'kin', 'senrin', 'chouchin', 'shime', 'shaku'];

// 夜ごとに 1 つずつ増える仕掛け（一度に覚えることは 1 つだけ）
// say / sayEn は、その夜にマスコットのヒノコがひとことで知らせる言葉（15 字まで）
export const GIMMICKS = [
  { id: 'ootama', night: 1, ja: '大玉', en: 'Big shell', desc: '大きくひらく。群れのまん中にあると一気に広がる', descEn: 'A huge burst. In the middle of a cluster, it takes everything', say: '大玉は、ドカンと広いよ！', sayEn: 'Big shells blast wide!' },
  { id: 'senrin', night: 2, ja: '千輪', en: 'Star shell', desc: '火花がまっすぐ飛んで、離れた玉にも届く', descEn: 'Fires sparks in straight lines that reach far shells', say: '千輪の火花は遠くまで！', sayEn: 'Star sparks fly far!' },
  { id: 'chouchin', night: 3, ja: '提灯', en: 'Lantern', desc: '灯ったあとにひらく玉は、点が2倍。線は提灯から引きはじめよう', descEn: 'Every burst after it lights scores ×2. Start your line at the lantern', say: '提灯から引くと点が2倍！', sayEn: 'Start at the lantern: 2×!' },
  { id: 'kumo', night: 4, ja: '雲', en: 'Cloud', desc: '火は雲を通らない。線は雲をよけて引く', descEn: 'Fire can\'t pass through clouds. Draw around them', say: '雲の中は通れないよ…', sayEn: 'Fire can\'t cross clouds' },
  { id: 'shime', night: 5, ja: '湿った玉', en: 'Damp shell', desc: '線でなぞるとひらく。爆発だけなら、別々の火が2回いる。点は高い', descEn: 'Your line opens it. Bursts alone need two separate hits. Worth more', say: '湿った玉は線でなぞって！', sayEn: 'Trace damp ones!' },
  { id: 'nawa', night: 6, ja: '仕掛け縄', en: 'Fuse rope', desc: '火が届くと、縄を走って遠くの玉まで燃え広がる', descEn: 'Once lit, fire races along the rope to far shells', say: '縄に火がつくと遠くまで！', sayEn: 'Light the rope, go far!' },
  { id: 'shaku', night: 7, ja: '尺玉', en: 'Grand shell', desc: '線の火でしかひらかない。先にひらいた玉が多いほど、倍率が上がる（最大 +13）', descEn: 'Only your line lights it. The more already open, the bigger the mult (up to +13)', say: '尺玉は線の最後に！', sayEn: 'End your line on it!' },
];
export function gimmickFor(night) { return GIMMICKS.find((g) => g.night === night) || null; }

// ---- お守り（12版）
// 同じお守りをもう一度取ると Lv が上がる（Lv1 → Lv2 → Lv3）。持ち物は id の配列で、重なった数が Lv
// （['kinun', 'kinun', 'kodou'] = 金運 Lv2 + 鼓動 Lv1。並びは関係ない）。一度に持てるのは SLOTS 種類まで（段位で減る）。
// 点 = 点の合計（C: 足す）× 倍率（M: 足す）× 掛け算の倍率（X: 掛ける）。result.parts に、どこから来たかを分けて入れる。
// 型（tags）は、組み合わせると伸びるまとまり: 金 gold / 提灯 lantern / 連鎖 chain / 墨 ink / 大トリ finale / 届く reach / 仕掛け gimmick / 賭け risk
//
//  お守り      珍しさ     型            Lv1 / Lv2 / Lv3                                                    効く所
//  長い筆      ふつう     届く・墨      墨 +50% / +80% / +110%                                              線
//  残り墨      ふつう     墨            墨を1割残すごとに 倍率 +1 / +2 / +3                                 M
//  大輪        ふつう     連鎖・届く    減衰 0.95 / 0.97 / 0.98（満月と重なると、もう 1 段ゆるい。0.985 まで）・大きさ +5% / +10% / +15%  連鎖
//  金運        ふつう     金            金の玉 1 つで 倍率 +2 / +3 / +4（ふだんは +1）                       M
//  遅火        ふつう     大トリ        導火線 0.6 倍の速さ・倍率 +2 / +4 / +6 から（大トリの割合も上がる）  M
//  一番星      ふつう     金            線でじかにふれた金は さらに +2 / +4 / +6                             M
//  終わり玉    ふつう     大トリ・届く  線の終わりが爆ぜる 大きさ 120 / 145 / 170・大トリ +1 / +3 / +5        届く・M
//  鼓動        ふつう     連鎖          連鎖でひらいた玉 5 / 4 / 3 個ごとに 倍率 +1（ふだんは、どの玉も 10 個ごと） M
//  満開の加護  めずらしい 大トリ        8割5分 / 8割 / 7割5分ひらけば ×1.5 / ×1.75 / ×2（全部なら満開の ×2 も）  X
//  増し玉      ふつう     届く・連鎖    玉が 4 / 7 / 10 個増える                                             C
//  二筆目      めずらしい 届く          6割 / 5割 / 4割ひらいたら、もう1本（墨 1/3 / 2/5 / 1/2）              届く
//  残り火      ふつう     連鎖          ひらいた玉の 3割 / 4割 / 半分がもう一度はじける                       C
//  提灯職人    ふつう     提灯          提灯ひとつで点 ×2.5 / ×3 / ×3.5（ふだんは ×2）                       C
//  雨よけ      ふつう     仕掛け        湿った玉がふつうの玉に。点 ×1.5 / ×2・1 つで倍率 +1 / ×2.5・倍率 +1  C・M
//  風切り      ふつう     仕掛け        雲が 1/2 / 1/4 / 消える・その夜の雲 1 つにつき 倍率 +1 / +2 / +3      M
//  招き猫      めずらしい 金            金の玉がひらくたびに ×1.15 / ×1.2 / ×1.25（重なる）・Lv3 は金の玉 +1   X
//  花筏        めずらしい 提灯          提灯がひとつ灯るたびに 倍率 +2 / +4 / +7                             M
//  連獅子      めずらしい 連鎖          連鎖の深さ（代）1 つごとに ×0.06 / ×0.1 / ×0.15 上がる                X
//  墨流し      めずらしい 墨            墨を1割残すごとに 点 +12% / +20% / +30%                              C
//  線香花火    めずらしい 賭け・墨      墨 −30%。そのかわり ×1.5 / ×1.75 / ×2                                X
//  天狗の団扇  伝説       届く・賭け    線がまっすぐなほど ×1.6 / ×1.9 / ×2.3 まで                           X
//  狸の葉っぱ  伝説       届く          線の前の 半分 / 3/4 / 全部 が、左右の反対側にも映って燃える（墨はいらない） 届く
//  狐火        伝説       届く・連鎖    はじめにひらいた 4 / 6 / 8 つの玉から、狐火が遠くの群れへ飛ぶ         届く
//  鎌鼬の爪    伝説       賭け          導火線 1.6 倍の速さ・連鎖が少し小さくなる（減衰 −0.04）。×1.4 / ×1.6 / ×1.8   X
//
// 組み合わせの例: 金（金運 + 一番星 + 招き猫）・提灯（提灯職人 + 花筏）・連鎖（大輪 + 鼓動 + 残り火 + 連獅子）・
// 墨（長い筆 + 残り墨 + 墨流し、線香花火は墨を減らすので取り合い）・大トリ（終わり玉 + 遅火 + 満開の加護）。
// 鎌鼬は連鎖と相性が悪く、遅火とは速さを打ち消しあう。数字は _dev/hitofude-skill.mjs charms で測って決めた
//
// 番号は再生リンクに入る（お守りごとに Lv の 2 ビット）。並びを変えたり足したりしたら REPLAY_VERSION を上げる
// kind は候補の出し方に使う: mult = 倍率を伸ばす / reach = 届く玉を増やす / gimmick = 仕掛けへの備え
const charm = (id, emoji, kind, rarity, tags, ja, en, lv, lvEn, extra = {}) => ({ id, emoji, kind, rarity, tags, ja, en, desc: lv[0], descEn: lvEn[0], lv, lvEn, ...extra });
export const CHARMS = [
  charm('nagafude', '🖌️', 'reach', 'common', ['reach', 'ink'], '長い筆', 'Long brush',
    ['墨（線の長さ）+50%', '墨 +80%', '墨 +110%'], ['Ink +50%', 'Ink +80%', 'Ink +110%']),
  charm('nokorizumi', '🖋️', 'mult', 'common', ['ink'], '残り墨', 'Spare ink',
    ['墨を1割残すごとに、倍率 +1', '墨を1割残すごとに、倍率 +2', '墨を1割残すごとに、倍率 +3'], ['+1 mult for every 10% of ink left unused', '+2 mult for every 10% of ink left', '+3 mult for every 10% of ink left']),
  charm('tairin', '🌸', 'reach', 'common', ['chain', 'reach'], '大輪', 'Big bloom',
    ['連鎖しても、玉が小さくなりにくい。ひらく大きさ +5%', '連鎖しても、もっと小さくなりにくい。大きさ +10%', '連鎖しても、ほとんど小さくならない。大きさ +15%'], ['Chained bursts shrink less. Bursts +5% bigger', 'Chained bursts shrink much less. +10% bigger', 'Chained bursts barely shrink. +15% bigger']),
  charm('kinun', '💰', 'mult', 'common', ['gold'], '金運', 'Gold luck',
    ['金の玉は倍率 +2（ふだんは +1）', '金の玉は倍率 +3', '金の玉は倍率 +4'], ['Gold shells give +2 mult (not +1)', 'Gold shells give +3 mult', 'Gold shells give +4 mult']),
  charm('osobi', '🐌', 'mult', 'common', ['finale'], '遅火', 'Slow fuse',
    ['導火線がゆっくり燃える。倍率は +2 から', '導火線がゆっくり燃える。倍率は +4 から', '導火線がゆっくり燃える。倍率は +6 から'], ['The fuse burns slower. Mult starts at +2', 'Slower fuse. Mult starts at +4', 'Slower fuse. Mult starts at +6']),
  charm('ichibanboshi', '🌟', 'mult', 'common', ['gold'], '一番星', 'First star',
    ['線で直接ふれた金の玉は、さらに倍率 +2', '線で直接ふれた金の玉は、さらに倍率 +4', '線で直接ふれた金の玉は、さらに倍率 +6'], ['Gold shells your line touches give +2 more mult', 'Line-touched gold gives +4 more mult', 'Line-touched gold gives +6 more mult']),
  charm('owaridama', '💣', 'reach', 'common', ['finale', 'reach'], '終わり玉', 'Finale',
    ['線の終わりが、ひと息おいて大きく爆ぜる。尺玉にも火がつき、大トリの倍率 +1', '線の終わりが、もっと大きく爆ぜる。大トリの倍率 +3', '線の終わりが、とても大きく爆ぜる。大トリの倍率 +5'], ['Your line\'s end blasts big a beat later. It can light the grand shell (finale +1 mult)', 'A bigger end blast. Grand finale +3 mult', 'A huge end blast. Grand finale +5 mult']),
  charm('kodou', '🥁', 'mult', 'common', ['chain'], '鼓動', 'Heartbeat',
    ['連鎖でひらいた玉 5 つごとに倍率 +1（ふだんは、どの玉も 10 個ごと）', '連鎖でひらいた玉 4 つごとに倍率 +1', '連鎖でひらいた玉 3 つごとに倍率 +1'], ['+1 mult per 5 chained bursts (not per 10 of any)', '+1 mult per 4 chained bursts', '+1 mult per 3 chained bursts']),
  charm('mankai', '🌕', 'mult', 'rare', ['finale'], '満開の加護', 'Full bloom',
    ['8割5分ひらけば ×1.5（全部なら、満開の ×2 とあわせて ×3）', '8割ひらけば ×1.75', '7割5分ひらけば ×2'], ['Open 85% of the sky for ×1.5 (×3 with a full bloom)', 'Open 80% for ×1.75', 'Open 75% for ×2']),
  charm('mashidama', '🎇', 'reach', 'common', ['reach', 'chain'], '増し玉', 'More shells',
    ['夜ごとに花火玉が 4 つ増える', '夜ごとに花火玉が 7 つ増える', '夜ごとに花火玉が 10 個増える'], ['+4 shells every night', '+7 shells every night', '+10 shells every night']),
  charm('nihitsu', '✌️', 'reach', 'rare', ['reach'], '二筆目', 'Second stroke',
    ['6割ひらいたら、もう1本（墨は 1/3）', '5割ひらいたら、もう1本（墨は 2/5）', '4割ひらいたら、もう1本（墨は 1/2）'], ['Burst 60% of the sky to draw again (1/3 ink)', 'Burst 50% to draw again (2/5 ink)', 'Burst 40% to draw again (1/2 ink)']),
  charm('nokoribi', '🔥', 'reach', 'common', ['chain'], '残り火', 'Embers',
    ['ひらいた玉の 3 割が、もう一度はじける', 'ひらいた玉の 4 割が、もう一度はじける', 'ひらいた玉の半分が、もう一度はじける'], ['30% of bursts pop again', '40% of bursts pop again', 'Half of all bursts pop again']),
  charm('chouchinshi', '🏮', 'mult', 'common', ['lantern'], '提灯職人', 'Lantern maker',
    ['提灯ひとつで点が 2.5 倍（ふだんは 2 倍）', '提灯ひとつで点が 3 倍', '提灯ひとつで点が 3.5 倍'], ['Each lantern makes points ×2.5 (not ×2)', 'Each lantern makes points ×3', 'Each lantern makes points ×3.5']),
  charm('amayoke', '☂️', 'gimmick', 'common', ['gimmick'], '雨よけ', 'Umbrella',
    ['湿った玉が、ふつうの玉になり、点が 1.5 倍', '湿った玉がふつうの玉になり、点が 2 倍。ひとつで倍率 +1', '湿った玉がふつうの玉になり、点が 2.5 倍。ひとつで倍率 +1'], ['Damp shells act like normal ones and score ×1.5', 'Damp shells act normal, score ×2 and give +1 mult each', 'Damp shells act normal, score ×2.5 and give +1 mult each']),
  charm('kazekiri', '🌬️', 'gimmick', 'common', ['gimmick'], '風切り', 'Wind cutter',
    ['雲が半分の大きさになる。雲ひとつにつき倍率 +1', '雲が 1/4 の大きさになる。雲ひとつにつき倍率 +2', '雲が消える。雲ひとつにつき倍率 +3'], ['Clouds shrink to half. +1 mult per cloud', 'Clouds shrink to a quarter. +2 mult per cloud', 'Clouds vanish. +3 mult per cloud']),
  charm('maneki', '🐱', 'mult', 'rare', ['gold'], '招き猫', 'Lucky cat',
    ['金の玉がひらくたびに ×1.15（ひらくほど重なる）', '金の玉がひらくたびに ×1.2', '金の玉がひらくたびに ×1.25。金の玉が 1 つ増える'], ['×1.15 for every gold shell opened (it stacks)', '×1.2 per gold shell opened', '×1.25 per gold shell. +1 gold shell']),
  charm('hanaikada', '🛶', 'mult', 'rare', ['lantern'], '花筏', 'Petal raft',
    ['提灯がひとつ灯るたびに、倍率 +2', '提灯がひとつ灯るたびに、倍率 +4', '提灯がひとつ灯るたびに、倍率 +7'], ['+2 mult for each lantern lit', '+4 mult for each lantern lit', '+7 mult for each lantern lit']),
  charm('renjishi', '🦁', 'mult', 'rare', ['chain'], '連獅子', 'Lion dance',
    ['連鎖が深いほど強い。深さ（代）1 つごとに ×0.06 ずつ', '連鎖の深さ 1 つごとに ×0.1 ずつ', '連鎖の深さ 1 つごとに ×0.15 ずつ'], ['Deeper chains score more: +×0.06 per generation', '+×0.1 per chain generation', '+×0.15 per chain generation']),
  charm('suminagashi', '🌀', 'mult', 'rare', ['ink'], '墨流し', 'Ink marbling',
    ['墨を1割残すごとに、点 +12%', '墨を1割残すごとに、点 +20%', '墨を1割残すごとに、点 +30%'], ['+12% points for every 10% of ink left', '+20% points per 10% ink left', '+30% points per 10% ink left']),
  charm('senkou', '✨', 'mult', 'rare', ['risk', 'ink'], '線香花火', 'Sparkler',
    ['墨が 3 割へる。そのかわり ×1.5', '墨が 3 割へる。そのかわり ×1.75', '墨が 3 割へる。そのかわり ×2'], ['30% less ink, but ×1.5', '30% less ink, but ×1.75', '30% less ink, but ×2']),
  charm('tengu', '👺', 'mult', 'legend', ['reach', 'risk'], '天狗の団扇', 'Tengu fan',
    ['線がまっすぐなほど強い（まっすぐなら ×1.6）', '線がまっすぐなほど強い（まっすぐなら ×1.9）', '線がまっすぐなほど強い（まっすぐなら ×2.3）'], ['The straighter your line, the stronger (straight: ×1.6)', 'Straight line: ×1.9', 'Straight line: ×2.3'], { boss: 'massugu' }),
  charm('tanuki', '🍃', 'reach', 'legend', ['reach'], '狸の葉っぱ', 'Tanuki leaf',
    ['線の前の半分が、左右の反対側にも映って燃える（墨はいらない）', '線の前の 4 分の 3 が、反対側にも映って燃える', '線がまるごと、反対側にも映って燃える'], ['The first half of your line is mirrored to the other side for free', 'The first 3/4 of your line is mirrored', 'Your whole line is mirrored'], { boss: 'kagami' }),
  charm('kitsune', '🦊', 'reach', 'legend', ['reach', 'chain'], '狐火', 'Foxfire',
    ['はじめにひらいた 4 つの玉から、狐火が遠くの群れへ飛ぶ', 'はじめの 6 つから、狐火が飛ぶ', 'はじめの 8 つから、狐火が飛ぶ'], ['Your first 4 bursts send foxfires to far clusters', 'Your first 6 bursts send foxfires', 'Your first 8 bursts send foxfires'], { boss: 'yamiyo' }),
  charm('kamaitachi', '🌪️', 'mult', 'legend', ['risk'], '鎌鼬の爪', 'Kamaitachi claw',
    ['導火線が速く、連鎖が少し小さくなる。そのかわり ×1.4', '導火線が速く、連鎖が少し小さくなる。×1.6', '導火線が速く、連鎖が少し小さくなる。×1.8'], ['Faster fuse, slightly smaller chains, but ×1.4', 'Faster fuse, smaller chains. ×1.6', 'Faster fuse, smaller chains. ×1.8'], { boss: 'isshun' }),
];
export const SLOTS = 5;     // 一度に持てるお守りの種類（段位 8 は 4）
export const MAX_LV = 3;    // 同じお守りは Lv3 まで
export const RARITIES = ['common', 'rare', 'legend'];
export const TAGS = ['gold', 'lantern', 'chain', 'ink', 'finale', 'reach', 'gimmick', 'risk'];
// 伝説のお守りは、その大一番の妖怪にはじめて勝つと、候補に出るようになる（opts.pool に入れる）
export const LEGEND_OF = { massugu: 'tengu', kagami: 'tanuki', yamiyo: 'kitsune', isshun: 'kamaitachi' };
// 仕掛けが出てくる前には候補に出さない（見たことのないものは選べない）。値は、その仕掛けが出てくる夜（0 始まり）
export const CHARM_NEEDS = { chouchinshi: 3, hanaikada: 3, kazekiri: 4, amayoke: 5 };
export const CHARM_IDS = CHARMS.map((c) => c.id);
// 入れかえる前のお守り。もう候補に出ず、ルールにも効かない。前の日の記録（お守りの並び）を表示するためだけに名前を残す
export const LEGACY_CHARMS = [
  { id: 'futofude', emoji: '🪶', kind: 'reach', legacy: true, ja: '太い筆', en: 'Thick brush', desc: '導火線の火が届く幅 ×2（いまは無いお守り）', descEn: 'Fuse reach ×2 (retired)' },
  { id: 'senrin', emoji: '💫', kind: 'reach', legacy: true, ja: '千輪', en: 'Thousand stars', desc: '千輪の火花が 10 本に（いまは無いお守り）', descEn: 'Star shells fire 10 sparks (retired)' },
  { id: 'orebi', emoji: '⚡', kind: 'reach', legacy: true, ja: '折れ火', en: 'Sharp turns', desc: '線の鋭い曲がり角が爆ぜる（いまは無いお守り）', descEn: 'Sharp corners explode (retired)' },
];
// 持ち物（id の配列。重なりが Lv）→ { id: Lv }。知らない id は数えず、Lv は MAX_LV まで
export function charmLevels(charms) {
  const out = {};
  for (const id of charms || []) if (CHARM_IDS.includes(id)) out[id] = Math.min(MAX_LV, (out[id] || 0) + 1);
  return out;
}
// { id: Lv } → id の配列（CHARM_IDS の並び）
export function charmList(levels) {
  const out = [];
  for (const id of CHARM_IDS) for (let k = 0; k < Math.min(MAX_LV, levels[id] || 0); k++) out.push(id);
  return out;
}
// 候補の id を選んだらどうなるか: 'up'（Lv が上がる）/ 'new'（空いた枠に入る）/ 'swap'（枠がいっぱい。1 つ手放す）/ 'max'（もう Lv3）
export function pickKind(held, id, slots = SLOTS) {
  const lv = charmLevels(held);
  if (lv[id]) return lv[id] >= MAX_LV ? 'max' : 'up';
  return Object.keys(lv).length < slots ? 'new' : 'swap';
}
// 選んだあとの持ち物（drop は手放すお守り。Lv ごと手放す）。並びは CHARM_IDS の順にそろえる
export function pickCharm(held, id, drop = null) {
  const lv = charmLevels(held);
  if (drop) delete lv[drop];
  if (CHARM_IDS.includes(id)) lv[id] = Math.min(MAX_LV, (lv[id] || 0) + 1);
  return charmList(lv);
}
export function charmById(id) { return CHARMS.find((c) => c.id === id) || LEGACY_CHARMS.find((c) => c.id === id) || null; }

export const BASE_INK = 460;
export const BASE_REACH = 7;
// 夜ごとの目標点は、その夜の「基準点」× 夜ごとの倍率で決める。
// 基準点（parScore）は、お守りなし・墨壺なしで、決まった手順の線を何本か試したうちのいちばん良い点。
// 並び方の運で「どう引いても届かない夜」が出ないように、夜ごとに測る。倍率は _dev/hitofude-skill.mjs で、
// 腕前の違うボット（落書き / 提灯から近い順に 3 本 / 山登り）を回して決めた（はじめの 9 つのお守りを、5 つの枠で集める）:
// 落書きは 2 割ほど、提灯から引く人は 8 割ほど、山登りはほぼ全部が越える。一夜目は、はじめての人の 1 本（近い順につなぐだけ）でも 8 割が越える。
// 予備の提灯 1 つで八夜を通せるのは、考えて引く人の半分ほど。倍率が 1 を超えるのは、それまでに集めたお守りの分（お守りは基準点に入れない）
export const TARGET_RATIO = [0.28, 0.52, 0.86, 1.2, 1.48, 2.38, 2.85, 3.1];
// 目安（基準点を測らない所で使う。テストと古いメモ用。いろいろな夜の目標点の中央値）
export const TARGETS = [160, 330, 660, 2600, 4400, 5800, 25000, 53000];
export const BASE_COUNTS = [16, 20, 24, 28, 32, 36, 40, 44];

// ---------------------------------------------------------------- 段位（何周も遊ぶ人のための、むずかしさの段）
// 段位 n は、1〜n の決まりが全部重なる。fx は重なったあとの値（ページは LEVELS[n].fx を読む）。
//  target: 目標点の倍率 / price: 屋台の値段に足す ★ / spare: はじめに持つ予備の提灯 / clouds: 二夜目から雲（並びも変わる）/
//  decay: 連鎖の減衰から引く値 / offer: お守りの候補の数 / slots: お守りの枠 / star2: ★★ に要る目標の倍数
// core が使うのは target・clouds・decay（newRound・targetFor に level を渡す）と、offer（offerCharms の数）。ほかはページが読む
const LEVEL_ADD = [
  { ja: 'ふつう', en: 'Normal', rule: 'いつもの夜', ruleEn: 'The usual nights', add: {} },
  { ja: '初段', en: 'Stake 1', rule: '目標 +10%', ruleEn: 'Targets +10%', add: { target: 1.1 } },
  { ja: '二段', en: 'Stake 2', rule: '屋台の値段 +1', ruleEn: 'Stall prices +1', add: { price: 1 } },
  { ja: '三段', en: 'Stake 3', rule: '予備の提灯なしで始まる', ruleEn: 'Start without a spare lantern', add: { spare: 0 } },
  { ja: '四段', en: 'Stake 4', rule: '二夜目から雲が出る', ruleEn: 'Clouds from night 2', add: { clouds: true } },
  { ja: '五段', en: 'Stake 5', rule: '連鎖が小さくなりやすい', ruleEn: 'Chains shrink faster', add: { decay: 0.03 } },
  { ja: '六段', en: 'Stake 6', rule: 'お守りの候補が 2 つ', ruleEn: 'Only 2 charms to choose from', add: { offer: 2 } },
  { ja: '七段', en: 'Stake 7', rule: '目標さらに +15%', ruleEn: 'Targets +15% more', add: { target: 1.15 } },
  { ja: '八段', en: 'Stake 8', rule: 'お守りの枠が 4 つ・★★ は目標の 4 倍', ruleEn: '4 charm slots; ★★ needs 4× the target', add: { slots: 4, star2: 4 } },
];
export const LEVELS = [];
{
  let fx = { target: 1, price: 0, spare: 1, clouds: false, decay: 0, offer: 3, slots: SLOTS, star2: 3 };
  LEVEL_ADD.forEach((L, n) => {
    const a = L.add;
    fx = { ...fx, ...a, target: fx.target * (a.target || 1), price: fx.price + (a.price || 0), decay: fx.decay + (a.decay || 0) };
    LEVELS.push({ id: `dan${n}`, n, ja: L.ja, en: L.en, rule: L.rule, ruleEn: L.ruleEn, fx: Object.freeze({ ...fx }) });
  });
}
export const MAX_LEVEL = LEVELS.length - 1;
export function levelFx(level = 0) { return LEVELS[Math.max(0, Math.min(MAX_LEVEL, Math.floor(+level || 0)))].fx; }
export function slotsFor(level = 0) { return levelFx(level).slots; }

// ---------------------------------------------------------------- 大一番（三夜目と六夜目）
// その夜だけ、線の引き方が変わる。シードで決まるので、「今夜の一筆」ではみんな同じ大一番になる。
// まっすぐ・鏡は線そのものを変える（ここで扱う）。闇夜・一瞬は見え方と時間だけを変える（ページで扱う）
export const BOSS_NIGHTS = [2, 5];
export const TWISTS = [
  { id: 'massugu', ja: 'まっすぐ', en: 'Straight', say: '今夜の線は、まっすぐ！', sayEn: 'Straight lines only!', rule: '指を離した所まで、直線になる', ruleEn: 'Your line snaps straight', desc: '線は、引きはじめと指を離した所を結ぶ直線になる', descEn: 'Your line becomes a straight segment from start to release', target: 0.85 },
  { id: 'kagami', ja: '鏡', en: 'Mirror', say: '線が左右に映るよ！', sayEn: 'Your line is mirrored!', rule: '線が、まん中の線で左右に映る', ruleEn: 'Your line is copied to the other side', desc: '線が左右に映って 2 本になる（墨は 3/4）', descEn: 'Your line is mirrored left and right (3/4 ink)', target: 1 },
  { id: 'yamiyo', ja: '闇夜', en: 'Dark night', say: 'よく見て、覚えて！', sayEn: 'Look now, remember later!', rule: '玉は 5 秒でうすくなる', ruleEn: 'Shells fade after 5 seconds', desc: '玉がはっきり見えるのは、はじめの 5 秒だけ（あとはうっすら）', descEn: 'Shells are clear for 5 seconds, then only faint', target: 0.85 },
  { id: 'isshun', ja: '一瞬', en: 'Snap', say: '4秒で引き切って！', sayEn: 'Draw it in 4 seconds!', rule: '指を置いてから 4 秒で線が終わる', ruleEn: 'Your line ends 4 s after touching', desc: '指を置いてから 4 秒で、線は勝手に終わる', descEn: 'Your line ends 4 s after you touch down', target: 0.9 },
];
export const SNAP_SECONDS = 4;
export const DARK_SECONDS = 5;
export const MIRROR_INK = 0.75;
function shuffled(arr, rng) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export function twistFor(seed, night) {
  const k = BOSS_NIGHTS.indexOf(night);
  if (k < 0) return null;
  return shuffled(TWISTS, rng32(hashStr(`hitofude-boss:${seed >>> 0}`)))[k];
}
export function isBoss(night) { return BOSS_NIGHTS.includes(night); }
// その夜の目標点。基準点 × 倍率（大一番は、闇夜・一瞬のように人にだけ効く難しさの分を下げる）× 段位。見やすいよう上 2 桁に丸める。
// 段位 4 から二夜目にも雲が出て並びが変わるので、基準点はその並びで測る（減衰の強さは基準点に入れない）
export function targetFor(seed, night, moon = 4, level = 0) {
  const tw = twistFor(seed, night);
  const t = parScore(seed, night, moon, level) * TARGET_RATIO[night] * (tw ? tw.target : 1) * levelFx(level).target;
  return Math.max(30, round2(t));
}
function round2(v) { const d = 10 ** Math.max(1, Math.floor(Math.log10(Math.max(1, v))) - 1); return Math.round(v / d) * d; }

// ---------------------------------------------------------------- 夜の景色（三夜目から）
// 玉の群れの並び方。夜ごとに変わり、同じ景色は続かない。八夜目は、尺玉を囲む輪
export const SCENES = [
  { id: 'mure', ja: '群れ', en: 'Clusters' },
  { id: 'kawa', ja: '天の川', en: 'River' },
  { id: 'wa', ja: '輪', en: 'Ring' },
  { id: 'yatai', ja: '屋台の列', en: 'Stalls' },
];
export function sceneFor(seed, night) {
  if (night < 2) return SCENES[0];
  if (night === NIGHTS - 1) return SCENES[2];
  const prev = night > 2 ? sceneFor(seed, night - 1).id : 'mure';
  const pool = SCENES.filter((sc) => sc.id !== prev && !(night === NIGHTS - 2 && sc.id === 'wa'));
  return pool[Math.floor(rng32(nightSeed(seed, night) ^ 0x5ce9e)() * pool.length)];
}

// 連鎖の減衰（ひとりの夜だけ）。導火線でひらいた玉が 0 代目、その爆発・火花でひらいた玉が 1 代目…と数え、
// ひらく大きさは R × max(DECAY_MIN, 減衰^代)。大輪（Lv）と満月は減衰をゆるめる段を足し、SOFT_DECAYS[段] になる。
// 段位 5 と鎌鼬は、そこから引く。
// 下限は、菊の火が玉どうしの最小の間（MIN_GAP）に届かない大きさにする（下限が大きいと、密な群れでは連鎖がいつまでも続く）
export const DECAY = 0.85;
export const DECAY_SOFT = 0.95;
export const DECAY_SOFTER = 0.97;
export const SOFT_DECAYS = [DECAY, DECAY_SOFT, DECAY_SOFTER, 0.98, 0.985];
export const DECAY_MIN = 0.3;
// 尺玉（大トリ）: ひらいた瞬間に、ほかの玉がひらいていた割合 share で、倍率 +round(1 + TORI_BONUS × share²)（+1〜+13）。
// 2 乗にしたのは、たまたま途中で尺玉を通った線（落書き）より、ほとんどひらいてから最後に尺玉へ来る線を、ずっと得にするため
// （share 0.5 で +4、0.9 で +11）。前の版は TORI_BONUS × share（10 で +1〜+11）
export const TORI_BONUS = 12;
export const TORI_R = 60;            // ひとりの夜の尺玉がひらく大きさ（花火合戦は SHELLS.shaku.R のまま）
export const DAMP_HITS = 2;          // 湿った玉を爆発だけでひらくのに要る、別々の火の数
// お守りの Lv1 の数字（前の版からの名前。Lv ごとの数字は CHARM_LV）
export const OWARI_DELAY = 0.6;      // 終わり玉: 線の終わりに火が届いてから爆ぜるまで（秒）
export const OWARI_R = 120;          // 終わり玉の大きさ（Lv1）
export const NIHITSU_SHARE = 0.6;    // 二筆目: この割合の玉がひらいていれば、もう1本
export const NIHITSU_INK = 1 / 3;    // 二筆目の墨（1 本目の基本の墨に対して）
export const SLOW_FUSE = 0.6;        // 遅火: 導火線の速さ
export const SLOW_MULT = 2;          // 遅火: 倍率の足し分
export const SPARE_STEP = 0.1;       // 残り墨・墨流し: 墨をこの割合残すごとに 1 段
export const MASHI_N = 4;            // 増し玉: 足す玉の数
export const MAKER_GAIN = 1.5;       // 提灯職人: 提灯ひとつで増える点の倍率（ふだんは 1）
export const KINUN_GOLD = 2;         // 金運: 金の玉ひとつの倍率（ふだんは 1）
export const STAR_GOLD = 2;          // 一番星: 線で直接ひらいた金の玉に、さらに足す倍率（Lv1）
export const BLOOM = 2;              // 満開（全部ひらいた）の掛け算
export const BLOOM_CHARM = 3;        // 満開の加護 Lv1 で全部ひらいたときの掛け算（満開 ×2 × 加護 ×1.5）
export const KAZE_SCALE = 0.5;       // 風切り: 雲の半径の倍率
export const KODOU_STEP = 5;         // 鼓動: 連鎖でひらいた玉この数ごとに倍率 +1（Lv1。ふだんは、どの玉も 10 個ごと）
export const FOX_DELAY = 0.5;        // 狐火: 飛んでから届くまで（秒）
export const FOX_MIN = 120;          // 狐火: これより遠い玉へ飛ぶ
export const FOX_NEAR = 70;          // 狐火: 飛ぶ先は、この距離の中にまだひらいていない玉がいちばん多い所
// Lv ごとの数字（[Lv1, Lv2, Lv3]）。意味は CHARMS の上の表
export const CHARM_LV = {
  nagafude: { ink: [1.5, 1.8, 2.1] },
  nokorizumi: { mult: [1, 2, 3] },
  tairin: { soft: [1, 2, 3], size: [1.05, 1.1, 1.15] },
  kinun: { gold: [2, 3, 4] },
  osobi: { mult: [2, 4, 6] },
  ichibanboshi: { gold: [2, 4, 6] },
  owaridama: { R: [120, 145, 170], tori: [1, 3, 5] },
  kodou: { step: [5, 4, 3] },
  mankai: { share: [0.85, 0.8, 0.75], x: [1.5, 1.75, 2] },
  mashidama: { n: [4, 7, 10] },
  nihitsu: { share: [0.6, 0.5, 0.4], ink: [1 / 3, 0.4, 0.5] },
  nokoribi: { p: [0.3, 0.4, 0.5] },
  chouchinshi: { gain: [1.5, 2, 2.5] },
  amayoke: { pts: [1.5, 2, 2.5], mult: [0, 1, 1] },
  kazekiri: { scale: [0.5, 0.25, 0], mult: [1, 2, 3] },
  maneki: { x: [1.15, 1.2, 1.25], gold: [0, 0, 1] },
  hanaikada: { mult: [2, 4, 7] },
  renjishi: { x: [0.06, 0.1, 0.15] },
  suminagashi: { pct: [0.12, 0.2, 0.3] },
  senkou: { ink: [0.7, 0.7, 0.7], x: [1.5, 1.75, 2] },
  tengu: { x: [1.6, 1.9, 2.3] },
  tanuki: { part: [0.5, 0.75, 1] },
  kitsune: { n: [4, 6, 8] },
  kamaitachi: { speed: [1.6, 1.6, 1.6], decay: [0.04, 0.04, 0.04], x: [1.4, 1.6, 1.8] },
};

// お守り（Lv つき）と今夜の月と段位を合わせた、この夜のルール（花火合戦はお守りなし・段位なしで、月だけ）
export function rulesFor(charms, moonIdx, level = 0) {
  const lv = charmLevels(charms);
  const L = (id, key, none) => (lv[id] ? CHARM_LV[id][key][lv[id] - 1] : none);
  const m = (MOONS[moonIdx] || MOONS[4]).fx;
  const soft = Math.min(SOFT_DECAYS.length - 1, (lv.tairin || 0) + (m.bloomDecay ? 1 : 0));
  const harsh = levelFx(level).decay + L('kamaitachi', 'decay', 0);
  return {
    ink: Math.round(BASE_INK * L('nagafude', 'ink', 1) * (m.ink || 1) * L('senkou', 'ink', 1)),
    reach: BASE_REACH * (m.reach || 1),
    radius: m.radius || 1,           // 花火合戦だけ（ひとりの夜の大きさは decay で決まる）
    decay: harsh ? Math.max(0.5, SOFT_DECAYS[soft] - harsh) : SOFT_DECAYS[soft],
    size: L('tairin', 'size', 1),
    goldBonus: L('kinun', 'gold', 1),
    fuseGold: L('ichibanboshi', 'gold', 0), // 一番星: 線で直接ひらいた金は、さらに足す
    senrinSparks: 6,
    endBurst: !!lv.owaridama,
    endR: L('owaridama', 'R', OWARI_R),
    toriPlus: L('owaridama', 'tori', 0),
    pulse: 10,
    chainPulse: L('kodou', 'step', 0), // 鼓動: 連鎖でひらいた玉だけを、この数ごとに数える
    bloom: BLOOM,
    bloomShare: L('mankai', 'share', 0),
    bloomX: L('mankai', 'x', 1),
    extraShells: L('mashidama', 'n', 0),
    extraGold: L('maneki', 'gold', 0),
    secondStroke: !!lv.nihitsu,
    secondShare: L('nihitsu', 'share', NIHITSU_SHARE),
    secondInk: L('nihitsu', 'ink', NIHITSU_INK),
    afterglow: L('nokoribi', 'p', 0) + (m.afterglow || 0),
    startMult: (m.startMult || 0) + L('osobi', 'mult', 0),
    moonMult: m.startMult || 0,
    fuseSpeed: (lv.osobi ? SLOW_FUSE : 1) * L('kamaitachi', 'speed', 1),
    spareInk: !!lv.nokorizumi,
    spareMult: L('nokorizumi', 'mult', 0),
    spareChips: L('suminagashi', 'pct', 0),
    goldDouble: !!m.goldDouble,
    bigDouble: !!m.bigDouble,
    extraSenrin: m.extraSenrin || 0,
    lanternGain: L('chouchinshi', 'gain', 1),
    lanternMult: L('hanaikada', 'mult', 0),
    dampHits: lv.amayoke ? 1 : DAMP_HITS,
    dampPts: L('amayoke', 'pts', 1),
    dampMult: L('amayoke', 'mult', 0),
    cloudScale: L('kazekiri', 'scale', 1),
    cloudMult: L('kazekiri', 'mult', 0),
    goldX: L('maneki', 'x', 0),
    genX: L('renjishi', 'x', 0),
    riskX: L('senkou', 'x', 0),
    straightX: L('tengu', 'x', 0),
    mirrorPart: L('tanuki', 'part', 0),
    foxfire: L('kitsune', 'n', 0),
    speedX: L('kamaitachi', 'x', 0),
    lv,
  };
}

// ---------------------------------------------------------------- 夜の並べ方
export const FIELD = { x0: 22, x1: W - 22, y0: 96, y1: 500 };
const MIN_GAP = 27;

function gauss(rng) { return (rng() + rng() + rng() - 1.5) / 1.5; }

export function nightSeed(seed, night) { return hashStr(`hitofude:${seed >>> 0}:${night}`); }

// 夜ごとの玉の内訳。仕掛けは GIMMICKS の夜から出てくる
export function shellMix(night, rules) {
  let gold = 1 + Math.floor(night / 3);
  let big = night >= 1 ? 1 + Math.floor((night - 1) / 2) : 0;
  let star = night >= 2 ? 1 + Math.floor((night - 2) / 2) : 0;
  const lantern = night >= 3 ? (night >= 6 ? 2 : 1) : 0;
  const damp = night >= 5 ? 3 + (night - 5) * 2 : 0;
  const shaku = night >= 7 ? 1 : 0;
  // 月のルールも、その玉が出てくる夜から効く（一度に覚えることは 1 つだけ）
  if (rules.goldDouble) gold *= 2;
  if (rules.bigDouble) big *= 2;
  if (night >= 2) star += rules.extraSenrin;
  return { kin: gold, ootama: big, senrin: star, chouchin: lantern, shime: damp, shaku };
}

// 雲（5 夜目から。段位 4 からは 2 夜目から）。火も火花も通らない。
// 置き場所はいつも元の大きさで決める（お守りで夜空が変わらないように）。風切りは、置いたあとで半径だけ縮める（Lv3 は消える）
export function makeClouds(seed, night, rules = null, level = 0) {
  if (night < (levelFx(level).clouds ? 1 : 4)) return [];
  const rng = rng32(nightSeed(seed, night) ^ 0x0c10d5);
  const n = night >= 6 ? 2 : 1, out = [];
  for (let k = 0; k < n; k++) {
    for (let t = 0; t < 40; t++) {
      const r = Math.round(38 + rng() * 12);
      const c = { x: Math.round(FIELD.x0 + 50 + rng() * (FIELD.x1 - FIELD.x0 - 100)), y: Math.round(FIELD.y0 + 60 + rng() * (FIELD.y1 - FIELD.y0 - 120)), r };
      if (out.some((o) => Math.hypot(o.x - c.x, o.y - c.y) < o.r + c.r + 60)) continue;
      out.push(c); break;
    }
  }
  return shrinkClouds(out, rules ? rules.cloudScale : 1);
}
function shrinkClouds(clouds, k) { return k === 1 ? clouds : clouds.map((c) => ({ ...c, r: Math.round(c.r * k) })).filter((c) => c.r > 0); }
// 線分 a→b が、どれかの雲を横切るか
export function crossesCloud(clouds, ax, ay, bx, by) {
  for (const c of clouds) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const u = l2 ? Math.max(0, Math.min(1, ((c.x - ax) * dx + (c.y - ay) * dy) / l2)) : 0;
    if (Math.hypot(ax + dx * u - c.x, ay + dy * u - c.y) < c.r) return true;
  }
  return false;
}
export function inCloud(clouds, x, y) { return clouds.some((c) => Math.hypot(c.x - x, c.y - y) < c.r); }

// 仕掛け縄（7 夜目から）。離れた玉どうしをゆるい弧でつなぐ。雲（元の大きさ）は通らない。
// 増し玉で足した玉はつながない（お守りで縄が変わらないように）
export function makeRopes(seed, night, all, clouds) {
  if (night < 6) return [];
  const shells = all.filter((s) => !s.extra);
  const rng = rng32(nightSeed(seed, night) ^ 0x2a0e5);
  const n = night >= 7 ? 3 : 2, out = [], used = new Set();
  for (let t = 0; t < 200 && out.length < n; t++) {
    const a = shells[Math.floor(rng() * shells.length)], b = shells[Math.floor(rng() * shells.length)];
    if (!a || !b || a === b || used.has(a.id) || used.has(b.id)) continue;
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    if (d < 100 || d > 190) continue;
    const bend = (rng() - 0.5) * 50, nx = -(b.y - a.y) / d, ny = (b.x - a.x) / d;
    const cx = (a.x + b.x) / 2 + nx * bend, cy = (a.y + b.y) / 2 + ny * bend;
    const pts = [];
    const steps = Math.round(d / FUSE_SAMPLE);
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      pts.push({ x: (1 - u) * (1 - u) * a.x + 2 * (1 - u) * u * cx + u * u * b.x, y: (1 - u) * (1 - u) * a.y + 2 * (1 - u) * u * cy + u * u * b.y });
    }
    if (pts.some((p) => inCloud(clouds, p.x, p.y))) continue;
    used.add(a.id); used.add(b.id);
    out.push({ a: a.id, b: b.id, pts });
  }
  return out;
}

// 夜 night（0 始まり）の花火玉。いくつかの群れと、はぐれ玉。群れの間は線でつなぐ。
// clouds は元の大きさの雲（makeClouds(seed, night)）。増し玉の玉は、もとの並びを変えずに、別の乱数で後ろに足す
// （お守りを持っていても、同じ夜はみんな同じ並び）。rules.baseExtra は花火合戦の玉の増し分で、こちらは並びに入る
// 招き猫（Lv2 から）の金の玉も、同じように別の乱数で、増し玉のあとに足す
export function makeLayout(seed, night, rules, clouds = makeClouds(seed, night)) {
  let shells = baseLayout(seed, night, rules, clouds);
  if (rules.extraShells) shells = addExtraShells(seed, night, shells, clouds, rules.extraShells);
  if (rules.extraGold) shells = addExtraShells(seed, night, shells, clouds, rules.extraGold, 'kin', 0x6a7e1d);
  return shells;
}
// 増し玉: もとの玉のそばに、別の乱数で足す（間隔と雲のよけ方は、もとの玉と同じ）
function addExtraShells(seed, night, shells, clouds, n, type = 'kiku', salt = 0x3a5d1e) {
  const rng = rng32(nightSeed(seed, night) ^ salt);
  const base = shells.filter((s) => s.type !== 'shaku' && !s.extra);
  const out = shells.slice();
  for (let i = 0; i < n && base.length; i++) {
    for (let t = 0; t < 80; t++) {
      const a = base[Math.floor(rng() * base.length)], grow = 1 + Math.floor(t / 20) * 0.4;
      const x = Math.round(a.x + gauss(rng) * 40 * grow), y = Math.round(a.y + gauss(rng) * 40 * grow);
      if (x < FIELD.x0 || x > FIELD.x1 || y < FIELD.y0 || y > FIELD.y1 || !spotClear(out, clouds, x, y)) continue;
      out.push({ id: out.length, type, x, y, hue: Math.floor(rng() * 7), extra: true });
      break;
    }
  }
  return out;
}
function spotClear(shells, clouds, x, y, gap = MIN_GAP) {
  return !shells.some((s) => Math.hypot(s.x - x, s.y - y) < gap + (s.type === 'shaku' ? 14 : 0)) && !clouds.some((c) => Math.hypot(c.x - x, c.y - y) < c.r + 14);
}
function baseLayout(seed, night, rules, clouds) {
  const rng = rng32(nightSeed(seed, night));
  const n = BASE_COUNTS[Math.min(night, BASE_COUNTS.length - 1)] + (rules.baseExtra || 0);
  const mix = shellMix(night, rules);
  const types = [];
  for (const t of ['kin', 'ootama', 'senrin', 'chouchin', 'shime']) for (let i = 0; i < mix[t]; i++) types.push(t);
  while (types.length < n - mix.shaku) types.push('kiku');
  for (let i = types.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [types[i], types[j]] = [types[j], types[i]]; }
  // 序盤の夜ほど群れが少なく密（最初の一筆で気持ちよく連鎖させる）。三夜目からは、景色ごとに群れの置き方が変わる
  const scene = sceneFor(seed, night).id;
  let k = night < 2 ? 2 : 3 + Math.floor(rng() * 3);
  let spread = night < 2 ? 34 : 40 + night, sx = 1, sy = 1;
  const centers = [];
  if (scene === 'kawa') {
    // 画面を横切る、うねった川。小さな群れが流れに沿って並ぶ
    k = 6; spread = 30 + night;
    const ph = rng() * Math.PI * 2, amp = 90 + rng() * 40, mid = (FIELD.y0 + FIELD.y1) / 2;
    for (let c = 0; c < k; c++) { const u = c / (k - 1); centers.push({ x: FIELD.x0 + 34 + u * (FIELD.x1 - FIELD.x0 - 68), y: mid + Math.sin(ph + u * Math.PI * 1.8) * amp }); }
  } else if (scene === 'wa') {
    // まん中を空けた輪（八夜目は、まん中に尺玉）
    k = 7; spread = 28 + night;
    const off = rng() * Math.PI * 2, r = 118 + rng() * 14;
    for (let c = 0; c < k; c++) { const a = off + c / k * Math.PI * 2; centers.push({ x: W / 2 + Math.cos(a) * r, y: 298 + Math.sin(a) * r * 1.2 }); }
  } else if (scene === 'yatai') {
    // 横に長い屋台が、3 段に並ぶ
    k = 6; spread = 30 + night; sx = 1.7; sy = 0.55;
    const rows = [FIELD.y0 + 60, (FIELD.y0 + FIELD.y1) / 2, FIELD.y1 - 60], shift = rng() < 0.5 ? 0 : 1;
    for (let c = 0; c < k; c++) { const row = Math.floor(c / 2); centers.push({ x: (c % 2 === (row + shift) % 2 ? 100 : 260) + (rng() - 0.5) * 30, y: rows[row] + (rng() - 0.5) * 20 }); }
  } else {
    for (let c = 0; c < k; c++) {
      let best = null;
      for (let t = 0; t < 12; t++) {
        const p = { x: FIELD.x0 + 30 + rng() * (FIELD.x1 - FIELD.x0 - 60), y: FIELD.y0 + 30 + rng() * (FIELD.y1 - FIELD.y0 - 60) };
        const d = centers.reduce((m, q) => Math.min(m, Math.hypot(p.x - q.x, p.y - q.y)), 1e9);
        if (!best || d > best.d) best = { p, d };
      }
      centers.push(best.p);
    }
  }
  const shells = [];
  // 尺玉は、まん中あたりに先に置く
  if (mix.shaku) shells.push({ id: 0, type: 'shaku', x: Math.round(W / 2 + (rng() - 0.5) * 60), y: Math.round(290 + (rng() - 0.5) * 80), hue: 2 });
  const clear = (x, y, gap) => spotClear(shells, clouds, x, y, gap);
  for (let i = 0; i < types.length; i++) {
    let pos = null;
    for (let t = 0; t < 60 && !pos; t++) {
      const loose = rng() < (night < 2 ? 0.08 : scene === 'mure' ? 0.22 : 0.12);
      const c = centers[Math.floor(rng() * centers.length)];
      // 間隔は丸めたあとの座標で確かめる（丸めで近づくことがある）。群れが混んで置けないときは、少しずつ広げる
      const grow = 1 + Math.floor(t / 20) * 0.35;
      const x = Math.round(loose ? FIELD.x0 + rng() * (FIELD.x1 - FIELD.x0) : c.x + gauss(rng) * spread * sx * grow);
      const y = Math.round(loose ? FIELD.y0 + rng() * (FIELD.y1 - FIELD.y0) : c.y + gauss(rng) * spread * sy * grow);
      if (x < FIELD.x0 || x > FIELD.x1 || y < FIELD.y0 || y > FIELD.y1) continue;
      if (!clear(x, y, MIN_GAP)) continue;
      pos = { x, y };
    }
    if (!pos) continue;
    shells.push({ id: shells.length, type: types[i], x: pos.x, y: pos.y, hue: Math.floor(rng() * 7) });
  }
  return shells;
}

// ---------------------------------------------------------------- 線
function pathLength(pts) {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return s;
}
export { pathLength };
export const STROKE_STEP = 8;
export const STROKE_MAX_POINTS = 127;

// 指の軌跡を、8 単位ごとの整数座標にならし、墨の長さで切る。挑戦状にはこの形で入る
export function normalizeStroke(raw, ink) {
  const pts = (raw || []).filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))
    .map((p) => ({ x: Math.max(0, Math.min(W - 1, p.x)), y: Math.max(0, Math.min(H - 1, p.y)) }));
  if (pts.length < 2) return [];
  const out = [{ x: Math.round(pts[0].x), y: Math.round(pts[0].y) }];
  let used = 0, carry = 0;
  for (let i = 1; i < pts.length && out.length < STROKE_MAX_POINTS; i++) {
    const a = pts[i - 1], b = pts[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (seg === 0) continue;
    let d = STROKE_STEP - carry;
    while (d <= seg && out.length < STROKE_MAX_POINTS) {
      if (used + STROKE_STEP > ink + 1e-9) return out;
      const q = { x: Math.round(a.x + (b.x - a.x) * d / seg), y: Math.round(a.y + (b.y - a.y) * d / seg) };
      const last = out[out.length - 1];
      if (q.x !== last.x || q.y !== last.y) { out.push(q); used += STROKE_STEP; }
      d += STROKE_STEP;
    }
    carry = seg - (d - STROKE_STEP);
  }
  return out;
}
// 線の中で、鋭く折れている点（折れ火）
function cornerIndices(pts) {
  const out = [];
  for (let i = 2; i < pts.length - 2; i++) {
    const a = pts[i - 2], b = pts[i], c = pts[i + 2];
    const v1x = b.x - a.x, v1y = b.y - a.y, v2x = c.x - b.x, v2y = c.y - b.y;
    const l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);
    if (!l1 || !l2) continue;
    const cos = (v1x * v2x + v1y * v2y) / (l1 * l2);
    if (cos < -0.1 && (!out.length || i - out[out.length - 1] > 3)) out.push(i);
  }
  return out;
}

// ---------------------------------------------------------------- シミュレーション
export const FUSE_SPEED = 300;       // 導火線の火が走る速さ（単位/秒）
export const FUSE_SAMPLE = 4;        // 導火線を刻む細かさ
export const BURST_GROW = 0.2;       // 玉がひらききるまで
export const BURST_HOLD = 0.25;      // ひらいたまま火が移る時間
export const SPARK_SPEED = 260;
export const SPARK_LIFE = 0.55;

// bank は墨壺（前の夜に残した墨。inkCarry で出す）。その夜の墨に足す（鏡の夜は、足したあとで 3/4 にする。狸の葉っぱなら減らない）。
// level は段位（雲・減衰・目標点が変わる）。花火合戦は段位なし
export function newRound({ seed, night, charms = [], moon = 4, par = false, vs = null, bank = 0, level = 0 }) {
  level = vs ? 0 : Math.max(0, Math.min(MAX_LEVEL, Math.floor(+level || 0)));
  const rules = rulesFor(charms, moon, level);
  if (vs) rules.baseExtra = vs.extra || 0;
  const tw = vs ? null : twistFor(seed, night);
  const full = makeClouds(seed, night, null, level), clouds = shrinkClouds(full, rules.cloudScale);
  const shells = makeLayout(seed, night, rules, full).map((s) => ({ ...s, burst: false, burstAt: -1, hp: s.type === 'shime' ? rules.dampHits : 1, lastSrc: null }));
  bank = vs ? 0 : Math.max(0, Math.min(BASE_INK, Math.floor(+bank || 0)));
  const mirrorInk = tw && tw.id === 'kagami' && !rules.mirrorPart ? MIRROR_INK : 1;
  const ink = Math.round((rules.ink + bank) * mirrorInk);
  const st = {
    seed: seed >>> 0, night, charms: charms.slice(), moon, level, rules, shells, clouds, ropes: [],
    twist: tw ? tw.id : null, scene: sceneFor(seed, night).id, target: par || vs ? 0 : targetFor(seed, night, moon, level),
    t: 0, tick: 0, phase: 'draw', strokes: [], ink, bank, inkTotal: ink, mirrorInk, cloudCount: full.length,
    fuse: { pts: [], burnt: [], seg: [], wet: [], rope: [], links: [], owner: [], fire: [], ends: new Set() },
    heads: [], explosions: [], sparks: [], embers: [], later: [], foxes: [], nextId: 1,
    pops: 0, chainPops: 0, chips: 0, goldMult: 0, lanterns: 0, lit: 0, tori: null, maxGen: 0, maxChainAt: 0, events: [],
    foxLeft: vs ? 0 : rules.foxfire,
    // 点の内訳（scoreParts で result.parts にする）。shells は玉そのものの点、lantern は提灯で増えた分、maker は提灯職人でさらに増えた分
    acc: { shells: 0, mashi: 0, damp: 0, lantern: 0, maker: 0, ember: 0, gold: 0, kinun: 0, star: 0, tori: 0, toriPlus: 0, lanternMult: 0, dampMult: 0 },
    stats: null,
    rng: rng32(nightSeed(seed, night) ^ 0x9e3779b9), secondUsed: false, done: false, result: null, vs: null,
  };
  if (vs) st.vs = newVsState(vs);
  const ropes = makeRopes(seed, night, shells, full);
  ropes.forEach((r, k) => addSegment(st, r.pts, 10 + k, true));
  st.ropes = ropes;
  st.stats = newStats(st);
  return st;
}

// 倍率（足し算の部分 M）= 1 + 月とお守りの足し分 + 金・尺玉 + 連鎖の足し分（ふだんは 10 個ごと、鼓動なら連鎖でひらいた玉 Lv ごとの数ごと）
// + 残り墨 + 花筏・雨よけ・風切り。掛け算の倍率（X）は xmultOf、点は scoreParts
export function multOf(st) {
  const r = st.rules;
  const pulse = r.chainPulse ? Math.floor(st.chainPops / r.chainPulse) : Math.floor(st.pops / r.pulse);
  return 1 + r.startMult + st.goldMult + pulse + spareBonus(st) + (st.vs ? 0 : st.acc.lanternMult + st.acc.dampMult + r.cloudMult * st.cloudCount);
}
// 提灯が灯ったあとの、点の倍率（1 + 灯った提灯 × 1。提灯職人なら Lv ごとに × 1.5 / 2 / 2.5）
export function pointFactor(st) { return 1 + st.lanterns; }

// ---- 墨の勘定
// inkTotal はこの夜にもらった墨（1 本目の墨。二筆目をもらえば、その墨も足す）。使った墨は、置いた線の長さの合計
// （鏡の夜に映った線と、狸の葉っぱの写しはただ）。残った墨 = inkTotal − 使った墨
export function inkUsed(st) { return st.strokes.reduce((a, pts) => a + pathLength(pts), 0); }
export function inkLeft(st) { return Math.max(0, st.inkTotal - inkUsed(st)); }
// 墨壺: 次の夜に持ちこせる墨 = 残った墨の半分（1 夜ぶんの基本の墨まで）。線を引く前の夜は 0
export function inkCarry(st) { return st.strokes.length ? Math.min(BASE_INK, Math.floor(0.5 * inkLeft(st))) : 0; }
// 墨を SPARE_STEP 残すごとに 1 段（線を引くまでは数えない）
export function spareSteps(st) {
  if (!st.strokes.length || !st.inkTotal) return 0;
  return Math.floor(inkLeft(st) / st.inkTotal / SPARE_STEP + 1e-9);
}
// 残り墨: 1 段ごとに倍率 +Lv
export function spareBonus(st) { return st.rules.spareMult ? spareSteps(st) * st.rules.spareMult : 0; }

// ---- 点の内訳（バラトロの「チップ × 倍率」のように、ページが 1 つずつ積み上げて見せる）
// 点 score = Math.round(C × M × X)。C = kind 'chips' の v の合計、M = kind 'mult' の v の合計、X = kind 'xmult' の v の積（並び順に掛ける）。
// C と M は整数。X の v は小数 2 桁に丸めた値。id はお守りの id か、下の PART_LABEL の id
//  chips: shells 玉 / mashidama 増し玉の玉 / lantern 提灯 / chouchinshi 提灯職人 / amayoke 雨よけ / nokoribi・ember 残り火 / suminagashi 墨流し
//  mult:  base 1 / moon 寝待月 / osobi / gold 金の玉 / kinun / ichibanboshi / tori 大トリ / owaridama / kodou・pulse / nokorizumi / hanaikada / amayoke / kazekiri
//  xmult: maneki / renjishi / senkou / tengu / kamaitachi / mankai / bloom 満開
export const PART_LABEL = {
  shells: { ja: '玉', en: 'Shells' }, lantern: { ja: '提灯', en: 'Lanterns' }, ember: { ja: '残り火', en: 'Embers' },
  base: { ja: '倍率', en: 'Base' }, moon: { ja: '月', en: 'Moon' }, gold: { ja: '金の玉', en: 'Gold' }, tori: { ja: '大トリ', en: 'Grand finale' },
  pulse: { ja: '10 個ごと', en: 'Every 10 bursts' }, bloom: { ja: '満開', en: 'Full bloom' },
};
function partLabel(id) { const c = CHARMS.find((x) => x.id === id); return c ? { ja: c.ja, en: c.en } : PART_LABEL[id] || { ja: id, en: id }; }
const round2x = (v) => Math.round(v * 100) / 100;
// 線のまっすぐさ（端から端の距離 ÷ 線の長さ）。天狗の団扇は 0.6 から 0.95 にかけて効き目が上がる
export function straightness(pts) {
  const len = pathLength(pts || []);
  if (!pts || pts.length < 2 || len < 1) return 0;
  const a = pts[0], b = pts[pts.length - 1];
  return Math.hypot(b.x - a.x, b.y - a.y) / len;
}
export function scoreParts(st) {
  const r = st.rules, a = st.acc, lv = r.lv, parts = [];
  const add = (id, kind, v) => { if (v) parts.push({ id, ...partLabel(id), kind, v }); };
  add('shells', 'chips', a.shells);
  add('mashidama', 'chips', a.mashi);
  add('amayoke', 'chips', a.damp);
  add('lantern', 'chips', a.lantern);
  add('chouchinshi', 'chips', a.maker);
  add(lv.nokoribi ? 'nokoribi' : 'ember', 'chips', a.ember);
  const steps = spareSteps(st);
  if (r.spareChips && steps) add('suminagashi', 'chips', Math.round(st.chips * steps * r.spareChips));
  add('base', 'mult', 1);
  add('moon', 'mult', r.moonMult);
  add('osobi', 'mult', r.startMult - r.moonMult);
  add('gold', 'mult', a.gold);
  add('kinun', 'mult', a.kinun);
  add('ichibanboshi', 'mult', a.star);
  add('tori', 'mult', a.tori);
  add('owaridama', 'mult', a.toriPlus);
  if (r.chainPulse) add('kodou', 'mult', Math.floor(st.chainPops / r.chainPulse)); else add('pulse', 'mult', Math.floor(st.pops / r.pulse));
  add('nokorizumi', 'mult', spareBonus(st));
  add('hanaikada', 'mult', a.lanternMult);
  add('amayoke', 'mult', a.dampMult);
  add('kazekiri', 'mult', r.cloudMult * st.cloudCount);
  if (r.goldX && a.gold) { let x = 1; for (let i = 0; i < a.gold; i++) x *= r.goldX; add('maneki', 'xmult', round2x(x)); }
  if (r.genX && st.maxGen) add('renjishi', 'xmult', round2x(1 + r.genX * st.maxGen));
  add('senkou', 'xmult', r.riskX);
  if (r.straightX && st.strokes.length) {
    const k = Math.max(0, Math.min(1, (straightness(st.strokes[0]) - 0.6) / 0.35));
    if (k > 0) add('tengu', 'xmult', round2x(1 + (r.straightX - 1) * k));
  }
  add('kamaitachi', 'xmult', r.speedX);
  const total = st.shells.length, open = st.pops;
  if (r.bloomShare && total && open >= total * r.bloomShare - 1e-9) add('mankai', 'xmult', r.bloomX);
  if (total && st.shells.every((s) => s.burst)) add('bloom', 'xmult', r.bloom);
  let C = 0, M = 0, X = 1;
  for (const p of parts) { if (p.kind === 'chips') C += p.v; else if (p.kind === 'mult') M += p.v; else X *= p.v; }
  return { parts, chips: C, mult: M, xmult: X, score: Math.round(C * M * X) };
}
// 掛け算の倍率（いまの時点）
export function xmultOf(st) { return st.vs ? 1 : scoreParts(st).xmult; }

// ---- 夜ごとの記録（願い札・実績用）。数は finish で数え直す。firstPop・startType・lineTouched・goldTouched・cloudTouched・maxGen は燃えながら数える
function newStats(st) {
  const n = (t) => st.shells.filter((s) => s.type === t).length;
  return {
    firstPop: null, startType: null, lineTouched: 0, goldTouched: 0,
    goldTotal: n('kin'), goldBurst: 0, dampTotal: n('shime'), dampBurst: 0, bigTotal: n('ootama'), bigBurst: 0,
    lanternTotal: n('chouchin'), lanternsLit: 0, ropesLit: 0, ropesTotal: st.ropes.length, cloudTouched: false,
    maxGen: 0, inkFrac: 0, pops: 0, total: st.shells.length, chainPops: 0, toriAdd: 0, allClear: false,
  };
}
function countStats(st) {
  const S = st.stats, f = st.fuse, b = (t) => st.shells.filter((s) => s.type === t && s.burst).length, n = (t) => st.shells.filter((s) => s.type === t).length;
  S.goldTotal = n('kin'); S.dampTotal = n('shime'); S.bigTotal = n('ootama'); S.lanternTotal = n('chouchin'); S.ropesTotal = st.ropes.length;
  S.goldBurst = b('kin'); S.dampBurst = b('shime'); S.bigBurst = b('ootama'); S.lanternsLit = b('chouchin');
  S.ropesLit = st.ropes.filter((_, k) => f.pts.some((_, i) => f.seg[i] === 10 + k && f.burnt[i])).length;
  S.maxGen = st.maxGen; S.inkFrac = st.inkTotal ? inkUsed(st) / st.inkTotal : 0;
  S.pops = st.pops; S.total = st.shells.length; S.chainPops = st.chainPops; S.toriAdd = st.tori ? st.tori.add : 0;
  S.allClear = st.shells.length > 0 && st.shells.every((s) => s.burst);
  return S;
}

// 導火線に区間を足す（プレイヤーの線も、仕掛け縄も）。近くにある別の区間の点どうしは「つながり」として覚え、
// 片方が燃えたらもう片方にも火が移る
const LINK_DIST = 6;
function addSegment(st, samples, segId, isRope, owner = 0) {
  const f = st.fuse, base = f.pts.length;
  for (const p of samples) {
    f.pts.push(p); f.burnt.push(false); f.seg.push(segId); f.rope.push(!!isRope); f.owner.push(isRope ? -1 : owner); f.fire.push(-1);
    f.wet.push(inCloud(st.clouds, p.x, p.y)); f.links.push([]);
  }
  for (let i = base; i < f.pts.length; i++) {
    for (let j = 0; j < base; j++) {
      if (f.seg[j] === segId) continue;
      if (Math.hypot(f.pts[i].x - f.pts[j].x, f.pts[i].y - f.pts[j].y) <= LINK_DIST) { f.links[i].push(j); f.links[j].push(i); }
    }
  }
  return base;
}

// 指の軌跡から線を置いて火をつける（1 本目も 2 本目も同じ）。返り値は、実際に使われた線
export function lightStroke(st, raw) {
  return lightPoints(st, normalizeStroke(st.twist === 'massugu' ? straighten(raw, st.ink) : raw, st.ink));
}
// まっすぐの夜: 引きはじめから、指を離した所へ向かう直線（墨の長さまで）
export function straighten(raw, ink) {
  const pts = (raw || []).filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y));
  if (pts.length < 2) return pts;
  const a = pts[0], b = pts[pts.length - 1], d = Math.hypot(b.x - a.x, b.y - a.y);
  if (d < 1) return [a];
  const k = Math.min(1, ink / d);
  return [{ x: a.x, y: a.y }, { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }];
}
// 鏡の夜: 左右に映した線
export function mirrorPoint(p) { return { x: W - p.x, y: p.y }; }
// ならし済みの線（挑戦状・再生リンクから来たもの）をそのまま置く。ならし直すと線がずれて結果が変わる
export function lightPoints(st, input) {
  const placed = placePoints(st, input, 0);
  if (!placed) return null;
  // 1 本目の引きはじめにある玉（願い札「提灯から引きはじめる」）
  if (!st.vs && st.strokes.length === 1) {
    let best = null;
    if (!st.fuse.wet[placed.base]) for (const s of st.shells) {
      const d = Math.hypot(s.x - placed.p0.x, s.y - placed.p0.y);
      if (!s.burst && d <= SHELLS[s.type].r + st.rules.reach && (!best || d < best.d)) best = { d, s };
    }
    st.stats.startType = best ? best.s.type : null;
  }
  igniteStroke(st, placed, 0);
  return placed.pts;
}
// 線を導火線として置く（火はまだつけない）。owner は線を引いた人（花火合戦では 0 = あなた、1 = 相手）
function placePoints(st, input, owner, segOverride = null) {
  const pts = [];
  let len = 0;
  for (const p of input || []) {
    if (!p || !Number.isInteger(p.x) || !Number.isInteger(p.y) || p.x < 0 || p.y < 0 || p.x >= W || p.y >= H) return null;
    if (pts.length) {
      const d = Math.hypot(p.x - pts[pts.length - 1].x, p.y - pts[pts.length - 1].y);
      if (len + d > st.ink + 1) break;
      len += d;
    }
    if (pts.length >= STROKE_MAX_POINTS) break;
    pts.push({ x: p.x, y: p.y });
  }
  if (pts.length < 3) return null;
  st.strokes.push(pts);
  // 導火線は、線を FUSE_SAMPLE ごとに刻んだ点の列。2 本目は後ろにつなげず、別の区間として持つ
  const samples = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.round(seg / FUSE_SAMPLE));
    for (let k = i === 1 ? 0 : 1; k <= n; k++) samples.push({ x: a.x + (b.x - a.x) * k / n, y: a.y + (b.y - a.y) * k / n });
  }
  const segId = segOverride == null ? st.strokes.length - 1 : segOverride;
  const base = addSegment(st, samples, segId, false, owner);
  st.fuse.ends.add(st.fuse.pts.length - 1);
  // 鏡の夜は、左右に映した線も置いて、両方の端から火をつける。
  // 狸の葉っぱ（鏡の夜でないとき）は、線の前の部分だけを映す（写しは別の区間 30 + 番号。終わりは終わり玉も爆ぜる）
  let mirror = null;
  const kagami = st.twist === 'kagami', part = kagami ? 1 : !st.vs && segOverride == null ? st.rules.mirrorPart : 0;
  if (part) {
    const ms = samples.slice(0, part >= 1 ? samples.length : Math.max(2, Math.round(samples.length * part))).map(mirrorPoint);
    const mseg = (kagami ? 20 : 30) + segId;
    const mb = addSegment(st, ms, mseg, false, owner);
    st.fuse.ends.add(st.fuse.pts.length - 1);
    mirror = { base: mb, seg: mseg, p: ms[0], len: ms.length };
  }
  if (!st.vs) for (let i = base; i < st.fuse.pts.length; i++) if (st.fuse.wet[i]) { st.stats.cloudTouched = true; break; }
  return { pts, base, segId, p0: samples[0], mirror, len: samples.length };
}
// 置いた線の引きはじめに火をつける
function igniteStroke(st, placed, o) {
  const { base, segId, p0, mirror } = placed;
  st.phase = 'burn';
  // 花火合戦: 引きはじめが、もう相手の火で燃えていたら、火はつかない（線の頭を取られた）
  if (st.fuse.burnt[base]) { st.events.push({ type: 'fizzle', x: p0.x, y: p0.y, o }); return; }
  st.fuse.burnt[base] = true; st.fuse.fire[base] = o;
  st.events.push({ type: 'light', x: p0.x, y: p0.y, o });
  // 雲の中から引きはじめた線は、火がつかない
  const mainWet = st.fuse.wet[base];
  if (!mainWet) {
    st.heads.push({ i: base, dir: 1, f: base, o });
    fuseNeighborsBurst(st, p0, st.rules.reach, 'f' + segId, o);
    catchLinks(st, base, o);
  }
  if (mirror && !st.fuse.burnt[mirror.base]) {
    st.fuse.burnt[mirror.base] = true; st.fuse.fire[mirror.base] = o;
    if (!st.fuse.wet[mirror.base]) {
      st.heads.push({ i: mirror.base, dir: 1, f: mirror.base, o });
      fuseNeighborsBurst(st, mirror.p, st.rules.reach, 'f' + mirror.seg, o);
      catchLinks(st, mirror.base, o);
    }
  }
  if (mainWet && !st.heads.some((h) => h.o === o)) st.events.push({ type: 'fizzle', x: p0.x, y: p0.y, o });
}

// gen は代（導火線の火で 0、爆発・火花で 1 つずつ増える）。fuse = true の爆発（終わり玉）は、線の火として玉に届く
function spawnExplosion(st, x, y, R, cause, hue, o = 0, gen = 0, fuse = false) {
  st.explosions.push({ id: st.nextId++, x, y, R, t: 0, cause, hue: hue == null ? -1 : hue, o, gen, fuse });
}
// gen 代目の爆発の大きさの倍率。掛け算をくり返して出す（どの端末でも同じ値になるように、** は使わない）
// 大輪は、ひらく大きさそのものも Lv ごとに少し大きくする（rules.size）
export function sizeAt(rules, gen, vs = false) {
  if (vs) return rules.radius;
  let k = 1;
  for (let i = 0; i < gen && k > DECAY_MIN; i++) k *= rules.decay;
  return Math.max(DECAY_MIN, k) * (rules.size || 1);
}

// src は火の出どころ（爆発・火花・導火線の区間）。cause は 'fuse'（線の火）/ 'end'（終わり玉の爆発）/ 'chain'（爆発）/ 'spark'（火花）/ 'fox'（狐火）。
// ひとりの夜: 湿った玉は線の火（終わり玉・狐火も）が触れるとひらき、爆発や火花だけなら別々の火が DAMP_HITS 回いる。
// 尺玉は線の火（終わり玉も）でしかひらかない。花火合戦: 湿った玉は、線も含めて別々の火が 2 回当たるとひらく（前のまま）。
// o は火の持ち主。花火合戦では、ひらいた玉の点は、その火の持ち主のものになる
function burst(st, s, cause, src, o = 0, gen = 0) {
  if (s.burst) return;
  if (s.type === 'kuro' && cause !== 'fuse') return; // 黒玉は、導火線の火にしか反応しない（爆発や火花は素通り）
  const line = cause === 'fuse' || cause === 'end';
  if (s.type === 'shaku' && !st.vs && !line) return; // 大トリの尺玉も、線の火でしかひらかない
  const damp = s.type === 'shime' && !(st.vs ? false : line || cause === 'fox');
  if ((damp || s.type === 'kuro') && s.lastSrc === src) return; // 同じ火は、何度当たっても 1 回と数える
  if ((damp || s.type === 'kuro') && s.hp > 1) {
    s.hp--; s.lastSrc = src;
    if (s.type === 'kuro') crackKuro(st, s, src, o); else st.events.push({ type: 'dry', shell: s, o, left: s.hp });
    return;
  }
  pop(st, s, cause, o, gen);
}
// ひとりの夜の点: 提灯の倍率をかけて整数に丸める。内訳は st.acc へ（玉 / 増し玉 / 雨よけ / 提灯 / 提灯職人）
function soloChips(st, s, def, factor) {
  const a = st.acc, damp = s.type === 'shime' ? Math.round(def.pts * (st.rules.dampPts - 1)) : 0;
  const raw = def.pts + damp, inc = Math.round(raw * factor), lit = raw * st.lit;
  st.chips += inc;
  if (s.extra && s.type === 'kiku') a.mashi += def.pts; else a.shells += def.pts;
  a.damp += damp; a.lantern += lit; a.maker += inc - raw - lit;
}
// 玉がひらく（点・倍率・爆発・火花・残り火・狐火）
function pop(st, s, cause, o, gen) {
  const def = SHELLS[s.type];
  s.burst = true; s.burstAt = st.t; s.by = o; s.gen = gen;
  st.pops++;
  if (gen > 0) st.chainPops++;
  const side = st.vs ? st.vs.side[o] : null;
  const factor = side ? 1 + side.lanterns : pointFactor(st);
  if (side) { st.chips += def.pts * factor; side.pops++; side.chips += def.pts * factor; } else {
    soloChips(st, s, def, factor);
    if (gen > st.maxGen) st.maxGen = gen;
    if (!st.stats.firstPop) st.stats.firstPop = s.type;
    if (cause === 'fuse') st.stats.lineTouched++;
  }
  if (s.type === 'kin') {
    const g = st.rules.goldBonus + (cause === 'fuse' && !side ? st.rules.fuseGold : 0);
    st.goldMult += g; if (side) side.gold += g;
    if (!side) {
      const a = st.acc;
      a.gold++; a.kinun += st.rules.goldBonus - 1;
      if (cause === 'fuse') { a.star += st.rules.fuseGold; st.stats.goldTouched++; }
      // 招き猫: 金の玉がひらくたびに掛け算が重なる
      if (st.rules.goldX) { let x = 1; for (let i = 0; i < a.gold; i++) x *= st.rules.goldX; st.events.push({ type: 'lucky', shell: s, x: round2x(x), n: a.gold, o }); }
    }
    if (g > st.rules.goldBonus) st.events.push({ type: 'star', shell: s, add: g, o });
  }
  if (s.type === 'shaku') {
    if (side) { st.goldMult += 3; side.gold += 3; } else {
      // 大トリ: ほかの玉が、もうどれだけひらいているか（終わり玉の Lv2・Lv3 は、さらに足す）
      let n = 0, open = 0;
      for (const x of st.shells) if (x !== s) { n++; if (x.burst) open++; }
      const share = n ? open / n : 1, base = Math.round(1 + TORI_BONUS * share * share), plus = st.rules.toriPlus, add = base + plus;
      st.goldMult += add; st.tori = { share, add, base, plus };
      st.acc.tori += base; st.acc.toriPlus += plus;
      st.events.push({ type: 'tori', shell: s, share, add, o });
    }
  }
  if (side && s.type === 'kuro') { side.gold += 1; side.kuro++; if (s.from !== o) side.back++; st.events.push({ type: 'kuroBoom', shell: s, o, from: s.from }); }
  if (s.type === 'chouchin') {
    st.lanterns += st.rules.lanternGain;
    if (side) side.lanterns += st.rules.lanternGain; else { st.lit++; st.acc.lanternMult += st.rules.lanternMult; }
    st.events.push({ type: 'lantern', shell: s, factor: side ? 1 + side.lanterns : pointFactor(st), o, mult: side ? 0 : st.rules.lanternMult });
  }
  if (!side && s.type === 'shime') st.acc.dampMult += st.rules.dampMult;
  // ひとりの夜の尺玉は、倍率のための大トリ。ひらいても火は遠くまで飛ばさない（先にひらいて夜空を一掃する手は無い）
  const k = sizeAt(st.rules, gen, !!side), R = !side && s.type === 'shaku' ? TORI_R : def.R * k;
  spawnExplosion(st, s.x, s.y, R, cause, s.hue, o, gen);
  if (s.type === 'senrin') {
    const n = st.rules.senrinSparks;
    const off = (s.id * 0.61803) % 1;
    for (let j = 0; j < n; j++) {
      const a = (j / n + off) * Math.PI * 2;
      // 火花の飛ぶ距離も、代が進むと縮む（花火合戦は前のまま）
      st.sparks.push({ id: st.nextId++, x: s.x, y: s.y, vx: Math.cos(a) * SPARK_SPEED, vy: Math.sin(a) * SPARK_SPEED, life: side ? SPARK_LIFE : SPARK_LIFE * k, o, gen });
    }
  }
  if (st.rules.afterglow && st.rng() < st.rules.afterglow) {
    const pts = side ? Math.round(def.pts / 2) * (1 + side.lanterns) : Math.round(Math.round(def.pts / 2) * pointFactor(st));
    st.embers.push({ x: s.x, y: s.y, at: st.t + 0.8, R: side ? def.R * 0.7 * k : R * 0.7, pts, hue: s.hue, o, gen });
  }
  // 狐火: はじめにひらいた玉から、遠くの群れへ飛ぶ
  if (!side && st.foxLeft > 0) { st.foxLeft--; launchFox(st, s, o, gen); }
  st.events.push({ type: 'burst', shell: s, chain: side ? side.pops : st.pops, cause, o, R, gen });
}
// 狐火の行き先: FOX_MIN より遠い、まだひらいていない玉のうち、まわり FOX_NEAR にまだひらいていない玉がいちばん多いもの
// （同じなら遠い方、それも同じなら番号の小さい方）。尺玉と、ほかの狐火がもう向かっている玉には飛ばない
function launchFox(st, from, o, gen) {
  const aimed = new Set(st.foxes.map((f) => f.target));
  let best = null;
  for (const c of st.shells) {
    if (c.burst || c.type === 'shaku' || c.type === 'kuro' || aimed.has(c.id)) continue;
    const d = Math.hypot(c.x - from.x, c.y - from.y);
    if (d < FOX_MIN) continue;
    let n = 0;
    for (const x of st.shells) if (x !== c && !x.burst && Math.hypot(x.x - c.x, x.y - c.y) <= FOX_NEAR) n++;
    if (!best || n > best.n || (n === best.n && d > best.d)) best = { c, n, d };
  }
  if (!best) return;
  const fx = { id: st.nextId++, x: from.x, y: from.y, tx: best.c.x, ty: best.c.y, target: best.c.id, at: st.t + FOX_DELAY, o, gen: gen + 1 };
  st.foxes.push(fx);
  st.events.push({ type: 'fox', x: fx.x, y: fx.y, tx: fx.tx, ty: fx.ty, at: fx.at, shell: best.c, o });
}

// 終わり玉: 線の終わりに火が届いたら（燃え進んで来ても、爆発から移っても）、ひと息おいて爆ぜる（その爆発は線の火として玉に届く）
function fuseEnd(st, i, o) {
  const f = st.fuse;
  if (!st.rules.endBurst || !f.ends.has(i)) return;
  st.later.push({ at: st.t + OWARI_DELAY, x: f.pts[i].x, y: f.pts[i].y, o });
  st.events.push({ type: 'fuseEnd', x: f.pts[i].x, y: f.pts[i].y, at: st.t + OWARI_DELAY, o });
}
function igniteFuseAt(st, i, o = 0) {
  const f = st.fuse;
  if (f.burnt[i] || f.wet[i]) return;
  f.burnt[i] = true; f.fire[i] = o;
  fuseEnd(st, i, o);
  st.heads.push({ i, dir: 1, f: i, o }, { i, dir: -1, f: i, o });
  st.events.push({ type: 'catch', x: f.pts[i].x, y: f.pts[i].y, rope: f.rope[i], o });
  // 花火合戦: 相手の線に自分の火が移った（横取り）。すでに自分の火が燃やしている所の続きは数えない
  if (st.vs && f.owner[i] >= 0 && f.owner[i] !== o) {
    const cont = (j) => j >= 0 && j < f.pts.length && f.seg[j] === f.seg[i] && f.fire[j] === o;
    if (!cont(i - 1) && !cont(i + 1)) { st.vs.side[o].steals++; st.events.push({ type: 'steal', x: f.pts[i].x, y: f.pts[i].y, o }); }
  }
  fuseNeighborsBurst(st, f.pts[i], st.rules.reach, 'f' + f.seg[i], o);
  if (!f.wet[i]) catchLinks(st, i, o); // 黒玉で消えた火は、交わる線にも移らない
}
// 燃えた点のすぐそばを通る別の区間（縄や、もう 1 本の線）にも火を移す
function catchLinks(st, i, o = 0) {
  for (const j of st.fuse.links[i]) igniteFuseAt(st, j, o);
}

function fuseNeighborsBurst(st, p, reach, src, o = 0) {
  for (const s of st.shells) {
    if (s.burst) continue;
    const d = Math.hypot(s.x - p.x, s.y - p.y);
    if (d <= SHELLS[s.type].r + reach) burst(st, s, 'fuse', src, o, 0);
  }
}
// 火の頭・爆発・火花を順に動かす。動かしている間に増えたもの（燃え移った火など）も、同じコマのうちに動かす。
// 花火合戦では、同じ瞬間に 2 人の火が同じ玉に届いたとき、どちらが先かを 1 コマごとに入れかえる（いつも同じ人が勝たないように）
function eachFair(st, list, fn) {
  if (!st.vs) { for (const x of list) fn(x); return; }
  const n = list.length, first = st.tick % 2;
  for (const x of list.slice(0, n).sort((a, b) => (a.o === first ? 0 : 1) - (b.o === first ? 0 : 1))) fn(x);
  for (let k = n; k < list.length; k++) fn(list[k]);
}

export function step(st) {
  if (st.done || st.phase === 'draw' || st.phase === 'draw2') return st;
  st.t += DT; st.tick++;
  const f = st.fuse;
  if (st.vs) vsTick(st);
  // 導火線の火（遅火なら遅い）
  const adv = FUSE_SPEED * (st.rules.fuseSpeed || 1) * DT / FUSE_SAMPLE;
  const alive = [];
  eachFair(st, st.heads, (h) => {
    let dead = false;
    const target = h.f + h.dir * adv;
    while (!dead) {
      const next = h.i + h.dir;
      if ((h.dir > 0 && next > target) || (h.dir < 0 && next < target)) break;
      if (next < 0 || next >= f.pts.length || f.burnt[next] || f.wet[next] || f.seg[next] !== f.seg[h.i]) { dead = true; break; }
      f.burnt[next] = true; f.fire[next] = h.o;
      h.i = next;
      fuseNeighborsBurst(st, f.pts[next], st.rules.reach, 'f' + f.seg[next], h.o);
      if (f.wet[next]) { dead = true; break; } // 黒玉に消された
      catchLinks(st, next, h.o);
      fuseEnd(st, next, h.o);
    }
    h.f = target;
    if (!dead) alive.push(h);
  });
  // 終わり玉の爆発（線の終わりに火が届いてから OWARI_DELAY 秒あと）
  if (st.later.length) {
    const wait = [];
    for (const L of st.later) {
      if (st.t < L.at - 1e-9) { wait.push(L); continue; }
      spawnExplosion(st, L.x, L.y, st.rules.endR, 'end', 2, L.o, 0, true);
      st.events.push({ type: 'endBurst', x: L.x, y: L.y, R: st.rules.endR, o: L.o });
    }
    st.later = wait;
  }
  // 狐火が届いた（行き先がもうひらいていたら、そのまま消える）
  if (st.foxes.length) {
    const wait = [];
    for (const fx of st.foxes) {
      if (st.t < fx.at - 1e-9) { wait.push(fx); continue; }
      const s = st.shells.find((x) => x.id === fx.target);
      st.events.push({ type: 'foxHit', x: fx.tx, y: fx.ty, shell: s, o: fx.o });
      if (s && !s.burst) burst(st, s, 'fox', 'x' + fx.id, fx.o, fx.gen);
    }
    st.foxes = wait;
  }
  // 雨雲に消された火は、ここで落とす（燃える先が雲の中なら、上の見回りで止まっている）
  st.heads = st.vs ? alive.filter((h) => !f.wet[h.i]) : alive;
  // 爆発: ひらいている間、近くの玉と導火線に火を移す
  eachFair(st, st.explosions, (e) => {
    e.t += DT;
    if (e.t > BURST_GROW + BURST_HOLD) return;
    const rad = e.R * Math.min(1, e.t / BURST_GROW);
    const clouds = st.clouds;
    for (const s of st.shells) {
      if (s.burst) continue;
      if (Math.hypot(s.x - e.x, s.y - e.y) > rad + SHELLS[s.type].r) continue;
      // 雲の向こうには火が届かない
      if (clouds.length && crossesCloud(clouds, e.x, e.y, s.x, s.y)) continue;
      burst(st, s, e.fuse ? 'end' : 'chain', e.id, e.o, (e.gen || 0) + 1);
    }
    let best = -1, bd = 1e9;
    for (let i = 0; i < f.pts.length; i++) {
      if (f.burnt[i] || f.wet[i]) continue;
      const d = Math.hypot(f.pts[i].x - e.x, f.pts[i].y - e.y);
      if (d <= rad && d < bd) { bd = d; best = i; }
    }
    if (best >= 0 && !(clouds.length && crossesCloud(clouds, e.x, e.y, f.pts[best].x, f.pts[best].y))) igniteFuseAt(st, best, e.o);
  });
  // 千輪の火花
  const sparks = [];
  eachFair(st, st.sparks, (sp) => {
    sp.x += sp.vx * DT; sp.y += sp.vy * DT; sp.life -= DT;
    if (st.clouds.length && inCloud(st.clouds, sp.x, sp.y)) return; // 雲に入った火花は消える
    for (const s of st.shells) {
      if (!s.burst && Math.hypot(s.x - sp.x, s.y - sp.y) <= SHELLS[s.type].r + 5) burst(st, s, 'spark', sp.id, sp.o, (sp.gen || 0) + 1);
    }
    for (let i = 0; i < f.pts.length; i++) {
      if (!f.burnt[i] && !f.wet[i] && Math.hypot(f.pts[i].x - sp.x, f.pts[i].y - sp.y) <= 5) { igniteFuseAt(st, i, sp.o); break; }
    }
    if (sp.life > 0 && sp.x > -10 && sp.x < W + 10 && sp.y > -10 && sp.y < H + 10) sparks.push(sp);
  });
  st.sparks = sparks;
  // 残り火
  const embers = [];
  for (const em of st.embers) {
    if (st.t >= em.at) {
      st.chips += em.pts; if (st.vs) st.vs.side[em.o].chips += em.pts; else st.acc.ember += em.pts;
      spawnExplosion(st, em.x, em.y, em.R, 'ember', em.hue, em.o, em.gen || 0); st.events.push({ type: 'ember', x: em.x, y: em.y, o: em.o, R: em.R });
    } else embers.push(em);
  }
  st.embers = embers;
  st.explosions = st.explosions.filter((e) => e.t <= BURST_GROW + BURST_HOLD + 0.6);
  // 終わったか
  const busy = st.heads.length || st.sparks.length || st.embers.length || st.later.length || st.foxes.length || st.explosions.some((e) => e.t <= BURST_GROW + BURST_HOLD) || (st.vs && st.vs.ignite.length);
  if (!busy) {
    if (st.rules.secondStroke && !st.secondUsed && st.pops >= nihitsuNeed(st) && st.shells.some((s) => !s.burst)) {
      st.secondUsed = true; st.phase = 'draw2'; st.ink = Math.round(st.rules.ink * st.mirrorInk * st.rules.secondInk);
      st.inkTotal += st.ink;
      st.events.push({ type: 'second' });
      return st;
    }
    finish(st);
  }
  return st;
}
// 二筆目がもらえる、ひらいた玉の数（夜の玉の 6 割。二筆目の Lv で 5 割・4 割）
export function nihitsuNeed(st) { return Math.ceil(st.shells.length * (st.rules.secondShare || NIHITSU_SHARE)); }

// 夜の終わり。result.score = Math.round(chips × mult × xmult)（内訳は result.parts。scoreParts を見る）
export function finish(st) {
  if (st.done) return st;
  if (st.vs) return finishVs(st);
  const allClear = st.shells.every((s) => s.burst);
  const sp = scoreParts(st);
  st.done = true; st.phase = 'done';
  countStats(st);
  const bloomX = sp.parts.filter((p) => p.id === 'bloom' || p.id === 'mankai').reduce((a, p) => a * p.v, 1);
  st.result = {
    pops: st.pops, total: st.shells.length, chips: sp.chips, mult: sp.mult, xmult: sp.xmult, allClear, bloom: allClear ? bloomX : 1, score: sp.score,
    parts: sp.parts, chainPops: st.chainPops, maxGen: st.maxGen, tori: st.tori, inkLeft: inkLeft(st), carry: inkCarry(st), spare: spareBonus(st), stats: st.stats,
  };
  st.events.push({ type: 'done', result: st.result });
  return st;
}

// 線を置いたあと、終わるまで一気に回す（テストと、再生リンクの答え合わせ用）。
// normalized = true なら、線はならし済み（再生リンク）としてそのまま使う
export function runToEnd(st, strokes, { normalized = false, maxTicks = 60 * 60 } = {}) {
  const light = (pts) => (normalized ? lightPoints(st, pts) : lightStroke(st, pts));
  let k = 0;
  if (strokes[k]) light(strokes[k++]);
  for (let n = 0; n < maxTicks && !st.done; n++) {
    if (st.phase === 'draw2') {
      if (strokes[k]) light(strokes[k++]); else finish(st);
    }
    step(st);
    st.events.length = 0;
  }
  if (!st.done) finish(st);
  return st.result;
}

// ---------------------------------------------------------------- 基準点
// お守りなし・墨壺なしで、決まった手順の線（提灯から・尺玉で終わる・ばらばらの所から、近い玉を順につなぐ。まっすぐの夜は玉から玉への直線）を
// PAR_LINES 本試し、いちばん良い点。シードと夜と月だけで決まるので、今夜の一筆では全員同じになる
export const PAR_LINES = 12;
const parCache = new Map();
// 段位 4 から（二夜目から雲）は並びが変わるので、その並びで測る（段位 4 で測る。減衰が強くなる段位 5 からのルールは入れない）
export function parScore(seed, night, moon = 4, level = 0) {
  const board = levelFx(level).clouds ? 4 : 0;
  const key = `${seed >>> 0}|${night}|${moon}|${board}`;
  if (parCache.has(key)) return parCache.get(key);
  const r = rng32(nightSeed(seed, night) ^ 0x9a55e7);
  let best = 0;
  for (let c = 0; c < PAR_LINES; c++) {
    const st = newRound({ seed, night, charms: [], moon, par: true, level: board });
    const res = runToEnd(st, [refLine(st, r, c)]);
    if (res && res.score > best) best = res.score;
  }
  if (parCache.size > 400) parCache.clear();
  parCache.set(key, best);
  return best;
}
function refLine(st, r, c) {
  const alive = st.shells;
  if (st.twist === 'massugu') {
    const a = alive[Math.floor(r() * alive.length)], far = alive.filter((s) => Math.hypot(s.x - a.x, s.y - a.y) > 120);
    const b = (far.length ? far : alive)[Math.floor(r() * (far.length || alive.length))];
    return [{ x: a.x, y: a.y }, { x: b.x, y: b.y }];
  }
  const lantern = alive.find((s) => s.type === 'chouchin'), shaku = alive.find((s) => s.type === 'shaku');
  let cur = (c % 3 === 0 && lantern) || (c % 3 === 1 && shaku) || alive[Math.floor(r() * alive.length)];
  const pts = [{ x: cur.x, y: cur.y }], seen = new Set([cur.id]);
  let used = 0;
  for (;;) {
    const cand = alive.filter((s) => !seen.has(s.id) && !crossesCloud(st.clouds, cur.x, cur.y, s.x, s.y))
      .map((s) => ({ s, d: Math.hypot(s.x - cur.x, s.y - cur.y) })).sort((a, b) => a.d - b.d).slice(0, 3);
    if (!cand.length) break;
    const pick = cand[Math.floor(r() * cand.length)];
    if (used + pick.d > st.ink) break;
    used += pick.d; seen.add(pick.s.id); cur = pick.s; pts.push({ x: cur.x, y: cur.y });
  }
  // 尺玉の線は、尺玉で終わるように逆向きに引く（大トリ）
  return c % 3 === 1 && shaku ? pts.reverse() : pts;
}

// ---------------------------------------------------------------- 花火合戦（CPU と対戦）
// 同じ夜空に、2 人がそれぞれ 1 本ずつ線を引く。自分の火でひらいた玉が、自分の点になる。
// 相手の線に自分の火が移ると、そこから先は自分の火として燃える（横取り）。先に火が届いた方が取る。
// 番の流れ（火が走っている間は、見守るだけ）:
//   相手が線とお邪魔玉を 1 つ見せる → あなたは全部見てから 1 本ひき、お邪魔玉を 1 つ置く → 点火
//   （相手の黒玉は先に見えているので、よけることも、あとから届いて大爆発させることもできる）
// お邪魔玉（黒玉）は、線の火にしか反応しない（爆発や火花は素通り）:
//  ・最初に届いた線の火は、そこで消える（その線は、黒玉のまわりで切れる）
//  ・そのあと別の線の火が届くと大爆発し、届けた人の点になる（点 60・倍率 +1・大きくひらく）
//  → 2 本の線が交わる所に置くと、先に来た相手の火を止め、あとから来た自分の火で大爆発できる
// 持ち主の番号は 0 = あなた、1 = 相手
export const VS_BOUTS = [
  { night: 2, extra: 8, ja: '群れと千輪', en: 'Clusters & stars' },
  { night: 3, extra: 8, ja: '提灯の取り合い', en: 'Lantern fight' },
  { night: 7, extra: 0, ja: 'まん中の尺玉を取り合う', en: 'Fight for the grand shell' },
];
export const VS_WIN = 2;            // 先に 2 番取った方の勝ち
export const VS_FIRST = [1, 1, 1];  // 番ごとの先手（いつも相手が先に線を見せ、あなたはそれを見てから引く）
export const VS_START_GAP = 26;     // 後手は先手の線のすぐそばから、どちらも尺玉のすぐそばからは引きはじめられない
export const VS_OJAMA_GAP = 60;     // お邪魔玉は、線の引きはじめからこれだけ離して置く（始まってすぐ消えることはない）
export const VS_KURO_SOAK = 24;     // 黒玉に消された火は、その線のまわりこの距離が濡れて切れる

// 番付（弱い順）。強さは _dev/hitofude-vs-balance.mjs で CPU どうしを戦わせて決めた。
// lines は線を考える本数、pick は上から何本の中から選ぶか（多いほど気まぐれ）、probe は「あなたの返し手」を何通り読むか（いちばん効く）、
// lag は火をつけるのが遅れる秒、ink は墨の倍率。ojama はお邪魔玉を置く所を何か所ためすか、ojamaPick は上から何か所の中から選ぶか
export const RIVALS = [
  { id: 'chibi', ja: 'チビ火', en: 'Chibi', title: '見習いの火の子', titleEn: 'Apprentice spark', lines: 1, pick: 1, probe: 0, lag: 0.25, ink: 0.8, ojama: 1, ojamaPick: 1,
    body: ['#e9fbff', '#8fe3ff', '#3fb4ff', '#1f6fe0'], say: { start: 'よーし、負けないぞ！', steal: 'やった、もらい！', stolen: 'あっ、ぼくの線…', ojama: 'えいっ、お邪魔！', boom: 'わー、ドカン！', win: 'かったー！', lose: 'つよいなあ…' },
    sayEn: { start: 'I won\'t lose!', steal: 'Mine now!', stolen: 'Hey, my line…', ojama: 'Take this!', boom: 'Whoa, boom!', win: 'I won!', lose: 'You\'re good…' } },
  { id: 'shizuku', ja: 'シズク', en: 'Shizuku', title: '線香花火の子', titleEn: 'Sparkler girl', lines: 3, pick: 2, probe: 0, lag: 0.15, ink: 0.85, ojama: 3, ojamaPick: 2,
    body: ['#fbf0ff', '#d9a8ff', '#a066f0', '#6a34c8'], say: { start: '提灯は、わたしのもの', steal: 'しずかに、いただきます', stolen: 'あら…', ojama: 'ちょっと、じゃましますね', boom: 'まあ、はでな…', win: 'ふふ、勝ち', lose: 'きれいな線だった' },
    sayEn: { start: 'The lantern is mine.', steal: 'Quietly taken.', stolen: 'Oh my…', ojama: 'Pardon the interruption.', boom: 'How flashy…', win: 'Hehe, I win.', lose: 'What a line.' } },
  { id: 'don', ja: 'ドン', en: 'Don', title: '打ち上げ屋の親方', titleEn: 'Master launcher', lines: 3, pick: 3, probe: 1, lag: 0, ink: 1, ojama: 6, ojamaPick: 2,
    body: ['#f2fff0', '#9dffb0', '#35d37a', '#16804a'], say: { start: '大玉は、ドンといただく', steal: 'ドーン！', stolen: 'ぬうっ', ojama: '黒玉、くらえ！', boom: 'でっけえ花火だ！', win: 'ガッハッハ！', lose: 'やるじゃねえか' },
    sayEn: { start: 'Big shells are mine!', steal: 'BOOM!', stolen: 'Grr!', ojama: 'Eat this!', boom: 'What a blast!', win: 'Ha ha ha!', lose: 'Not bad, kid.' } },
  { id: 'karakuri', ja: 'カラクリ', en: 'Karakuri', title: '横取りとお邪魔の名人', titleEn: 'Master of theft and tricks', lines: 4, pick: 2, probe: 1, lag: 0.05, ink: 1, ojama: 12, ojamaPick: 1,
    body: ['#fff8e8', '#ffd98a', '#e0a030', '#9a6010'], say: { start: '線は、読んでいるよ', steal: '計算どおり', stolen: 'ほう、読まれたか', ojama: 'からくり、発動', boom: 'それも計算のうち…？', win: 'からくり、完成', lose: '見事な手だ' },
    sayEn: { start: 'I\'ve read your line.', steal: 'As calculated.', stolen: 'Oh, you read me.', ojama: 'Trap activated.', boom: 'Was that… planned?', win: 'Mechanism complete.', lose: 'A fine move.' } },
  { id: 'tsukikage', ja: 'ツキカゲ', en: 'Tsukikage', title: '月夜の花火師', titleEn: 'Moonlit master', lines: 6, pick: 1, probe: 2, lag: 0.067, ink: 1, ojama: 18, ojamaPick: 1,
    body: ['#ffffff', '#dfe6ff', '#8a9cff', '#3a3f9a'], say: { start: '月の下で、勝負', steal: '月は、すべてを照らす', stolen: '…やるね', ojama: '影を、落とそう', boom: '月も、驚いている', win: '今宵も、月の勝ち', lose: 'きみの花火、覚えておく' },
    sayEn: { start: 'Under the moon, we duel.', steal: 'The moon sees all.', stolen: '…impressive.', ojama: 'Let a shadow fall.', boom: 'Even the moon is surprised.', win: 'The moon wins tonight.', lose: 'I\'ll remember your fireworks.' } },
];
export function rivalById(id) { return RIVALS.find((r) => r.id === id) || RIVALS[0]; }

// 番の盤面。ink は [あなた, 相手] の墨の倍率、lag は [あなた, 相手] の火が遅れてつく秒
export function newVsRound({ seed, bout, moon = 4, ink = [1, 1], lag = [0, 0], first = VS_FIRST[bout] }) {
  const b = VS_BOUTS[bout];
  const st = newRound({ seed, night: b.night, moon, vs: { extra: b.extra, first } });
  const v = st.vs;
  v.bout = bout; v.lag = lag.slice(); v.inkK = ink.slice();
  v.ink = ink.map((k) => Math.round(st.rules.ink * k));
  st.ink = v.ink[0];
  return st;
}
function newVsState(vs) {
  return {
    first: vs.first == null ? 1 : vs.first, bout: 0, ink: null, inkK: [1, 1], lag: [0, 0],
    side: [0, 1].map(() => ({ pops: 0, chips: 0, gold: 0, lanterns: 0, steals: 0, kuro: 0, back: 0, cut: 0 })),
    ignite: [], placed: [null, null], ojama: [null, null], nextShell: 1000,
  };
}
// 引きはじめてよい所か。後手は先手の線のすぐそばから、どちらも尺玉・黒玉のすぐそばからは引きはじめられない
export function vsCanStart(st, o, p) {
  if (!p) return true;
  if (st.shells.some((s) => (s.type === 'shaku' || s.type === 'kuro') && Math.hypot(s.x - p.x, s.y - p.y) < SHELLS[s.type].r + VS_START_GAP)) return false;
  const other = st.vs.placed[1 - o];
  if (!other) return true;
  const f = st.fuse;
  for (let i = other.base; i < other.base + other.len; i++) if (Math.hypot(f.pts[i].x - p.x, f.pts[i].y - p.y) < VS_START_GAP) return false;
  return true;
}
// 線を置く（火はまだ）。置けなければ null（短すぎる・相手の線のすぐそばから引いた）
export function vsPlace(st, o, input, { normalized = false } = {}) {
  const v = st.vs;
  if (!v || v.placed[o] || st.phase !== 'draw') return null;
  const ink = v.ink[o], keep = st.ink;
  const pts = normalized ? input : normalizeStroke(input, ink);
  if (!pts || pts.length < 3 || !vsCanStart(st, o, pts[0])) return null;
  st.ink = ink;
  const placed = placePoints(st, pts, o);
  st.ink = keep;
  if (!placed) return null;
  v.placed[o] = placed;
  return placed.pts;
}
// お邪魔玉を置けない理由（置けるなら null）: 'out' 場の外・雲の中 / 'shell' 玉と重なる / 'start' 線の引きはじめのそば
export function vsOjamaWhy(st, x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < FIELD.x0 || x > FIELD.x1 || y < FIELD.y0 - 20 || y > FIELD.y1 + 20) return 'out';
  if (st.clouds.length && inCloud(st.clouds, x, y)) return 'out';
  if (st.shells.some((s) => !s.burst && Math.hypot(s.x - x, s.y - y) < SHELLS[s.type].r + SHELLS.kuro.r)) return 'shell';
  for (const p of st.vs.placed) if (p && Math.hypot(p.pts[0].x - x, p.pts[0].y - y) < VS_OJAMA_GAP) return 'start';
  return null;
}
export function vsCanOjama(st, x, y) { return !vsOjamaWhy(st, x, y); }
// お邪魔玉を置く（線を引いたあと、火をつける前。1 人 1 つ）
export function vsPlaceOjama(st, o, x, y) {
  const v = st.vs;
  x = Math.round(x); y = Math.round(y);
  if (!v || st.phase !== 'draw' || v.ojama[o] || !vsCanOjama(st, x, y)) return false;
  const s = { id: v.nextShell++, type: 'kuro', x, y, hue: 5, burst: false, burstAt: -1, hp: 2, lastSrc: null, from: o, crackBy: -1 };
  st.shells.push(s);
  v.ojama[o] = { x, y, id: s.id };
  st.events.push({ type: 'ojama', shell: s, o });
  return true;
}
// 黒玉に最初に線の火が届いた: その火は消え、その線は黒玉のまわりが濡れて切れる（ほかの線はそのまま）
function crackKuro(st, s, src, o) {
  const f = st.fuse, seg = +String(src).slice(1);
  const soak = Math.max(VS_KURO_SOAK, SHELLS.kuro.r + st.rules.reach + 4); // 触れた火の頭が必ず入る広さ
  for (let i = 0; i < f.pts.length; i++) if (f.seg[i] === seg && !f.wet[i] && Math.hypot(f.pts[i].x - s.x, f.pts[i].y - s.y) < soak) f.wet[i] = true;
  s.crackBy = o;
  st.vs.side[o].cut++;
  st.events.push({ type: 'crack', shell: s, o, from: s.from });
}
// 点火。2 人いっしょに火がつく（lag のある方は、その秒数だけ遅れて）
export function vsIgnite(st) {
  const v = st.vs;
  st.phase = 'burn';
  for (const o of [v.first, 1 - v.first]) {
    if (!v.placed[o]) continue;
    const d = Math.round((v.lag[o] || 0) / DT);
    if (d > 0) v.ignite.push({ tick: st.tick + d, o }); else igniteStroke(st, v.placed[o], o);
  }
  st.events.push({ type: 'vsStart', first: v.first });
}
// 1 コマごと: 遅れてつく火
function vsTick(st) {
  const v = st.vs;
  if (!v.ignite.length) return;
  const now = v.ignite.filter((g) => st.tick >= g.tick);
  v.ignite = v.ignite.filter((g) => st.tick < g.tick);
  for (const g of now) igniteStroke(st, v.placed[g.o], g.o);
}
export function vsMult(st, o) { const sd = st.vs.side[o]; return 1 + st.rules.startMult + sd.gold + Math.floor(sd.pops / st.rules.pulse); }
export function vsScore(st, o) { return st.vs.side[o].chips * vsMult(st, o); }
function finishVs(st) {
  const sc = [vsScore(st, 0), vsScore(st, 1)], sd = st.vs.side, f = st.fuse;
  // 相手の線のうち、自分の火で燃やした長さ（点の数）
  const took = [0, 0];
  for (let i = 0; i < f.pts.length; i++) if (f.owner[i] >= 0 && f.fire[i] >= 0 && f.fire[i] !== f.owner[i]) took[f.fire[i]]++;
  st.done = true; st.phase = 'done';
  const pick = (k) => sd.map((x) => x[k]);
  st.result = {
    vs: true, score: sc, winner: sc[0] > sc[1] ? 0 : sc[1] > sc[0] ? 1 : -1, total: st.shells.filter((s) => s.type !== 'kuro').length,
    pops: pick('pops'), chips: pick('chips'), mult: [vsMult(st, 0), vsMult(st, 1)], steals: pick('steals'), took,
    kuro: pick('kuro'), back: pick('back'), cut: pick('cut'), ojama: st.vs.ojama.map((x) => (x ? 1 : 0)),
  };
  st.events.push({ type: 'done', result: st.result });
  return st;
}

// ---- CPU の頭の中
// 近い玉を順につなぐ線（ばらつきは rng）。from から始め、墨が切れるか、つなげる玉が無くなるまで
function chainLine(st, from, ink, r, visited = new Set()) {
  const pts = [{ x: from.x, y: from.y }];
  let cur = from, used = 0;
  for (;;) {
    const cand = st.shells.filter((s) => !visited.has(s.id) && !crossesCloud(st.clouds, cur.x, cur.y, s.x, s.y))
      .map((s) => ({ s, d: Math.hypot(s.x - cur.x, s.y - cur.y) })).filter((c) => c.d > 1).sort((a, b) => a.d - b.d).slice(0, 3);
    if (!cand.length) break;
    const pick = cand[Math.floor(r() * cand.length)];
    if (used + pick.d > ink) {
      // 最後の玉まで届かなくても、墨の残りだけその方へ伸ばす
      const k = (ink - used) / pick.d;
      if (k > 0.3) pts.push({ x: cur.x + (pick.s.x - cur.x) * k, y: cur.y + (pick.s.y - cur.y) * k });
      break;
    }
    used += pick.d; visited.add(pick.s.id); cur = pick.s; pts.push({ x: cur.x, y: cur.y });
  }
  return pts;
}
// 考える線の候補。後手で cut のある相手は、先手の線に遅れて届く所を横切る線も考える
export function vsCandidates(st, o, rival, r) {
  const v = st.vs, f = st.fuse, ink = v.ink[o], out = [];
  const other = v.placed[1 - o];
  const okStart = (s) => vsCanStart(st, o, s) && !inCloud(st.clouds, s.x, s.y);
  const shells = st.shells.filter(okStart);
  if (!shells.length) return out;
  const pri = ['shaku', 'chouchin', 'ootama', 'kin'];
  const starts = [];
  for (const t of pri) for (const s of shells) if (s.type === t) starts.push(s);
  const n = rival.lines;
  const nCut = other && rival.cut ? Math.floor(n / 2) : 0;
  for (let c = 0; c < n - nCut; c++) {
    const s0 = c < starts.length && c % 2 === 0 ? starts[Math.floor(c / 2) % starts.length] : shells[Math.floor(r() * shells.length)];
    out.push(chainLine(st, s0, ink, r, new Set([s0.id])));
  }
  // 横取りの線: 先手の線の、火が遅れて届く所（途中から先）を目がけて、近くの玉から横切る
  for (let c = 0; c < nCut; c++) {
    const frac = 0.25 + 0.6 * ((c + 0.5) / nCut);
    const qi = other.base + Math.floor(frac * (other.len - 1));
    const q = f.pts[qi];
    if (!q || f.wet[qi]) continue;
    const theirs = (qi - other.base) * FUSE_SAMPLE / FUSE_SPEED; // 先手の火がそこへ届くまで（相手が先手なので、遅れなし）
    const near = shells.map((s) => ({ s, d: Math.hypot(s.x - q.x, s.y - q.y) })).filter((x) => x.d > VS_START_GAP && x.d < Math.min(150, ink * 0.5))
      .filter((x) => (v.lag[o] || 0) + x.d / FUSE_SPEED < theirs + (v.lag[1 - o] || 0) && !crossesCloud(st.clouds, x.s.x, x.s.y, q.x, q.y)).sort((a, b) => a.d - b.d);
    if (!near.length) continue;
    const s0 = near[Math.floor(r() * Math.min(3, near.length))].s;
    // 横切る点の少し先まで伸ばしてから、近い玉を順につなぐ
    const dx = q.x - s0.x, dy = q.y - s0.y, dl = Math.hypot(dx, dy) || 1;
    const over = { x: Math.max(1, Math.min(W - 2, q.x + dx / dl * 10)), y: Math.max(1, Math.min(H - 2, q.y + dy / dl * 10)) };
    const used = dl + 10;
    const rest = chainLine(st, over, Math.max(0, ink - used), r, new Set([s0.id]));
    out.push([{ x: s0.x, y: s0.y }, ...rest]);
  }
  return out;
}
// 線を 1 本ずつ試して選ぶ（1 本ごとに yield。ページでは、考えている間も画面を止めない）。
// make() は、この番の盤面を作り直す関数（先手の線がもう置いてあれば、それも置いた盤面）。
// 後手は、先手の線と並べて最後まで回し、差がいちばん大きい線を選ぶ。
// 先手は、相手の返し手（近い玉をつなぐ線と、横取りをねらう線）を probe × 2 本ためし、最悪と平均のあいだで測る
// （1 人で回していちばん点が高い線は、長くて横取りされやすい）
export function* vsPlanGen(make, o, rival, r) {
  const base = make();
  const other = base.vs.placed[1 - o];
  const cands = vsCandidates(base, o, rival, r);
  const probe = !other && rival.probe ? { lines: rival.probe * 2, cut: true } : null;
  const scored = [];
  for (const c of cands) {
    const st = make();
    if (!vsPlace(st, o, c)) { yield; continue; }
    const pts = st.vs.placed[o].pts;
    let val;
    if (probe) {
      const replies = vsCandidates(st, 1 - o, probe, r);
      const margins = [];
      for (const rep of replies) {
        const t = make();
        vsPlace(t, o, pts, { normalized: true });
        if (!vsPlace(t, 1 - o, rep)) continue;
        vsIgnite(t); runVs(t);
        margins.push(vsScore(t, o) - vsScore(t, 1 - o));
        yield;
      }
      if (!margins.length) { vsIgnite(st); runVs(st); margins.push(vsScore(st, o)); }
      val = 0.5 * Math.min(...margins) + 0.5 * margins.reduce((a, b) => a + b, 0) / margins.length;
    } else {
      vsIgnite(st); runVs(st);
      val = vsScore(st, o) - (other ? vsScore(st, 1 - o) : 0) * 0.8;
    }
    scored.push({ pts, val });
    yield;
  }
  scored.sort((a, b) => b.val - a.val);
  if (!scored.length) return null;
  return scored[Math.floor(r() * Math.min(scored.length, rival.pick || 1))].pts;
}
export function vsPlan(make, o, rival, r) {
  const g = vsPlanGen(make, o, rival, r);
  for (;;) { const x = g.next(); if (x.done) return x.value; }
}
// ---- CPU のお邪魔玉
// 置く所の候補: 2 本の線が交わる所（先に来た火を止め、あとから来た火で大爆発）と、相手の線の上に散らした所。
// 候補が多いときは、自分の線の上（横取りされそうな所をふさぐ）も少し
export function vsOjamaSpots(st, o, n, r) {
  const v = st.vs, f = st.fuse, out = [];
  const other = v.placed[1 - o], mine = v.placed[o];
  if (n <= 0 || (!other && !mine)) return out;
  const put = (line, i) => {
    const p = f.pts[i], a = f.pts[Math.max(line.base, i - 1)], b = f.pts[Math.min(line.base + line.len - 1, i + 1)];
    const dx = b.x - a.x, dy = b.y - a.y, dl = Math.hypot(dx, dy) || 1;
    for (const off of [0, 9, -9, 15, -15]) {
      const x = Math.round(p.x - dy / dl * off), y = Math.round(p.y + dx / dl * off);
      if (vsCanOjama(st, x, y) && !out.some((c) => Math.hypot(c.x - x, c.y - y) < 14)) { out.push({ x, y }); return true; }
    }
    return false;
  };
  // 線の上の u（0〜1）の所に置く。玉と重なって置けなければ、そこからいちばん近い置ける所へ
  const along = (line, u) => {
    const i0 = Math.floor(u * (line.len - 1));
    for (let d = 0; d < line.len; d++) for (const i of d ? [i0 + d, i0 - d] : [i0]) if (i >= 0 && i < line.len && put(line, line.base + i)) return;
  };
  if (!other) {
    // 相手の線がまだ無い（先に見せる側）: 自分の線の上（横取りしに来た火を止める罠）と、
    // 自分の線から離れた玉の群れの間（取りに来た線を止める罠）
    const nOwn = Math.ceil(n / 3);
    for (let k = 0; k < nOwn; k++) along(mine, (k + r()) / nOwn);
    const far = (x, y) => { for (let i = mine.base; i < mine.base + mine.len; i += 2) if (Math.hypot(f.pts[i].x - x, f.pts[i].y - y) < 40) return false; return true; };
    const gaps = [];
    for (let i = 0; i < st.shells.length; i++) for (let j = i + 1; j < st.shells.length; j++) {
      const a = st.shells[i], b = st.shells[j], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (a.type === 'kuro' || b.type === 'kuro' || d < 40 || d > 72) continue;
      const x = Math.round((a.x + b.x) / 2), y = Math.round((a.y + b.y) / 2);
      if (far(x, y) && vsCanOjama(st, x, y)) gaps.push({ x, y, w: SHELLS[a.type].pts + SHELLS[b.type].pts });
    }
    gaps.sort((p, q) => q.w - p.w); // 点の高い群れほど先に
    for (const c of shuffled(gaps.slice(0, Math.max(8, (n - out.length) * 3)), r)) {
      if (out.length >= n) break;
      if (!out.some((q) => Math.hypot(q.x - c.x, q.y - c.y) < 30)) out.push({ x: c.x, y: c.y });
    }
    return out;
  }
  if (mine && n >= 3) {
    const cross = [];
    for (let i = other.base; i < other.base + other.len; i += 2) {
      const p = f.pts[i];
      if (cross.some((j) => Math.hypot(f.pts[j].x - p.x, f.pts[j].y - p.y) < 30)) continue;
      for (let j = mine.base; j < mine.base + mine.len; j += 2) if (Math.hypot(f.pts[j].x - p.x, f.pts[j].y - p.y) < 8) { cross.push(i); break; }
    }
    for (const i of shuffled(cross, r).slice(0, Math.ceil(n / 3))) put(other, i);
  }
  const rest = n - out.length, nMine = mine && rest >= 4 ? Math.floor(rest / 4) : 0;
  for (let k = 0; k < rest - nMine; k++) along(other, (k + r()) / (rest - nMine));
  for (let k = 0; k < nMine; k++) along(mine, (k + r()) / nMine);
  return out;
}
// お邪魔玉の置き所を、1 か所ずつ最後まで回して選ぶ（1 回回すごとに yield）。
// make() は、この番の盤面（置いた順に、線とお邪魔玉まで）を作り直す関数。
// 相手の線がまだ無い（先に見せる）ときは、相手の返し手をいくつか引いて、最悪と平均のあいだで測る
// （相手は黒玉を見てから線を引くので、よけられる所はよけられたとして測る）
export function* vsOjamaPlanGen(make, o, rival, r) {
  const base = make();
  const spots = vsOjamaSpots(base, o, rival.ojama || 1, r);
  const blind = !base.vs.placed[1 - o];
  const replies = blind ? vsCandidates(base, 1 - o, { lines: Math.max(2, (rival.probe || 0) * 2 + 1), cut: true }, r) : [null];
  const scored = [];
  for (const c of spots) {
    const margins = [];
    for (const rep of replies) {
      const st = make();
      if (!vsPlaceOjama(st, o, c.x, c.y)) break;
      if (rep && !vsPlace(st, 1 - o, rep)) continue;
      vsIgnite(st); runVs(st);
      margins.push(vsScore(st, o) - vsScore(st, 1 - o));
      yield;
    }
    if (!margins.length) continue;
    scored.push({ x: c.x, y: c.y, val: 0.5 * Math.min(...margins) + 0.5 * margins.reduce((a, b) => a + b, 0) / margins.length });
  }
  if (!scored.length) return null;
  scored.sort((a, b) => b.val - a.val);
  return scored[Math.floor(r() * Math.min(scored.length, rival.ojamaPick || 1))];
}
// 先に見せる側の 1 番ぶん: 線を選び、その線に合わせてお邪魔玉の置き所を選ぶ。返り値は { pts, ojama }
export function* vsFirstPlanGen(make, o, rival, r) {
  const pts = yield* vsPlanGen(make, o, rival, r);
  if (!pts) return { pts: null, ojama: null };
  const ojama = yield* vsOjamaPlanGen(() => { const st = make(); vsPlace(st, o, pts, { normalized: true }); return st; }, o, rival, r);
  return { pts, ojama };
}
export function vsFirstPlan(make, o, rival, r) {
  const g = vsFirstPlanGen(make, o, rival, r);
  for (;;) { const x = g.next(); if (x.done) return x.value; }
}
export function vsOjamaPlan(make, o, rival, r) {
  const g = vsOjamaPlanGen(make, o, rival, r);
  for (;;) { const x = g.next(); if (x.done) return x.value; }
}
// 置き終えた盤面（火をつける前）を最後まで回した行く末。ページの目安に使う（火がつく前に、どうなるかを言える）。
// kuro は黒玉ごとに、最初に届いて消えた火の持ち主（crack）と、大爆発させた人（boom）。どちらも -1 は「起きない」
export function vsForecast(st) {
  vsIgnite(st); runVs(st);
  return {
    score: [vsScore(st, 0), vsScore(st, 1)],
    kuro: st.shells.filter((s) => s.type === 'kuro').map((s) => ({ from: s.from, x: s.x, y: s.y, crack: s.crackBy, boom: s.burst ? s.by : -1 })),
  };
}
// 盤面を最後まで回す（CPU の読みと、目安）
export function runVs(st, maxTicks = 60 * 60) {
  for (let n = 0; n < maxTicks && !st.done; n++) { step(st); st.events.length = 0; }
  if (!st.done) finish(st);
  return st.result;
}

// ---- お手本（はじめての人に、ルールを実演して見せる盤面）
// 台本: 相手の線 → あなたの線（相手の線を横切る）→ 相手のお邪魔玉（横取りされそうな所をふさぐ）
// → あなたのお邪魔玉（交わる所: 相手の火を止め、あとから来たあなたの火で大爆発）→ 点火して見守る
const demoLine = (pts, step = 6) => {
  const out = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / step));
    for (let k = i === 1 ? 0 : 1; k <= n; k++) out.push({ x: Math.round(a.x + (b.x - a.x) * k / n), y: Math.round(a.y + (b.y - a.y) * k / n) });
  }
  return out;
};
export const VS_DEMO = {
  shells: [
    ['kiku', 70, 168], ['kiku', 88, 194], ['kiku', 110, 150],
    ['kiku', 236, 146], ['kiku', 222, 194], ['kiku', 262, 222],
    ['kiku', 226, 254], ['ootama', 176, 226], ['kiku', 185, 146],
    ['kin', 322, 166], ['kiku', 330, 196],
    ['kiku', 92, 342], ['kiku', 132, 352], ['kiku', 200, 440], ['kiku', 250, 460], ['kiku', 70, 450],
  ],
  rival: demoLine([{ x: 40, y: 180 }, { x: 335, y: 180 }]),
  mine: demoLine([{ x: 250, y: 132 }, { x: 250, y: 240 }, { x: 150, y: 240 }, { x: 150, y: 196 }]),
  ojamaRival: { x: 300, y: 180 },
  ojamaTry: { x: 240, y: 215 },   // お手本で、はじめに指を置いてみせる所（自分の線の上: あなたの火が止まる）
  ojamaMine: { x: 150, y: 180 },  // 指をずらした先（交わる所: 相手の火を止め、あとから来たあなたの火で大爆発）
};
export function newVsDemo(moon = 4) {
  const st = newVsRound({ seed: 1, bout: 0, moon });
  st.shells = VS_DEMO.shells.map(([type, x, y], i) => ({ id: i, type, x, y, hue: i % 7, burst: false, burstAt: -1, hp: 1, lastSrc: null }));
  st.clouds = []; st.ropes = [];
  return st;
}

// 番を落としたときのヒント（上ほど効き目が大きい）
export function vsHint(st, o = 0) {
  const r = st.result, opp = 1 - o, f = st.fuse;
  if (!r || !r.vs) return null;
  const shaku = st.shells.find((s) => s.type === 'shaku');
  if (shaku && shaku.burst && shaku.by === opp) return { id: 'vsShaku' };
  if (r.kuro[opp] > r.kuro[o]) return { id: 'vsBoomed' };
  const theirK = st.shells.find((s) => s.type === 'kuro' && s.from === opp);
  if (theirK && theirK.crackBy === o && !(theirK.burst && theirK.by === o)) return { id: 'vsTrap' };
  if (r.took[opp] > r.took[o] + 12) return { id: 'vsTaken' };
  const lantern = st.shells.find((s) => s.type === 'chouchin' && s.burst && s.by === opp);
  if (lantern && !st.shells.some((s) => s.type === 'chouchin' && s.burst && s.by === o)) return { id: 'vsLantern' };
  const mineK = st.shells.find((s) => s.type === 'kuro' && s.from === o);
  if (!mineK || mineK.crackBy !== opp) return { id: 'vsOjama' };
  if (!r.steals[o]) return { id: 'vsCross' };
  let mine = 0; for (let i = 0; i < f.pts.length; i++) if (f.owner[i] === o) mine++;
  if (mine && r.pops[o] < r.pops[opp] / 2) return { id: 'vsDense' };
  return { id: 'vsGeneral' };
}

// ---- 挑戦状（同じ相手・同じ夜空で）
export function encodeVs(seed, rivalIdx, marks) {
  const m = (marks || '').replace(/[^wld]/g, '').slice(0, 3);
  return `${(seed >>> 0).toString(36)}.${rivalIdx}.${m}`;
}
export function decodeVs(s) {
  const m = /^([0-9a-z]{1,7})\.([0-9])\.([wld]{0,3})$/.exec(s || '');
  if (!m) return null;
  const seed = parseInt(m[1], 36), rival = +m[2];
  if (!Number.isFinite(seed) || seed > 0xffffffff || rival >= RIVALS.length) return null;
  return { seed: seed >>> 0, rival, marks: m[3] };
}
export function vsMarks(results) { return results.map((r) => (r.winner === 0 ? 'w' : r.winner === 1 ? 'l' : 'd')).join(''); }
export function vsShareText(match, lang, url = SITE_URL) {
  const rv = RIVALS[match.rival], en = lang === 'en';
  const w = match.results.filter((r) => r.winner === 0).length, l = match.results.filter((r) => r.winner === 1).length;
  const dots = match.results.map((r) => (r.winner === 0 ? '🔴' : r.winner === 1 ? '🔵' : '⚪')).join('');
  const sum = (k) => match.results.reduce((a, r) => a + r[k][0], 0);
  const steals = sum('steals'), boom = sum('kuro');
  const won = match.winner === 0;
  const head = en ? `Hanabi Battle vs ${rv.en}: ${won ? 'won' : 'lost'} ${w}-${l}` : `花火合戦 vs ${rv.ja}　${w}-${l} で${won ? '勝ち！' : '負け…'}`;
  const tail = en ? `Steals ${steals} · Big blasts ${boom}` : `横取り ${steals} ・ 大爆発 ${boom}`;
  return `${head}\n${dots} ${tail}\n${url}\n${en ? '#hitofudehanabi' : HASHTAG}`;
}

// ---------------------------------------------------------------- 夜ごとのお守り
// round は、大一番を越えたときの 2 つ目の選択（別の並びを出す。ページは引き直しにも round を変えて使う）。
// 候補は opts.pool（無ければ、伝説を除いた全部。伝説は勝った大一番の分だけ pool に入れる）のうち、仕掛けがもう出ているもの。
// 持っているお守りも、Lv が MAX_LV より下なら候補に出る（選ぶと Lv が上がる）。枠がいっぱいでも新しいものは出る（ページで入れかえる）。
// 珍しさで出やすさが変わる（RARITY_W の重み。めずらしいは半分、伝説は 3 割）。数は opts.count（無ければ段位の offer。ふだん 3）。
// 同じ種類にかたよらないように、倍率・届く玉は 数 − 1 まで、仕掛けへの備えは 1 つまで（足りなければ残りから足す）。決定的
export const RARITY_W = { common: 1, rare: 0.5, legend: 0.3 };
// 仕掛けが出てくる夜（段位 4 からは雲が二夜目から出るので、風切りも早く出る）
export function charmNeed(id, level = 0) { return id === 'kazekiri' && levelFx(level).clouds ? 1 : CHARM_NEEDS[id] || 0; }
export function offerCharms(seed, night, held, round = 0, opts = {}) {
  const level = opts.level || 0, count = opts.count != null ? opts.count : levelFx(level).offer;
  const lv = charmLevels(held);
  const rng = rng32(nightSeed(seed, night) ^ 0x51ed270b ^ (round ? 0x2b0d5 * round : 0));
  const items = CHARM_IDS.filter((id) => (opts.pool ? opts.pool.includes(id) : charmById(id).rarity !== 'legend'))
    .filter((id) => (lv[id] || 0) < MAX_LV && charmNeed(id, level) <= night + 1)
    .map((id) => ({ id, w: RARITY_W[charmById(id).rarity] || 1 }));
  // 重みつきで、1 つずつ引いて並べる（足し算と掛け算だけ。どの端末でも同じ並びになる）
  const order = [];
  while (items.length) {
    let tot = 0;
    for (const x of items) tot += x.w;
    let r = rng() * tot, k = 0;
    while (k < items.length - 1 && r >= items[k].w) { r -= items[k].w; k++; }
    order.push(items.splice(k, 1)[0].id);
  }
  const cap = { mult: Math.max(1, count - 1), reach: Math.max(1, count - 1), gimmick: 1 };
  const out = [], n = {};
  for (const id of order) {
    const k = charmById(id).kind;
    if (out.length < count && (n[k] || 0) < cap[k]) { out.push(id); n[k] = (n[k] || 0) + 1; }
  }
  for (const id of order) if (out.length < count && !out.includes(id)) out.push(id);
  return out;
}

// ---------------------------------------------------------------- 散ったときのヒント
// 終わった夜の様子から、次に効きそうなことを 1 つだけ選ぶ（上ほど効き目が大きい）
export function failHint(st) {
  const f = st.fuse, left = st.shells.filter((s) => !s.burst);
  const leftOf = (type) => left.filter((s) => s.type === type).length;
  // 1) 雲の中から引きはじめて、火がつかなかった
  if (st.strokes.length && f.wet[0] && st.pops === 0) return { id: 'cloudStart' };
  // 2) 大一番のコツ
  if (st.twist) return { id: 'twist_' + st.twist };
  // 3) 尺玉が残った（線の火でしかひらかない）／早くひらきすぎた（大トリは最後に）
  if (leftOf('shaku')) return { id: 'shaku' };
  if (st.tori && st.tori.share < 0.6) return { id: 'toriEarly', share: st.tori.share, add: st.tori.add };
  // 4) 提灯が灯らなかった／灯るのが遅かった（あとにひらく玉ほど点が倍）
  if (leftOf('chouchin') && leftOf('chouchin') === st.shells.filter((s) => s.type === 'chouchin').length) return { id: 'lantern' };
  const lit = st.shells.filter((s) => s.type === 'chouchin' && s.burst).map((s) => s.burstAt);
  if (lit.length && st.pops >= 8) {
    const order = st.shells.filter((s) => s.burst).map((s) => s.burstAt).sort((a, b) => a - b);
    if (Math.min(...lit) > order[Math.floor(order.length / 2)]) return { id: 'lanternLate' };
  }
  // 5) あと少しで満開（ふだん ×2、満開の加護なら ×2 × 加護）だった
  if (left.length > 0 && left.length <= 3) return { id: 'almost', n: left.length, bloom: st.rules.bloom * st.rules.bloomX };
  // 6) 墨が余った（残り墨を持っていても、届かなかった夜は使い切る方がよい）
  if (inkUsed(st) < st.inkTotal * 0.6) return { id: 'ink' };
  // 7) 仕掛け縄に火が届かなかった
  if (st.ropes.length && st.ropes.every((r) => !f.burnt.some((b, i) => b && f.rope[i]))) return { id: 'rope' };
  // 8) 湿った玉が残った（線でなぞるとひらく）
  if (leftOf('shime') >= 2) return { id: 'damp' };
  // 9) 金の玉が残った（倍率）
  if (leftOf('kin')) return { id: 'gold' };
  // 10) 線から遠い群れが残った
  if (left.length >= 4) return { id: 'far' };
  return { id: 'general' };
}

// ---------------------------------------------------------------- 願い札（夜ごとの小さな目標）
// 夜ごとに 1 枚。シード・夜・段位で決まり（今夜の一筆では、みんな同じ札）、その夜に意味のあるものだけから選ぶ（前の夜と同じ札は出さない）。
// どれも「その夜を越えたうえで」かなう（wishMet は、目標点に届いていなければ false）。かなえると ★1 と経験（ページと meta.js）。
// ja / en の {n} は wishFor が数に置きかえる。ok はその夜に出してよいか（night は 0 始まり、clouds は雲が出る夜か）
export const WISH_POPS = 0.7; // 「◯個以上ひらく」の数 = その夜の基本の玉の数 × これ
export const WISHES = [
  { id: 'w_lantern_first', ja: '提灯から引きはじめる', en: 'Start your line on a lantern', ok: (n) => n >= 3 },
  { id: 'w_all_gold', ja: '金の玉を全部ひらく', en: 'Open every gold shell', ok: () => true },
  { id: 'w_spare30', ja: '墨を3割残して越える', en: 'Clear with 30% of your ink left', ok: (n) => n < 7 },
  { id: 'w_pops', ja: '{n}個以上ひらく', en: 'Open {n} or more shells', ok: () => true },
  { id: 'w_touch_few', ja: '線でじかにふれる玉は4つまで', en: 'Touch at most 4 shells with your line', ok: (n, tw) => n >= 1 && tw !== 'kagami' },
  { id: 'w_double', ja: '目標の2倍をとる', en: 'Score double the target', ok: (n, tw) => !tw },
  { id: 'w_damp_all', ja: '湿った玉を全部ひらく', en: 'Open every damp shell', ok: (n) => n >= 5 },
  { id: 'w_tori8', ja: '大トリで倍率 +8 以上', en: 'Grand finale for +8 mult or more', ok: (n) => n === 7 },
  { id: 'w_rope_all', ja: '仕掛け縄に全部火をつける', en: 'Light every fuse rope', ok: (n) => n >= 6 },
  { id: 'w_no_cloud', ja: '雲にふれずに越える', en: 'Clear without touching a cloud', ok: (n, tw, clouds) => clouds },
  { id: 'w_gold_first', ja: 'はじめにひらくのは金の玉', en: 'Make a gold shell burst first', ok: () => true },
  { id: 'w_bloom', ja: '満開にする（全部ひらく）', en: 'Full bloom: open every shell', ok: (n) => n <= 3 },
  { id: 'w_short', ja: '墨の半分以下で越える', en: 'Clear using half your ink or less', ok: (n) => n < 7 },
  { id: 'w_big_all', ja: '大玉を全部ひらく', en: 'Open every big shell', ok: (n) => n >= 1 },
];
export function wishById(id) { return WISHES.find((w) => w.id === id) || null; }
export function wishFor(seed, night, level = 0) {
  if (night < 0 || night >= NIGHTS) return null;
  const tw = twistFor(seed, night), clouds = night >= (levelFx(level).clouds ? 1 : 4);
  const prev = night > 0 ? wishFor(seed, night - 1, level).id : null;
  const pool = WISHES.filter((w) => w.id !== prev && w.ok(night, tw ? tw.id : null, clouds));
  const w = pool[Math.floor(rng32(hashStr(`hitofude-wish:${seed >>> 0}:${night}:${level}`))() * pool.length)];
  const n = w.id === 'w_pops' ? Math.round(BASE_COUNTS[night] * WISH_POPS) : undefined;
  const fill = (t) => (n == null ? t : t.replace('{n}', n));
  return n == null ? { id: w.id, ja: w.ja, en: w.en } : { id: w.id, n, ja: fill(w.ja), en: fill(w.en) };
}
// 終わった夜で、願いがかなったか。wish は wishFor の返り値（または id）。target は越えるべき点（無ければ st.target）
export function wishMet(st, wish, target = st.target) {
  if (!st || !st.done || !st.result || st.vs || !wish) return false;
  const w = typeof wish === 'string' ? { id: wish } : wish, S = st.stats, score = st.result.score;
  if (score < (target || 0)) return false;
  switch (w.id) {
    case 'w_lantern_first': return S.startType === 'chouchin';
    case 'w_all_gold': return S.goldTotal > 0 && S.goldBurst === S.goldTotal;
    case 'w_spare30': return S.inkFrac <= 0.7 + 1e-9;
    case 'w_pops': return S.pops >= (w.n != null ? w.n : Math.round(BASE_COUNTS[st.night] * WISH_POPS));
    case 'w_touch_few': return S.lineTouched <= 4;
    case 'w_double': return score >= 2 * (target || 0);
    case 'w_damp_all': return S.dampTotal > 0 && S.dampBurst === S.dampTotal;
    case 'w_tori8': return S.toriAdd >= 8;
    case 'w_rope_all': return S.ropesTotal > 0 && S.ropesLit === S.ropesTotal;
    case 'w_no_cloud': return !S.cloudTouched;
    case 'w_gold_first': return S.firstPop === 'kin';
    case 'w_bloom': return S.allClear;
    case 'w_short': return S.inkFrac <= 0.5 + 1e-9;
    case 'w_big_all': return S.bigTotal > 0 && S.bigBurst === S.bigTotal;
    default: return false;
  }
}

// ---------------------------------------------------------------- 筆跡占い
// 線の形から、その人の「筆跡」を 7 つのどれかに見立てる（結果とシェアに出す）
export const STROKE_TYPES = [
  { id: 'nyuukon', emoji: '🎯', ja: 'ひと筆入魂', en: 'One Touch', line: '短く、深く。無駄のない一筆', lineEn: 'Short and deep. Nothing wasted' },
  { id: 'massugu', emoji: '🏹', ja: '一直線', en: 'Arrow', line: '狙いをしぼった、まっすぐな一筆', lineEn: 'Aimed and straight' },
  { id: 'wa', emoji: '⭕', ja: 'ひと回り', en: 'Full Circle', line: '始まりに帰ってくる、律儀な一筆', lineEn: 'Comes back to where it began' },
  { id: 'uzumaki', emoji: '🌀', ja: '渦巻き', en: 'Whirlpool', line: 'ぐるりと巻き込む、欲ばりな一筆', lineEn: 'Spirals in to take it all' },
  { id: 'inazuma', emoji: '⚡', ja: '稲妻', en: 'Lightning', line: '迷いなく折れる、勝負師の一筆', lineEn: 'Sharp turns, no hesitation' },
  { id: 'nami', emoji: '🌊', ja: '波乗り', en: 'Wave Rider', line: 'ゆらゆら拾っていく、しなやかな一筆', lineEn: 'Sways and gathers, supple' },
  { id: 'sanpo', emoji: '🐾', ja: 'ぶらり散歩', en: 'Wanderer', line: '寄り道が、いちばんの近道', lineEn: 'Detours are the best shortcuts' },
];
export function strokeType(pts, { ink = BASE_INK, pops = 0, total = 1 } = {}) {
  const list = (pts || []).filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y));
  const T = (id) => STROKE_TYPES.find((t) => t.id === id);
  if (list.length < 3) return T('nyuukon');
  const len = pathLength(list), a = list[0], b = list[list.length - 1], chord = Math.hypot(b.x - a.x, b.y - a.y);
  // 3 点おき（約 24 単位）に向きの変わり方を見る（指のぶれを拾わない）
  const q = list.filter((_, i) => i % 3 === 0 || i === list.length - 1);
  let turn = 0, flips = 0, lastSign = 0;
  for (let i = 1; i < q.length - 1; i++) {
    const ang = Math.atan2(q[i + 1].y - q[i].y, q[i + 1].x - q[i].x) - Math.atan2(q[i].y - q[i - 1].y, q[i].x - q[i - 1].x);
    const d = Math.atan2(Math.sin(ang), Math.cos(ang));
    turn += d;
    if (Math.abs(d) > 0.25) { const sg = Math.sign(d); if (lastSign && sg !== lastSign) flips++; lastSign = sg; }
  }
  const sharp = cornerIndices(list).length;
  if (len < ink * 0.45 && pops >= total * 0.6) return T('nyuukon');
  if (chord / len > 0.9) return T('massugu');
  if (len > 180 && chord < len * 0.15) return T('wa');
  if (Math.abs(turn) > Math.PI * 1.6) return T('uzumaki');
  if (sharp >= 3) return T('inazuma');
  if (flips >= 3) return T('nami');
  return T('sanpo');
}

// ---------------------------------------------------------------- 共有・挑戦状・再生
export const SITE_URL = 'https://yuichi916.github.io/hitofude.html';
export const HASHTAG = '#一筆花火';

export function fmt(n) { return Math.round(n).toLocaleString('en-US'); }

// 夜ごとの結果。🎆 目標の 3 倍以上 / ✨ 越えた / 💥 散った / 🌑 たどり着かず
export function nightMark(r) {
  if (!r) return '🌑';
  if (r.score < r.target) return '💥';
  return r.score >= r.target * 3 ? '🎆' : '✨';
}

export function runShareText(run, lang, url = SITE_URL) {
  // 絵文字は見出しの 🎆 だけ。結果は言葉で書く（夜ごとの印の列は画面とシェア画像にだけ出す）
  const en = lang === 'en';
  const cleared = run.nights.filter((r) => r && r.score >= r.target).length;
  const moon = MOONS[run.moon];
  let head;
  if (run.daily) {
    const md = `${+run.key.slice(5, 7)}/${+run.key.slice(8, 10)}`;
    head = `🎆${en ? 'Hitofude Hanabi' : '一筆花火'} #${run.no} ${md} ${en ? moon.en : moon.ja}`;
  } else head = en ? '🎆Hitofude Hanabi' : '🎆一筆花火';
  const line2 = cleared === NIGHTS ? (en ? `Stage ${STAGE.id} clear!` : `ステージ${STAGE.id} 完走`)
    : (en ? `Stage ${STAGE.id} · ${cleared}/${NIGHTS} nights` : `ステージ${STAGE.id} ${cleared}/${NIGHTS}夜`);
  const line3 = en ? `${fmt(run.total)} pts · best chain ${run.bestChain}` : `${fmt(run.total)}点・最大${run.bestChain}連鎖`;
  // 筆跡と、大一番の結果（今夜の一筆は、みんな同じ大一番）
  const extra = [];
  if (run.type) { const ty = STROKE_TYPES.find((x) => x.id === run.type); if (ty) extra.push(en ? `Stroke: ${ty.en}` : `筆跡「${ty.ja}」`); }
  const bosses = run.nights.filter((r) => r && r.twist).map((r) => {
    const tw = TWISTS.find((x) => x.id === r.twist); if (!tw) return null;
    const won = r.score >= r.target;
    return en ? `${tw.en} ${won ? 'cleared' : 'missed'}` : `「${tw.ja}」${won ? '成功' : '届かず'}`;
  }).filter(Boolean);
  if (bosses.length) extra.push((en ? 'Boss ' : '大一番') + bosses.join(en ? ', ' : '、'));
  const line4 = extra.length ? '\n' + extra.join(en ? ' · ' : '・') : '';
  return `${head}\n${line2} ${line3}${line4}\n${url}\n${en ? '#hitofudehanabi' : HASHTAG}`;
}

// 同じ夜で勝負: #s=<seed36>.<moon>[.<score>]
export function encodeDuel(seed, moon, score) {
  return `${(seed >>> 0).toString(36)}.${moon}${score ? '.' + Math.round(score) : ''}`;
}
export function decodeDuel(s) {
  const m = typeof s === 'string' && s.match(/^([0-9a-z]{1,7})\.([0-7])(?:\.(\d{1,12}))?$/);
  if (!m) return null;
  const seed = parseInt(m[1], 36);
  if (!Number.isFinite(seed) || seed > 0xffffffff) return null;
  return { seed: seed >>> 0, moon: +m[2], score: m[3] ? +m[3] : 0 };
}

// 一筆の再生: [版4][シード32][月3][夜3][段位4][お守りの Lv 2×お守りの数][墨壺10][本数1+1][各線: 点数7, (x9, y10)×点数]
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
// 版 2: 大一番と夜の景色を足した。版 3: 連鎖の減衰・大トリ・お守りの入れ替え・墨壺。
// 版 4: お守りの Lv・24 個のお守り・段位（前の版のリンクは、同じ夜を作れないので読まない）
export const REPLAY_VERSION = 4;
function writer() {
  const out = []; let acc = 0, n = 0;
  return {
    put(v, bits) { for (let i = bits - 1; i >= 0; i--) { acc = (acc << 1) | (Math.floor(v / 2 ** i) & 1); if (++n === 6) { out.push(B64[acc]); acc = 0; n = 0; } } },
    done() { if (n) out.push(B64[acc << (6 - n)]); return out.join(''); },
  };
}
function reader(s) {
  const vals = [];
  for (const ch of s) { const v = B64.indexOf(ch); if (v < 0) return null; vals.push(v); }
  let i = 0, bit = 0;
  return {
    get(bits) {
      let v = 0;
      for (let k = 0; k < bits; k++) {
        if (i >= vals.length) throw new Error('short');
        v = v * 2 + ((vals[i] >>> (5 - bit)) & 1);
        if (++bit === 6) { bit = 0; i++; }
      }
      return v;
    },
  };
}
export function encodeReplay({ seed, moon, night, charms, strokes, bank = 0, level = 0 }) {
  const w = writer();
  w.put(REPLAY_VERSION, 4); w.put(seed >>> 0, 32); w.put(moon, 3); w.put(night, 3);
  w.put(Math.max(0, Math.min(MAX_LEVEL, Math.floor(+level || 0))), 4);
  const lv = charmLevels(charms || []);
  for (const id of CHARM_IDS) w.put(lv[id] || 0, 2);
  w.put(Math.max(0, Math.min(BASE_INK, Math.floor(+bank || 0))), 10);
  w.put(Math.min(2, strokes.length) - 1, 1);
  for (const pts of strokes.slice(0, 2)) {
    w.put(pts.length, 7);
    for (const p of pts) { w.put(p.x, 9); w.put(p.y, 10); }
  }
  return w.done();
}
// 返り値の charms は、Lv の数だけ同じ id を並べた配列（CHARM_IDS の並び）
export function decodeReplay(s) {
  if (typeof s !== 'string' || s.length < 12 || s.length > 900) return null;
  const r = reader(s);
  if (!r) return null;
  try {
    const ver = r.get(4);
    if (ver !== REPLAY_VERSION) return ver >= 1 && ver < REPLAY_VERSION ? { old: true } : null;
    const seed = r.get(32) >>> 0, moon = r.get(3), night = r.get(3), level = r.get(4);
    if (night >= NIGHTS || level > MAX_LEVEL) return null;
    const lv = {};
    for (const id of CHARM_IDS) lv[id] = r.get(2);
    const charms = charmList(lv);
    const bank = r.get(10);
    if (bank > BASE_INK) return null;
    const count = r.get(1) + 1;
    const strokes = [];
    for (let k = 0; k < count; k++) {
      const n = r.get(7);
      if (n < 3) return null;
      const pts = [];
      for (let i = 0; i < n; i++) {
        const x = r.get(9), y = r.get(10);
        if (x >= W || y >= H) return null;
        pts.push({ x, y });
      }
      strokes.push(pts);
    }
    return { seed, moon, night, charms, strokes, bank, level };
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------- 記録
// 連続記録は「遊んだ日」で数える。1 日だけの休みは、7 日に 1 回まで見逃す
export function nextStreak(prev, today) {
  const s = { streak: 0, last: null, freezeOn: null, ...(prev || {}) };
  if (s.last === today) return s;
  if (!s.last) return { ...s, streak: 1, last: today };
  const gap = Math.round((keyToUTC(today) - keyToUTC(s.last)) / DAY_MS);
  if (gap === 1) return { ...s, streak: s.streak + 1, last: today };
  const freezeOk = !s.freezeOn || Math.round((keyToUTC(today) - keyToUTC(s.freezeOn)) / DAY_MS) >= 7;
  if (gap === 2 && freezeOk) return { ...s, streak: s.streak + 1, last: today, freezeOn: addDays(today, -1) };
  return { ...s, streak: 1, last: today };
}
export function currentStreak(s, today) {
  if (!s || !s.last || !s.streak) return 0;
  const gap = Math.round((keyToUTC(today) - keyToUTC(s.last)) / DAY_MS);
  if (gap <= 1) return s.streak;
  const freezeOk = !s.freezeOn || Math.round((keyToUTC(today) - keyToUTC(s.freezeOn)) / DAY_MS) >= 7;
  return gap === 2 && freezeOk ? s.streak : 0;
}
// counts[i] = i 夜を越えた人数。自分より先まで行った人数 + 同じ人数の半分 から上位 % を出す
export function topPercent(counts, mine) {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total < 10) return null;
  let better = 0;
  for (let i = mine + 1; i < counts.length; i++) better += counts[i];
  const p = Math.round(((better + counts[mine] / 2) / total) * 100);
  return Math.max(1, Math.min(99, p));
}
