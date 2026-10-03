// 今夜の一筆の願い札を、日ごとに前もって作る（サーバーで毎回作ると重いので）。src/wishes.js に書き出す。
// 使い方: node gen-wishes.mjs [はじめの日 YYYY-MM-DD] [日数]
// ゲームのルール（core.js の願い札・盤の作り方）を変えたら、作りなおしてデプロイしなおす。
import { writeFileSync } from 'fs';
import * as K from '../../assets/hitofude/core.js';

const start = process.argv[2] || '2026-10-01', days = +(process.argv[3] || 457);
const DAY = 86400000, t0 = Date.parse(start + 'T00:00:00Z');
const out = {};
for (let i = 0; i < days; i++) {
  const day = new Date(t0 + i * DAY).toISOString().slice(0, 10);
  const seed = K.hashStr('hitofude-daily:' + day), moon = K.moonIndex(K.moonPhase(day));
  out[day] = Array.from({ length: K.NIGHTS }, (_, n) => { const w = K.wishFor(seed, n, 0, moon); return w ? [w.id, w.n == null ? null : w.n, w.stars || 1] : null; });
  if (i % 30 === 0) console.error(day);
}
const body = `// 自動で作ったファイル（gen-wishes.mjs）。今夜の一筆の日ごとの願い札 [id, n, 星の数]。版 ${K.REPLAY_VERSION}\nexport const WISH_VERSION = ${K.REPLAY_VERSION};\nexport default ${JSON.stringify(out)};\n`;
writeFileSync(new URL('./src/wishes.js', import.meta.url), body);
console.error(`wrote ${Object.keys(out).length} days`);
