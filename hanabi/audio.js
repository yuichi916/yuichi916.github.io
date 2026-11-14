// 一筆花火 2 — 音。効果音はその場で合成する。ペンタトニックで連鎖が駆け上がる
const PENTA = [0, 2, 4, 7, 9];
export function createAudio(bgmList) {
  let ctx = null, master, sfx, bgm, fuseGain, fuseFilter, noise;
  const tracks = {}; let current = null, on = true, musicOn = true, lastThump = 0, thumps = 0;
  const A = {
    get ctx() { return ctx; },
    unlock() {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.18;
      master = ctx.createGain(); master.gain.value = 0.9; comp.connect(master); master.connect(ctx.destination);
      sfx = ctx.createGain(); sfx.gain.value = on ? 0.85 : 0; sfx.connect(comp);
      bgm = ctx.createGain(); bgm.gain.value = musicOn ? 0.55 : 0; bgm.connect(comp);
      const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      noise = buf;
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      fuseFilter = ctx.createBiquadFilter(); fuseFilter.type = 'bandpass'; fuseFilter.frequency.value = 3800; fuseFilter.Q.value = 0.7;
      fuseGain = ctx.createGain(); fuseGain.gain.value = 0;
      src.connect(fuseFilter); fuseFilter.connect(fuseGain); fuseGain.connect(sfx); src.start();
      for (const [k, f, l] of bgmList) load(k, f, l);
    },
    setSound(v) { on = v; if (sfx) sfx.gain.value = v ? 0.85 : 0; },
    setMusic(v) { musicOn = v; if (bgm) bgm.gain.value = v ? 0.55 : 0; },
    get soundOn() { return on; }, get musicOn() { return musicOn; },
    mute(v) { if (master) master.gain.value = v ? 0 : 0.9; },
    // 大事な音の前に、効果音と曲をいったん下げる（amt=残す割合、sec=戻るまで）
    duck(sec = 0.4, amt = 0.35) {
      if (!ctx) return;
      const t = ctx.currentTime;
      for (const [node, lv] of [[sfx, on ? 0.85 : 0], [bgm, musicOn ? 0.55 : 0]]) { node.gain.cancelScheduledValues(t); node.gain.setValueAtTime(lv * amt, t); node.gain.setTargetAtTime(lv, t + sec * 0.4, sec / 3); }
    },
    scene(name, fade = 0.5) {
      A.wanted = name;
      if (!ctx || current === name) return;
      const t = ctx.currentTime;
      for (const [k, x] of Object.entries(tracks)) { x.gain.gain.cancelScheduledValues(t); x.gain.gain.setTargetAtTime(k === name ? x.level : 0.0001, t, fade / 3); }
      current = name;
    },
    fuse(level, heat) { if (!ctx) return; const t = ctx.currentTime; fuseGain.gain.setTargetAtTime(level * (0.05 + heat * 0.03), t, 0.04); fuseFilter.frequency.setTargetAtTime(3000 + heat * 1500, t, 0.05); },
    note(n, { vol = 0.2, pan = 0, dur = 0.5, up = 0 } = {}) {
      if (!ctx || !on) return;
      const oct = Math.floor(n / 5), step = PENTA[((n % 5) + 5) % 5], f = 293.66 * 2 ** ((step + oct * 12 + up) / 12);
      const t = ctx.currentTime, g = ctx.createGain(), p = ctx.createStereoPanner();
      p.pan.value = pan;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      for (const [mul, a, w] of [[1, 1, 'triangle'], [2.01, 0.35, 'sine'], [3.98, 0.12, 'sine']]) {
        const o = ctx.createOscillator(), og = ctx.createGain(); o.type = w; o.frequency.value = f * mul; og.gain.value = a; o.connect(og); og.connect(g); o.start(t); o.stop(t + dur + 0.02);
      }
      g.connect(p); p.connect(sfx);
    },
    boom(size = 1, pan = 0, delay = 0) {
      if (!ctx || !on) return;
      const now = ctx.currentTime; if (now - lastThump > 0.25) { thumps = 0; lastThump = now; } if (++thumps > 7) return;
      const t = now + delay, p = ctx.createStereoPanner(); p.pan.value = pan; p.connect(sfx);
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.frequency.setValueAtTime(140 * (0.8 + Math.random() * 0.3), t); o.frequency.exponentialRampToValueAtTime(34, t + 0.28);
      og.gain.setValueAtTime(0.55 * size, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.42); o.connect(og); og.connect(p); o.start(t); o.stop(t + 0.45);
      const s = ctx.createBufferSource(); s.buffer = noise; s.playbackRate.value = 0.75 + Math.random() * 0.4;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(4200, t); lp.frequency.exponentialRampToValueAtTime(300, t + 0.45);
      const sg = ctx.createGain(); sg.gain.setValueAtTime(0.5 * size, t); sg.gain.exponentialRampToValueAtTime(0.001, t + 0.55); s.connect(lp); lp.connect(sg); sg.connect(p); s.start(t, Math.random()); s.stop(t + 0.6);
      A.crackle(size, pan, t + 0.18 + Math.random() * 0.1);
    },
    crackle(size, pan, t0) {
      if (!ctx || !on) return;
      const n = Math.round(4 + size * 8), p = ctx.createStereoPanner(); p.pan.value = pan; p.connect(sfx);
      for (let i = 0; i < n; i++) {
        const t = t0 + Math.random() * 0.7 * Math.min(1.6, size), s = ctx.createBufferSource(); s.buffer = noise;
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3500 + Math.random() * 3500;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.09 + Math.random() * 0.1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
        s.connect(hp); hp.connect(g); g.connect(p); s.start(t, Math.random() * 1.5); s.stop(t + 0.04);
      }
    },
    gust(level = 1) { // 風の音: 雑音を帯域で持ち上げる
      if (!ctx || !on) return;
      const t = ctx.currentTime, d = level >= 1 ? 0.7 : 0.5, n = ctx.createBufferSource(); n.buffer = noise;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.4; f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(level >= 1 ? 3600 : 1800, t + d * 0.7);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.001, t); g.gain.linearRampToValueAtTime(0.16 * level, t + d * 0.5); g.gain.exponentialRampToValueAtTime(0.001, t + d);
      n.connect(f); f.connect(g); g.connect(sfx); n.start(t, Math.random()); n.stop(t + d + 0.02);
    },
    launch(pan = 0) {
      if (!ctx || !on) return;
      const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(), p = ctx.createStereoPanner(); p.pan.value = pan;
      o.type = 'sine'; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(760, t + 0.55);
      g.gain.setValueAtTime(0.09, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.6); o.connect(g); g.connect(p); p.connect(sfx); o.start(t); o.stop(t + 0.62);
    },
    ui(kind = 'tap') {
      if (!ctx || !on) return;
      if (kind === 'tap') A.note(12, { vol: 0.12, dur: 0.16 });
      if (kind === 'caught') { // 追いつかれた: ほかの音を一瞬下げて、低く沈む音をはっきり聞かせる
        A.duck(0.45, 0.3);
        const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(320, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.34); g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.4); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.42);
        const s = ctx.createBufferSource(); s.buffer = noise; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(120, t + 0.3);
        const sg = ctx.createGain(); sg.gain.setValueAtTime(0.35, t); sg.gain.exponentialRampToValueAtTime(0.001, t + 0.32); s.connect(lp); lp.connect(sg); sg.connect(master); s.start(t, Math.random()); s.stop(t + 0.34);
      }
      if (kind === 'mikiri') { A.note(20, { vol: 0.2, dur: 0.25 }); setTimeout(() => A.note(23, { vol: 0.2, dur: 0.5 }), 60); }
      if (kind === 'win') [10, 12, 14, 15, 17, 20].forEach((n, i) => setTimeout(() => A.note(n, { vol: 0.17, dur: 0.8 }), i * 90));
      if (kind === 'lose') [12, 10, 7].forEach((n, i) => setTimeout(() => A.note(n, { vol: 0.13, dur: 0.7 }), i * 170));
      if (kind === 'heat') A.note(17, { vol: 0.18, dur: 0.3 });
      if (kind === 'graze') { // かすり: ごく短い、乾いた高い音
        const t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = noise; const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6500;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.11, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.035); s.connect(hp); hp.connect(g); g.connect(sfx); s.start(t, Math.random()); s.stop(t + 0.04);
      }
      if (kind === 'spell') { // 技の名乗り: 低い一打のあとに、下から上へ鳴る
        A.duck(0.5, 0.45); A.boom(1.3, 0);
        [5, 9, 12, 16].forEach((n, i) => setTimeout(() => A.note(n, { vol: 0.15, dur: 0.6, up: -12 }), 90 + i * 70));
      }
      if (kind === 'tsugi') [12, 15, 19].forEach((n, i) => setTimeout(() => A.note(n, { vol: 0.17, dur: 0.45 }), i * 55));
    },
  };
  async function load(k, f, l) {
    try {
      const r = await fetch(f); const b = await ctx.decodeAudioData(await r.arrayBuffer());
      const s = ctx.createBufferSource(); s.buffer = b; s.loop = true; if (l.loopStart) s.loopStart = l.loopStart;
      const g = ctx.createGain(); g.gain.value = 0.0001; s.connect(g); g.connect(bgm); s.start();
      tracks[k] = { gain: g, level: l.gain ?? 1 };
      if (A.wanted === k) { current = k; g.gain.setTargetAtTime(tracks[k].level, ctx.currentTime, 0.2); }
    } catch (e) { console.warn('bgm', k, e); }
  }
  return A;
}
