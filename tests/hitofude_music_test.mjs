// 一筆花火の BGM 登録表（assets/hitofude/bgm/tracks.json）の読み取りを確かめる
import { readFileSync } from 'fs';
import { parseTracks } from '../assets/hitofude/music.js';

let fails = 0;
const eq = (a, b, m) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) { fails++; console.log('FAIL', m, JSON.stringify(a), '!=', JSON.stringify(b)); } };

// 置いてある登録表（Suno で作った3曲。ループのつなぎ目は曲の中に焼き込んであるので、ファイル全体をループする）
const shipped = parseTracks(JSON.parse(readFileSync(new URL('../assets/hitofude/bgm/tracks.json', import.meta.url), 'utf8')));
eq(Object.keys(shipped), ['calm', 'burn', 'finale'], '出荷時の登録表は3枠とも埋まっている');
for (const tr of Object.values(shipped)) {
  let ok = true; try { readFileSync(new URL('../assets/hitofude/bgm/' + tr.src, import.meta.url)); } catch (e) { ok = false; }
  eq(ok, true, '登録した曲のファイルがある: ' + tr.src);
}
// ふつうの登録
eq(parseTracks({ calm: { src: 'hitofude_calm_d90.mp3', loopStart: 0.5, loopEnd: 64.5, gain: 0.8 } }),
  { calm: { src: 'hitofude_calm_d90.mp3', loopStart: 0.5, loopEnd: 64.5, gain: 0.8 } }, 'ループ点と音量を読む');
eq(parseTracks({ finale: { src: 'fin.m4a' } }), { finale: { src: 'fin.m4a', loopStart: 0, loopEnd: null, gain: 1 } }, '省いた値は既定値');
// このフォルダの外や、外部の URL は読まない
for (const src of ['../../../index.html', 'https://example.com/a.mp3', '/abs.mp3', 'a/b.mp3', 'x.html', 'a b.mp3', '.mp3', 'javascript:alert(1).mp3'])
  eq(parseTracks({ calm: { src } }), {}, 'はじく: ' + src);
// おかしな数値は既定値にもどす
eq(parseTracks({ burn: { src: 'b.ogg', loopStart: -3, loopEnd: 'x', gain: 9 } }), { burn: { src: 'b.ogg', loopStart: 0, loopEnd: null, gain: 1 } }, '範囲外の数値');
eq(parseTracks({ burn: { src: 'b.ogg', loopStart: 10, loopEnd: 5 } }).burn.loopEnd, null, '終わりが始まりより前なら曲の終わりまで');
eq(parseTracks(null), {}, 'null');
eq(parseTracks({ other: { src: 'a.mp3' } }), {}, '知らない枠は無視');

console.log(fails ? `hitofude_music_test: ${fails} FAILED` : 'hitofude_music_test: ALL PASS');
process.exit(fails ? 1 : 0);
