// 一筆花火2 の世界ランキングの確かめ役（手元で動かす）。
// まだ確かめていない上位の記録をサーバーから受け取り、本物のルール（hanabi/verify.js）で 1 周を流しなおして、
// 送られた点・夜の数・流派・段位・今日の祭りの日付と合えば ✓、合わなければ隠す。
//
//   node _dev/hanabi2-verify.mjs            … 本番（https://hanabi2-rank.yuichi916.workers.dev）
//   RANK_URL=http://127.0.0.1:8788 ADMIN_TOKEN=… node _dev/hanabi2-verify.mjs
//   DRY=1 …                                  … 結果を出すだけで、サーバーに書かない
//
// 合言葉は環境変数 ADMIN_TOKEN か C:\Users\yuich\.secrets\hanabi2-admin-token.txt から読む（画面に出さない）。
import { readFileSync, appendFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { verifyRun } from '../hanabi/verify.js';

const URL0 = process.env.RANK_URL || 'https://hanabi2-rank.yuichi916.workers.dev';
const TOKEN = (process.env.ADMIN_TOKEN || (() => { try { return readFileSync('C:/Users/yuich/.secrets/hanabi2-admin-token.txt', 'utf8'); } catch { return ''; } })()).trim();
const LOGFILE = process.env.VERIFY_LOG || 'E:/tmp/hanabi2-verify.log';
if (!TOKEN) { console.error('ADMIN_TOKEN がない'); process.exit(2); }
const H = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

// 送られた値と、流しなおした結果が合うか
export function judge(row, log, v) {
  if (!v.ok) return `replay:${v.why}@${v.at}${v.claimed !== undefined ? ` ${v.claimed}→${v.got}` : ''}`;
  if (v.total !== row.score) return `total ${row.score}→${v.total}`;
  if (v.nights !== row.nights) return `nights ${row.nights}→${v.nights}`;
  if (!!row.won !== v.won) return 'won';
  if (!v.over) return 'not-finished';
  if (log.school !== row.school || log.rank !== row.rank || log.fuse !== row.fuse) return 'header';
  const daily = row.board.startsWith('d:');
  if (daily !== !!log.daily) return 'board';
  if (daily && String(log.seed) !== row.board.slice(2)) return 'daily-seed';
  if (!daily && row.board !== `a:${log.rank}:${log.school}`) return 'board';
  return '';
}

async function main() {
  const dry = !!process.env.DRY;
  const r = await fetch(`${URL0}/admin/pending?limit=30`, { headers: H });
  const j = await r.json();
  if (!j.ok) { console.error('pending', j); process.exit(1); }
  let good = 0, bad = 0;
  for (const row of j.rows) {
    let why = '', log = null;
    try { log = JSON.parse(gunzipSync(Buffer.from(row.log, 'base64')).toString('utf8')); } catch { why = 'decode'; }
    if (!why) { const t0 = Date.now(); const v = verifyRun(log); why = judge(row, log, v); row.ms = Date.now() - t0; }
    const verified = why ? -1 : 1;
    if (verified === 1) good++; else bad++;
    const line = `${new Date().toISOString()} ${row.board} ${row.player.slice(0, 8)} ${row.name} ${row.score} ${verified === 1 ? 'OK' : 'NG ' + why} ${row.ms ?? ''}ms`;
    console.log(line);
    try { appendFileSync(LOGFILE, line + '\n'); } catch { /* なくてもよい */ }
    if (!dry) await fetch(`${URL0}/admin/mark`, { method: 'POST', headers: H, body: JSON.stringify({ board: row.board, player: row.player, verified, why }) });
  }
  console.log(`確かめた ${j.rows.length} 件: 合った ${good}・隠した ${bad}${dry ? '（DRY）' : ''}`);
}
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1].endsWith('hanabi2-verify.mjs')) main();
