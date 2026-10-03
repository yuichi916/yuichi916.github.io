// 一筆花火の「絵の式」（assets/hitofude/glyphs.js）のテスト。DOM は小さな作り物の document で確かめる。
// 実行: node tests/hitofude_glyphs_test.mjs（SHOW=1 で、全部の式を文字にして出す）
import { readFileSync } from 'fs';
import * as K from '../assets/hitofude/core.js';
import { ICONS } from '../assets/hitofude/icons.js';
import { charmGlyph, wishGlyph, gimmickGlyph, twistGlyph, hintGlyph, shopGlyph, glyphEl } from '../assets/hitofude/glyphs.js';

let failures = 0;
function check(name, fn) {
  try { fn(); } catch (e) { failures++; console.error(`FAIL ${name}: ${e.message}`); }
}
function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function ok(v, msg) { if (!v) throw new Error(msg || 'not ok'); }
const J = (x) => JSON.stringify(x);

const KINDS = new Set(['shell', 'icon', 'mult', 'xmult', 'chips', 'num', 'op', 'sep']);
const VALUED = new Set(['mult', 'xmult', 'chips', 'num', 'op']);
const OPS = new Set(['→', '+', '×', '✕', '↻']);
const SHELL_TYPES = new Set([...K.TYPES, 'any']);
const LETTERS = /[A-Za-z]/;
const JAPANESE = /[　-ヿ㐀-䶿一-鿿豈-﫿＀-￯]/;
const MAX_GROUP = 7;

// 式を文字にする（確かめる用）: [玉] <絵> M倍率 X掛け算 C点 数 → | Lv3: …
function show(tokens) {
  return tokens.map((t) => {
    const s = t.k === 'shell' ? `[${t.v}]` : t.k === 'icon' ? `<${t.v}>` : t.k === 'mult' ? `M${t.v}` : t.k === 'xmult' ? `X${t.v}` : t.k === 'chips' ? `C${t.v}` : t.k === 'sep' ? (t.lv3 ? ' | Lv3: ' : ' | ') : t.v;
    return s;
  }).join(' ').replace(/ {2,}/g, ' ').replace(/ \| /g, ' | ');
}

// 札の決まりを全部確かめる。lv3 は Lv3 の札を許すか
function validate(name, tokens, { lv3 = false } = {}) {
  ok(Array.isArray(tokens) && tokens.length > 0, `${name}: 空`);
  let seenLv3 = false;
  for (const t of tokens) {
    ok(t && KINDS.has(t.k), `${name}: 知らない札 ${J(t)}`);
    if (t.k === 'icon') ok(Object.prototype.hasOwnProperty.call(ICONS, t.v), `${name}: ICONS に無い絵 ${t.v}`);
    if (t.k === 'shell') ok(SHELL_TYPES.has(t.v), `${name}: 知らない玉 ${t.v}`);
    if (VALUED.has(t.k)) {
      ok(typeof t.v === 'string' && t.v.length > 0, `${name}: 値が文字でない ${J(t)}`);
      ok(!LETTERS.test(t.v), `${name}: 英字が入っている ${J(t)}`);
      ok(!JAPANESE.test(t.v), `${name}: 日本語が入っている ${J(t)}`);
      ok([...t.v].length <= 6, `${name}: 6 字をこえる ${J(t)}`);
    }
    if (t.k === 'op') ok(OPS.has(t.v), `${name}: 知らないつなぎ ${t.v}`);
    if (t.k === 'sep') ok(!('v' in t), `${name}: 区切りに値がある`);
    if (t.lv3) { ok(lv3, `${name}: Lv3 でないのに Lv3 の札 ${J(t)}`); seenLv3 = true; } else ok(!seenLv3, `${name}: Lv3 の札のあとに、ふつうの札 ${J(t)}`);
  }
  // まとまり: ふつうは 2 つまで・Lv3 は 1 つまで・どれも 1〜7 札
  const groups = [[]];
  for (const t of tokens) { if (t.k === 'sep') groups.push([]); else groups[groups.length - 1].push(t); }
  for (const g of groups) ok(g.length > 0 && g.length <= MAX_GROUP, `${name}: まとまりの札の数 ${g.length}: ${show(tokens)}`);
  const lv3Groups = groups.filter((g) => g[0].lv3);
  ok(groups.length - lv3Groups.length <= 2, `${name}: ふつうのまとまりが 3 つ以上: ${show(tokens)}`);
  ok(lv3Groups.length <= 1, `${name}: Lv3 のまとまりが 2 つ以上: ${show(tokens)}`);
  for (const g of lv3Groups) ok(g.every((t) => t.lv3), `${name}: Lv3 のまとまりに、ふつうの札`);
  if (lv3Groups.length) ok(tokens[tokens.indexOf(lv3Groups[0][0]) - 1].lv3, `${name}: Lv3 の前の区切りに lv3 が無い`);
}

// failHint が返す id（core.js の failHint の本文から読む。大一番のヒントは twist_<id>）
const coreSrc = readFileSync(new URL('../assets/hitofude/core.js', import.meta.url), 'utf8');
const failBody = coreSrc.slice(coreSrc.indexOf('export function failHint'), coreSrc.indexOf('\n}\n', coreSrc.indexOf('export function failHint')));
const HINT_IDS = [...new Set([...failBody.matchAll(/id: '([^']+)'/g)].map((m) => m[1]).filter((id) => !id.endsWith('_')))].concat(K.TWISTS.map((tw) => 'twist_' + tw.id));
const SHOP_IDS = ['reroll', 'ink', 'life', 'focus'];
const WISH_IDS = K.WISHES.map((w) => w.id).concat('w_tori8');

const SHOW = [];

check('お守り: 24 個 × Lv1〜3 の式が決まりどおり・Lv3 の札は Lv3 だけ・どのお守りも Lv3 でふるまいが増える', () => {
  eq(K.CHARM_IDS.length, 24);
  for (const id of K.CHARM_IDS) {
    for (let lv = 1; lv <= K.MAX_LV; lv++) {
      const g = charmGlyph(id, lv);
      validate(`${id} Lv${lv}`, g, { lv3: lv === 3 });
      if (lv === 3) ok(g.some((t) => t.lv3), `${id}: Lv3 のふるまいの札が無い`);
      SHOW.push(`${id} Lv${lv}: ${show(g)}`);
    }
  }
});

check('お守り: 数は CHARM_LV から読む（Lv1 と Lv2 で式が変わる・数が式に入る）', () => {
  for (const id of K.CHARM_IDS) ok(J(charmGlyph(id, 1)) !== J(charmGlyph(id, 2)), `${id}: Lv1 と Lv2 が同じ式`);
  const has = (g, k, v) => g.some((t) => t.k === k && t.v === v);
  const L = K.CHARM_LV;
  for (let i = 0; i < 3; i++) {
    ok(has(charmGlyph('kinun', i + 1), 'mult', `+${L.kinun.gold[i]}`), `kinun Lv${i + 1}`);
    ok(has(charmGlyph('hanaikada', i + 1), 'mult', `+${L.hanaikada.mult[i]}`), `hanaikada Lv${i + 1}`);
    ok(has(charmGlyph('tengu', i + 1), 'xmult', `×${L.tengu.x[i]}`), `tengu Lv${i + 1}`);
    ok(has(charmGlyph('chouchinshi', i + 1), 'chips', `×${1 + L.chouchinshi.gain[i]}`), `chouchinshi Lv${i + 1}`);
    ok(has(charmGlyph('kodou', i + 1), 'num', String(L.kodou.step[i])), `kodou Lv${i + 1}`);
    ok(has(charmGlyph('nagafude', i + 1), 'num', `+${Math.round((L.nagafude.ink[i] - 1) * 100)}%`), `nagafude Lv${i + 1}`);
    ok(has(charmGlyph('mankai', i + 1), 'num', `≥${Math.round(L.mankai.share[i] * 100)}%`), `mankai Lv${i + 1}`);
  }
  ok(has(charmGlyph('maneki', 1), 'num', `≤×${K.MANEKI_CAP}`), 'maneki の上限');
  ok(has(charmGlyph('senkou', 1), 'num', `≤${Math.round((1 - K.SENKOU_USE) * 100)}%`), 'senkou: 8 割使う = 残り 2 割以下');
  ok(has(charmGlyph('nokorizumi', 3), 'xmult', `×${L.nokorizumi.half[2]}`), 'nokorizumi Lv3');
  ok(has(charmGlyph('tairin', 1), 'num', '−15%'), 'tairin: ふだんの縮み');
  // Lv の外は 1〜3 にそろえる。知らない id は空
  for (const id of K.CHARM_IDS) { eq(J(charmGlyph(id, 0)), J(charmGlyph(id, 1)), `${id} Lv0`); eq(J(charmGlyph(id, 9)), J(charmGlyph(id, 3)), `${id} Lv9`); }
  eq(J(charmGlyph('futofude', 1)), '[]'); eq(J(charmGlyph('nope', 2)), '[]');
});

check('願い札: 全部の札（と前の版の w_tori8）・w_pops は数を入れる', () => {
  for (const id of WISH_IDS) {
    const g = wishGlyph(id, id === 'w_pops' ? 25 : undefined);
    validate(id, g);
    SHOW.push(`${id}: ${show(g)}`);
  }
  ok(wishGlyph('w_pops', 25).some((t) => t.k === 'num' && t.v === '≥25'), 'w_pops の数');
  validate('w_pops（数なし）', wishGlyph('w_pops'));
  validate('w_pops（おかしな数）', wishGlyph('w_pops', '<b>x</b>'));
  ok(wishGlyph('w_tori8').some((t) => t.k === 'mult' && t.v === '≥+8'), 'w_tori8 は +8');
  ok(wishGlyph('w_tori6').some((t) => t.k === 'mult' && t.v === '≥+6'), 'w_tori6 は +6');
  eq(J(wishGlyph('w_nope')), '[]');
});

check('仕掛け・大一番・ヒント・屋台: 全部の id の式が決まりどおり（数は core から）', () => {
  for (const gm of K.GIMMICKS) { const g = gimmickGlyph(gm.id); validate(gm.id, g); SHOW.push(`gimmick ${gm.id}: ${show(g)}`); }
  for (const tw of K.TWISTS) { const g = twistGlyph(tw.id); validate(tw.id, g); SHOW.push(`twist ${tw.id}: ${show(g)}`); }
  for (const id of ['almost', 'damp', 'far', 'general', 'gold', 'ink', 'lantern', 'rope', 'shaku', 'twist_massugu']) ok(HINT_IDS.includes(id), `failHint の id に ${id} が無い`);
  for (const id of HINT_IDS) { const g = hintGlyph(id); validate(`hint ${id}`, g); SHOW.push(`hint ${id}: ${show(g)}`); }
  for (const id of SHOP_IDS) { const g = shopGlyph(id); validate(`shop ${id}`, g); SHOW.push(`shop ${id}: ${show(g)}`); }
  const has = (g, k, v) => g.some((t) => t.k === k && t.v === v);
  ok(has(gimmickGlyph('chouchin'), 'chips', '×2'), '提灯は点 ×2');
  ok(has(gimmickGlyph('shaku'), 'mult', `+${1 + K.TORI_BONUS}`), '尺玉は +13 まで');
  ok(has(twistGlyph('yamiyo'), 'num', String(K.DARK_SECONDS)), '闇夜の秒');
  ok(has(twistGlyph('isshun'), 'num', String(K.SNAP_SECONDS)), '一瞬の秒');
  ok(has(twistGlyph('kagami'), 'num', '−25%'), '鏡の墨（× は点と倍率だけ。墨の増減は割合）');
  for (const f of [gimmickGlyph, twistGlyph, hintGlyph, shopGlyph]) eq(J(f('nope')), '[]');
});

check('色の決まり: 白い数（num）に × を使わない（× は点＝青と倍率＝金だけ）', () => {
  const all = [];
  for (const c of K.CHARMS) for (const lv of [1, 2, 3]) all.push([`${c.id} Lv${lv}`, charmGlyph(c.id, lv)]);
  for (const gm of K.GIMMICKS) all.push([gm.id, gimmickGlyph(gm.id)]);
  for (const tw of K.TWISTS) all.push([tw.id, twistGlyph(tw.id)]);
  for (const id of HINT_IDS) all.push([`hint ${id}`, hintGlyph(id)]);
  for (const w of K.WISHES) all.push([w.id, wishGlyph(w.id, 30)]);
  for (const [id, g] of all) for (const tk of g) ok(!(tk.k === 'num' && /^×/.test(tk.v)), `${id}: 白い ${tk.v}`);
});

check('絵: ICONS の部品の形（d はパスの文字だけ・色と太さ）・前からの絵は残っている', () => {
  for (const name of ['menu', 'stroke', 'lantern', 'star', 'boom', 'sparkle', 'flame', 'eye', 'hand', 'firework', 'fast', 'ty_massugu']) ok(ICONS[name], `前からの絵 ${name}`);
  for (const [name, parts] of Object.entries(ICONS)) {
    ok(Array.isArray(parts) && parts.length > 0, `${name}: 部品が無い`);
    for (const p of parts) {
      ok(typeof p.d === 'string' && /^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+$/.test(p.d), `${name}: d がおかしい ${p.d}`);
      for (const c of ['f', 's']) if (p[c] !== undefined && p[c] !== null) ok(typeof p[c] === 'string' && (p[c] === 'cur' || /^(#[0-9a-f]{3,8}|rgba?\([\d.,\s]+\))$/i.test(p[c])), `${name}: ${c} がおかしい ${p[c]}`);
      if (p.w !== undefined) ok(typeof p.w === 'number' && p.w > 0 && p.w < 5, `${name}: w がおかしい`);
    }
  }
});

check('glyphEl: 札ごとの要素とクラス・Lv3 のしるし・文字は textContent・知らない札は飛ばす', () => {
  const made = [];
  const doc = {
    createElement(tag) {
      const n = { tagName: tag.toUpperCase(), className: '', textContent: '', attrs: {}, children: [], setAttribute(k, v) { this.attrs[k] = String(v); }, appendChild(c) { this.children.push(c); return c; } };
      made.push(n); return n;
    },
  };
  const shells = [], icons = [];
  const shellImg = (type) => { shells.push(type); return { tagName: 'CANVAS', shell: type }; };
  const svgIcon = (name) => { icons.push(name); return { tagName: 'SVG', icon: name }; };
  const tokens = [
    { k: 'shell', v: 'kin' }, { k: 'op', v: '→' }, { k: 'mult', v: '+3' }, { k: 'sep' },
    { k: 'icon', v: 'ink' }, { k: 'num', v: '<b>' }, { k: 'xmult', v: '×1.5' }, { k: 'chips', v: '+10%' },
    { k: 'bogus', v: 'x' }, null,
    { k: 'sep', lv3: true }, { k: 'icon', v: 'boom', lv3: true },
  ];
  const root = glyphEl(tokens, { shellImg, svgIcon, doc });
  eq(root.tagName, 'SPAN'); eq(root.className, 'glyph');
  const kids = root.children;
  eq(kids.map((n) => `${n.tagName}.${n.className}`).join(' '),
    'SPAN.g-shell I.g-op B.g-mult I.g-sep SPAN.g-icon B.g-num B.g-x B.g-chips I.g-sep g-lv3 SPAN.g-icon g-lv3');
  eq(J(shells), J(['kin'])); eq(J(icons), J(['ink', 'boom']));
  eq(kids[0].children[0].shell, 'kin'); eq(kids[0].attrs['data-v'], 'kin');
  eq(kids[4].children[0].icon, 'ink');
  eq(kids[1].textContent, '→'); eq(kids[2].textContent, '+3'); eq(kids[5].textContent, '<b>'); eq(kids[6].textContent, '×1.5');
  eq(kids[3].textContent, ''); eq(kids[3].attrs['aria-hidden'], 'true');
  // 絵を描く関数が無くても、枠だけは作る
  const bare = glyphEl([{ k: 'shell', v: 'any' }, { k: 'icon', v: 'cloud' }], { doc });
  eq(bare.children.length, 2); eq(bare.children[0].children.length, 0); eq(bare.children[1].attrs['data-v'], 'cloud');
  // 本物の式もそのまま組める
  for (const id of K.CHARM_IDS) {
    const g = charmGlyph(id, 3), el = glyphEl(g, { shellImg, svgIcon, doc });
    eq(el.children.length, g.length, id);
    eq(el.children.filter((n) => n.className.includes('g-lv3')).length, g.filter((t) => t.lv3).length, `${id} の Lv3`);
  }
});

if (process.env.SHOW) console.log(SHOW.join('\n'));
if (failures) { console.error(`hitofude_glyphs_test: ${failures} FAILED`); process.exit(1); }
console.log('hitofude_glyphs_test: ALL PASS');
