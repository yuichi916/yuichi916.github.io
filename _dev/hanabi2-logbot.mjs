// ランキングの試験用: ルールどおりに 1 周を遊んで、ページと同じ形の記録を作る（tests と Worker の試験で使う）
import * as G from '../hanabi/sim.js';
import * as Run from '../hanabi/run.js';
const q = (v) => Math.round(v * 10) / 10;
function playNight(run, W, H) {
  const def = Run.nightDef(run, run.world, run.night), st = G.newNight(def, W, H, Run.loadoutFor(run)); G.stageRise(st);
  const evs = []; let step = 0, path = null, pen = null;
  while (st.phase !== 'over' && step < 60 * 400) {
    if (st.phase === 'aim' && !st.shells.some((x) => x.rise > 0)) {
      if (run.engi.length && st.strokesLeft === 1) { const id = run.engi[0]; if (G.useEngi(st, id)) { run.engi.shift(); evs.push([step, 'e', id]); } }
      const idle = st.shells.filter((x) => x.state === 'idle').sort((a, b) => a.x - b.x);
      if (idle.length) { pen = { x: q(idle[0].x), y: q(idle[0].y) }; if (G.penDown(st, pen.x, pen.y)) { evs.push([step, 'd', pen.x, pen.y]); path = idle.slice(1, 10).map((x) => ({ x: x.x, y: x.y })); } }
    } else if (st.phase === 'stroke' && st.stroke?.penDown && path) {
      const t = path[0];
      if (!t) { evs.push([step, 'u']); G.penUp(st); path = null; }
      else { const dx = t.x - pen.x, dy = t.y - pen.y, d = Math.hypot(dx, dy), v = 7.5; pen = d <= v ? (path.shift(), { x: q(t.x), y: q(t.y) }) : { x: q(pen.x + (dx / d) * v), y: q(pen.y + (dy / d) * v) }; evs.push([step, 'm', pen.x, pen.y]); G.penMove(st, pen.x, pen.y); }
    }
    G.step(st, G.DT); st.events.length = 0; step++;
  }
  return { st, def, op: ['n', W, H, evs, st.score] };
}
export function makeRunLog(seed, { nightsMax = 6, daily = false } = {}) {
  const run = Run.newRun({ seed, school: 'hon' }); run.daily = daily;
  const log = { v: Run.LOG_VERSION, seed, fuse: 'asa', rank: 0, school: 'hon', daily, xp: 0, ops: [] };
  const unlocked = Run.unlockedCharms({ xp: 0 }), rnd = G.rng32(seed * 3 + 1);
  for (let g = 0; g < 80; g++) {
    const { st, def, op } = playNight(run, 1280, 720); log.ops.push(op);
    const r = Run.settleNight(run, st, def);
    if (r.res === 'over') break;
    if (r.res !== 'clear') continue;
    const sh = Run.openShop(run, unlocked);
    // nightsMax を越えたら買わない（弱くなって、本当に散るまで遊ぶ。周回はルールどおりに終える）
    if (run.nightsCleared < nightsMax) for (let i = 0; i < sh.items.length; i++) if (rnd() < 0.5 && !Run.buyItem(sh, run, i)) log.ops.push(['b', i]);
    const ch = Run.routeChoices(run), c = ch.length ? ch[Math.floor(rnd() * ch.length)] : null; if (c) Run.chooseRoute(run, c);
    log.ops.push(['a', c ? c.lane : -1]);
    if (Run.advance(run) === 'world') { log.ops.push(['k', 3]); run.coins += 3; }
  }
  return { run, log };
}
