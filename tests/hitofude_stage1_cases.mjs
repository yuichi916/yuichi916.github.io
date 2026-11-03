// ステージ1が1点も変わっていないことを確かめるための「指紋」。
// どの版の core.js にも同じ手順で当て、夜の並び・目標点・大一番・景色・願い札・お守りの候補・再生リンク・
// 線を燃やした結果（点・内訳・記録）・コマごとの出来事・花火合戦を、ケースごとの短いハッシュにする。
// 基準（tests/hitofude_stage1_golden.json）は、ステージ2を入れる前の版（d7540b35）の core.js で作った:
//   node _dev/hitofude-stage1-golden.mjs <core.js> tests/hitofude_stage1_golden.json
// テスト（tests/hitofude_stage1_frozen_test.mjs）は、いまの core.js の指紋を基準と一字一句くらべる。
// ここでは K のステージ1の呼び方（stage を渡さない、前からの引数）だけを使う。
import { createHash } from 'node:crypto';

const h = (v) => createHash('sha1').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex').slice(0, 12);
// 指紋のための乱数（core とは別。どの版でも同じ並びになる）
function mul(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// 線の作り方 3 つ: 近い順につなぐ / でたらめに歩く / 玉から玉への直線
function lineOf(K, st, r, kind) {
  const live = st.shells.filter((s) => !s.burst);
  if (!live.length) return [{ x: 100, y: 200 }, { x: 200, y: 300 }, { x: 250, y: 320 }];
  if (kind === 0) {
    let cur = live[Math.floor(r() * live.length)];
    const pts = [{ x: cur.x + (r() - 0.5) * 6, y: cur.y + (r() - 0.5) * 6 }], seen = new Set([cur.id]);
    let used = 0;
    for (let k = 0; k < 30; k++) {
      const cand = live.filter((s) => !seen.has(s.id)).map((s) => ({ s, d: Math.hypot(s.x - cur.x, s.y - cur.y) })).sort((a, b) => a.d - b.d).slice(0, 3);
      if (!cand.length) break;
      const p = cand[Math.floor(r() * cand.length)];
      if (used + p.d > st.ink * 1.1) break;
      used += p.d; seen.add(p.s.id); cur = p.s; pts.push({ x: cur.x + (r() - 0.5) * 4, y: cur.y + (r() - 0.5) * 4 });
    }
    return pts;
  }
  if (kind === 1) {
    const pts = [{ x: 40 + r() * 280, y: 110 + r() * 380 }];
    let a = r() * Math.PI * 2;
    for (let k = 0; k < 70; k++) { a += (r() - 0.5) * 1.1; const p = pts[pts.length - 1]; pts.push({ x: p.x + Math.cos(a) * 7, y: p.y + Math.sin(a) * 7 }); }
    return pts;
  }
  const a = live[Math.floor(r() * live.length)], b = live[Math.floor(r() * live.length)];
  return [{ x: a.x, y: a.y }, { x: (a.x + b.x) / 2 + 3, y: (a.y + b.y) / 2 - 2 }, { x: b.x, y: b.y }];
}
// 出来事の要点（ページが読むもの）。玉は id だけにする
const evKey = (e) => JSON.stringify(e, (k, v) => (k === 'shell' && v ? v.id : k === 'result' ? (v ? v.score : null) : typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v));
function burnTrace(K, st, strokes) {
  const tr = [];
  let k = 0;
  K.lightStroke(st, strokes[k++]);
  tr.push(st.events.map(evKey).join(';')); st.events.length = 0;
  for (let n = 0; n < 3600 && !st.done; n++) {
    if (st.phase === 'draw2') { if (strokes[k]) K.lightStroke(st, strokes[k++]); else K.finish(st); }
    K.step(st);
    if (st.events.length) tr.push(n + ':' + st.events.map(evKey).join(';'));
    st.events.length = 0;
  }
  if (!st.done) K.finish(st);
  return tr.join('|');
}
const pick = (arr, r) => arr[Math.floor(r() * arr.length)];

export function fingerprint(K, { scale = 1 } = {}) {
  const out = {};
  const r = mul(20261103);
  const ids = K.CHARM_IDS;
  const randCharms = () => { const n = Math.floor(r() * 7), c = []; for (let i = 0; i < n; i++) c.push(pick(ids, r)); return c; };
  // 1) 夜の並び・目標点・大一番・景色・雲・縄・基準点（シード × 夜 × 月 × 段位）
  const NS = Math.round(36 * scale);
  for (let i = 0; i < NS; i++) {
    const seed = Math.floor(r() * 4294967296) >>> 0, moon = i % 8, level = i % 3 === 0 ? Math.floor(r() * 9) : 0;
    const rows = [];
    for (let night = 0; night < 8; night++) {
      const st = K.newRound({ seed, night, moon, level });
      rows.push([K.twistFor(seed, night) && K.twistFor(seed, night).id, K.sceneFor(seed, night).id, K.targetFor(seed, night, moon, level), K.parScore(seed, night, moon, level),
        st.shells.map((s) => `${s.type}${s.x},${s.y},${s.hue}`).join(' '), JSON.stringify(st.clouds), st.ropes.map((x) => `${x.a}-${x.b}:${x.pts.length}`).join(), st.ink, st.target, st.scene, st.twist,
        JSON.stringify(K.shellMix(night, st.rules)), K.nightSeed(seed, night)]);
    }
    out[`board${i}`] = h(rows);
  }
  // 2) 願い札（重いので少なめ）
  const NW = Math.round(10 * scale);
  for (let i = 0; i < NW; i++) {
    const seed = Math.floor(r() * 4294967296) >>> 0, moon = Math.floor(r() * 8), level = i % 2 ? 0 : Math.floor(r() * 9);
    out[`wish${i}`] = h(Array.from({ length: 8 }, (_, n) => K.wishFor(seed, n, level, moon)));
  }
  // 3) お守りの候補・はじめのお守り・型しぼり・ルール
  const NO = Math.round(300 * scale);
  const pools = [null, ['kinun', 'kodou', 'tairin', 'chouchinshi', 'mashidama', 'amayoke', 'nokorizumi', 'maneki', 'senkou'], ids.slice()];
  for (let i = 0; i < NO; i++) {
    const seed = Math.floor(r() * 4294967296) >>> 0, night = Math.floor(r() * 8), held = randCharms(), level = Math.floor(r() * 9);
    const pool = pick(pools, r), focus = r() < 0.3 ? pick(K.TAGS, r) : null, caps = r() < 0.2 ? { tengu: 1, kitsune: 0 } : undefined;
    const opts = { level, pool, ...(focus ? { focus } : {}), ...(caps ? { caps } : {}) };
    out[`offer${i}`] = h([K.offerCharms(seed, night, held, i % 3, opts), K.focusTags(night, held, { level, pool }), K.startOffer(seed, pool), JSON.stringify(K.rulesFor(held, i % 8, level)), K.setBonus(held), K.charmNeed('kazekiri', level)]);
  }
  // 4) 線を燃やした結果（お守り・月・段位・墨壺つき）と、筆跡・ヒント・願い・再生リンク
  const NR = Math.round(900 * scale);
  for (let i = 0; i < NR; i++) {
    const seed = Math.floor(r() * 4294967296) >>> 0, night = Math.floor(r() * 8), moon = Math.floor(r() * 8), level = r() < 0.4 ? Math.floor(r() * 9) : 0;
    const charms = randCharms(), bank = r() < 0.3 ? Math.floor(r() * 460) : 0;
    const params = { seed, night, charms, moon, bank, level };
    const st0 = K.newRound(params);
    const kind = Math.floor(r() * 3);
    const s1 = lineOf(K, st0, r, kind), s2 = lineOf(K, st0, r, 0);
    const st = K.newRound(params);
    const res = K.runToEnd(st, [s1, s2]);
    const wm = K.WISHES.map((w) => (K.wishMet(st, w.id) ? 1 : 0)).join('');
    const code = K.encodeReplay({ seed, moon, night, charms, strokes: st.strokes, bank, level });
    const dec = K.decodeReplay(code);
    let again = null;
    if (dec && !dec.old) { const st2 = K.newRound({ seed: dec.seed, night: dec.night, charms: dec.charms, moon: dec.moon, bank: dec.bank, level: dec.level }); again = K.runToEnd(st2, dec.strokes, { normalized: true }).score; }
    out[`run${i}`] = h([res, st.strokes, K.failHint(st), K.strokeType(st.strokes[0], { ink: st.ink, pops: res.pops, total: res.total }), wm, code, again, K.inkCarry(st), K.multOf(st), K.xmultOf(st), K.scoreParts(st), K.spareSteps(st), K.inkUsedFrac(st)]);
  }
  // 5) コマごとの出来事（ページの見せ方が読むもの）
  const NT = Math.round(160 * scale);
  for (let i = 0; i < NT; i++) {
    const seed = Math.floor(r() * 4294967296) >>> 0, night = Math.floor(r() * 8), moon = Math.floor(r() * 8), level = r() < 0.3 ? Math.floor(r() * 9) : 0;
    const charms = randCharms(), params = { seed, night, charms, moon, bank: 0, level };
    const st0 = K.newRound(params);
    const lines = [lineOf(K, st0, r, Math.floor(r() * 3)), lineOf(K, st0, r, 0)];
    out[`trace${i}`] = h(burnTrace(K, K.newRound(params), lines));
  }
  // 6) 花火合戦
  const NV = Math.round(60 * scale);
  for (let i = 0; i < NV; i++) {
    const seed = Math.floor(r() * 4294967296) >>> 0, bout = i % 3, moon = Math.floor(r() * 8);
    const st = K.newVsRound({ seed, bout, moon });
    const a = lineOf(K, st, r, 0), b = lineOf(K, st, r, 1);
    const p1 = K.vsPlace(st, 1, a), p0 = K.vsPlace(st, 0, b);
    if (p1 && r() < 0.5) K.vsPlaceOjama(st, 1, 100 + Math.floor(r() * 160), 150 + Math.floor(r() * 300));
    const res = p1 || p0 ? K.runVs(st) : null;
    out[`vs${i}`] = h([res, !!p1, !!p0, st.shells.map((s) => s.type + s.x + ',' + s.y).join(' ')]);
  }
  // 7) 再生リンクの読み方（こわれたもの・古い版）と、記録の関数
  const bad = ['', 'AAAA', 'B'.repeat(20), 'xyz<>', 'QAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'];
  out.decode = h(bad.map((s) => JSON.stringify(K.decodeReplay(s))));
  out.consts = h([K.NIGHTS, K.TARGET_RATIO, K.TARGETS, K.BASE_COUNTS, K.BOSS_NIGHTS, K.TWISTS.map((x) => [x.id, x.target]), K.SCENES.map((x) => x.id), K.GIMMICKS.map((g) => [g.id, g.night]), K.REPLAY_VERSION, Object.keys(K.SHELLS).filter((k) => ['kiku', 'ootama', 'kin', 'senrin', 'chouchin', 'shime', 'shaku', 'kuro'].includes(k)).map((k) => [k, K.SHELLS[k]]), K.TYPES, K.CHARM_IDS, K.LEVELS.map((L) => L.fx), K.STAGE.id, K.STAGES[0]]);
  return out;
}
