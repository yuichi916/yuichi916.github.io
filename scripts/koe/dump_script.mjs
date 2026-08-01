// 台本JS（window.KOE.epN = {...} を代入するだけのファイル）をJSONに落とす。
// usage: node dump_script.mjs ../../assets/koe/koe-ep1.js > C:/tmp/koe-ep1.json
//
// 1ファイル＝1エピソードを前提とする（koe-ep1.js は window.KOE.ep1 だけを
// 代入する想定）。fix round 1（レビュー指摘）: 以前は
// Object.keys(sandbox.KOE)[0] を無条件に取っていたため、誤って2エピソード
// 分を代入したファイルでもエラーにならず、先頭のエピソードだけを黙って
// 棚卸しし残りを見逃す事故になり得た。曖昧なときは選ばず止める。
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = readFileSync(resolve(process.argv[2]), 'utf8');
const sandbox = { KOE: {} };
new Function('window', src)(sandbox);
const eps = Object.keys(sandbox.KOE);
if (!eps.length) { console.error('window.KOE に何も代入されていない'); process.exit(1); }
if (eps.length > 1) {
  console.error(`window.KOE に複数のエピソードが代入されている: ${eps.join(', ')} — 1ファイル1エピソードを前提とする。曖昧なので止める`);
  process.exit(1);
}
process.stdout.write(JSON.stringify(sandbox.KOE[eps[0]], null, 1));
