// 一筆花火の「絵の式」。お守り・願い札・仕掛け・大一番・ヒント・屋台の効き目を、言葉を使わずに
// 花火玉の絵・アイコン・数字の短い列で表す（読まなくても、見ればわかるように）。
// 数字は core の CHARM_LV などから読む（ルールの数字を変えても、式がずれない）。DOM に触るのは glyphEl だけ。
// テストは tests/hitofude_glyphs_test.mjs。
//
// 式は札（token）の配列:
//  { k: 'shell', v: 玉の種類 | 'any' }  花火玉の絵（ページの shellImg で描く。'any' はどれか 1 つの玉）
//  { k: 'icon', v: ICONS の名前 }       アイコン（icons.js）
//  { k: 'mult', v: '+3' }               倍率に足す（赤）
//  { k: 'xmult', v: '×1.5' }            倍率に掛ける（金）
//  { k: 'chips', v: '×2' }              点に足す・掛ける（青）
//  { k: 'num', v: '≥30%' }              そのほかの数・条件（6 字まで。数字と記号だけ）
//  { k: 'op', v: '→' }                  原因と結果のあいだ（→ / + / × / ✕「できない・なくなる」/ ↻「もう一度」）
//  { k: 'sep' }                         効き目のまとまりの区切り（まとまりは 2 つまで）
//  lv3: true は Lv3 で増えるふるまい。Lv3 のときだけ、最後に区切り（これも lv3）のあとへ足す
//
// 読み方の決まり（どの式でも同じにする）:
//  ・ただの数（10%・4）は「…ごとに」、≥ ≤ は「…以上・以下」、① は「いちばんはじめ」、①-④ は「はじめの 4 つ」
//  ・[線][玉] は「線でじかにふれた玉」、[玉][100%] は「その玉を全部ひらく」、[玉][+3] は「その玉が 3 つ増える」
//  ・墨は残した墨（inkLeft）で数える。「墨を 8 割以上使う」は「残り ≤20%」
//  ・[代] は連鎖の深さ（代ごとに玉が小さくなる）。ふだんは代ごとに −15%
import {
  CHARM_LV, MAX_LV, SHELLS, wishById, rulesFor,
  DECAY, SOFT_DECAYS, SPARE_STEP, SPARE_HALF, SENKOU_USE, MANEKI_CAP, BLOOM, TORI_BONUS, FOX_R, DEEP_SPARKS,
  SLOW_FUSE, DAMP_HITS, DARK_SECONDS, SNAP_SECONDS, MIRROR_INK,
} from './core.js';

// お守りなしの夜のルール（金の玉の倍率・提灯の点の倍・千輪の火花の数を読む）
const BASE = rulesFor([], 4);
// 屋台の「墨」で墨壺に足す量（1 夜ぶんの墨に対して。ページの屋台と同じ）
export const SHOP_INK = 1 / 4;

// ---- 数の書き方
const MINUS = '−';
const n2 = (x) => String(Math.round(x * 100) / 100);
const FRAC = [[0.5, '½'], [0.25, '¼'], [0.75, '¾'], [1 / 3, '⅓'], [2 / 3, '⅔']];
const fr = (x) => { const f = FRAC.find(([v]) => Math.abs(v - x) < 1e-9); return f ? f[1] : n2(x); };
const times = (x) => `×${fr(x)}`;                              // 1.5 → ×1.5、0.75 → ×¾
const pct = (x) => `${Math.round(x * 100)}%`;                  // 0.3 → 30%
const up = (x) => `+${Math.round((x - 1) * 100)}%`;            // 1.7 → +70%
const down = (x) => `${MINUS}${Math.round((1 - x) * 100)}%`;   // 0.7 → −30%
const plus = (x) => `+${n2(x)}`;
const circ = (n) => String.fromCharCode(0x2460 + Math.max(1, Math.min(20, n)) - 1); // ①〜⑳
const shrink = (decay) => down(decay);                         // 代ごとの大きさ 0.85 → −15%

// ---- 札を作る
const S = (v) => ({ k: 'shell', v });
const I = (v) => ({ k: 'icon', v });
const M = (v) => ({ k: 'mult', v });
const X = (v) => ({ k: 'xmult', v });
const CH = (v) => ({ k: 'chips', v });
const N = (v) => ({ k: 'num', v });
const O = (v = '→') => ({ k: 'op', v });
// 2 つの小さな式を + でつなぐ（空のものは飛ばす）
const and = (...parts) => parts.filter((p) => p && p.length).reduce((a, p) => (a.length ? [...a, O('+'), ...p] : p), []);
// まとまりを区切りでつなぎ、Lv3 のまとまりを lv3 つきで最後に足す
function join(groups, lv3 = null) {
  const out = [];
  for (const g of groups) if (g && g.length) { if (out.length) out.push({ k: 'sep' }); out.push(...g); }
  if (lv3 && lv3.length) { out.push({ k: 'sep', lv3: true }); for (const t of lv3) out.push({ ...t, lv3: true }); }
  return out;
}

// ---------------------------------------------------------------- お守り
// CHARM[id](v, i) は v = CHARM_LV[id]、i = Lv − 1 を受けて { g: まとまりの配列, x: Lv3 のまとまり } を返す。
// Lv3 のまとまりは、Lv3 だけが 0 でない数（CHARM_LV の keep・sparks など）があるときに出す
const CHARM = {
  // 墨 +70%・線の火が届く幅 ×1.3【線でふれた玉は ×1.5 の大きさ・線は雲の中でも燃える】
  nagafude: (v, i) => ({
    g: [[I('ink'), N(up(v.ink[i]))], [I('reach'), N(times(v.reach[i]))]],
    x: and(v.touchR[i] > 1 ? [I('stroke'), S('any'), O(), I('size'), N(times(v.touchR[i]))] : null, v.cloud[i] ? [I('cloudLine')] : null),
  }),
  // 墨を 1 割残すごとに 倍率 +1【半分以上残せば ×1.5】
  nokorizumi: (v, i) => ({
    g: [[I('inkLeft'), N(pct(SPARE_STEP)), O(), M(plus(v.mult[i]))]],
    x: v.half[i] > 1 ? [I('inkLeft'), N(`≥${pct(SPARE_STEP * SPARE_HALF)}`), O(), X(times(v.half[i]))] : null,
  }),
  // 代ごとの縮み −15% → −8%・ひらく大きさ +10%【3 代目までは縮まない】
  tairin: (v, i) => ({
    g: [[I('gen'), N(shrink(DECAY)), O(), N(shrink(SOFT_DECAYS[v.soft[i]]))], [I('size'), N(up(v.size[i]))]],
    x: v.keep[i] ? [I('gen'), N(`≤${v.keep[i]}`), O(), N('±0%')] : null,
  }),
  // 金の玉 → 倍率 +2（ふだんは +1）【金の玉が大きくひらく】
  kinun: (v, i) => ({
    g: [[S('kin'), O(), M(plus(v.gold[i]))]],
    x: v.R[i] ? [S('kin'), O(), I('size'), N(times(v.R[i] / SHELLS.kin.R))] : null,
  }),
  // 導火線 ×0.6 の速さ → 倍率 +3 から【線でふれた玉 2 つごとに 倍率 +1】
  osobi: (v, i) => ({
    g: [[I('slow'), N(times(SLOW_FUSE)), O(), M(plus(v.mult[i]))]],
    x: v.touch[i] ? [I('stroke'), S('any'), N(String(v.touch[i])), O(), M('+1')] : null,
  }),
  // 線でふれた金 → さらに倍率 +3【その金から火花 10 本】
  ichibanboshi: (v, i) => ({
    g: [[I('stroke'), S('kin'), O(), M(plus(v.gold[i]))]],
    x: v.sparks[i] ? [I('stroke'), S('kin'), O(), I('sparks'), N(String(v.sparks[i]))] : null,
  }),
  // 線の終わり → 爆ぜる（ふつうの玉の ×2.6）・尺玉 → 倍率 +2【線の始まりも爆ぜる】
  owaridama: (v, i) => ({
    g: [[I('lineEnd'), O(), I('boom'), N(times(v.R[i] / SHELLS.kiku.R))], [S('shaku'), O(), M(plus(v.tori[i]))]],
    x: v.start[i] ? [I('lineStart'), O(), I('boom')] : null,
  }),
  // 連鎖でひらいた玉 4 つごとに 倍率 +1【連鎖でひらいた玉は点 ×1.5】
  kodou: (v, i) => ({
    g: [[I('chain'), N(String(v.step[i])), O(), M('+1')]],
    x: v.chips[i] > 1 ? [I('chain'), O(), CH(times(v.chips[i]))] : null,
  }),
  // 85% 以上ひらく → ×1.5【残り 2 つまでなら満開（×2）】
  mankai: (v, i) => ({
    g: [[S('any'), N(`≥${pct(v.share[i])}`), O(), X(times(v.x[i]))]],
    x: v.near[i] ? [S('any'), N(`${MINUS}${v.near[i]}`), O(), X(times(BLOOM))] : null,
  }),
  // 玉 +5【大玉 +3】
  mashidama: (v, i) => ({
    g: [[S('kiku'), N(plus(v.n[i]))]],
    x: v.big[i] ? [S('ootama'), N(plus(v.big[i]))] : null,
  }),
  // 55% 以上ひらく → もう 1 本（墨 30%）【残した墨も 2 本目に】
  nihitsu: (v, i) => ({
    g: [[S('any'), N(`≥${pct(v.share[i])}`), O(), I('two'), I('ink'), N(pct(v.ink[i]))]],
    x: v.keep[i] ? [I('inkLeft'), O(), I('two')] : null,
  }),
  // ひらいた玉の 50% → もう一度はじける【もう一度、もう一度】
  nokoribi: (v, i) => ({
    g: [[I('firework'), N(pct(v.p[i])), O(), I('again')]],
    x: v.again[i] ? [I('again'), O(), I('again')] : null,
  }),
  // 提灯 → 点 ×2.5（ふだんは ×2）【提灯 +1】
  chouchinshi: (v, i) => ({
    g: [[S('chouchin'), O(), CH(times(1 + v.gain[i]))]],
    x: v.lantern[i] ? [S('chouchin'), N(plus(v.lantern[i]))] : null,
  }),
  // 湿った玉 → ふつうの玉・点 ×1.5（Lv2 から倍率 +1）【大きくひらく】
  amayoke: (v, i) => ({
    g: [[S('shime'), O(), S('kiku'), CH(times(v.pts[i])), ...(v.mult[i] ? [M(plus(v.mult[i]))] : [])]],
    x: v.R[i] ? [S('shime'), O(), I('size'), N(times(v.R[i] / SHELLS.shime.R))] : null,
  }),
  // 雲 ×½（Lv3 は ×0 = 消える）・雲 1 つ → 倍率 +2【雲のあとに大玉】
  kazekiri: (v, i) => ({
    g: [[I('cloud'), N(times(v.scale[i]))], [I('cloud'), O(), M(plus(v.mult[i]))]],
    x: v.big[i] ? [I('cloud'), O(), S('ootama')] : null,
  }),
  // 金の玉 → ×1.12（重なる。×3 まで）【金の玉 +1】
  maneki: (v, i) => ({
    g: [[S('kin'), O(), X(times(v.x[i])), N(`≤×${n2(MANEKI_CAP)}`)]],
    x: v.gold[i] ? [S('kin'), N(plus(v.gold[i]))] : null,
  }),
  // 提灯 → 倍率 +2【灯った提灯から火花 8 本】
  hanaikada: (v, i) => ({
    g: [[S('chouchin'), O(), M(plus(v.mult[i]))]],
    x: v.sparks[i] ? [S('chouchin'), O(), I('sparks'), N(String(v.sparks[i]))] : null,
  }),
  // 代ごとに ×0.09 ずつ【4 代目からの玉は火花 4 本】
  renjishi: (v, i) => ({
    g: [[I('gen'), O(), X(`+×${n2(v.x[i])}`)]],
    x: v.deep[i] ? [I('gen'), N(`≥${v.deep[i]}`), O(), I('sparks'), N(String(DEEP_SPARKS))] : null,
  }),
  // 墨を 1 割残すごとに 点 +10%【残した墨で、線の終わりが爆ぜる】
  suminagashi: (v, i) => ({
    g: [[I('inkLeft'), N(pct(SPARE_STEP)), O(), CH(`+${pct(v.pct[i])}`)]],
    x: v.blast[i] ? [I('inkLeft'), O(), I('lineEnd'), I('boom')] : null,
  }),
  // 墨 −30%・残りが 2 割以下（8 割以上使う）→ ×1.6【燃える線から火花】
  senkou: (v, i) => ({
    g: [[I('ink'), N(down(v.ink[i]))], [I('inkLeft'), N(`≤${pct(1 - SENKOU_USE)}`), O(), X(times(v.x[i]))]],
    x: v.sparks[i] ? [I('stroke'), O(), I('sparks')] : null,
  }),
  // まっすぐな線 → ×1.35【線の終わりから突風】
  tengu: (v, i) => ({
    g: [[I('straight'), O(), X(times(v.x[i]))]],
    x: v.gust[i] ? [I('lineEnd'), O(), I('wind')] : null,
  }),
  // 線の前の 80% → 左右に映る【上下・ななめにも】
  tanuki: (v, i) => ({
    g: [[I('stroke'), N(pct(v.part[i])), O(), I('mirror')]],
    x: v.flip[i] ? [I('stroke'), O(), I('mirror4')] : null,
  }),
  // はじめの 4 つ → 狐火・狐火は ×1.5 の大きさ【狐火から、また狐火】
  kitsune: (v, i) => ({
    g: [[I('firework'), N(`①-${circ(v.n[i])}`), O(), I('fox')], [I('fox'), O(), I('size'), N(times(FOX_R))]],
    x: v.relay[i] ? [I('fox'), O(), I('fox')] : null,
  }),
  // 導火線 ×1.6 の速さ・代ごとの縮み −19% → ×1.35【線の終わりからも火がつく】
  kamaitachi: (v, i) => ({
    g: [[I('fast'), N(times(v.speed[i])), I('gen'), N(shrink(DECAY - v.decay[i])), O(), X(times(v.x[i]))]],
    x: v.both[i] ? [I('lineEnd'), O(), I('flame')] : null,
  }),
};

// お守りの式（lv は 1〜3）。知らない id は空の配列
export function charmGlyph(id, lv = 1) {
  const f = CHARM[id], v = CHARM_LV[id];
  if (!f || !v) return [];
  const i = Math.max(1, Math.min(MAX_LV, Math.floor(+lv) || 1)) - 1;
  const { g, x } = f(v, i);
  return join(g, x);
}

// ---------------------------------------------------------------- 願い札
// n は w_pops の数（wishFor の返り値の n）。無ければ「?」
const count = (n) => { const k = n == null || n === '' ? NaN : Math.round(+n); return Number.isFinite(k) && k >= 0 && k < 1e5 ? String(k) : '?'; };
const WISH = {
  w_lantern_first: () => [[I('lineStart'), S('chouchin')]],
  w_all_gold: () => [[S('kin'), N('100%')]],
  w_spare30: () => [[I('inkLeft'), N('≥30%')]],
  w_pops: (n) => [[S('any'), N(`≥${count(n)}`)]],
  w_touch_few: () => [[I('stroke'), S('any'), N('≤4')]],
  w_double: () => [[I('target'), N('×2')]],
  w_damp_all: () => [[S('shime'), N('100%')]],
  w_rope_all: () => [[I('rope'), N('100%')]],
  w_no_cloud: () => [[I('stroke'), I('cloud'), O('✕')]],
  w_gold_first: () => [[S('kin'), N('①')]],
  w_bloom: () => [[S('any'), N('100%')]],
  w_short: () => [[I('inkLeft'), N('≥50%')]],
  w_big_all: () => [[S('ootama'), N('100%')]],
};
// 大トリの札（w_tori6・前の版の w_tori8）は、札の言葉の「+6」を読む
const toriWish = (id) => {
  const w = wishById(id), m = w && String(w.en).match(/\+(\d+)/);
  return m ? [[S('shaku'), M(`≥+${m[1]}`)]] : null;
};
export function wishGlyph(id, n) {
  const g = WISH[id] ? WISH[id](n) : /^w_tori\d+$/.test(id) ? toriWish(id) : null;
  return g ? join(g) : [];
}

// ---------------------------------------------------------------- 夜ごとに増える仕掛け
const GIMMICK = {
  // 大玉 → ふつうの玉の ×1.6 の大きさ
  ootama: () => [[S('ootama'), O(), I('size'), N(times(SHELLS.ootama.R / SHELLS.kiku.R))]],
  // 千輪 → 火花 6 本（まっすぐ遠くまで）
  senrin: () => [[S('senrin'), O(), I('sparks'), N(String(BASE.senrinSparks))]],
  // 提灯から引きはじめる → 点 ×2
  chouchin: () => [[I('lineStart'), S('chouchin'), O(), CH(times(1 + BASE.lanternGain))]],
  // 火 → 雲は通れない
  kumo: () => [[I('flame'), O(), I('cloud'), O('✕')]],
  // 線でふれる → ひらく・爆発なら 2 回でひらく
  shime: () => [[I('stroke'), S('shime'), O(), I('firework')], [...Array.from({ length: Math.min(3, DAMP_HITS) }, () => I('boom')), O(), I('firework')]],
  // 火 → 縄 → 遠くの玉
  nawa: () => [[I('flame'), O(), I('rope'), O(), S('any')]],
  // 爆発では尺玉はひらかない・全部ひらいてから尺玉 → 倍率 +13
  shaku: () => [[I('boom'), O(), S('shaku'), O('✕')], [S('any'), N('100%'), O(), S('shaku'), M(plus(1 + TORI_BONUS))]],
};
export function gimmickGlyph(id) { return GIMMICK[id] ? join(GIMMICK[id]()) : []; }

// ---------------------------------------------------------------- 大一番
const TWIST = {
  massugu: () => [[I('stroke'), O(), I('straight')]],
  kagami: () => [[I('stroke'), O(), I('mirror')], [I('ink'), N(times(MIRROR_INK))]],
  yamiyo: () => [[I('timer'), N(String(DARK_SECONDS)), O(), I('dark')]],
  isshun: () => [[I('hand'), I('timer'), N(String(SNAP_SECONDS)), O(), I('lineEnd')]],
};
export function twistGlyph(id) { return TWIST[id] ? join(TWIST[id]()) : []; }

// ---------------------------------------------------------------- 散ったときのヒント（failHint の id）
// 次に試すことの絵。大一番のヒントは twist_<大一番の id>
const TORI_AT = 0.9; // 大トリのヒントに出す「先にひらいておく割合」の例
const HINT = {
  cloudStart: () => [[I('lineStart'), I('cloud'), O('✕')]],
  twist_massugu: () => [[I('straight'), S('any'), S('any'), S('any')]],
  twist_kagami: () => [[S('any'), I('mirror'), S('any')]],
  twist_yamiyo: () => [[I('timer'), N(`≤${DARK_SECONDS}`), O(), I('eye'), S('any')]],
  twist_isshun: () => [[I('eye'), I('stroke'), O(), I('hand')]],
  shaku: () => [[I('lineEnd'), S('shaku')]],
  toriEarly: () => [[S('any'), N(`≥${pct(TORI_AT)}`), O(), S('shaku'), M(plus(Math.round(1 + TORI_BONUS * TORI_AT * TORI_AT)))]],
  lantern: () => GIMMICK.chouchin(),
  lanternLate: () => [[S('chouchin'), N('①'), O(), CH(times(1 + BASE.lanternGain))]],
  almost: () => [[S('any'), N('100%'), O(), X(times(BLOOM))]],
  ink: () => [[I('inkLeft'), N('0%')]],
  rope: () => [[I('stroke'), O(), I('rope'), O(), S('any')]],
  damp: () => [[I('stroke'), S('shime'), O(), I('firework')]],
  gold: () => [[S('kin'), O(), M(plus(BASE.goldBonus))]],
  far: () => [[S('any'), I('stroke'), S('any')]],
  general: () => [[I('lineStart'), S('any'), S('any'), S('any'), O(), S('any')]],
};
export function hintGlyph(id) { return HINT[id] ? join(HINT[id]()) : []; }

// ---------------------------------------------------------------- 屋台
const SHOP = {
  reroll: () => [[I('reroll')]],                        // 候補を引きなおす
  ink: () => [[I('inkpot'), N(`+${pct(SHOP_INK)}`)]],   // 次の夜の墨 +25%（墨壺）
  life: () => [[I('lantern'), O('↻')]],                 // 予備の提灯（散っても、もう一度）
  focus: () => [[I('filter')]],                         // 次の候補を 1 つの型だけに
};
export function shopGlyph(id) { return SHOP[id] ? join(SHOP[id]()) : []; }

// ---------------------------------------------------------------- DOM
// <span class="glyph"> を作る。玉は span.g-shell の中に shellImg(type) の絵、アイコンは span.g-icon の中に svgIcon(name)。
// 数は b.g-mult / b.g-x / b.g-chips / b.g-num、つなぎは i.g-op、区切りは i.g-sep（中身なし。CSS で線を引く）。
// Lv3 の札には .g-lv3 も。文字は textContent で入れる（外から来た文字でも HTML にならない）
const TEXT = { mult: ['b', 'g-mult'], xmult: ['b', 'g-x'], chips: ['b', 'g-chips'], num: ['b', 'g-num'], op: ['i', 'g-op'], sep: ['i', 'g-sep'] };
export function glyphEl(tokens, { shellImg = null, svgIcon = null, doc = globalThis.document } = {}) {
  const root = doc.createElement('span');
  root.className = 'glyph';
  for (const t of tokens || []) {
    if (!t || typeof t !== 'object') continue;
    const lv3 = t.lv3 ? ' g-lv3' : '';
    let n;
    if (t.k === 'shell' || t.k === 'icon') {
      n = doc.createElement('span');
      n.className = `${t.k === 'shell' ? 'g-shell' : 'g-icon'}${lv3}`;
      n.setAttribute('data-v', String(t.v));
      const pic = t.k === 'shell' ? (shellImg ? shellImg(t.v) : null) : (svgIcon ? svgIcon(t.v) : null);
      if (pic) n.appendChild(pic);
    } else if (TEXT[t.k]) {
      n = doc.createElement(TEXT[t.k][0]);
      n.className = TEXT[t.k][1] + lv3;
      if (t.k !== 'sep') n.textContent = String(t.v);
      else n.setAttribute('aria-hidden', 'true');
    } else continue;
    root.appendChild(n);
  }
  return root;
}
