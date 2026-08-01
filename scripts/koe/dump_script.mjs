// 台本JS（window.KOE.epN = {...} を代入するだけのファイル）をJSONに落とす。
// usage: node dump_script.mjs ../../assets/koe/koe-ep1.js > C:/tmp/koe-ep1.json
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = readFileSync(resolve(process.argv[2]), 'utf8');
const sandbox = { KOE: {} };
new Function('window', src)(sandbox);
const eps = Object.keys(sandbox.KOE);
if (!eps.length) { console.error('window.KOE に何も代入されていない'); process.exit(1); }
process.stdout.write(JSON.stringify(sandbox.KOE[eps[0]], null, 1));
