// 花火合戦のつり合いを測る。CPU どうしを戦わせ、勝率・番ごとの勝ち・横取り・お邪魔玉・継ぎ火の数を出す。
// 使い方: node _dev/hitofude-vs-balance.mjs <あなた役> <相手役> [試合数=60]
//   役は RIVALS の id（'don@{"probe":2}' のように設定を上書きできる）か、人の目安の 'bot1' 'bot3' 'bot6'
//   （線を 1・3・6 本考えて選ぶ。bot1 は相手の線を読まず、道具はお邪魔玉だけ）
import * as K from '../assets/hitofude/core.js';

export const BOTS = {
  bot1: { lines: 1, pick: 1, probe: 0, ink: 1, lag: 0, react: 0.6, ojama: 0.15, tsugi: 0, tactics: ['kayaku', 'nagafude'] },
  bot3: { lines: 3, pick: 1, probe: 1, cut: true, ink: 1, lag: 0, react: 0.4, ojama: 0.12, tsugi: 0.12, tactics: ['hayabi', 'futofude', 'kayaku'] },
  bot6: { lines: 6, pick: 1, probe: 2, cut: true, ink: 1, lag: 0, react: 0.3, ojama: 0.1, tsugi: 0.1, tactics: ['hayabi', 'tairin', 'kayaku'] },
};
const role = (id) => { if (BOTS[id]) return BOTS[id]; const m = /^(\w+)@(.+)$/.exec(id); if (m) return { ...(BOTS[m[1]] || K.rivalById(m[1])), ...JSON.parse(m[2]) }; return K.rivalById(id); };
const FIRST = process.env.FIRST ? process.env.FIRST.split(',').map(Number) : K.VS_FIRST;

// 1 試合。a があなた役（0）、b が相手役（1）
export function playMatch(seed, moon, a, b, rng) {
  const results = [];
  const wins = [0, 0];
  for (let bout = 0; bout < K.VS_BOUTS.length && Math.max(...wins) < K.VS_WIN; bout++) {
    const roles = [a, b], first = FIRST[bout], second = 1 - first;
    const tactics = [0, 1].map((o) => K.rivalTactic(roles[o], K.vsOffers(seed, bout, o)));
    // 先手は、後手の作戦札を知らずに線を考える（ページと同じ）
    const opts = (known) => ({ seed, bout, moon, ink: [a.ink || 1, b.ink || 1], lag: [a.lag || 0, b.lag || 0], powder: [a.powder || 0, b.powder || 0], first, tactics: tactics.map((x, o) => (known[o] ? x : null)) });
    const lines = [null, null];
    const make = (known) => () => { const st = K.newVsRound(opts(known)); for (const o of [first, second]) if (lines[o]) K.vsPlace(st, o, lines[o], { normalized: true }); return st; };
    const kFirst = [false, false]; kFirst[first] = true;
    lines[first] = K.vsPlan(make(kFirst), first, roles[first], rng);
    lines[second] = K.vsPlan(make([true, true]), second, roles[second], rng);
    const st = make([true, true])();
    K.vsIgnite(st);
    const res = K.runVs(st, [a, b]);
    results.push(res);
    if (res.winner >= 0) wins[res.winner]++;
  }
  const tot = [0, 1].map((o) => results.reduce((x, r) => x + r.score[o], 0));
  const winner = wins[0] !== wins[1] ? (wins[0] > wins[1] ? 0 : 1) : tot[0] !== tot[1] ? (tot[0] > tot[1] ? 0 : 1) : -1;
  return { results, wins, winner };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [ia = 'bot3', ib = 'chibi', nArg = '60'] = process.argv.slice(2);
  const A = role(ia), B = role(ib), N = +nArg;
  const rng = K.rng32(777);
  const byBout = K.VS_BOUTS.map(() => [0, 0, 0]);
  const sum = {}; let win = 0, lose = 0, nb = 0;
  const t0 = Date.now();
  for (let i = 1; i <= N; i++) {
    const m = playMatch(K.hashStr('vs' + i), i % 8, A, B, rng);
    if (m.winner === 0) win++; else if (m.winner === 1) lose++;
    m.results.forEach((r, bout) => {
      nb++; byBout[bout][2]++; if (r.winner >= 0) byBout[bout][r.winner]++;
      for (const k of ['steals', 'took', 'ojama', 'tsugi', 'kuro', 'back']) { sum[k] = sum[k] || [0, 0]; sum[k][0] += r[k][0]; sum[k][1] += r[k][1]; }
    });
  }
  const pct = (x, n) => `${Math.round(x / n * 100)}%`;
  const per = (k) => `${(sum[k][0] / nb).toFixed(2)}-${(sum[k][1] / nb).toFixed(2)}`;
  console.log(`${ia} vs ${ib}  N=${N}: あなた役の勝ち ${pct(win, N)}（負け ${pct(lose, N)}） ・ 番ごと ${byBout.map((b, i) => `${i + 1}番 ${pct(b[0], b[2] || 1)}`).join(' ')}`);
  console.log(`  1 番あたり: 横取り ${per('steals')} ・ お邪魔玉 ${per('ojama')} ・ 継ぎ火 ${per('tsugi')} ・ 黒玉の爆発 ${per('kuro')}（うちお邪魔返し ${per('back')}） ・ ${((Date.now() - t0) / N).toFixed(0)} ms/試合`);
}
