// Suno などで作った曲を、一筆花火の BGM に仕上げて登録する。
//   ループ区間を小節の頭で切り出し（継ぎ目の前後が一番よく似る所を探す）→ 音量を -16 LUFS にそろえる → MP3 160kbps →
//   assets/hitofude/bgm/hitofude_<枠>.mp3 に書き、tracks.json に登録する。
//
// 使い方（リポジトリの一番上で。playwright と @breezystack/lamejs が要る。ffmpeg は要らない）:
//   node _dev/hitofude-bgm-prep.mjs calm   <曲.mp3|wav> --bpm 90  [--bars 24] [--start 秒]
//   node _dev/hitofude-bgm-prep.mjs burn   <曲.mp3|wav> --bpm 135 [--bars 36] [--start 秒]
//   node _dev/hitofude-bgm-prep.mjs finale <曲.mp3|wav> [--len 6] [--start 秒]
//   共通: [--lufs -16] [--gain 0.5]（tracks.json に書く音量。合成した曲と同じくらいの大きさになる）[--dry]（書き出さず、選んだ区間だけ見る）
//
// ファイルの中の「ループ区間」の前後にも 1 秒ずつ曲を残す。MP3 は頭に小さな無音が入り、その長さはブラウザによって違うが、
// 前後が本物の曲なら、ループ点が数ミリ秒ずれても継ぎ目は切れない。
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { Mp3Encoder } from '@breezystack/lamejs';

const [slot, input, ...rest] = process.argv.slice(2);
const opt = {};
for (let i = 0; i < rest.length; i++) if (rest[i].startsWith('--')) { const k = rest[i].slice(2); const v = rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : true; opt[k] = v; }
if (!['calm', 'burn', 'finale'].includes(slot) || !input) { console.error('使い方は、このファイルの先頭を見てください'); process.exit(1); }
const RATE = 44100, PAD = 1.0;
const TARGET = +(opt.lufs ?? -16), GAIN = +(opt.gain ?? 0.5);

// ---------------------------------------------------------------- 読み込み（ブラウザの decodeAudioData に任せる）
const exe = process.env.CHROMIUM || (process.platform === 'linux' ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const page = await browser.newPage();
const pcm = await page.evaluate(async ({ b64, rate }) => {
  const bin = atob(b64), u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const ac = new OfflineAudioContext(2, 1, rate);
  const buf = await ac.decodeAudioData(u8.buffer);
  const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
  const i16 = new Int16Array(L.length * 2);
  for (let i = 0; i < L.length; i++) { i16[i * 2] = Math.max(-1, Math.min(1, L[i])) * 32767; i16[i * 2 + 1] = Math.max(-1, Math.min(1, R[i])) * 32767; }
  let s = ''; const b = new Uint8Array(i16.buffer);
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
}, { b64: readFileSync(input).toString('base64'), rate: RATE });
await browser.close();
const raw = new Int16Array(Uint8Array.from(Buffer.from(pcm, 'base64')).buffer);
const N = raw.length / 2;
const L = new Float32Array(N), R = new Float32Array(N);
for (let i = 0; i < N; i++) { L[i] = raw[i * 2] / 32768; R[i] = raw[i * 2 + 1] / 32768; }
const dur = N / RATE;
console.log(`読み込み: ${input}  ${dur.toFixed(2)} 秒`);

// ---------------------------------------------------------------- 区間を決める
let a, b, loopStart = null, loopEnd = null; // [a, b) を書き出す。ループはその中の [loopStart, loopEnd)
if (slot === 'finale') {
  const len = +(opt.len ?? 6);
  // 曲の最後の大きな一発で終わるように、終わりの無音を落としてから len 秒ぶん取る
  let end = N; const th = 10 ** (-50 / 20);
  while (end > 0 && Math.abs(L[end - 1]) < th && Math.abs(R[end - 1]) < th) end--;
  const start = opt.start != null ? Math.round(+opt.start * RATE) : Math.max(0, end - Math.round(len * RATE));
  a = start; b = Math.min(N, Math.max(end, start + 1));
} else {
  const bpm = +opt.bpm;
  if (!bpm) { console.error('--bpm を指定してください（Suno のプロンプトに書いた BPM）'); process.exit(1); }
  const bar = 4 * 60 / bpm;
  const bars = opt.bars ? +opt.bars : Math.max(4, Math.round(64 / bar / 4) * 4); // 約 64 秒になる、4 の倍数の小節
  const len = Math.round(bars * bar * RATE);
  if (len + 2 * PAD * RATE > N) { console.error(`曲が短すぎます（${bars} 小節 = ${(len / RATE).toFixed(1)} 秒）。--bars を減らしてください`); process.exit(1); }
  // 10ms ごとの音の強さと、立ち上がり（拍の頭）
  const hop = Math.round(RATE / 100), nh = Math.floor(N / hop), env = new Float32Array(nh), onset = new Float32Array(nh);
  for (let h = 0; h < nh; h++) { let q = 0; for (let i = h * hop; i < (h + 1) * hop; i++) q += L[i] * L[i] + R[i] * R[i]; env[h] = Math.log10(q / hop + 1e-9); }
  for (let h = 1; h < nh; h++) onset[h] = Math.max(0, env[h] - env[h - 1]);
  const lenH = Math.round(len / hop), win = 300; // 継ぎ目の前後 3 秒を比べる
  const cmp = (x, y) => { let s = 0, sx = 0, sy = 0; for (let k = -win; k < win; k++) { const p = env[x + k], q = env[y + k]; s += p * q; sx += p * p; sy += q * q; } return s / Math.sqrt(sx * sy + 1e-12); };
  const lo = opt.start != null ? Math.round(+opt.start * 100) : Math.max(win + PAD * 100, Math.round(nh * 0.12));
  const hi = opt.start != null ? lo : nh - lenH - win - PAD * 100;
  let best = null;
  for (let h = lo; h <= hi; h++) {
    // 拍の頭（立ち上がりが強い所）で、継ぎ目の前後がよく似ている所
    const o = Math.max(onset[h], onset[h + 1] || 0);
    const score = cmp(h, h + lenH) + 0.15 * Math.min(1, o / 0.5);
    if (!best || score > best.score) best = { h, score };
  }
  // 小さい単位で合わせる: 始まりの直前と、終わりの直前の波形が一番そろう所に、終わりを数ミリ秒ずらす
  const s0 = best.h * hop;
  let e0 = s0 + len, bestC = -2, W = 2048;
  for (let d = -Math.round(0.02 * RATE); d <= Math.round(0.02 * RATE); d++) {
    const e = s0 + len + d; let c = 0, sa = 0, sb = 0;
    for (let k = 1; k <= W; k++) { const p = L[s0 - k] + R[s0 - k], q = L[e - k] + R[e - k]; c += p * q; sa += p * p; sb += q * q; }
    c /= Math.sqrt(sa * sb + 1e-12);
    if (c > bestC) { bestC = c; e0 = e; }
  }
  a = s0 - Math.round(PAD * RATE); b = Math.min(N, e0 + Math.round(PAD * RATE));
  loopStart = (s0 - a) / RATE; loopEnd = (e0 - a) / RATE;
  console.log(`ループ: 曲の ${(s0 / RATE).toFixed(3)} 秒から ${bars} 小節（${((e0 - s0) / RATE).toFixed(3)} 秒）  継ぎ目の似かた ${best.score.toFixed(3)} / 波形 ${bestC.toFixed(3)}`);
  if (bestC < 0.6) console.log('  ※ 継ぎ目の波形があまり似ていません。--bpm が合っているか、--start で別の所を試してください');
}

// ---------------------------------------------------------------- 音量（ITU-R BS.1770 の K 特性とゲート）
function lufs(x0, x1, from, to) {
  const shelf = (() => { const f0 = 1681.974450955533, G = 3.999843853973347, Q = 0.7071752369554196, K = Math.tan(Math.PI * f0 / RATE), Vh = 10 ** (G / 20), Vb = Vh ** 0.4996667741545416, a0 = 1 + K / Q + K * K;
    return { b: [(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0], a: [2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0] }; })();
  const hp = (() => { const f0 = 38.13547087602444, Q = 0.5003270373238773, K = Math.tan(Math.PI * f0 / RATE), d = 1 + K / Q + K * K;
    return { b: [1, -2, 1], a: [2 * (K * K - 1) / d, (1 - K / Q + K * K) / d] }; })();
  const filt = (x, f) => { const y = new Float64Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) { const v = f.b[0] * x[i] + f.b[1] * x1 + f.b[2] * x2 - f.a[0] * y1 - f.a[1] * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; } return y; };
  const kL = filt(filt(x0.subarray(from, to), shelf), hp), kR = filt(filt(x1.subarray(from, to), shelf), hp);
  const blk = Math.round(0.4 * RATE), step = Math.round(0.1 * RATE), zs = [];
  for (let s = 0; s + blk <= kL.length; s += step) { let q = 0; for (let i = s; i < s + blk; i++) q += kL[i] * kL[i] + kR[i] * kR[i]; zs.push(q / blk); }
  const Lk = (z) => -0.691 + 10 * Math.log10(z + 1e-12);
  const abs = zs.filter((z) => Lk(z) > -70); if (!abs.length) return -70;
  const rel = Lk(abs.reduce((p, z) => p + z, 0) / abs.length) - 10;
  const g = abs.filter((z) => Lk(z) > rel);
  return Lk(g.reduce((p, z) => p + z, 0) / g.length);
}
const measFrom = loopStart != null ? a + Math.round(loopStart * RATE) : a, measTo = loopEnd != null ? a + Math.round(loopEnd * RATE) : b;
const before = lufs(L, R, measFrom, measTo);
let peak = 0; for (let i = a; i < b; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
let gain = 10 ** ((TARGET - before) / 20);
if (peak * gain > 10 ** (-1 / 20)) gain = 10 ** (-1 / 20) / peak; // ピークは -1 dBFS まで
console.log(`音量: ${before.toFixed(1)} LUFS → ${(before + 20 * Math.log10(gain)).toFixed(1)} LUFS（ピーク ${(20 * Math.log10(peak * gain)).toFixed(1)} dBFS）`);
if (opt.dry) process.exit(0);

// ---------------------------------------------------------------- 書き出し（finale は、頭と尻を少しだけフェード）
const n = b - a, outL = new Int16Array(n), outR = new Int16Array(n);
const fin = Math.round(0.03 * RATE), fout = Math.round(0.3 * RATE);
for (let i = 0; i < n; i++) {
  let g = gain;
  if (slot === 'finale') { if (i < fin) g *= i / fin; if (i > n - fout) g *= (n - i) / fout; }
  outL[i] = Math.max(-32768, Math.min(32767, Math.round(L[a + i] * g * 32767)));
  outR[i] = Math.max(-32768, Math.min(32767, Math.round(R[a + i] * g * 32767)));
}
const enc = new Mp3Encoder(2, RATE, 160), parts = [];
for (let i = 0; i < n; i += 1152) { const m = enc.encodeBuffer(outL.subarray(i, i + 1152), outR.subarray(i, i + 1152)); if (m.length) parts.push(Buffer.from(m)); }
const tail = enc.flush(); if (tail.length) parts.push(Buffer.from(tail));
const file = `hitofude_${slot}.mp3`, dir = pathToFileURL(process.cwd() + '/assets/hitofude/bgm/');
const mp3 = Buffer.concat(parts);
writeFileSync(new URL(file, dir), mp3);
const reg = JSON.parse(readFileSync(new URL('tracks.json', dir), 'utf8'));
reg[slot] = { src: file, ...(loopStart != null ? { loopStart: +loopStart.toFixed(4), loopEnd: +loopEnd.toFixed(4) } : {}), gain: GAIN };
writeFileSync(new URL('tracks.json', dir), JSON.stringify(reg, null, 2) + '\n');
console.log(`書き出し: assets/hitofude/bgm/${file}（${(mp3.length / 1024).toFixed(0)} KB）と tracks.json`);
