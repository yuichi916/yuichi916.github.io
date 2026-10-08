// バランス測定: CPU対CPUを並列で大量に回し、つなぐ派の勝率と試合時間を出す。
// 使い方: node _dev/tsunagu-naraberu/balance.mjs --games 400 --levels ふつう --set convT=0.6,convN=0.6 [--mirror] [--json out.json]
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
import { CFG, AI_T, AI_N, LEVELS } from '../../assets/tsunagu-naraberu/config.js';
import { createMatch } from '../../assets/tsunagu-naraberu/match.js';
import { createTsunaguAI } from '../../assets/tsunagu-naraberu/ai-tsunagu.js';
import { createNaraberuAI } from '../../assets/tsunagu-naraberu/ai-naraberu.js';

export function playOne({ cfg, level, kinds, seed }) {
  const m = createMatch({ cfg, kinds, seeds: [seed * 2 + 1, seed * 2 + 2], handicap: [0, 0] });
  const ais = kinds.map((k, p) => (k === 'tsunagu'
    ? createTsunaguAI(level, cfg, { seed: seed * 3 + p })
    : createNaraberuAI(level, cfg, { seed: seed * 3 + p })));
  const maxChain = [0, 0];
  while (!m.result) {
    const ev = m.step(ais.map((ai, p) => ai.next(m.players[p].board, m.players[p].pending.D)));
    for (const e of ev) if (e.type === 'pop' && e.chain > maxChain[e.p]) maxChain[e.p] = e.chain;
  }
  return { winner: m.result.winner, frames: m.result.frames, sent: m.players.map(p => p.sent), maxChain };
}

function wilson(k, n, z = 1.96) {
  if (!n) return [0, 1];
  const p = k / n, d = 1 + z * z / n;
  const c = (p + z * z / (2 * n)) / d, h = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d;
  return [c - h, c + h];
}

function parseArgs() {
  const a = process.argv.slice(2), o = { games: 200, levels: ['やさしい', 'ふつう', 'つよい'], set: {}, ai: {}, mirror: false, json: null };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--games') o.games = +a[++i];
    else if (a[i] === '--levels') o.levels = a[++i].split(',');
    else if (a[i] === '--set') for (const kv of a[++i].split(',')) { const [k, v] = kv.split('='); o.set[k] = +v; }
    else if (a[i] === '--ai') for (const kv of a[++i].split(',')) { const [k, v] = kv.split('='); o.ai[k] = +v; }
    else if (a[i] === '--mirror') o.mirror = true;
    else if (a[i] === '--json') o.json = a[++i];
  }
  return o;
}

async function runAll(jobs, threads) {
  const chunks = Array.from({ length: threads }, () => []);
  jobs.forEach((j, i) => chunks[i % threads].push(j));
  const file = fileURLToPath(import.meta.url);
  const parts = await Promise.all(chunks.filter(c => c.length).map(c => new Promise((res, rej) => {
    const w = new Worker(file, { workerData: c });
    w.on('message', res); w.on('error', rej);
  })));
  return parts.flat();
}

// --ai T.minChain.つよい=4,N.pot=8,L.つよい.act=6 のような上書き
export function applyAi(aiSet) {
  for (const [path, v] of Object.entries(aiSet || {})) {
    const [root, ...keys] = path.split('.');
    let o = { T: AI_T, N: AI_N, L: LEVELS }[root];
    for (const k of keys.slice(0, -1)) o = o[k];
    o[keys[keys.length - 1]] = v;
  }
}

if (!isMainThread) {
  applyAi(workerData[0]?.aiSet);
  parentPort.postMessage(workerData.map(j => ({ ...j, cfg: undefined, aiSet: undefined, ...playOne(j) })));
} else if (process.argv[1] && fileURLToPath(import.meta.url).toLowerCase() === process.argv[1].toLowerCase()) {
  const o = parseArgs();
  const cfg = { ...CFG, ...o.set };
  const threads = Math.max(1, os.cpus().length - 2);
  const t0 = Date.now();
  const report = { set: o.set, ai: o.ai, games: o.games, levels: {} };
  for (const level of o.levels) {
    const pairs = o.mirror ? [['tsunagu', 'tsunagu'], ['naraberu', 'naraberu']] : [['tsunagu', 'naraberu'], ['naraberu', 'tsunagu']];
    const jobs = [];
    for (let g = 0; g < o.games; g++) jobs.push({ cfg, level, kinds: pairs[g % 2], seed: 1000 + g, aiSet: o.ai });
    const res = await runAll(jobs, threads);
    let tw = 0, draws = 0, frames = 0, sentT = 0, sentN = 0, chT = 0, chN = 0, p0w = 0;
    const secs = [];
    for (const r of res) {
      const tIdx = r.kinds.indexOf('tsunagu');
      if (r.winner === -1) draws++;
      else { if (r.winner === 0) p0w++; if (r.kinds[r.winner] === 'tsunagu' && !o.mirror) tw++; }
      frames += r.frames; secs.push(r.frames / 60);
      if (!o.mirror) {
        sentT += r.sent[tIdx]; sentN += r.sent[1 - tIdx];
        chT += r.maxChain[tIdx]; chN += r.maxChain[1 - tIdx];
      }
    }
    secs.sort((a, b) => a - b);
    const n = res.length, decided = n - draws;
    const rate = o.mirror ? p0w / Math.max(1, decided) : (tw + draws / 2) / n;
    const [lo, hi] = wilson(o.mirror ? p0w : tw + draws / 2, o.mirror ? decided : n);
    const row = {
      n, rate, ci: [lo, hi], draws: draws / n, avgSec: frames / n / 60, medSec: secs[Math.floor(n / 2)],
      p10Sec: secs[Math.floor(n * 0.1)], p90Sec: secs[Math.floor(n * 0.9)],
      sentT: sentT / n, sentN: sentN / n, maxChainT: chT / n, maxChainN: chN / n,
    };
    report.levels[level] = row;
    const pct = v => (v * 100).toFixed(1) + '%';
    console.log(`${level}${o.mirror ? '(ミラー: 1P勝率)' : ' つなぐ派勝率'} ${pct(rate)} [${pct(lo)}–${pct(hi)}] 引分${pct(row.draws)} `
      + `平均${row.avgSec.toFixed(0)}秒 中央${row.medSec.toFixed(0)}秒 (10%:${row.p10Sec.toFixed(0)} 90%:${row.p90Sec.toFixed(0)}) `
      + (o.mirror ? '' : `送D つなぐ${row.sentT.toFixed(0)}/ならべる${row.sentN.toFixed(0)} 最大連鎖 ${row.maxChainT.toFixed(1)}/${row.maxChainN.toFixed(1)}`));
  }
  console.log(`(${((Date.now() - t0) / 1000).toFixed(0)}秒, ${threads}スレッド, set=${JSON.stringify(o.set)} ai=${JSON.stringify(o.ai)})`);
  if (o.json) writeFileSync(o.json, JSON.stringify(report, null, 2));
}
