// 一筆花火の BGM。assets/hitofude/bgm/tracks.json に曲（Suno などで作ったもの）が登録されていればそれを流し、
// 無ければ、夏祭りの夜をイメージした曲をその場で合成して流す。
//
// 合成する曲は D の陽音階（D E G A B）・96 BPM・8 小節ループ。
//   calm … 線を考えているあいだ。琴のアルペジオ・やわらかい和音・ときどき風鈴
//   burn … 火が走っているあいだ。calm に太鼓・鉦・笛を重ねる（同じ拍で重ねるので、切り替えても拍がずれない）
// ページ側は createMusic() で作り、setMode('calm' | 'burn') と stinger() を呼ぶだけ。

const BPM = 96;
const S16 = 60 / BPM / 4;
const STEPS = 128; // 16 分音符 × 16 × 8 小節

const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

// 小節ごとの和音（陽音階の音だけで組む）
const D = { root: 38, arp: [62, 64, 69, 74, 76] };
const E = { root: 40, arp: [59, 64, 67, 71, 76] };
const G = { root: 43, arp: [62, 67, 71, 74, 79] };
const A = { root: 45, arp: [64, 69, 71, 76, 81] };
const BARS = [D, D, E, G, D, A, G, A];
const CALM_PAT = [[0, 2, 4, 3, 1, 3, 2, -1], [0, -1, 2, 4, 3, -1, 2, 1]];
const BURN_PAT = [0, 2, 4, 2, 1, 3, 4, 3, 0, 2, 4, 2, 1, 3, 2, 1];
// 笛の旋律（[音, 16分音符いくつ]、-1 は休み）
const FLUTE = [
  [[81, 4], [83, 2], [81, 2], [79, 4], [76, 4]],
  [[74, 6], [76, 2], [79, 8]],
  [[76, 4], [79, 2], [76, 2], [74, 4], [71, 4]],
  [[74, 8], [-1, 4], [79, 2], [81, 2]],
  [[83, 4], [86, 2], [83, 2], [81, 4], [79, 4]],
  [[81, 6], [79, 2], [76, 8]],
  [[79, 4], [76, 2], [74, 2], [76, 4], [79, 4]],
  [[81, 12], [-1, 4]],
];
const FLUTE_AT = FLUTE.map((bar) => { const m = new Map(); let s = 0; for (const [n, len] of bar) { if (n > 0) m.set(s, [n, len]); s += len; } return m; });

export function createMusic(ac, out, noiseBuf) {
  // side … 爆発の効果音が鳴るあいだ曲を下げるつまみ（満開のジングルは通さない）
  const side = ac.createGain(); side.connect(out);
  const bus = ac.createGain(); bus.connect(side);
  const calm = ac.createGain(); calm.connect(bus);
  const burn = ac.createGain(); burn.gain.value = 0; burn.connect(bus);
  const warm = ac.createBiquadFilter(); warm.type = 'lowpass'; warm.frequency.value = 3400; warm.connect(calm);
  let timer = null, next = 0, step = 0, mode = 'calm', files = null, calmSrc = null, burnSrc = null;
  // burn の曲は火が走る数秒ずつしか鳴らないので、毎回頭からにせず前回の続きから鳴らす
  let burnPos = 0, burnAt = 0;

  // ---------------------------------------------------------------- 楽器
  function env(g, t, peak, attack, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }
  function koto(t, m, vol, dest) {
    const f = mtof(m), o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain(), g2 = ac.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(f * 1.012, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.04);
    o2.type = 'sine'; o2.frequency.value = f * 2;
    env(g, t, vol, 0.004, 1.1); env(g2, t, vol * 0.3, 0.004, 0.5);
    o.connect(g).connect(dest); o2.connect(g2).connect(dest);
    o.start(t); o2.start(t); o.stop(t + 1.2); o2.stop(t + 0.6);
  }
  function pad(t, ms, dur, vol, dest) {
    for (const m of ms) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine'; o.frequency.value = mtof(m);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.6);
      g.gain.setValueAtTime(vol, t + dur - 0.3); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.5);
      o.connect(g).connect(dest); o.start(t); o.stop(t + dur + 0.6);
    }
  }
  function bass(t, m, vol, dest) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.value = mtof(m);
    env(g, t, vol, 0.01, 1.4); o.connect(g).connect(dest); o.start(t); o.stop(t + 1.5);
  }
  function hit(t, dur, vol, freq, type, q, dest) {
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = noiseBuf; src.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = q;
    env(g, t, vol, 0.002, dur); src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }
  function don(t, vol, dest) { // 太鼓
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(96, t); o.frequency.exponentialRampToValueAtTime(52, t + 0.25);
    env(g, t, vol, 0.004, 0.5); o.connect(g).connect(dest); o.start(t); o.stop(t + 0.6);
    hit(t, 0.12, vol * 0.5, 320, 'lowpass', 0.7, dest);
  }
  function ka(t, vol, dest) { // 鉦（かね）
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'square'; o.frequency.value = 1760;
    env(g, t, vol * 0.25, 0.002, 0.05); o.connect(g).connect(dest); o.start(t); o.stop(t + 0.08);
    hit(t, 0.06, vol, 3200, 'bandpass', 2, dest);
  }
  function chime(t, vol, dest) { // 風鈴
    const base = [2349, 2637, 2960][Math.floor(Math.random() * 3)];
    [1, 2.76, 5.4].forEach((k, i) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine'; o.frequency.value = base * k;
      const ti = t + i * 0.004; // 音を鳴らしはじめる時刻と、音量の包絡をそろえる（ずれるとプチッと鳴る）
      env(g, ti, vol / (1 + i * 1.5), 0.003, 2.4 - i * 0.6); o.connect(g).connect(dest); o.start(ti); o.stop(ti + 2.6);
    });
  }
  function flute(t, m, dur, vol, dest) { // 篠笛らしく、息の音とゆれを足す
    const f = mtof(m), o = ac.createOscillator(), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
    o.type = 'sine'; o.frequency.value = f;
    lfo.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.008, t + Math.min(0.3, dur));
    lfo.connect(lg).connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.05);
    g.gain.setValueAtTime(vol, t + Math.max(0.06, dur - 0.08)); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.06);
    o.connect(g).connect(dest); o.start(t); lfo.start(t); o.stop(t + dur + 0.1); lfo.stop(t + dur + 0.1);
    hit(t, Math.min(0.25, dur), vol * 0.35, f * 2, 'bandpass', 6, dest);
  }

  // ---------------------------------------------------------------- 1 拍ずつ予約する
  function schedule(i, t) {
    const bar = Math.floor(i / 16), s = i % 16, chord = BARS[bar];
    // calm
    if (s === 0) { bass(t, chord.root, 0.22, warm); pad(t, [chord.root + 24, chord.root + 31], 16 * S16, 0.045, warm); }
    if (s % 2 === 0) {
      const idx = CALM_PAT[bar % 2][s / 2];
      if (idx >= 0) koto(t + (Math.random() - 0.5) * 0.012, chord.arp[idx], 0.11 + Math.random() * 0.04, warm);
    }
    if (s === 0 && bar % 2 === 0) don(t, 0.18, calm);
    if (s === 8 && Math.random() < 0.3) chime(t, 0.036, calm);
    // burn（音量 0 のあいだは予約しない。重ねる音が多いので）
    if (mode !== 'burn' && burn.gain.value < 0.02) return;
    const turn = bar === 7;
    if ((turn ? [0, 4, 8, 10, 12, 14] : [0, 6, 8]).includes(s)) don(t, s === 0 ? 0.55 : 0.4, burn);
    if (!turn && (s === 4 || s === 12)) ka(t, 0.13, burn);
    hit(t, 0.035, s % 2 ? 0.035 : 0.06, 7000, 'highpass', 0.8, burn);
    koto(t, chord.arp[BURN_PAT[s]] + 12, 0.055, burn);
    const note = FLUTE_AT[bar].get(s);
    if (note) flute(t, note[0], note[1] * S16, 0.1, burn);
  }
  function tick() {
    if (ac.state !== 'running') return;
    if (next < ac.currentTime) next = ac.currentTime + 0.05;
    while (next < ac.currentTime + 0.25) { schedule(step, next); step = (step + 1) % STEPS; next += S16; }
  }

  // ---------------------------------------------------------------- 曲のファイル
  function loopSource(tr, dest, offset = 0) {
    const src = ac.createBufferSource();
    src.buffer = tr.buf; src.loop = true;
    src.loopStart = tr.loopStart || 0;
    src.loopEnd = tr.loopEnd || tr.buf.duration;
    const g = ac.createGain(); g.gain.value = tr.gain ?? 1;
    src.connect(g).connect(dest); src.start(ac.currentTime + 0.02, offset);
    return src;
  }
  function fade(g, v, sec) {
    const now = ac.currentTime;
    g.gain.cancelScheduledValues(now); g.gain.setValueAtTime(g.gain.value, now); g.gain.setTargetAtTime(v, now, sec / 3);
  }

  const api = {
    get playing() { return !!timer || !!calmSrc; },
    start() {
      if (api.playing) return;
      if (files && files.calm) { calmSrc = loopSource(files.calm, calm); return; }
      next = ac.currentTime + 0.08; step = 0;
      timer = setInterval(tick, 50); tick();
    },
    stop() {
      if (timer) { clearInterval(timer); timer = null; }
      for (const s of [calmSrc, burnSrc]) if (s) try { s.stop(); } catch (e) { /* 止まっている */ }
      calmSrc = burnSrc = null;
      fade(burn, 0, 0.1); mode = 'calm';
    },
    // 登録された曲を使う。calm が無いときは合成した曲のまま（テンポの違う曲を重ねない）
    useFiles(f) {
      if (!f || !f.calm) return;
      const was = api.playing;
      api.stop(); files = f;
      if (was) api.start();
    },
    setMode(m) {
      if (m === mode) return;
      mode = m;
      if (m === 'burn') {
        // 曲のファイルどうしはテンポがちがうので重ねない（burn の曲が無ければ calm のまま）
        fade(calm, files ? (files.burn ? 0 : 1) : 0.6, 0.3); fade(burn, 1, 0.25);
        if (files && files.burn && !burnSrc) { burnSrc = loopSource(files.burn, burn, burnPos); burnAt = ac.currentTime; }
      } else {
        fade(calm, 1, 1.2); fade(burn, 0, 1.2);
        if (burnSrc) {
          const s0 = burnSrc.loopStart, len = (burnSrc.loopEnd || burnSrc.buffer.duration) - s0;
          const p = burnPos + ac.currentTime - burnAt;
          burnPos = p < s0 + len ? p : s0 + ((p - s0) % len);
        }
        if (burnSrc) { const s = burnSrc; burnSrc = null; setTimeout(() => { try { s.stop(); } catch (e) { /* 止まっている */ } }, 1600); }
      }
    },
    // 大きな場面で BGM を一瞬さげる
    duck(level = 0.35, sec = 0.9) {
      const now = ac.currentTime;
      bus.gain.cancelScheduledValues(now); bus.gain.setValueAtTime(bus.gain.value, now);
      bus.gain.linearRampToValueAtTime(level, now + 0.05); bus.gain.setTargetAtTime(1, now + sec, 0.3);
    },
    // 爆発の効果音とぶつからないよう、すばやく下げて、鳴りやんだら hold 秒おいてゆっくり戻す。
    // 連鎖で次々に呼ばれても、いちばん深く下げた所より上には戻さない
    sfxDuck(level = 0.3, hold = 0.25) {
      const now = ac.currentTime, g = side.gain, cur = g.value;
      g.cancelScheduledValues(now); g.setValueAtTime(cur, now);
      g.setTargetAtTime(Math.min(level, cur), now, 0.012);
      g.setTargetAtTime(1, now + hold, 0.35);
    },
    // 満開のジングル。曲のファイルがあれば true を返す（無ければページが効果音で鳴らす）
    stinger() {
      if (!files || !files.finale) return false;
      api.duck(0.15, (files.finale.buf.duration || 4) + 0.3);
      const src = ac.createBufferSource(), g = ac.createGain();
      src.buffer = files.finale.buf; g.gain.value = files.finale.gain ?? 1;
      src.connect(g).connect(out); src.start(ac.currentTime + 0.02);
      return true;
    },
  };
  return api;
}

// tracks.json の中身を確かめる。src はこのフォルダのファイル名だけを受けつける（外のURLやパスは読まない）
export function parseTracks(json) {
  const out = {};
  if (!json || typeof json !== 'object') return out;
  for (const key of ['calm', 'burn', 'finale']) {
    const tr = json[key];
    if (!tr || typeof tr !== 'object' || typeof tr.src !== 'string') continue;
    if (!/^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*\.(mp3|m4a|aac|ogg|opus|wav)$/.test(tr.src)) continue;
    const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : null);
    out[key] = { src: tr.src, loopStart: num(tr.loopStart, 0, 600) || 0, loopEnd: num(tr.loopEnd, 0, 600), gain: num(tr.gain, 0, 2) ?? 1 };
    if (out[key].loopEnd !== null && out[key].loopEnd <= out[key].loopStart) out[key].loopEnd = null;
  }
  return out;
}
