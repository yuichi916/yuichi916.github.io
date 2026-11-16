// 一筆花火 2 — ランキングの確かめ役。遊んだ人の記録（筆の動きと屋台の操作）を、本物のルールでもう一度流して、
// 送られてきた点と夜の数が出るかを確かめる。DOM に触らない（ページ・テスト・確かめの道具で同じものを使う）。
//
// 記録 log = { v, seed, fuse, rank, school, daily, xp, ps, as, ops: [...] }（ps: 縦画面の玉 1.3 倍で遊んだ記録なら 1、as: 練習の周＝世界 1 の大一番 ×0.75）
//   ['n', W, H, evs, score]  夜。evs = [[コマ, 'd', x, y] | [コマ, 'm', x, y] | [コマ, 'u'] | [コマ, 'e', 縁起物]]
//   ['b', i] 買う / ['r'] 引き直し / ['s', i] 売る / ['w', i, j] 並べ替え / ['g'] ほうびを受け取らない
//   ['a', 道] 次の夜へ（道の分かれがなければ -1）/ ['x'] 屋台の途中で閉じた（そのまま次へ）
//   ['k', 小判] 線香花火 / ['L', 0|1] 夜の途中で閉じた（1 なら灯をひとつ取られた）/ ['E'] 千秋楽へ
import * as G from './sim.js';
import * as Run from './run.js';

const MAX_STEPS = 60 * 900; // 1 夜 15 分まで

// 1 夜を流す。ページと同じく、夜のはじめに玉の上がる時間をそろえてから、コマごとに筆の動きを入れる
export function replayNight(def, W, H, run, evs, ps = 1) {
  const lo = Run.loadoutFor(run); if (!ps) lo.rs = 1; // 縦画面の玉 1.3 倍より前の記録（ps なし）は、元の大きさで流す
  const st = G.newNight(def, W, H, lo);
  G.stageRise(st);
  let i = 0;
  for (let step = 0; step < MAX_STEPS && st.phase !== 'over'; step++) {
    while (i < evs.length && evs[i][0] <= step) {
      const e = evs[i++];
      if (e[1] === 'd') G.penDown(st, e[2], e[3]);
      else if (e[1] === 'm') G.penMove(st, e[2], e[3]);
      else if (e[1] === 'u') G.penUp(st);
      else if (e[1] === 'e') { const k = (run.engi || []).indexOf(e[2]); if (k >= 0 && G.useEngi(st, e[2])) run.engi.splice(k, 1); }
    }
    G.step(st, G.DT); st.events.length = 0;
  }
  return st;
}

const num = (x) => typeof x === 'number' && Number.isFinite(x);
const okEvs = (evs) => Array.isArray(evs) && evs.length < 200000 && evs.every((e) => Array.isArray(e) && Number.isInteger(e[0]) && e[0] >= 0 && (e[1] === 'u' || (e[1] === 'e' && typeof e[2] === 'string') || ((e[1] === 'd' || e[1] === 'm') && num(e[2]) && num(e[3]))));

// 今日の祭りの種（ページの startDaily と同じ。世界時の日付）
export const dailySeed = (d) => d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();

export function verifyRun(log) {
  const fail = (why, at = -1, more = {}) => ({ ok: false, why, at, ...more });
  if (!log || log.v !== Run.LOG_VERSION || !Array.isArray(log.ops)) return fail('version');
  if (!Run.SCHOOLS.some((s) => s.id === log.school) || !Run.FUSES.some((f) => f.id === log.fuse) || !(Number.isInteger(log.rank) && log.rank >= 0 && log.rank < Run.RANKS.length)) return fail('header');
  if (log.daily && (log.fuse !== 'asa' || log.rank !== 0 || log.school !== 'hon')) return fail('daily-header');
  const run = Run.newRun({ seed: log.seed, fuse: log.fuse, rank: log.rank, school: log.school });
  run.daily = !!log.daily; run.assist = log.as ? 1 : 0;
  const unlocked = Run.unlockedCharms({ xp: Math.max(0, +log.xp || 0) });
  let sh = null, phase = 'night', senko = false;
  for (let k = 0; k < log.ops.length; k++) {
    const op = log.ops[k];
    if (!Array.isArray(op)) return fail('op', k);
    const t = op[0];
    if (phase === 'over') return fail('after-end', k);
    if (phase === 'won' && t !== 'E') return fail('after-win', k);
    switch (t) {
      case 'n': {
        if (phase !== 'night') return fail('order', k);
        const [, W, H, evs, score] = op;
        if (!(num(W) && num(H) && W >= 200 && H >= 200 && W <= 4000 && H <= 4000) || !okEvs(evs)) return fail('night-data', k);
        const def = Run.nightDef(run, run.world, run.night);
        const st = replayNight(def, W, H, run, evs, log.ps ? 1 : 0);
        if (st.phase !== 'over') return fail('unfinished', k);
        if (st.score !== score) return fail('score', k, { got: st.score, claimed: score, w: run.world, n: run.night });
        const r = Run.settleNight(run, st, def);
        if (r.res === 'clear') { sh = Run.openShop(run, Run.unlockedCharms({ xp: Math.max(0, +log.xp || 0) })); phase = 'shop'; }
        else if (r.res === 'over') phase = 'over';
        senko = false;
        break;
      }
      case 'L': // 夜の途中で閉じた。灯を取るのは、灯が 2 つ以上あるときだけ
        if (phase !== 'night') return fail('order', k);
        if (op[1]) { if (run.lives <= 1) return fail('left', k); run.lives--; }
        break;
      case 'b': if (phase !== 'shop' || !Number.isInteger(op[1]) || Run.buyItem(sh, run, op[1])) return fail('buy', k); break;
      case 'r': if (phase !== 'shop' || !Run.rerollShop(sh, run, unlocked)) return fail('reroll', k); break;
      case 's': if (phase !== 'shop' || !Number.isInteger(op[1]) || !Run.sellCharm(run, op[1])) return fail('sell', k); break;
      case 'w': if (phase !== 'shop' || !Run.swapCharms(run, op[1], op[2])) return fail('swap', k); break;
      case 'g': if (phase !== 'shop') return fail('gift', k); sh.giftTaken = true; break;
      case 'a': case 'x': {
        if (phase !== 'shop') return fail('order', k);
        if (t === 'a') { const ch = Run.routeChoices(run); if (ch.length) { const c = ch.find((x) => x.lane === op[1]); if (!c) return fail('route', k); Run.chooseRoute(run, c); } }
        const res = Run.advance(run); sh = null;
        phase = res === 'won' ? 'won' : 'night'; senko = res === 'world';
        break;
      }
      case 'k': // 線香花火は世界の変わり目に 1 回だけ
        if (phase !== 'night' || !senko || !Number.isInteger(op[1]) || op[1] < 0 || op[1] > Run.SENKO_MAX) return fail('senko', k);
        run.coins += op[1]; senko = false;
        break;
      case 'E': if (phase !== 'won') return fail('endless', k); Run.startEndless(run); phase = 'night'; break;
      default: return fail('op', k);
    }
  }
  return { ok: true, total: run.totalScore, nights: run.nightsCleared, won: !!run.won, endless: !!run.endless, over: phase === 'over' || phase === 'won', run };
}
