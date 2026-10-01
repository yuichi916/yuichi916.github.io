// 一筆花火の純関数とシミュレーションのテスト。DOM も fetch も使わない。実行: node tests/hitofude_core_test.mjs
import * as K from '../assets/hitofude/core.js';

let failures = 0;
function check(name, fn) {
  try { fn(); } catch (e) { failures++; console.error(`FAIL ${name}: ${e.message}`); }
}
function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function ok(v, msg) { if (!v) throw new Error(msg || 'not ok'); }
const line = (x0, y0, x1, y1, n = 40) => Array.from({ length: n + 1 }, (_, i) => ({ x: x0 + (x1 - x0) * i / n, y: y0 + (y1 - y0) * i / n }));

check('日付と月: 日本時間の 0 時で切り替わり、公開した夜が #1・満月のころ', () => {
  eq(K.jstDateKey(new Date('2026-09-26T14:59:59Z')), '2026-09-26');
  eq(K.jstDateKey(new Date('2026-09-26T15:00:00Z')), '2026-09-27');
  eq(K.dayNumber('2026-09-26'), 1);
  eq(K.MOONS[K.moonIndex(K.moonPhase('2026-09-26'))].id, 'mangetsu');
  eq(K.MOONS[K.moonIndex(K.moonPhase('2026-10-11'))].id, 'shingetsu', '2026-10-11 は新月のころ');
  eq(K.MOONS.length, 8);
  for (let p = 0; p < 1; p += 0.01) ok(K.moonIndex(p) >= 0 && K.moonIndex(p) < 8);
});

check('お守り: 15 個・ID 重複なし・絵文字はカラーで出る・再生リンクの 16bit に収まる', () => {
  eq(K.CHARMS.length, 15);
  eq(new Set(K.CHARM_IDS).size, K.CHARMS.length);
  ok(K.CHARMS.length <= 16);
  for (const c of K.CHARMS) {
    ok(c.ja && c.en && c.desc && c.descEn, `${c.id} の文言`);
    ok(/^\p{Emoji_Presentation}$/u.test(c.emoji) || /️$/.test(c.emoji), `${c.id}: ${c.emoji} は白黒の文字で出る`);
  }
});

check('ルール: お守りと月が合わさる', () => {
  const base = K.rulesFor([], 1);
  eq(base.ink, K.BASE_INK);
  eq(base.decay, K.DECAY); eq(base.bloom, 2); eq(base.chainPulse, 0);
  const r = K.rulesFor(['nagafude', 'tairin', 'kodou', 'mankai'], 4);
  eq(r.ink, Math.round(K.BASE_INK * 1.4));
  eq(r.decay, K.DECAY_SOFTER, '大輪と満月で、減衰がもっとゆるい');
  eq(K.rulesFor(['tairin'], 1).decay, K.DECAY_SOFT); eq(K.rulesFor([], 4).decay, K.DECAY_SOFT, '満月は大輪と同じだけゆるい');
  eq(K.rulesFor([], 4).radius, 1.12, '花火合戦の満月は +12% のまま');
  eq(r.chainPulse, K.KODOU_STEP); eq(r.bloom, 3, '満開の加護は ×3');
  eq(K.rulesFor([], 5).startMult, 1, '寝待月は倍率 +1 から');
  eq(K.rulesFor(['osobi'], 5).startMult, 1 + K.SLOW_MULT, '遅火と寝待月は足し算');
  eq(K.rulesFor(['osobi'], 1).fuseSpeed, K.SLOW_FUSE);
  eq(K.rulesFor(['nokoribi'], 6).afterglow, 0.25 + 0.4, '残り火と下弦は足し算');
  eq(K.rulesFor(['amayoke'], 1).dampHits, 1); eq(K.rulesFor([], 1).dampHits, K.DAMP_HITS);
});

check('夜の並び: 決定的・場の中・重ならない・夜ごとに増える・月で種類が変わる', () => {
  for (let night = 0; night < K.NIGHTS; night++) {
    const a = K.makeLayout(12345, night, K.rulesFor([], 4)), b = K.makeLayout(12345, night, K.rulesFor([], 4));
    eq(JSON.stringify(a), JSON.stringify(b), `night ${night}: 決定的でない`);
    ok(a.length >= K.BASE_COUNTS[night] - 2, `night ${night}: ${a.length} 個`);
    for (const s of a) ok(s.x >= K.FIELD.x0 && s.x <= K.FIELD.x1 && s.y >= K.FIELD.y0 && s.y <= K.FIELD.y1, '場の外');
    for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) {
      ok(Math.hypot(a[i].x - a[j].x, a[i].y - a[j].y) >= 27, `night ${night}: ${i} と ${j} が近すぎる`);
    }
  }
  const other = K.makeLayout(999, 0, K.rulesFor([], 4));
  ok(JSON.stringify(other) !== JSON.stringify(K.makeLayout(12345, 0, K.rulesFor([], 4))), 'シードで変わらない');
  const golds = (moon) => K.makeLayout(7, 3, K.rulesFor([], moon)).filter((s) => s.type === 'kin').length;
  eq(golds(0), golds(4) * 2, '新月は金が 2 倍');
  eq(K.makeLayout(7, 3, K.rulesFor(['mashidama'], 4)).length - K.makeLayout(7, 3, K.rulesFor([], 4)).length, K.MASHI_N, '増し玉');
});

check('夜空は固まっている: 増し玉・風切りを持っていても、もとの玉・雲・縄は同じ（増し玉の玉は後ろに足すだけ）', () => {
  let extra = 0;
  for (let seed = 1; seed <= 30; seed++) for (const night of [3, 4, 6, 7]) {
    const moon = seed % 8, a = K.newRound({ seed, night, moon, par: true });
    for (const ch of [['mashidama'], ['kazekiri'], ['mashidama', 'kazekiri', 'nagafude']]) {
      const b = K.newRound({ seed, night, charms: ch, moon, par: true });
      const key = (s) => `${s.id}:${s.type}:${s.x}:${s.y}:${s.hue}`;
      eq(b.shells.slice(0, a.shells.length).map(key).join(), a.shells.map(key).join(), `seed ${seed} night ${night} ${ch}: もとの玉が変わる`);
      eq(b.clouds.map((c) => `${c.x}:${c.y}`).join(), a.clouds.map((c) => `${c.x}:${c.y}`).join(), '雲の場所が変わる');
      eq(JSON.stringify(b.ropes), JSON.stringify(a.ropes), '縄が変わる');
      const added = b.shells.slice(a.shells.length);
      if (ch.includes('mashidama')) { ok(added.length >= K.MASHI_N - 1 && added.every((s) => s.extra && s.type === 'kiku'), '増し玉の玉'); extra += added.length; } else eq(added.length, 0);
      if (ch.includes('kazekiri')) b.clouds.forEach((c, i) => eq(c.r, Math.round(a.clouds[i].r * K.KAZE_SCALE), '風切りの雲'));
      for (const s of added) {
        ok(s.x >= K.FIELD.x0 && s.x <= K.FIELD.x1 && s.y >= K.FIELD.y0 && s.y <= K.FIELD.y1, '場の外');
        for (const t of b.shells) if (t !== s) ok(Math.hypot(t.x - s.x, t.y - s.y) >= 27, '増し玉が近すぎる');
        for (const c of a.clouds) ok(Math.hypot(c.x - s.x, c.y - s.y) >= c.r + 14, '増し玉が雲（元の大きさ）に重なる');
      }
    }
  }
  ok(extra > 0);
  // 目標点も、お守りに関係なく同じ
  eq(K.newRound({ seed: 5, night: 6, charms: ['mashidama', 'kazekiri'], moon: 3 }).target, K.newRound({ seed: 5, night: 6, moon: 3 }).target);
});

check('線: 8 単位ごとの整数点にならし、墨の長さで切る', () => {
  const pts = K.normalizeStroke(line(20, 300, 340, 300, 7), 100);
  ok(pts.length >= 10 && pts.length <= 14, `${pts.length} 点`);
  ok(K.pathLength(pts) <= 100 + 1e-9, `長さ ${K.pathLength(pts)}`);
  for (const p of pts) ok(Number.isInteger(p.x) && Number.isInteger(p.y));
  eq(K.normalizeStroke([{ x: 5, y: 5 }], 100).length, 0, '1 点だけ');
  eq(K.normalizeStroke([{ x: 5, y: 5 }, { x: NaN, y: 3 }], 100).length, 0, 'NaN');
  const out = K.normalizeStroke([{ x: -50, y: -50 }, { x: 900, y: 900 }], 5000);
  for (const p of out) ok(p.x >= 0 && p.x < K.W && p.y >= 0 && p.y < K.H, '画面の外');
  ok(K.normalizeStroke(line(0, 0, 359, 639, 200), 99999).length <= K.STROKE_MAX_POINTS, '点数の上限');
});

// 手で並べた夜で、火の移り方を確かめる
function handRound(shells, charms = [], moon = 1) {
  const st = K.newRound({ seed: 1, night: 0, charms, moon });
  st.shells = shells.map((s, i) => ({ id: i, hue: 0, burst: false, burstAt: -1, ...s }));
  return st;
}
check('導火線: 線の上の玉がひらき、爆発が近くの玉へ連鎖する', () => {
  const st = handRound([
    { type: 'kiku', x: 100, y: 300 },  // 線の上
    { type: 'kiku', x: 140, y: 300 },  // 線の上
    { type: 'kiku', x: 140, y: 340 },  // 線から 40 離れる → 爆発（R=46）で連鎖
    { type: 'kiku', x: 300, y: 100 },  // 遠い → 残る
  ]);
  const res = K.runToEnd(st, [line(80, 300, 160, 300)]);
  eq(res.pops, 3);
  ok(!st.shells[3].burst, '遠い玉がひらいた');
  eq(res.chips, 30);
  eq(res.mult, 1);
  eq(res.score, 30);
  eq(res.allClear, false);
});

check('導火線: 爆発が線の途中に引火すると、そこから両向きに燃える', () => {
  // 線は左から燃える。右の端の近くに大玉があり、別の火（千輪の火花）でひらくと、線の右側が先に燃える
  const st = handRound([{ type: 'kiku', x: 20, y: 300 }]);
  K.lightStroke(st, line(20, 300, 340, 300, 80));
  // 途中に爆発を置く
  st.explosions.push({ x: 300, y: 300, R: 30, t: 0, cause: 'test', hue: 0 });
  let caught = false;
  for (let i = 0; i < 20 && !st.done; i++) { K.step(st); if (st.events.some((e) => e.type === 'catch')) caught = true; st.events.length = 0; }
  ok(caught, '引火しなかった');
  ok(st.heads.length >= 2, `火の数 ${st.heads.length}`);
});

check('千輪: 火花がまっすぐ飛んで、離れた玉をひらく', () => {
  const st = handRound([
    { type: 'senrin', x: 100, y: 300 },
    { type: 'kiku', x: 100, y: 180 },   // 真上に 120（爆発 R=30 では届かないが、火花なら届く）
    { type: 'kiku', x: 220, y: 300 },
  ]);
  const res = K.runToEnd(st, [line(80, 300, 110, 300, 6)]);
  ok(res.pops >= 2, `${res.pops}`);
});

check('金と倍率: 金は倍率 +1、10 個ごとに +1、全部ひらくと ×2（満開の加護なら ×3）・金運は金ひとつ +2', () => {
  const shells = [];
  for (let i = 0; i < 10; i++) shells.push({ type: i === 0 ? 'kin' : 'kiku', x: 30 + i * 30, y: 300 });
  const st = handRound(shells);
  const res = K.runToEnd(st, [line(20, 300, 340, 300, 80)]);
  eq(res.pops, 10); eq(res.allClear, true);
  eq(res.chips, 5 + 9 * 10);
  eq(res.mult, 1 + 1 + 1, '金 +1・10 個 +1');
  eq(res.score, 95 * 3 * 2);
  const st2 = handRound(shells.map((s) => ({ ...s })), ['kinun', 'mankai']);
  const r2 = K.runToEnd(st2, [line(20, 300, 340, 300, 80)]);
  eq(r2.mult, 1 + 2 + 1, '金運 +2');
  eq(r2.score, 95 * 4 * 3, '満開の加護 ×3');
});

// 1 列に並べた菊（間 gap）の端の 1 つにだけ線で触れ、burst の知らせを集める
function rowChain(charms = [], gap = 26, n = 9) {
  const st = handRound(Array.from({ length: n }, (_, i) => ({ type: 'kiku', x: 50 + i * gap, y: 300 })), charms);
  K.lightStroke(st, line(50, 340, 50, 310, 6));
  const bursts = [];
  for (let i = 0; i < 1200 && !st.done; i++) { K.step(st); for (const e of st.events) if (e.type === 'burst') bursts.push(e); st.events.length = 0; }
  return { st, bursts };
}
check('鼓動: 爆発や火花でひらいた玉だけを、KODOU_STEP ごとに数える（線でひらいた玉は数えない）', () => {
  const a = rowChain();
  ok(a.st.chainPops >= K.KODOU_STEP && a.st.chainPops === a.st.pops - 1, `連鎖 ${a.st.chainPops} / ${a.st.pops}`);
  eq(a.st.result.mult, 1 + Math.floor(a.st.pops / 10), 'ふだんは 10 個ごと');
  const b = rowChain(['kodou']);
  eq(b.st.result.mult, 1 + Math.floor(b.st.chainPops / K.KODOU_STEP), '鼓動');
  eq(b.st.chainPops, b.bursts.filter((e) => e.gen > 0).length, '連鎖でひらいた玉 = 代が 1 以上');
  // 線でひらいた玉は数えない: 全部を線でなぞる（玉の間を広くして、線の火が先に届くように）
  const st = handRound(Array.from({ length: 6 }, (_, i) => ({ type: 'kiku', x: 40 + i * 60, y: 300 })), ['kodou']);
  const r = K.runToEnd(st, [line(20, 300, 350, 300, 80)]);
  eq(r.pops, 6); eq(st.chainPops, 0); eq(r.mult, 1);
});

check('連鎖の減衰: 代が進むほど小さくひらく・爆発の大きさと代は burst の知らせに入る・大輪でゆるむ', () => {
  const R = K.rulesFor([], 1), T = K.rulesFor(['tairin'], 1);
  eq(K.sizeAt(R, 0), 1); ok(Math.abs(K.sizeAt(R, 2) - K.DECAY * K.DECAY) < 1e-12);
  eq(K.sizeAt(R, 40), K.DECAY_MIN, '下限');
  ok(K.sizeAt(T, 3) > K.sizeAt(R, 3), '大輪はゆるい');
  eq(K.sizeAt(K.rulesFor([], 4), 5, true), 1.12, '花火合戦は減衰なし（満月 +12%）');
  // 下限の菊の火は、玉どうしの最小の間に届かない（密な群れでも連鎖が終わる）
  ok(K.SHELLS.kiku.R * K.DECAY_MIN + K.SHELLS.kiku.r < 27, '下限が大きすぎる');
  const { st, bursts } = rowChain();
  eq(bursts[0].gen, 0, '線でひらいた玉は 0 代目'); eq(bursts[0].cause, 'fuse'); eq(bursts[0].R, K.SHELLS.kiku.R);
  let prev = 0;
  for (const e of bursts) {
    ok(e.gen >= prev, '代は列にそって増える'); prev = e.gen;
    ok(Math.abs(e.R - K.SHELLS.kiku.R * K.sizeAt(st.rules, e.gen)) < 1e-9, `${e.gen} 代目の大きさ ${e.R}`);
    if (e.gen) eq(e.cause, 'chain');
  }
  ok(prev >= 4, `連鎖が ${prev} 代まで`);
  ok(bursts.length >= 5 && bursts.length < 9, `減衰で連鎖が途中で止まる（${bursts.length} 個）`);
  eq(rowChain(['tairin']).bursts.length, 9, '大輪なら最後まで連鎖する');
});

check('終わり玉: 線の終わりが、ひと息おいて大きく爆ぜる。その火は線の火として尺玉にも届く', () => {
  const st = handRound([{ type: 'kiku', x: 200, y: 380 }], ['owaridama']);
  K.lightStroke(st, line(40, 300, 200, 300));  // 終点から 80 下に玉 → 終わり玉（R=100）で届く
  let endAt = -1, boomAt = -1;
  for (let i = 0; i < 1200 && !st.done; i++) {
    K.step(st);
    for (const e of st.events) { if (e.type === 'fuseEnd') endAt = st.t; if (e.type === 'endBurst') { boomAt = st.t; eq(e.R, K.OWARI_R); } }
    st.events.length = 0;
  }
  eq(st.result.pops, 1);
  ok(endAt > 0 && boomAt - endAt >= K.OWARI_DELAY - 1e-9 && boomAt - endAt < K.OWARI_DELAY + 0.05, `終わりに火が届いて ${endAt} → 爆ぜて ${boomAt}`);
  // 尺玉は爆発ではひらかないが、終わり玉の火ではひらく
  const sh = () => [{ type: 'shaku', x: 200, y: 370 }];
  eq(K.runToEnd(handRound(sh()), [line(40, 300, 200, 300)]).pops, 0, '終わり玉なしでは届かない');
  const r2 = K.runToEnd(handRound(sh(), ['owaridama']), [line(40, 300, 200, 300)]);
  eq(r2.pops, 1, '終わり玉の火で尺玉がひらく');
});

check('二筆目: 6 割ひらいて残りがあれば、もう1本（墨は 1/3）。もらった墨は墨の勘定に入る', () => {
  const shells = [];
  for (let i = 0; i < 26; i++) shells.push({ type: 'kiku', x: 20 + (i % 13) * 26, y: i < 13 ? 200 : 202 });
  shells.push({ type: 'kiku', x: 180, y: 450 });
  const st = handRound(shells, ['nihitsu']);
  eq(K.nihitsuNeed(st), Math.ceil(27 * K.NIHITSU_SHARE));
  K.lightStroke(st, line(10, 201, 350, 201, 90));
  const total1 = st.inkTotal;
  for (let i = 0; i < 3600 && st.phase !== 'draw2' && !st.done; i++) { K.step(st); st.events.length = 0; }
  eq(st.phase, 'draw2');
  eq(st.ink, Math.round(st.rules.ink * K.NIHITSU_INK));
  eq(st.inkTotal, total1 + st.ink, '二筆目の墨も、この夜にもらった墨');
  K.lightStroke(st, line(170, 450, 190, 450, 6));
  for (let i = 0; i < 3600 && !st.done; i++) { K.step(st); st.events.length = 0; }
  eq(st.result.allClear, true);
  // ひらいた玉が足りなければ、もう1本は無い
  const few = handRound(shells.map((s) => ({ ...s })), ['nihitsu']);
  K.runToEnd(few, [line(170, 450, 190, 450, 6)]);  // 離れた 1 つだけ
  eq(few.result.pops, 1); eq(few.secondUsed, false);
});

check('決定的: 同じ夜・同じ線なら、同じ点', () => {
  for (let night = 0; night < K.NIGHTS; night++) {
    const mk = () => K.newRound({ seed: 777, night, charms: ['nokoribi', 'osobi', 'owaridama', 'kodou'], moon: 6 });
    const a = mk(), b = mk();
    const stroke = line(30, 150 + night * 30, 330, 420 - night * 20, 60);
    eq(JSON.stringify(K.runToEnd(a, [stroke])), JSON.stringify(K.runToEnd(b, [stroke])), `night ${night}`);
  }
});

check('お守りの候補: 決定的・3 つ・持っているものは出ない', () => {
  const a = K.offerCharms(5, 2, ['tairin']), b = K.offerCharms(5, 2, ['tairin']);
  eq(a.join(), b.join());
  eq(a.length, 3);
  ok(!a.includes('tairin'));
  eq(new Set(a).size, 3);
});

check('勝負リンク: 戻すと同じ・細工したものは読まない', () => {
  const s = K.encodeDuel(4294967295, 7, 123456);
  eq(JSON.stringify(K.decodeDuel(s)), JSON.stringify({ seed: 4294967295, moon: 7, score: 123456 }));
  eq(K.decodeDuel(K.encodeDuel(12, 3)).score, 0);
  for (const bad of ['', 'x', 'zzzzzzzz.1', 'abc.8', 'abc.1.<b>', null, 'abc.1.1234567890123']) eq(K.decodeDuel(bad), null, String(bad));
});

check('再生リンク: 一筆を戻すと同じ点になる（墨壺も入る）・細工したものは読まない', () => {
  const rng = K.rng32(5);
  let banked = 0;
  for (let i = 0; i < 24; i++) {
    const night = i % K.NIGHTS, moon = i % 8;
    const charms = K.CHARM_IDS.filter(() => rng() < 0.3);
    const bank = i % 3 === 0 ? 0 : Math.floor(rng() * (K.BASE_INK + 1));
    const st = K.newRound({ seed: 1000 + i, night, charms, moon, bank });
    const used = K.lightStroke(st, line(rng() * 360, 100 + rng() * 400, rng() * 360, 100 + rng() * 400, 50));
    if (!used) continue;
    for (let n = 0; n < 3600 && !st.done; n++) { if (st.phase === 'draw2') K.finish(st); else K.step(st); st.events.length = 0; }
    const code = K.encodeReplay({ seed: 1000 + i, moon, night, charms, strokes: st.strokes, bank });
    ok(/^[A-Za-z0-9_-]+$/.test(code) && code.length < 700, `長さ ${code.length}`);
    const back = K.decodeReplay(code);
    ok(back && !back.old, '戻らない');
    eq(JSON.stringify(back.strokes), JSON.stringify(st.strokes));
    eq(back.charms.join(), charms.join());
    eq(back.bank, bank, '墨壺');
    if (bank) banked++;
    const again = K.newRound({ seed: back.seed, night: back.night, charms: back.charms, moon: back.moon, bank: back.bank });
    const r2 = K.runToEnd(again, back.strokes, { normalized: true });
    eq(r2.score, st.result.score, '再生で点が変わった');
  }
  ok(banked > 5);
  eq(K.decodeReplay(K.encodeReplay({ seed: 1, moon: 1, night: 1, charms: [], strokes: [[{ x: 1, y: 1 }, { x: 9, y: 1 }, { x: 17, y: 1 }]] })).bank, 0, '墨壺を渡さなければ 0');
  eq(K.decodeReplay(K.encodeReplay({ seed: 1, moon: 1, night: 1, charms: [], bank: 5000, strokes: [[{ x: 1, y: 1 }, { x: 9, y: 1 }, { x: 17, y: 1 }]] })).bank, K.BASE_INK, '墨壺は 1 夜ぶんまで');
  eq(K.REPLAY_VERSION, 3);
  eq(K.decodeReplay(''), null);
  eq(K.decodeReplay('<script>alert(1)</script>'), null);
  eq(K.decodeReplay('A'.repeat(800)), null);
  const good = K.encodeReplay({ seed: 1, moon: 1, night: 1, charms: [], strokes: [[{ x: 1, y: 1 }, { x: 9, y: 1 }, { x: 17, y: 1 }]] });
  eq(K.decodeReplay('A' + good.slice(1)), null, '版が違う');
  eq(K.decodeReplay(good.slice(0, 10)), null, '短い');
  const far = K.encodeReplay({ seed: 1, moon: 1, night: 1, charms: [], strokes: [[{ x: 400, y: 1 }, { x: 9, y: 1 }, { x: 17, y: 1 }]] });
  eq(K.decodeReplay(far), null, '画面の外の点');
});

check('共有文: 点と連鎖を言葉で書き、絵文字は見出しの 🎆 だけ・答え（線）は入れない', () => {
  const run = {
    daily: true, key: '2026-09-27', no: 2, moon: 4, total: 123456, bestChain: 58,
    nights: [{ score: 900, target: 80 }, { score: 300, target: 250 }, { score: 100, target: 600 }],
  };
  const ja = K.runShareText(run, 'ja');
  ok(ja.startsWith('🎆一筆花火 #2 9/27 満月\nステージ1 2/8夜 123,456点・最大58連鎖\n'), ja);
  ok(ja.includes(K.HASHTAG), ja);
  const emoji = /\p{Extended_Pictographic}/gu;
  eq((ja.match(emoji) || []).join(''), '🎆', '絵文字は見出しの 1 つだけ');
  const en = K.runShareText({ ...run, daily: false }, 'en');
  ok(en.startsWith('🎆Hitofude Hanabi\nStage 1 · 2/8 nights 123,456 pts · best chain 58\n'), en);
  const all = K.runShareText({ ...run, nights: Array(8).fill({ score: 10, target: 1 }) }, 'ja');
  ok(all.includes('\nステージ1 完走 '), all);
  ok(K.runShareText({ ...run, nights: Array(8).fill({ score: 10, target: 1 }) }, 'en').includes('\nStage 1 clear! '));
});

check('連続記録と上位 %', () => {
  let s = K.nextStreak(null, '2026-09-26');
  s = K.nextStreak(s, '2026-09-27'); eq(s.streak, 2);
  s = K.nextStreak(s, '2026-09-29'); eq(s.streak, 3, '1 日休みを見逃す');
  eq(K.currentStreak(s, '2026-09-30'), 3);
  eq(K.currentStreak(s, '2026-10-05'), 0);
  eq(K.topPercent([1, 1, 1, 1, 1, 0, 0, 0, 0], 2), null, '10 人未満');
  eq(K.topPercent([0, 10, 10, 10, 10, 0, 0, 0, 0], 4), 13);
  eq(K.topPercent([0, 10, 10, 10, 10, 0, 0, 0, 0], 1), 88);
});

check('ならし済みの線: 範囲外・整数でない点は読まない・墨を超えた分は切る', () => {
  const st = K.newRound({ seed: 1, night: 0, moon: 1 });
  eq(K.lightPoints(st, [{ x: 1.5, y: 2 }, { x: 9, y: 2 }, { x: 17, y: 2 }]), null);
  eq(K.lightPoints(K.newRound({ seed: 1, night: 0, moon: 1 }), [{ x: -1, y: 2 }, { x: 9, y: 2 }, { x: 17, y: 2 }]), null);
  const long = Array.from({ length: 120 }, (_, i) => ({ x: (i * 8) % 352, y: 100 + Math.floor((i * 8) / 352) * 20 }));
  const used = K.lightPoints(K.newRound({ seed: 1, night: 0, moon: 1 }), long);
  ok(used && K.pathLength(used) <= K.BASE_INK + 1, `長さ ${used && K.pathLength(used)}`);
});

check('仕掛け: 夜ごとに 1 つずつ増える（一夜目は菊と金だけ）', () => {
  const kinds = (night) => { const st = K.newRound({ seed: 99, night, moon: 1 }); return { types: new Set(st.shells.map((s) => s.type)), clouds: st.clouds.length, ropes: st.ropes.length }; };
  const n0 = kinds(0);
  eq([...n0.types].sort().join(), 'kiku,kin', '一夜目');
  eq(n0.clouds + n0.ropes, 0);
  for (const g of K.GIMMICKS) {
    const before = kinds(g.night - 1), at = kinds(g.night);
    if (g.id === 'kumo') { eq(before.clouds, 0, '雲の前夜'); ok(at.clouds >= 1, '雲が出ない'); continue; }
    if (g.id === 'nawa') { eq(before.ropes, 0, '縄の前夜'); ok(at.ropes >= 1, '縄が出ない'); continue; }
    ok(!before.types.has(g.id), `${g.id} が前の夜に出ている`);
    ok(at.types.has(g.id), `${g.id} が ${g.night} 夜目に出ない`);
  }
  eq(K.gimmickFor(0), null);
  eq(K.gimmickFor(7).id, 'shaku');
  eq(K.newRound({ seed: 99, night: 7, moon: 1 }).shells.filter((s) => s.type === 'shaku').length, 1, '尺玉は 1 つ');
});

check('お守りの候補: 仕掛けが出てくる前の夜には、その仕掛けのお守りを出さない', () => {
  for (let seed = 1; seed < 60; seed++) {
    const o0 = K.offerCharms(seed, 0, []);
    for (const id of ['senrin', 'chouchinshi', 'kazekiri', 'amayoke']) ok(!o0.includes(id), `一夜目の後に ${id}`);
    ok(!K.offerCharms(seed, 3, []).includes('amayoke'), '雨よけは湿った玉の前夜から');
  }
  const later = new Set();
  for (let seed = 1; seed < 200; seed++) K.offerCharms(seed, 6, []).forEach((id) => later.add(id));
  for (const id of ['chouchinshi', 'kazekiri', 'amayoke']) ok(later.has(id), `${id} が一度も出ない`);
});

check('提灯: 灯ったあとにひらいた玉だけ点が 2 倍（線を引く向きで点が変わる）', () => {
  const shells = [{ type: 'chouchin', x: 40, y: 300 }];
  for (let i = 1; i <= 8; i++) shells.push({ type: 'kiku', x: 40 + i * 36, y: 300 });
  const fromLantern = K.runToEnd(handRound(shells.map((x) => ({ ...x }))), [line(30, 300, 340, 300, 80)]);
  const toLantern = K.runToEnd(handRound(shells.map((x) => ({ ...x }))), [line(340, 300, 30, 300, 80)]);
  eq(fromLantern.pops, 9); eq(toLantern.pops, 9);
  ok(fromLantern.chips > toLantern.chips, `提灯から ${fromLantern.chips} / 提灯へ ${toLantern.chips}`);
  eq(fromLantern.chips, 10 + 8 * 10 * 2, '提灯のあとの 8 個が 2 倍');
  const maker = K.runToEnd(handRound(shells.map((x) => ({ ...x })), ['chouchinshi']), [line(30, 300, 340, 300, 80)]);
  eq(maker.chips, 10 + 8 * 10 * (1 + K.MAKER_GAIN), '提灯職人は 2.5 倍');
});

check('湿った玉: 線の火が触れるとひらく。爆発だけなら、別々の火が 2 回いる（同じ火は 1 回と数える）', () => {
  const mk = (charms = []) => { const st = handRound([{ type: 'shime', x: 200, y: 300 }], charms); st.shells[0].hp = st.rules.dampHits; return st; };
  eq(K.runToEnd(mk(), [line(150, 300, 250, 300, 30)]).pops, 1, '線でなぞるとひらく');
  // 線は遠く、爆発だけを当てる
  const boom = (st, list) => {
    K.lightStroke(st, line(20, 600, 60, 600, 10));
    const seen = [];
    for (let i = 0; i < 600 && !st.done; i++) {
      for (const [at, e] of list) if (i === at) st.explosions.push({ t: 0, hue: 0, o: 0, gen: 0, cause: 'test', ...e });
      K.step(st); for (const ev of st.events) seen.push(ev.type); st.events.length = 0;
    }
    return seen;
  };
  const a = mk(), sa = boom(a, [[2, { id: 901, x: 200, y: 330, R: 30 }]]);
  eq(a.result.pops, 0, '爆発 1 回ではひらかない'); ok(sa.includes('dry'), '乾いた知らせ'); eq(a.shells[0].hp, 1);
  const b = mk(); boom(b, [[2, { id: 901, x: 200, y: 330, R: 30 }], [20, { id: 902, x: 230, y: 300, R: 40 }]]);
  eq(b.result.pops, 1, '別々の爆発 2 回でひらく');
  eq(b.shells[0].gen, 1, '爆発でひらいた玉は 1 代目');
  const c = mk(); boom(c, [[2, { id: 901, x: 200, y: 330, R: 30 }], [20, { id: 901, x: 200, y: 330, R: 30 }]]);
  eq(c.result.pops, 0, '同じ火は 2 回と数えない');
  const d = mk(['amayoke']); boom(d, [[2, { id: 901, x: 200, y: 330, R: 30 }]]);
  eq(d.result.pops, 1, '雨よけなら、ふつうの玉と同じ');
});

check('一番星: 線で直接ひらいた金は倍率 +3（爆発でひらいた金は +1）・遅火: 導火線が遅く、倍率 +2 から', () => {
  const gold = () => [{ type: 'kin', x: 100, y: 300 }, { type: 'kin', x: 100, y: 340 }];
  const a = K.runToEnd(handRound(gold(), ['ichibanboshi']), [line(60, 300, 140, 300, 20)]);
  eq(a.pops, 2); eq(a.mult, 1 + (1 + K.STAR_GOLD) + 1, '線の金 +3・爆発の金 +1');
  const b = K.runToEnd(handRound(gold(), ['ichibanboshi', 'kinun']), [line(60, 300, 140, 300, 20)]);
  eq(b.mult, 1 + (K.KINUN_GOLD + K.STAR_GOLD) + K.KINUN_GOLD, '金運と重なる');
  // 終わり玉の爆発でひらいた金は、線で直接ふれたことにならない（cause は 'end'）
  const e = handRound([{ type: 'kin', x: 200, y: 370 }], ['ichibanboshi', 'owaridama']);
  K.lightStroke(e, line(40, 300, 200, 300));
  let cause = null;
  for (let i = 0; i < 1200 && !e.done; i++) { K.step(e); for (const ev of e.events) if (ev.type === 'burst') cause = ev.cause; e.events.length = 0; }
  eq(cause, 'end'); eq(e.result.mult, 1 + 1);
  // 遅火: 同じ線でも、終わるまでの時間が長い
  const t = (charms) => { const st = handRound([{ type: 'kiku', x: 300, y: 300 }], charms); K.runToEnd(st, [line(20, 300, 300, 300, 70)]); return st; };
  const fast = t([]), slow = t(['osobi']);
  ok(slow.t > fast.t * 1.25, `遅火 ${slow.t.toFixed(2)} 秒 / ふだん ${fast.t.toFixed(2)} 秒`);
  eq(slow.result.mult, 1 + K.SLOW_MULT);
});

check('墨壺と残り墨: bank はその夜の墨に足す・持ちこせるのは残った墨の半分（1 夜ぶんまで）・残り墨は 1 割ごとに倍率 +1', () => {
  const st = K.newRound({ seed: 3, night: 1, moon: 1, bank: 100 });
  eq(st.ink, K.BASE_INK + 100); eq(st.inkTotal, st.ink); eq(st.bank, 100);
  eq(K.newRound({ seed: 3, night: 1, moon: 1, bank: 99999 }).ink, K.BASE_INK * 2, '墨壺は 1 夜ぶんまで');
  eq(K.newRound({ seed: 3, night: 1, moon: 1, bank: -5 }).ink, K.BASE_INK);
  eq(K.newRound({ seed: 3, night: 1, moon: 1, bank: 100 }).target, K.newRound({ seed: 3, night: 1, moon: 1 }).target, '目標点は墨壺に関係しない');
  const mirror = roundWithTwist('kagami', 5);
  eq(K.newRound({ seed: mirror.seed, night: 5, bank: 100 }).ink, Math.round((K.rulesFor([], 4).ink + 100) * K.MIRROR_INK), '鏡の夜は足したあとで 3/4');
  eq(K.inkCarry(st), 0, '線を引く前は持ちこさない');
  const pts = K.lightStroke(st, line(40, 300, 200, 300, 40));
  const used = K.pathLength(pts);
  ok(Math.abs(K.inkUsed(st) - used) < 1e-9);
  eq(K.inkLeft(st), st.inkTotal - used);
  eq(K.inkCarry(st), Math.min(K.BASE_INK, Math.floor(0.5 * (st.inkTotal - used))));
  K.runToEnd(st, []);
  eq(st.result.carry, K.inkCarry(st)); eq(st.result.inkLeft, K.inkLeft(st));
  // 残り墨
  const sp = K.newRound({ seed: 3, night: 1, charms: ['nokorizumi'], moon: 1 });
  eq(K.spareBonus(sp), 0, '線を引く前は数えない');
  const p2 = K.lightStroke(sp, line(40, 300, 140, 300, 20));
  const left = sp.inkTotal - K.pathLength(p2);
  eq(K.spareBonus(sp), Math.floor(left / sp.inkTotal / K.SPARE_STEP + 1e-9));
  ok(K.spareBonus(sp) >= 7, `残り墨 ${K.spareBonus(sp)}`);
  eq(K.multOf(sp), 1 + K.spareBonus(sp) + sp.goldMult + Math.floor(sp.pops / 10));
});

check('雲: 爆発は雲の向こうに届かず、雲の中の線は燃えない', () => {
  const st = handRound([{ type: 'ootama', x: 100, y: 300 }, { type: 'kiku', x: 170, y: 300 }]);
  st.clouds = [{ x: 135, y: 300, r: 20 }];
  const r = K.runToEnd(st, [line(60, 300, 100, 300, 10)]);
  eq(r.pops, 1, '雲の向こうの玉がひらいた');
  const st2 = handRound([{ type: 'kiku', x: 300, y: 300 }]);
  st2.clouds = [{ x: 200, y: 300, r: 30 }];
  eq(K.runToEnd(st2, [line(100, 300, 310, 300, 60)]).pops, 0, '火が雲を抜けた');
  const st3 = handRound([{ type: 'kiku', x: 300, y: 300 }]);
  st3.clouds = [{ x: 100, y: 300, r: 30 }];
  eq(K.runToEnd(st3, [line(100, 300, 310, 300, 60)]).pops, 0, '雲の中から引いた線に火がついた');
});

check('仕掛け縄: 片方の端に火が届くと、縄を走って反対側の玉をひらく', () => {
  const st = K.newRound({ seed: 3, night: 0, moon: 1 });
  st.shells = [{ id: 0, type: 'kiku', x: 60, y: 300, hue: 0, burst: false, burstAt: -1, hp: 1 }, { id: 1, type: 'kiku', x: 300, y: 300, hue: 0, burst: false, burstAt: -1, hp: 1 }];
  const rope = []; for (let x = 60; x <= 300; x += 4) rope.push({ x, y: 300 });
  st.clouds = [];
  // 縄は内部の区間として足す（newRound と同じ道筋）
  const K2 = K.newRound({ seed: 3, night: 6, moon: 1 });
  ok(K2.ropes.length >= 1 && K2.fuse.rope.some((x) => x), '七夜目に縄が無い');
  ok(K2.fuse.pts.every((p) => !K.inCloud(K2.clouds, p.x, p.y)), '縄が雲を通る');
  // 七夜目の縄の端の玉に線で火をつけると、反対の端の玉までひらく
  const r = K2.ropes[0];
  const a = K2.shells.find((s) => s.id === r.a), b = K2.shells.find((s) => s.id === r.b);
  K.lightStroke(K2, line(a.x - 30, a.y, a.x, a.y, 10));
  for (let i = 0; i < 3600 && !K2.done; i++) { if (K2.phase === 'draw2') K.finish(K2); else K.step(K2); K2.events.length = 0; }
  ok(b.burst, '縄の反対側の玉がひらかない');
  void st; void rope;
});

check('大トリ（尺玉）: 線の火でしかひらかない。ひらいた瞬間に、ほかの玉がひらいていた割合で倍率 +1〜+11', () => {
  // 大玉の爆発は尺玉をのみこんでも、ひらかない
  const a = handRound([{ type: 'ootama', x: 140, y: 300 }, { type: 'shaku', x: 200, y: 300 }]);
  const ra = K.runToEnd(a, [line(100, 300, 145, 300, 10)]);
  eq(ra.pops, 1, '爆発では尺玉はひらかない'); eq(a.tori, null);
  // 4 つの菊を先にひらいて、最後に尺玉へ → share 1 → +11
  const row = () => [...[0, 1, 2, 3].map((i) => ({ type: 'kiku', x: 40 + i * 50, y: 300 })), { type: 'shaku', x: 320, y: 300 }];
  const b = handRound(row());
  K.lightStroke(b, line(30, 300, 330, 300, 80));
  let tori = null;
  for (let i = 0; i < 1200 && !b.done; i++) { K.step(b); for (const e of b.events) if (e.type === 'tori') tori = e; b.events.length = 0; }
  ok(tori && tori.share === 1 && tori.add === 1 + K.TORI_BONUS, JSON.stringify(tori && { share: tori.share, add: tori.add }));
  eq(b.result.mult, 1 + 1 + K.TORI_BONUS, '倍率 = 1 + 大トリ');
  eq(b.result.tori.add, tori.add);
  // 尺玉から引きはじめると、まだ何もひらいていない → +1
  const c = handRound(row());
  const rc = K.runToEnd(c, [line(330, 300, 30, 300, 80)]);
  eq(c.tori.share, 0); eq(c.tori.add, 1); eq(rc.mult, 2);
  ok(rc.score < b.result.score / 3, '尺玉を最後にした方が、ずっと高い');
  // 尺玉がひらいても、まわりを一掃しない（ひとりの夜は TORI_R）
  const d = handRound([{ type: 'shaku', x: 200, y: 300 }, { type: 'kiku', x: 200, y: 300 + K.TORI_R + 30 }]);
  eq(K.runToEnd(d, [line(150, 300, 250, 300, 30)]).pops, 1);
});

check('目標点: 目安は夜ごとに上がる・倍率は夜ごとにある', () => {
  eq(K.TARGETS.length, K.NIGHTS);
  for (let i = 1; i < K.TARGETS.length; i++) ok(K.TARGETS[i] > K.TARGETS[i - 1]);
  eq(K.TARGET_RATIO.length, K.NIGHTS);
  // 倍率は七夜目まで上がる（八夜目は、基準点に大トリの倍率が入っているので七夜目より低くてよい）
  for (let i = 1; i < K.NIGHTS - 1; i++) ok(K.TARGET_RATIO[i] > K.TARGET_RATIO[i - 1]);
  for (const r of K.TARGET_RATIO) ok(r > 0);
});

check('目標点: その夜の並びから測る（決定的・上 2 桁に丸める・お守りなしでも届く夜は基準点より下）', () => {
  for (let seed = 1; seed <= 12; seed++) for (let n = 0; n < K.NIGHTS; n++) {
    const moon = seed % 8, par = K.parScore(seed, n, moon), tg = K.targetFor(seed, n, moon);
    ok(par > 0, `seed ${seed} night ${n}: 基準点が 0`);
    eq(K.parScore(seed, n, moon), par, '基準点が決定的でない');
    eq(K.targetFor(seed, n, moon), tg, '目標点が決定的でない');
    eq(K.newRound({ seed, night: n, moon }).target, tg, 'newRound の目標点がずれる');
    ok(tg >= 30, '目標点が小さすぎる');
    ok(String(tg).replace(/0+$/, '').length <= 2, `目標点 ${tg} が上 2 桁に丸まっていない`);
    const tw = K.twistFor(seed, n), f = K.TARGET_RATIO[n] * (tw ? tw.target : 1);
    // 倍率が 1 以下の夜は、お守りなしの手順の線で届く（基準点そのものが、実際に引ける線の点）
    if (f <= 1) ok(tg <= Math.max(30, par * 1.05), `seed ${seed} night ${n}: 目標点 ${tg} が基準点 ${par} を越える`);
  }
  // 月（玉の数）が変われば基準点も変わる
  ok([0, 2, 4, 6].map((m) => K.parScore(7, 7, m)).some((v, i, a) => v !== a[0]), '月で基準点が変わらない');
});

check('夜の景色: 二夜目までは群れ・八夜目は輪・同じ景色は続かない・どの景色でも玉がほぼ全部置ける', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 60; seed++) {
    eq(K.sceneFor(seed, 0).id, 'mure'); eq(K.sceneFor(seed, 1).id, 'mure');
    eq(K.sceneFor(seed, K.NIGHTS - 1).id, 'wa');
    for (let n = 2; n < K.NIGHTS; n++) {
      seen.add(K.sceneFor(seed, n).id);
      if (n > 2) ok(K.sceneFor(seed, n).id !== K.sceneFor(seed, n - 1).id, `seed ${seed} night ${n}: 同じ景色が続く`);
      const rules = K.rulesFor(['mashidama'], 4), a = K.makeLayout(seed, n, rules);
      ok(a.length >= K.BASE_COUNTS[n] + K.MASHI_N - 3, `seed ${seed} night ${n} (${K.sceneFor(seed, n).id}): ${a.length} 個しか置けない`);
      for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) ok(Math.hypot(a[i].x - a[j].x, a[i].y - a[j].y) >= 27, `seed ${seed} night ${n}: 近すぎる`);
    }
  }
  eq(seen.size, K.SCENES.length, '4 つの景色がどれも出る');
});

check('大一番: 三夜目と六夜目だけ・2 つは別の仕掛け・シードで決まる・目標点は仕掛けに合わせる', () => {
  const kinds = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    for (let n = 0; n < K.NIGHTS; n++) eq(!!K.twistFor(seed, n), K.BOSS_NIGHTS.includes(n), `night ${n}`);
    const a = K.twistFor(seed, 2), b = K.twistFor(seed, 5);
    ok(a.id !== b.id, '同じ仕掛けが 2 回');
    eq(K.twistFor(seed, 2).id, a.id, '決定的');
    kinds.add(a.id); kinds.add(b.id);
    // 大一番の目標点は、同じ夜の基準点 × 倍率 × 仕掛けの割り引き
    const want = K.parScore(seed, 5) * K.TARGET_RATIO[5] * b.target, got = K.targetFor(seed, 5);
    ok(Math.abs(got - want) <= want * 0.05 + 5, `seed ${seed}: 大一番の目標点 ${got} ≠ ${want}`);
    eq(K.newRound({ seed, night: 5 }).twist, b.id);
  }
  eq(kinds.size, K.TWISTS.length);
  for (const tw of K.TWISTS) ok(tw.say.length <= 15 && tw.ja && tw.en && tw.desc && tw.descEn, `${tw.id} の文言`);
});

// 仕掛けを指定した夜（シードを探して作る）
function roundWithTwist(id, night = 5) {
  for (let seed = 1; seed < 500; seed++) if (K.twistFor(seed, night) && K.twistFor(seed, night).id === id) return K.newRound({ seed, night });
  throw new Error('見つからない: ' + id);
}
check('大一番「まっすぐ」: ぐねぐね引いても、始まりと指を離した所を結ぶ直線になる（墨の長さまで）', () => {
  const st = roundWithTwist('massugu');
  const zig = [{ x: 40, y: 200 }, { x: 120, y: 320 }, { x: 180, y: 180 }, { x: 260, y: 300 }];
  const pts = K.lightStroke(st, zig);
  ok(pts && pts.length >= 3);
  const a = pts[0], b = pts[pts.length - 1];
  for (const p of pts) { const cross = Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / Math.hypot(b.x - a.x, b.y - a.y); ok(cross <= 1.5, `直線から ${cross.toFixed(1)} 外れる`); }
  ok(Math.hypot(b.x - 260, b.y - 300) < 12, '指を離した所まで届く');
  const long = K.straighten([{ x: 0, y: 0 }, { x: 5000, y: 0 }], 400);
  eq(Math.round(long[1].x), 400, '墨の長さで切る');
});

check('大一番「鏡」: 墨は 6 割・左右に映した線にも火がつく・再生しても同じ点', () => {
  const st = roundWithTwist('kagami');
  eq(st.ink, Math.round(K.rulesFor([], 4).ink * K.MIRROR_INK));
  K.lightStroke(st, line(40, 150, 120, 150, 20));
  const segs = new Set(st.fuse.seg);
  ok(segs.has(0) && segs.has(20), '映した区間がない');
  const mirrored = st.fuse.pts.filter((_, i) => st.fuse.seg[i] === 20);
  ok(mirrored.every((p) => p.x >= 240), '右側に映っていない');
  ok(st.heads.length >= 2 || st.pops > 0, '両方の端から火がつく');
  const again = roundWithTwist('kagami');
  const r1 = K.runToEnd(again, [st.strokes[0]], { normalized: true });
  const again2 = roundWithTwist('kagami');
  eq(K.runToEnd(again2, [st.strokes[0]], { normalized: true }).score, r1.score, '決定的でない');
});

check('お守りの候補: 同じ種類が 3 つそろわない（倍率・届く玉は 2 つまで、仕掛けへの備えは 1 つまで）', () => {
  for (const c of K.CHARMS) ok(['mult', 'reach', 'gimmick'].includes(c.kind), `${c.id} の種類`);
  let n = 0;
  for (let seed = 1; seed < 300; seed++) for (let night = 0; night < K.NIGHTS - 1; night++) {
    const o = K.offerCharms(seed, night, []);
    eq(o.length, 3); n++;
    const kinds = o.map((id) => K.charmById(id).kind);
    ok(kinds.filter((k) => k === 'gimmick').length <= 1, `seed ${seed} night ${night}: ${o}`);
    ok(new Set(kinds).size >= 2, `seed ${seed} night ${night}: 同じ種類が 3 つ ${o}`);
  }
  ok(n > 1000);
  // 入れかえたお守りは、もう無い
  for (const id of ['futofude', 'orebi', 'senrin']) eq(K.charmById(id), null, id);
  for (const id of ['nokorizumi', 'ichibanboshi', 'osobi']) ok(K.charmById(id), id);
});

check('お守り: 大一番のあとの 2 つ目は、別の 3 つ（持っているものは出ない）', () => {
  const a = K.offerCharms(77, 5, ['kodou']), b = K.offerCharms(77, 5, ['kodou', a[0]], 1);
  eq(b.length, 3); ok(!b.includes('kodou') && !b.includes(a[0]));
  ok(JSON.stringify(a) !== JSON.stringify(K.offerCharms(77, 5, ['kodou'], 1)), '同じ並び');
});

check('筆跡占い: 形で 7 つに分かれる', () => {
  const circle = Array.from({ length: 60 }, (_, i) => ({ x: 180 + Math.cos(i / 59 * Math.PI * 2) * 80, y: 300 + Math.sin(i / 59 * Math.PI * 2) * 80 }));
  const spiral = Array.from({ length: 90 }, (_, i) => { const a = i / 89 * Math.PI * 4.5, r = 20 + i * 1.2; return { x: 180 + Math.cos(a) * r, y: 300 + Math.sin(a) * r }; });
  const zig = Array.from({ length: 50 }, (_, i) => ({ x: 40 + i * 6, y: 300 + ((Math.floor(i / 10) % 2) ? (i % 10) * 12 : 120 - (i % 10) * 12) }));
  const wave = Array.from({ length: 50 }, (_, i) => ({ x: 30 + i * 6, y: 300 + Math.sin(i / 49 * Math.PI * 4) * 30 }));
  const T = (pts, o) => K.strokeType(K.normalizeStroke(pts, 460), o).id;
  eq(T(line(40, 300, 320, 320)), 'massugu');
  eq(T(circle), 'wa');
  eq(T(spiral), 'uzumaki');
  eq(T(zig), 'inazuma');
  eq(T(wave), 'nami');
  eq(T(line(100, 300, 180, 300), { ink: 460, pops: 20, total: 24 }), 'nyuukon');
  eq(K.STROKE_TYPES.length, 7);
});

check('シェア: 筆跡と大一番の結果が 1 行で入る', () => {
  const run = { daily: true, key: '2026-09-27', no: 2, moon: 4, total: 12345, bestChain: 30, type: 'inazuma',
    nights: [{ score: 100, target: 60 }, { score: 300, target: 200 }, { score: 900, target: 600, twist: 'kagami' }, { score: 100, target: 2500 }] };
  const ja = K.runShareText(run, 'ja'), en = K.runShareText(run, 'en');
  ok(ja.includes('\n筆跡「稲妻」・大一番「鏡」成功\n'), ja);
  ok(en.includes('Stroke: Lightning · Boss Mirror cleared'), en);
  eq((ja.match(/\p{Extended_Pictographic}/gu) || []).join(''), '🎆', '筆跡と大一番に絵文字を付けない');
  ok(!K.runShareText({ ...run, type: null, nights: [{ score: 100, target: 60 }] }, 'ja').includes('大一番'));
});

check('再生リンク: 前の版（1・2）のリンクは「前の版」とわかる', () => {
  const code = K.encodeReplay({ seed: 1, moon: 1, night: 1, charms: [], strokes: [[{ x: 1, y: 1 }, { x: 9, y: 1 }, { x: 17, y: 1 }]] });
  // 先頭の 1 文字 = 版 4 ビット + シードの上 2 ビット。E は版 1、I は版 2
  for (const head of ['E', 'I']) { const d = K.decodeReplay(head + code.slice(1)); ok(d && d.old, `${head}: ${JSON.stringify(d)}`); }
  eq(code[0], 'M', '今の版（3）は M から始まる（シードの上 2 ビットが 0 のとき）');
  eq(K.decodeReplay('Q' + code.slice(1)), null, 'まだ無い版（4）は読まない');
});

check('散ったときのヒント: 夜の様子から、効きそうなことを 1 つ選ぶ', () => {
  const H = (shells, stroke, setup) => { const st = handRound(shells); if (setup) setup(st); K.runToEnd(st, [stroke]); return K.failHint(st).id; };
  const far = [{ type: 'kiku', x: 320, y: 80 }, { type: 'kiku', x: 300, y: 90 }];
  // 雲の中から引きはじめた
  eq(H([{ type: 'kiku', x: 150, y: 300 }], line(100, 300, 300, 300), (st) => { st.clouds = [{ x: 100, y: 300, r: 30 }]; }), 'cloudStart');
  // 提灯が灯らなかった
  eq(H([{ type: 'kiku', x: 120, y: 300 }, { type: 'chouchin', x: 330, y: 560 }], line(60, 300, 200, 300)), 'lantern');
  // あと 2 つで満開
  eq(H([{ type: 'kiku', x: 60, y: 300 }, { type: 'kiku', x: 150, y: 300 }, { type: 'kiku', x: 240, y: 300 }, ...far], line(40, 300, 400, 300, 60)), 'almost');
  // 墨が余った（短い線）
  eq(H([{ type: 'kiku', x: 60, y: 300 }, ...far, { type: 'kiku', x: 200, y: 500 }, { type: 'kiku', x: 250, y: 500 }], line(40, 300, 90, 300, 8)), 'ink');
  // 大一番は、その夜のコツ
  const st = roundWithTwist('kagami'); K.runToEnd(st, [line(40, 150, 90, 150, 8)]);
  eq(K.failHint(st).id, 'twist_kagami');
  eq(K.failHint(roundWithTwist('massugu')).id, 'twist_massugu');
  // 尺玉が残った／尺玉を先にひらいてしまった
  eq(H([{ type: 'kiku', x: 60, y: 300 }, { type: 'shaku', x: 200, y: 450 }, ...far], line(40, 300, 100, 300)), 'shaku');
  const early = handRound([{ type: 'shaku', x: 60, y: 300 }, ...[1, 2, 3, 4, 5].map((i) => ({ type: 'kiku', x: 60 + i * 50, y: 300 })), ...far]);
  K.runToEnd(early, [line(40, 300, 330, 300, 60)]);
  const h = K.failHint(early);
  eq(h.id, 'toriEarly'); ok(h.share < 0.6 && h.add >= 1, JSON.stringify(h));
  // 「あと少しで満開」は、満開の倍率も返す
  const al = handRound([{ type: 'kiku', x: 60, y: 300 }, { type: 'kiku', x: 150, y: 300 }, { type: 'kiku', x: 240, y: 300 }, ...far], ['mankai']);
  K.runToEnd(al, [line(40, 300, 400, 300, 60)]);
  eq(JSON.stringify(K.failHint(al)), JSON.stringify({ id: 'almost', n: 2, bloom: 3 }));
});

check('ステージ: 今は八夜の1ステージだけ遊べて、次のステージは準備中として一覧にある', () => {
  eq(K.STAGES[0].id, 1);
  eq(K.STAGES[0].ja, '川辺の夏祭り');
  eq(K.STAGES[0].nights, 8);
  eq(K.STAGES[0].ready, true);
  eq(K.NIGHTS, K.STAGES[0].nights, '夜の数はステージ1から取る');
  eq(K.STAGE.id, 1, '今遊ぶのはステージ1');
  ok(K.STAGES.length >= 2 && K.STAGES[1].id === 2 && K.STAGES[1].ready === false, 'ステージ2は準備中');
  eq(K.nextStage(1).id, 2);
  eq(K.nextStage(K.STAGES[K.STAGES.length - 1].id), null, '最後のステージの次は無い');
});

check('ステージの完走記録: 初めて完走した日は残し、最高点だけ更新する', () => {
  const a = K.recordStageClear({}, 1, 5000, '2026-09-26');
  eq(JSON.stringify(a), JSON.stringify({ 1: { first: '2026-09-26', best: 5000 } }));
  const b = K.recordStageClear(a, 1, 4000, '2026-09-27');
  eq(JSON.stringify(b), JSON.stringify({ 1: { first: '2026-09-26', best: 5000 } }), '低い点では変えない');
  const c = K.recordStageClear(b, 1, 9000, '2026-09-28');
  eq(JSON.stringify(c), JSON.stringify({ 1: { first: '2026-09-26', best: 9000 } }));
  eq(JSON.stringify(a), JSON.stringify({ 1: { first: '2026-09-26', best: 5000 } }), 'もとの記録は書き換えない');
  eq(JSON.stringify(K.recordStageClear(null, 1, 10, '2026-09-26')), JSON.stringify({ 1: { first: '2026-09-26', best: 10 } }), '記録が無くても作る');
});

// ---------------------------------------------------------------- 花火合戦
function vsHand(shells, opts = {}) {
  const st = K.newVsRound({ seed: 1, bout: 0, moon: 1, ...opts });
  st.shells = shells.map((s, i) => ({ id: i, hue: 0, burst: false, burstAt: -1, hp: 1, lastSrc: null, ...s }));
  st.clouds = [];
  return st;
}
check('花火合戦: 盤面は決定的・大一番なし・三番は尺玉の輪', () => {
  for (let bout = 0; bout < K.VS_BOUTS.length; bout++) {
    const a = K.newVsRound({ seed: 42, bout, moon: 3 }), b = K.newVsRound({ seed: 42, bout, moon: 3 });
    eq(JSON.stringify(a.shells), JSON.stringify(b.shells), `bout ${bout}`);
    eq(a.twist, null); eq(a.target, 0); ok(a.vs && a.vs.placed.every((x) => x === null));
  }
  ok(K.newVsRound({ seed: 42, bout: 2 }).shells.some((s) => s.type === 'shaku'), '三番に尺玉');
  eq(K.newVsRound({ seed: 42, bout: 0, ink: [1, 0.5] }).vs.ink[1], Math.round(K.newVsRound({ seed: 42, bout: 0 }).rules.ink * 0.5));
});
check('花火合戦: 自分の火でひらいた玉が自分の点・点は持ち主ごと', () => {
  const st = vsHand([{ type: 'kiku', x: 80, y: 200 }, { type: 'kiku', x: 120, y: 200 }, { type: 'kin', x: 80, y: 450 }, { type: 'kiku', x: 120, y: 450 }, { type: 'kiku', x: 160, y: 450 }]);
  ok(K.vsPlace(st, 1, line(60, 200, 140, 200)), '相手の線');
  ok(K.vsPlace(st, 0, line(60, 450, 180, 450)), 'あなたの線');
  K.vsIgnite(st);
  const r = K.runVs(st);
  eq(r.pops[0], 3); eq(r.pops[1], 2);
  eq(r.mult[0], 2, '金はひらいた人の倍率に入る'); eq(r.mult[1], 1);
  eq(r.score[0], (5 + 10 + 10) * 2); eq(r.score[1], 20);
  eq(r.winner, 0);
  ok(st.shells.every((s) => s.by === (s.y > 300 ? 0 : 1)), '持ち主');
});
check('花火合戦: 後手は先手の線のすぐそば・どちらも尺玉のすぐそばからは引きはじめられない', () => {
  const st = vsHand([{ type: 'kiku', x: 100, y: 300 }, { type: 'shaku', x: 250, y: 150 }]);
  ok(K.vsPlace(st, 1, line(60, 300, 200, 300)));
  eq(K.vsPlace(st, 0, line(100, 310, 100, 450)), null, '相手の線から 10 の所');
  eq(K.vsPlace(st, 0, line(250, 170, 250, 400)), null, '尺玉から 20 の所');
  ok(K.vsPlace(st, 0, line(100, 360, 100, 500)), '60 離れていれば引ける');
  eq(K.vsPlace(st, 0, line(300, 500, 300, 600)), null, '1 番に 1 本だけ');
});
check('花火合戦: 相手の線に先に火が届くと、その先を横取りする', () => {
  // 相手の線は右へ 280。あなたの線は、相手の線の終わり近く（x=260）を上から横切る。あなたの方がずっと早く着く
  const st = vsHand([{ type: 'kiku', x: 300, y: 300 }, { type: 'kiku', x: 60, y: 300 }]);
  K.vsPlace(st, 1, line(40, 300, 320, 300, 70));
  K.vsPlace(st, 0, line(270, 250, 270, 350, 25));
  K.vsIgnite(st);
  const r = K.runVs(st);
  ok(r.steals[0] >= 1, `横取り ${r.steals}`);
  ok(r.took[0] > 0, '相手の線を燃やした');
  eq(st.shells[0].by, 0, '相手の線の先の玉は、あなたの点');
  eq(st.shells[1].by, 1, '相手の線の始まりの玉は、相手の点');
});
check('花火合戦: お邪魔玉は、線を引いたあと・火をつける前に 1 人 1 つ。玉の上・線の引きはじめのそば・場の外には置けない', () => {
  const st = vsHand([{ type: 'kiku', x: 100, y: 200 }]);
  K.vsPlace(st, 1, line(40, 300, 320, 300, 70));
  K.vsPlace(st, 0, line(200, 500, 200, 380, 30));
  eq(K.vsOjamaWhy(st, 105, 205), 'shell', '玉と重なる');
  eq(K.vsOjamaWhy(st, 80, 300), 'start', '相手の線の引きはじめから 40');
  eq(K.vsOjamaWhy(st, 200, 470), 'start', 'あなたの線の引きはじめから 30');
  eq(K.vsOjamaWhy(st, 5, 300), 'out', '場の外');
  eq(K.vsOjamaWhy(st, 200, 300), null);
  ok(K.vsPlaceOjama(st, 0, 200, 300), '置ける');
  eq(K.vsPlaceOjama(st, 0, 260, 300), false, '1 人 1 つ');
  eq(K.vsOjamaWhy(st, 205, 300), 'shell', 'お邪魔玉どうしも重ならない');
  ok(K.vsPlaceOjama(st, 1, 260, 300), '相手も 1 つ');
  const k = st.shells.find((s) => s.type === 'kuro' && s.from === 0);
  ok(k && k.hp === 2 && k.crackBy === -1);
  eq(JSON.stringify(st.vs.ojama[0]), JSON.stringify({ x: 200, y: 300, id: k.id }));
  const st2 = vsHand([]);
  K.vsPlace(st2, 1, line(40, 300, 320, 300, 70)); K.vsIgnite(st2);
  eq(K.vsPlaceOjama(st2, 0, 200, 300), false, '火がついたら置けない');
});
check('花火合戦: お邪魔玉に最初に届いた線の火は消え、その線だけが切れる。爆発や火花は素通り', () => {
  const st = vsHand([{ type: 'kiku', x: 60, y: 290 }, { type: 'kiku', x: 300, y: 290 }]);
  K.vsPlace(st, 1, line(40, 300, 320, 300, 70));
  ok(K.vsPlaceOjama(st, 0, 200, 300));
  K.vsIgnite(st);
  const r = K.runVs(st);
  const k = st.shells.find((s) => s.type === 'kuro');
  ok(!k.burst && k.hp === 1 && k.crackBy === 1, '相手の火で、ひびが入っただけ');
  eq(st.shells[0].by, 1); eq(st.shells[1].burst, false, '相手の火は、黒玉の先へは行けない');
  eq(r.cut[1], 1); eq(r.cut[0], 0); eq(r.kuro[1], 0);
  // 大玉の爆発がお邪魔玉をのみこんでも、何も起きない
  const st2 = vsHand([{ type: 'ootama', x: 200, y: 340 }]);
  K.vsPlace(st2, 0, line(40, 360, 320, 360, 70));
  ok(K.vsPlaceOjama(st2, 1, 200, 300));
  K.vsIgnite(st2); K.runVs(st2);
  ok(st2.shells[0].burst, '大玉はひらいた');
  const k2 = st2.shells.find((s) => s.type === 'kuro');
  ok(!k2.burst && k2.hp === 2, '爆発では、ひびも入らない');
});
check('花火合戦: 2 番目に届いた別の線の火で大爆発。届けた人の点・倍率 +1', () => {
  // 相手の火が先に届いて消え、あとからあなたの線の火が届く
  const st = vsHand([]);
  K.vsPlace(st, 1, line(40, 300, 320, 300, 70));
  K.vsPlace(st, 0, line(200, 500, 200, 312, 47));
  ok(K.vsPlaceOjama(st, 0, 200, 300));
  K.vsIgnite(st);
  const r = K.runVs(st);
  const k = st.shells.find((s) => s.type === 'kuro');
  ok(k.burst && k.by === 0 && k.crackBy === 1, `あなたの大爆発 ${JSON.stringify(k)}`);
  eq(r.kuro[0], 1); eq(r.back[0], 0, '自分のお邪魔玉'); eq(r.mult[0], 2, '倍率 +1');
  eq(r.score[0], K.SHELLS.kuro.pts * 2);
  // 相手のお邪魔玉を爆発させると「お邪魔返し」
  const st2 = vsHand([]);
  K.vsPlace(st2, 1, line(40, 300, 320, 300, 70));
  K.vsPlace(st2, 0, line(200, 500, 200, 312, 47));
  ok(K.vsPlaceOjama(st2, 1, 200, 300));
  K.vsIgnite(st2);
  const r2 = K.runVs(st2);
  eq(r2.kuro[0], 1); eq(r2.back[0], 1);
});
check('花火合戦: 黒玉に消された火は、そこで交わる線にも移らない（横取りにならない）', () => {
  // 相手の火が黒玉に届く所（x=184）が、ちょうどあなたの線（x=190）と交わる所
  const st = vsHand([]);
  K.vsPlace(st, 1, line(40, 300, 320, 300, 70), { normalized: true });
  K.vsPlace(st, 0, line(190, 500, 190, 250, 50), { normalized: true });
  ok(K.vsPlaceOjama(st, 1, 200, 290));
  K.vsIgnite(st);
  const r = K.runVs(st);
  const k = st.shells.find((s) => s.type === 'kuro');
  eq(k.crackBy, 1, '相手の火が先');
  eq(r.steals[1], 0, 'あなたの線は取られない');
  ok(k.burst && k.by === 0, 'あとから来たあなたの火で大爆発');
});
check('花火合戦: 火をつける前に行く末がわかる（vsForecast は本番と同じ）', () => {
  const opts = { seed: 31, bout: 1, moon: 3 };
  const a = K.vsPlan(() => K.newVsRound(opts), 1, K.RIVALS[1], K.rng32(1));
  const mk1 = () => { const t = K.newVsRound(opts); K.vsPlace(t, 1, a, { normalized: true }); return t; };
  const b = K.vsPlan(mk1, 0, { lines: 3, pick: 1, cut: true }, K.rng32(2));
  const make = () => { const t = mk1(); K.vsPlace(t, 0, b, { normalized: true }); return t; };
  const c = K.vsOjamaPlan(make, 1, K.RIVALS[3], K.rng32(3));
  ok(c && K.vsCanOjama(make(), c.x, c.y), `相手の置き所 ${JSON.stringify(c)}`);
  const mk2 = () => { const t = make(); K.vsPlaceOjama(t, 1, c.x, c.y); return t; };
  const fc = K.vsForecast(mk2());
  const real = mk2(); K.vsIgnite(real); const r = K.runVs(real);
  eq(JSON.stringify(fc.score), JSON.stringify(r.score), '点も同じ');
  const rk = real.shells.find((s) => s.type === 'kuro');
  eq(fc.kuro[0].crack, rk.crackBy); eq(fc.kuro[0].boom, rk.burst ? rk.by : -1);
  // 相手は、置かないときより点差がよくなる所を選ぶ
  const none = make(); K.vsIgnite(none); K.runVs(none);
  ok(c.val >= K.vsScore(none, 1) - K.vsScore(none, 0), '置いた方が得');
  eq(JSON.stringify(K.vsOjamaPlan(make, 1, K.RIVALS[3], K.rng32(3))), JSON.stringify(c), '決定的');
});
check('花火合戦: お邪魔玉の候補は置ける所だけ・交わる所も考える', () => {
  const st = vsHand(Array.from({ length: 10 }, (_, i) => ({ type: 'kiku', x: 60 + i * 26, y: 318 })));
  K.vsPlace(st, 1, line(40, 300, 320, 300, 70));
  K.vsPlace(st, 0, line(200, 500, 200, 150, 90));
  const spots = K.vsOjamaSpots(st, 0, 9, K.rng32(4));
  ok(spots.length >= 6, `候補 ${spots.length}`);
  ok(spots.every((c) => K.vsCanOjama(st, c.x, c.y)), '置ける所だけ');
  ok(spots.some((c) => Math.abs(c.x - 200) < 20 && Math.abs(c.y - 300) < 20), '交わる所');
  eq(K.vsOjamaSpots(st, 0, 1, K.rng32(4)).length, 1, '1 か所でも、玉の間の置ける所を探す');
});
check('花火合戦: 相手は線とお邪魔玉を先に見せる（あなたの線を見ずに決める）・黒玉のすぐそばからは引きはじめられない', () => {
  const opts = { seed: 58, bout: 1, moon: 4, ink: [1, 1], lag: [0, 0.05] };
  const make = () => K.newVsRound(opts);
  for (const rv of K.RIVALS) {
    const a = K.vsFirstPlan(make, 1, rv, K.rng32(9)), b = K.vsFirstPlan(make, 1, rv, K.rng32(9));
    eq(JSON.stringify(a), JSON.stringify(b), `${rv.id}: 決定的`);
    ok(a.pts && a.ojama, `${rv.id}: 線とお邪魔玉 ${JSON.stringify(a.ojama)}`);
    const st = make(); ok(K.vsPlace(st, 1, a.pts, { normalized: true }));
    ok(K.vsPlaceOjama(st, 1, a.ojama.x, a.ojama.y), `${rv.id}: あなたの線が無くても置ける`);
  }
  const st = vsHand([]);
  K.vsPlace(st, 1, line(40, 300, 320, 300, 70));
  ok(K.vsPlaceOjama(st, 1, 200, 420));
  eq(K.vsCanStart(st, 0, { x: 200, y: 450 }), false, '黒玉から 30');
  ok(K.vsCanStart(st, 0, { x: 200, y: 470 }), '黒玉から 50 なら引ける');
});
check('花火合戦: 火をつけるのが遅い相手（lag）は、その分遅れて火がつく', () => {
  const st = vsHand([{ type: 'kiku', x: 60, y: 300 }], { lag: [0, 0.25] });
  K.vsPlace(st, 1, line(40, 300, 320, 300, 70)); K.vsIgnite(st);
  eq(st.heads.length, 0);
  for (let i = 0; i < Math.round(0.25 / K.DT); i++) K.step(st);
  ok(st.heads.length > 0 || st.shells[0].burst, '遅れて火がつく');
});
check('花火合戦: CPU は置ける線を選ぶ・決定的・番付の順に強くなる設定', () => {
  const opts = { seed: 77, bout: 1, moon: 2, ink: [1, 1] };
  const make = () => K.newVsRound(opts);
  const a = K.vsPlan(make, 1, K.RIVALS[2], K.rng32(5)), b = K.vsPlan(make, 1, K.RIVALS[2], K.rng32(5));
  ok(a && a.length >= 3); eq(JSON.stringify(a), JSON.stringify(b));
  const st = make(); ok(K.vsPlace(st, 1, a, { normalized: true }), '置ける');
  // あなたの返し手も、相手の線から離れて引きはじめる
  const mk2 = () => { const t = make(); K.vsPlace(t, 1, a, { normalized: true }); return t; };
  const reply = K.vsPlan(mk2, 0, { lines: 4, pick: 1, cut: true }, K.rng32(6));
  const t = mk2(); ok(K.vsPlace(t, 0, reply, { normalized: true }), '返し手も置ける');
  for (let i = 1; i < K.RIVALS.length; i++) for (const k of ['probe', 'lines', 'ojama']) ok((K.RIVALS[i][k] || 0) >= (K.RIVALS[i - 1][k] || 0), `番付 ${i} ${k}`);
  for (const rv of K.RIVALS) for (const k of ['start', 'steal', 'stolen', 'ojama', 'boom', 'win', 'lose']) ok(rv.say[k] && rv.sayEn[k], `${rv.id}.${k}`);
});
check('花火合戦: お手本の台本どおりに起きる（横取り → 相手の黒玉があなたの火を止める → あなたの黒玉で相手の火が消え、あなたの大爆発）', () => {
  const D = K.VS_DEMO;
  // ページと同じ順: 相手の線 → 相手のお邪魔玉 → あなたの線 → あなたのお邪魔玉
  const make = () => { const t = K.newVsDemo(4); K.vsPlace(t, 1, D.rival, { normalized: true }); K.vsPlaceOjama(t, 1, D.ojamaRival.x, D.ojamaRival.y); K.vsPlace(t, 0, D.mine, { normalized: true }); return t; };
  const st = make();
  ok(st.vs.placed[0] && st.vs.placed[1] && st.vs.ojama[1], '線と相手のお邪魔玉を置ける');
  eq(K.vsForecast(make()).kuro[0].crack, 0, '相手の黒玉は、あなたの火を止める');
  const tryIt = make(); ok(K.vsPlaceOjama(tryIt, 0, D.ojamaTry.x, D.ojamaTry.y)); eq(K.vsForecast(tryIt).kuro[1].crack, 0, 'はじめに指を置く所は、あなたの火が止まる');
  ok(K.vsPlaceOjama(st, 0, D.ojamaMine.x, D.ojamaMine.y), 'あなたのお邪魔玉');
  const fc = K.vsForecast(make().vs && (() => { const t = make(); K.vsPlaceOjama(t, 0, D.ojamaMine.x, D.ojamaMine.y); return t; })());
  eq(fc.kuro[1].crack, 1); eq(fc.kuro[1].boom, 0, '交わる所: 相手の火を止めて、あなたの大爆発');
  K.vsIgnite(st);
  const seen = [];
  for (let i = 0; i < 1200 && !st.done; i++) { K.step(st); for (const e of st.events) if (['steal', 'crack', 'kuroBoom'].includes(e.type)) seen.push(`${e.type}${e.o}`); st.events.length = 0; }
  const first = (x) => seen.indexOf(x);
  ok(first('steal0') >= 0 && first('steal0') < first('crack0') && first('crack0') <= first('crack1') && first('crack1') < first('kuroBoom0'), seen.join(' '));
  ok(!seen.includes('steal1') && !seen.includes('kuroBoom1'), '相手は横取りも大爆発もしない');
  eq(st.result.winner, 0, 'お手本はあなたの勝ち');
});
check('花火合戦: ひとりの夜のルール変更（減衰・大トリ・湿った玉・お守り・墨壺）の前と、まったく同じ結果になる', () => {
  // 値は、ルール変更の前の core.js で CPU どうしを戦わせて取った（seed 4242・月は (seed + 番) % 8）
  const want = {
    0: { shells: 34, score: [570, 45], pops: [14, 2], steals: [11, 0], kuro: [1, 0] },
    1: { shells: 38, score: [1020, 660], pops: [21, 13], steals: [1, 1], kuro: [0, 0] },
    2: { shells: 46, clouds: [[226, 394, 43], [174, 228, 45]], score: [17270, 300], pops: [39, 6], steals: [7, 5], kuro: [2, 0] },
  };
  const seed = 4242;
  for (let bout = 0; bout < K.VS_BOUTS.length; bout++) {
    const opts = { seed, bout, moon: (seed + bout) % 8 };
    const a = K.vsFirstPlan(() => K.newVsRound(opts), 1, K.RIVALS[2], K.rng32(seed + bout));
    const mk = () => { const t = K.newVsRound(opts); K.vsPlace(t, 1, a.pts, { normalized: true }); if (a.ojama) K.vsPlaceOjama(t, 1, a.ojama.x, a.ojama.y); return t; };
    const b = K.vsPlan(mk, 0, { lines: 3, pick: 1, cut: true }, K.rng32(seed * 3 + bout));
    const mk2 = () => { const t = mk(); K.vsPlace(t, 0, b, { normalized: true }); return t; };
    const c = K.vsOjamaPlan(mk2, 0, K.RIVALS[1], K.rng32(seed * 5 + bout));
    const st = mk2(); if (c) K.vsPlaceOjama(st, 0, c.x, c.y);
    K.vsIgnite(st);
    const r = K.runVs(st), w = want[bout];
    eq(st.shells.length, w.shells, `${bout} 番: 玉の数`);
    if (w.clouds) eq(JSON.stringify(st.clouds.map((q) => [q.x, q.y, q.r])), JSON.stringify(w.clouds), `${bout} 番: 雲`);
    for (const k of ['score', 'pops', 'steals', 'kuro']) eq(JSON.stringify(r[k]), JSON.stringify(w[k]), `${bout} 番: ${k}`);
  }
  // 花火合戦の尺玉は、爆発でもひらき、倍率 +3 のまま
  const st = vsHand([{ type: 'ootama', x: 140, y: 300 }, { type: 'shaku', x: 200, y: 300 }]);
  K.vsPlace(st, 0, line(100, 300, 145, 300, 10)); K.vsIgnite(st);
  const r = K.runVs(st);
  eq(r.pops[0], 2); eq(r.mult[0], 1 + 3);
});

check('花火合戦: 挑戦状のリンクと、シェアの文', () => {
  const code = K.encodeVs(123456789, 3, 'wlw');
  eq(JSON.stringify(K.decodeVs(code)), JSON.stringify({ seed: 123456789, rival: 3, marks: 'wlw' }));
  for (const bad of ['', 'zz', 'abc.9.w', 'abc.1.x', '<script>.1.w']) eq(K.decodeVs(bad), null, bad);
  const res = (w, s0, s1) => ({ winner: w, score: [s0, s1], steals: [2, 0], kuro: [1, 0], back: [0, 0] });
  const ja = K.vsShareText({ rival: 2, winner: 0, results: [res(0, 10, 5), res(1, 1, 5), res(0, 9, 5)] }, 'ja', 'U');
  ok(ja.includes('ドン') && ja.includes('2-1') && ja.includes('🔴🔵🔴') && ja.includes('横取り 6') && ja.includes('大爆発 3'), ja);
  ok(K.vsShareText({ rival: 0, winner: 1, results: [res(1, 1, 5), res(1, 1, 5)] }, 'en', 'U').includes('lost 0-2'));
});

if (failures) { console.error(`hitofude_core_test: ${failures} FAILED`); process.exit(1); }
console.log('hitofude_core_test: ALL PASS');
