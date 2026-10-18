// 紹介動画に向く試合を探す。ゲームの demo と同じ作り方（seeds [s, s+7919]・AI は s+1 と s）で試合を回し、
// 大連鎖（カットインが出る4連鎖以上）・相殺・決着の時刻を並べる。
// 使い方: node scout.mjs [--level つよい] [--from 1] [--n 300] [--a tsunagu] [--b naraberu]
import { CFG, cpuAtkOf } from '../../../assets/tsunagu-naraberu/config.js';
import { createMatch } from '../../../assets/tsunagu-naraberu/match.js';
import { createTsunaguAI } from '../../../assets/tsunagu-naraberu/ai-tsunagu.js';
import { createNaraberuAI } from '../../../assets/tsunagu-naraberu/ai-naraberu.js';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const level = arg('level', 'つよい'), from = +arg('from', 1), n = +arg('n', 300);
const kinds = [arg('a', 'tsunagu'), arg('b', 'naraberu')];
const makeAI = (kind, seed) => (kind === 'tsunagu' ? createTsunaguAI(level, CFG, { seed }) : createNaraberuAI(level, CFG, { seed }));

const rows = [];
for (let seed = from; seed < from + n; seed++) {
  const match = createMatch({ cfg: CFG, kinds, seeds: [seed, seed + 7919], cpuAtk: kinds.map(k => cpuAtkOf(k, level)) });
  const ais = [makeAI(kinds[0], seed + 1), makeAI(kinds[1], seed)];
  const big = [], offs = [];
  let f = 0;
  for (; f < 60 * 120 && !match.result; f++) {
    const ev = match.step(match.players.map((pl, p) => ais[p].next(pl.board, pl.pending.D)));
    for (const e of ev) {
      if (e.type === 'pop' && e.chain >= 4) big.push(`${e.p}:${e.chain}@${(f / 60).toFixed(1)}`);
      if (e.type === 'attack' && e.offset > 0.5) offs.push(`${e.p}@${(f / 60).toFixed(1)}`);
    }
  }
  if (!match.result) continue;
  const sec = f / 60, both = new Set(big.map(b => b[0])).size;
  rows.push({ seed, sec: +sec.toFixed(1), winner: match.result.winner, big, offs, both });
}
// 30〜55秒で決着、大連鎖あり（両派ならなお良い）、相殺あり
const good = rows.filter(r => r.sec >= 30 && r.sec <= 55 && r.big.length && r.offs.length)
  .sort((a, b) => b.both - a.both || b.big.length - a.big.length);
console.log(`試合 ${rows.length} / 候補 ${good.length}`);
for (const r of good.slice(0, 15)) console.log(JSON.stringify(r));
