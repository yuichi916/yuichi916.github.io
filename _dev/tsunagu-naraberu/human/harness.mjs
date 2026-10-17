// 置き場所: _dev/tsunagu-naraberu/human/（作り直し: node harness.mjs matrix --games 400 --json out.json）。人の代わりの設定は profiles.json
// ツナラベ！ 人の代わり（初心者・ふつうの人・上手な人）対 CPU の勝率を測る。リポジトリのファイルは一切書き換えない。
// 使い方:
//   node harness.mjs calib    [--profiles p.json] [--sessions 60] [--secs 180]          一人プレイで速さ・連鎖を測る（校正）
//   node harness.mjs matrix   [--profiles p.json] [--games 200] [--ai K=V,...] [--json out.json] [--who 初心者,...] [--levels かんたん,...]
//   node harness.mjs selftest [--games 400]                                             同じ段どうしで五分か、登録でCPUの挙動が変わらないか
// --ai: balance.mjs と同じ上書き（T.noise.かんたん=6, N.speed.おに.act=6, L.おに.think=14 など）。CPUの段の改案を試すのに使う
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';

const BASE = new URL('../../../assets/tsunagu-naraberu/', import.meta.url).href; // リポジトリの中のゲーム本体
const { CFG, AI_T, AI_N, LEVELS, cpuAtkOf } = await import(BASE + 'config.js');
const { createMatch } = await import(BASE + 'match.js');
const { createTsunagu } = await import(BASE + 'tsunagu.js');
const { createNaraberu } = await import(BASE + 'naraberu.js');
const { createTsunaguAI } = await import(BASE + 'ai-tsunagu.js');
const { createNaraberuAI } = await import(BASE + 'ai-naraberu.js');

const HERE = fileURLToPath(new URL('.', import.meta.url));
export const CPU_LEVELS = ['かんたん', 'やさしい', 'ふつう', 'つよい', 'おに'];
export const WHO = ['初心者', 'ふつうの人', '上手な人'];
const DEFAULT_RAISE_IDLE = AI_N.raiseIdle;
let baseRaiseIdle = DEFAULT_RAISE_IDLE;

// 人の代わりを、段の名前（例 '初心者T' / '初心者N'）で config の表に足す。人には攻撃補正をかけない（atk=1）
export function registerProfiles(P) {
  for (const [who, p] of Object.entries(P.T || {})) {
    const n = who + 'T';
    LEVELS[n] = { depth: p.depth, act: p.act, think: p.think, lookahead: p.lookahead };
    AI_T.noise[n] = p.noise; AI_T.minChain[n] = p.minChain; AI_T.atk[n] = 1;
  }
  for (const [who, p] of Object.entries(P.N || {})) {
    const n = who + 'N';
    LEVELS[n] = { depth: p.depth, act: p.act, think: p.think, lookahead: p.lookahead };
    AI_N.speed[n] = {}; AI_N.noise[n] = p.noise; AI_N.minChain[n] = p.minChain;
    AI_N.raiseBelow[n] = p.raiseBelow; AI_N.atk[n] = 1;
  }
}

export function applyAi(aiSet) {
  for (const [path, v] of Object.entries(aiSet || {})) {
    const [root, ...keys] = path.split('.');
    let o = { T: AI_T, N: AI_N, L: LEVELS, C: CFG }[root];
    for (const k of keys.slice(0, -1)) o = o[k];
    o[keys[keys.length - 1]] = v;
  }
}

const mkAI = (kind, lv, seed) => (kind === 'tsunagu'
  ? createTsunaguAI(lv, CFG, { seed }) : createNaraberuAI(lv, CFG, { seed }));

// 一人プレイ（おじゃまなし）。secs 秒か、負けるまで
function solo({ kind, lv, seed, secs, raiseIdle }) {
  AI_N.raiseIdle = raiseIdle ?? baseRaiseIdle;
  const board = kind === 'tsunagu'
    ? createTsunagu({ cfg: CFG, seed, takeGarbage: () => 0 })
    : createNaraberu({ cfg: CFG, seed, takeGarbage: () => [] });
  const ai = mkAI(kind, lv, seed * 7 + 3);
  const max = secs * 60;
  let f = 0, acts = 0, maxChain = 0;
  const chainHist = {}; // その段まで届いた連鎖（pop の chain ごとの回数）
  let combos = 0, pops = 0, curSeq = 0;
  const seqEnds = []; // つなぐ: 1回の発火が何連鎖で終わったか
  while (f < max && !board.isDead()) {
    const inp = ai.next(board, 0);
    for (const e of board.step(inp)) {
      if (e.type === 'lock' || e.type === 'swap') {
        acts++;
        if (kind === 'tsunagu' && e.type === 'lock') { if (curSeq) seqEnds.push(curSeq); curSeq = 0; }
      }
      if (e.type === 'pop') {
        pops++;
        chainHist[e.chain] = (chainHist[e.chain] || 0) + 1;
        if (e.chain > maxChain) maxChain = e.chain;
        if (kind === 'naraberu' && e.n >= 4) combos++;
        if (kind === 'tsunagu') curSeq = e.chain;
      }
    }
    f++;
  }
  if (curSeq) seqEnds.push(curSeq);
  return { frames: f, dead: board.isDead(), acts, maxChain, chainHist, combos, pops, seqEnds };
}

// 対戦。levels[p] の段で、human 側には攻撃補正をかけない
function match({ kinds, levels, seed, human, raiseIdle }) {
  AI_N.raiseIdle = (human >= 0 && kinds[human] === 'naraberu' && raiseIdle != null) ? raiseIdle : baseRaiseIdle;
  const cpuAtk = kinds.map((k, p) => (p === human ? 1 : cpuAtkOf(k, levels[p])));
  const m = createMatch({ cfg: CFG, kinds, seeds: [seed * 2 + 1, seed * 2 + 2], handicap: [0, 0], cpuAtk });
  const ais = kinds.map((k, p) => mkAI(k, levels[p], seed * 3 + p));
  const maxChain = [0, 0], acts = [0, 0];
  while (!m.result) {
    const ev = m.step(ais.map((ai, p) => ai.next(m.players[p].board, m.players[p].pending.D)));
    for (const e of ev) {
      if (e.type === 'pop' && e.chain > maxChain[e.p]) maxChain[e.p] = e.chain;
      if (e.type === 'lock' || e.type === 'swap') acts[e.p]++;
    }
  }
  return { winner: m.result.winner, frames: m.result.frames, maxChain, acts, sent: m.players.map(p => p.sent) };
}

if (!isMainThread) {
  registerProfiles(workerData.profiles);
  applyAi(workerData.aiSet);
  baseRaiseIdle = AI_N.raiseIdle;
  parentPort.on('message', jobs => {
    if (jobs === null) { process.exit(0); }
    parentPort.postMessage(jobs.map(j => ({ ...j, ...(j.type === 'solo' ? solo(j) : match(j)) })));
  });
}

// ---- 親 ----
export function wilson(k, n, z = 1.96) {
  if (!n) return [0, 1];
  const p = k / n, d = 1 + z * z / n;
  const c = (p + z * z / (2 * n)) / d, h = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d;
  return [c - h, c + h];
}

// 動的な割り振り（試合の長さがばらつくので、小分けにして空いた worker に渡す）
async function runJobs(jobs, profiles, aiSet, threads = Math.max(1, os.cpus().length - 2)) {
  const file = fileURLToPath(import.meta.url);
  const out = [];
  const B = 4;
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(threads, Math.ceil(jobs.length / B)) }, () => new Promise((res, rej) => {
    const w = new Worker(file, { workerData: { profiles, aiSet } });
    const feed = () => {
      if (next >= jobs.length) { w.postMessage(null); return; }
      const batch = jobs.slice(next, next + B); next += B;
      w.postMessage(batch);
    };
    w.on('message', r => { out.push(...r); feed(); });
    w.on('error', rej);
    w.on('exit', res);
    feed();
  })));
  return out;
}

function parseArgs() {
  const a = process.argv.slice(3);
  const o = { profiles: HERE + 'profiles.json', games: 200, sessions: 60, secs: 180, ai: {}, json: null, who: WHO, levels: CPU_LEVELS, factions: ['tsunagu', 'naraberu'] };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--profiles') o.profiles = a[++i];
    else if (a[i] === '--games') o.games = +a[++i];
    else if (a[i] === '--sessions') o.sessions = +a[++i];
    else if (a[i] === '--secs') o.secs = +a[++i];
    else if (a[i] === '--json') o.json = a[++i];
    else if (a[i] === '--who') o.who = a[++i].split(',');
    else if (a[i] === '--levels') o.levels = a[++i] === 'none' ? [] : a[i].split(',');
    else if (a[i] === '--factions') o.factions = a[++i].split(',');
    else if (a[i] === '--ai') for (const kv of a[++i].split(',')) { const [k, v] = kv.split('='); o.ai[k] = v === 'true' ? true : v === 'false' ? false : +v; }
  }
  return o;
}

const pct = v => (v * 100).toFixed(1) + '%';
const mean = xs => xs.reduce((s, v) => s + v, 0) / Math.max(1, xs.length);

async function calib(o, P) {
  const jobs = [];
  for (const kind of o.factions) {
    const key = kind === 'tsunagu' ? 'T' : 'N';
    const names = [...o.who.map(w => ({ label: w, lv: w + key, raiseIdle: P[key][w]?.raiseIdle })), ...o.levels.map(l => ({ label: 'CPU ' + l, lv: l }))];
    for (const nm of names) for (let s = 0; s < o.sessions; s++) jobs.push({ type: 'solo', kind, lv: nm.lv, label: nm.label, raiseIdle: nm.raiseIdle, seed: 300 + s, secs: o.secs });
  }
  const res = await runJobs(jobs, P, o.ai);
  const report = {};
  for (const kind of o.factions) {
    console.log(`\n== 一人プレイ ${kind}（おじゃまなし、${o.secs}秒×${o.sessions}回） ==`);
    const labels = [...new Set(jobs.filter(j => j.kind === kind).map(j => j.label))];
    for (const lab of labels) {
      const rs = res.filter(r => r.kind === kind && r.label === lab);
      const mins = rs.reduce((s, r) => s + r.frames, 0) / 3600;
      const rate = rs.reduce((s, r) => s + r.acts, 0) / mins;
      const mc = rs.map(r => r.maxChain);
      const dist = k => mc.filter(v => v >= k).length / rs.length;
      const hist = {};
      for (const r of rs) for (const [c, n] of Object.entries(r.chainHist)) hist[c] = (hist[c] || 0) + n;
      const perMin = k => Object.entries(hist).filter(([c]) => +c >= k).reduce((s, [, n]) => s + n, 0) / mins;
      const dead = rs.filter(r => r.dead).length / rs.length;
      const row = { rate, maxChainMean: mean(mc), maxChainGE: { 2: dist(2), 3: dist(3), 4: dist(4), 5: dist(5) }, dead, aliveSec: mean(rs.map(r => r.frames / 60)) };
      let extra;
      if (kind === 'tsunagu') {
        const se = rs.flatMap(r => r.seqEnds);
        const share = k => se.filter(v => v >= k).length / Math.max(1, se.length);
        row.fires = se.length / mins; row.fireGE = { 2: share(2), 3: share(3), 4: share(4) };
        extra = `発火${row.fires.toFixed(1)}/分 うち2連鎖以上${pct(row.fireGE[2])} 3以上${pct(row.fireGE[3])} 4以上${pct(row.fireGE[4])}`;
      } else {
        row.popsPerMin = rs.reduce((s, r) => s + r.pops, 0) / mins;
        row.comboPerMin = rs.reduce((s, r) => s + r.combos, 0) / mins;
        row.chain2PerMin = perMin(2); row.chain3PerMin = perMin(3);
        extra = `消し${row.popsPerMin.toFixed(1)}/分 同時4+${row.comboPerMin.toFixed(2)}/分 2連鎖目${row.chain2PerMin.toFixed(2)}/分 3連鎖目${row.chain3PerMin.toFixed(2)}/分`;
      }
      report[`${kind}/${lab}`] = row;
      console.log(`${lab.padEnd(8, '　')} ${kind === 'tsunagu' ? '置いた組' : '入れ替え'} ${rate.toFixed(1)}/分  最大連鎖 平均${row.maxChainMean.toFixed(2)} (≥2:${pct(dist(2))} ≥3:${pct(dist(3))} ≥4:${pct(dist(4))} ≥5:${pct(dist(5))})  `
        + `${extra}  負け${pct(dead)} 平均${row.aliveSec.toFixed(0)}秒`);
    }
  }
  return report;
}

async function matrix(o, P) {
  const jobs = [];
  for (const play of o.factions) {
    const cpuKind = play === 'tsunagu' ? 'naraberu' : 'tsunagu';
    const key = play === 'tsunagu' ? 'T' : 'N';
    for (const w of o.who) for (const L of o.levels) for (let g = 0; g < o.games; g++) {
      const hp = g % 2;
      const kinds = hp === 0 ? [play, cpuKind] : [cpuKind, play];
      const levels = hp === 0 ? [w + key, L] : [L, w + key];
      jobs.push({ type: 'match', play, who: w, L, kinds, levels, human: hp, raiseIdle: P[key][w]?.raiseIdle, seed: 7000 + g });
    }
  }
  const t0 = Date.now();
  const res = await runJobs(jobs, P, o.ai);
  const report = {};
  for (const play of o.factions) {
    console.log(`\n== 人が ${play === 'tsunagu' ? 'つなぐ派' : 'ならべる派'} で遊ぶ（CPU は${play === 'tsunagu' ? 'ならべる派' : 'つなぐ派'}）: 人の勝率 [95%区間] 平均秒 ==`);
    console.log(['', ...o.levels].join('\t'));
    for (const w of o.who) {
      const cells = [];
      for (const L of o.levels) {
        const rs = res.filter(r => r.play === play && r.who === w && r.L === L);
        let k = 0, draws = 0;
        for (const r of rs) { if (r.winner === r.human) k++; else if (r.winner === -1) { k += 0.5; draws++; } }
        const [lo, hi] = wilson(k, rs.length);
        const avgSec = mean(rs.map(r => r.frames / 60));
        const hRate = mean(rs.map(r => r.acts[r.human] / (r.frames / 3600)));
        const hMax = mean(rs.map(r => r.maxChain[r.human])), cMax = mean(rs.map(r => r.maxChain[1 - r.human]));
        report[`${play}/${w}/${L}`] = { n: rs.length, rate: k / rs.length, ci: [lo, hi], avgSec, draws: draws / rs.length, humanActsPerMin: hRate, humanMaxChain: hMax, cpuMaxChain: cMax };
        cells.push(`${pct(k / rs.length)} [${(lo * 100).toFixed(0)}–${(hi * 100).toFixed(0)}] ${avgSec.toFixed(0)}s`);
      }
      console.log([w, ...cells].join('\t'));
    }
  }
  console.log(`(${((Date.now() - t0) / 1000).toFixed(0)}秒, ${res.length}試合, ai=${JSON.stringify(o.ai)})`);
  return report;
}

async function selftest(o, P) {
  // 1) 人の代わりを登録しても CPU の段の挙動は変わらない（同じシードで同じ結果）
  const probe = [];
  for (let g = 0; g < 8; g++) probe.push({ type: 'match', kinds: g % 2 ? ['tsunagu', 'naraberu'] : ['naraberu', 'tsunagu'], levels: ['ふつう', 'つよい'], human: -1, seed: 900 + g });
  const a = await runJobs(probe, {}, {}, 4), b = await runJobs(probe, P, {}, 4);
  const key = r => `${r.seed}:${r.winner}:${r.frames}`;
  const sa = a.map(key).sort().join(), sb = b.map(key).sort().join();
  console.log(`登録の影響なし: ${sa === sb ? 'OK' : 'NG'}`);
  if (sa !== sb) process.exitCode = 1;
  // 2) 同じ段どうし: 派をまたいで（両方に CPU 補正）・同じ派どうし（1P 勝率）。どちらも ~50% のはず
  const jobs = [];
  for (const L of o.levels) for (let g = 0; g < o.games; g++) {
    jobs.push({ type: 'match', t: 'cross', L, kinds: g % 2 ? ['tsunagu', 'naraberu'] : ['naraberu', 'tsunagu'], levels: [L, L], human: -1, seed: 1000 + g });
    jobs.push({ type: 'match', t: 'mirror', L, kinds: g % 2 ? ['tsunagu', 'tsunagu'] : ['naraberu', 'naraberu'], levels: [L, L], human: -1, seed: 1000 + g });
  }
  // 3) 人の代わり同士（同じ腕前・同じ派）: 1P 勝率 ~50%
  for (const w of o.who) for (let g = 0; g < o.games; g++) {
    const kind = g % 2 ? 'tsunagu' : 'naraberu', k = kind === 'tsunagu' ? 'T' : 'N';
    jobs.push({ type: 'match', t: 'humanMirror', L: w, kinds: [kind, kind], levels: [w + k, w + k], human: 0, raiseIdle: P[k][w].raiseIdle, seed: 1000 + g });
  }
  const res = await runJobs(jobs, P, o.ai);
  const report = {};
  for (const t of ['cross', 'mirror', 'humanMirror']) {
    for (const L of (t === 'humanMirror' ? o.who : o.levels)) {
      const rs = res.filter(r => r.t === t && r.L === L);
      let k = 0;
      for (const r of rs) {
        if (r.winner === -1) k += 0.5;
        else if (t === 'cross' ? r.kinds[r.winner] === 'tsunagu' : r.winner === 0) k++;
      }
      const [lo, hi] = wilson(k, rs.length);
      report[`${t}/${L}`] = { rate: k / rs.length, ci: [lo, hi], avgSec: mean(rs.map(r => r.frames / 60)) };
      const what = t === 'cross' ? 'つなぐ派の勝率（両方CPU補正あり）' : '1Pの勝率';
      console.log(`${t.padEnd(12)} ${L.padEnd(6, '　')} ${what} ${pct(k / rs.length)} [${pct(lo)}–${pct(hi)}] 平均${report[`${t}/${L}`].avgSec.toFixed(0)}秒`);
    }
  }
  return report;
}

if (isMainThread && process.argv[1] && fileURLToPath(import.meta.url).toLowerCase() === process.argv[1].toLowerCase()) {
  const mode = process.argv[2];
  const o = parseArgs();
  const P = JSON.parse(readFileSync(o.profiles, 'utf8'));
  const t0 = Date.now();
  const fn = { calib, matrix, selftest }[mode];
  if (!fn) { console.error('mode: calib | matrix | selftest'); process.exit(2); }
  const report = await fn(o, P);
  console.log(`(合計 ${((Date.now() - t0) / 1000).toFixed(0)}秒)`);
  if (o.json) writeFileSync(o.json, JSON.stringify({ mode, profiles: P, ai: o.ai, games: o.games, report }, null, 2));
}
