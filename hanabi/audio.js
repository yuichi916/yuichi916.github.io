// 一筆花火 2 — 音。効果音はその場で合成する。ペンタトニックで連鎖が駆け上がる
const PENTA = [0, 2, 4, 7, 9];
export function createAudio(bgmList) {
  let ctx = null, master, sfx, bgm, fuseGain, fuseFilter, noise, penGain, penFilter;
  const tracks = {}; let current = null, on = true, musicOn = true, lastThump = 0, thumps = 0;
  const els = {}, bytes = {}; let prefetched = false;
  // 流し読み（<audio> → WebAudio）は、よそのサイトの枠（Playgama など）の中だと Android の Chrome で無音になった（2026-11-16 依頼主の実機）。
  // 枠の中では、流し読みをやめて中身を先に落とす方式（ほかの曲と同じ、鳴ると分かっている方式）にする。代わりに起動直後から真っ先に落とす
  const STREAM_OK = (() => { try { return window.self === window.top; } catch { return false; } })();
  const streams = (l) => !!l.stream && STREAM_OK;
  const diag = {}; let muted = false;
  // 予備の「普通の <audio> 再生」（WebAudio を通さない）の音量。WebAudio の道（曲の量 → 曲 0.55 → 全体 0.9）と同じ掛け算
  const plainVol = (x) => Math.max(0, Math.min(1, (x.target || 0) * (musicOn ? 0.55 : 0) * (muted ? 0 : 0.9)));
  const setTrack = (x, v, tc) => { if (x.plain) { x.target = v; x.plain.volume = plainVol(x); return; } x.gain.gain.cancelScheduledValues(ctx.currentTime); x.gain.gain.setTargetAtTime(Math.max(v, 0.0001), ctx.currentTime, tc); };
  const refreshPlain = () => { for (const x of Object.values(tracks)) if (x.plain) x.plain.volume = plainVol(x); };
  const A = {
    get ctx() { return ctx; },
    unlock() {
      // 2 回目以降: 止まっている箱を動かし直し、再生を断られた曲（<audio>）を鳴らし直す。
      // タッチの pointerdown は「音を出してよい操作」に数えられず、最初の 1 回では断られることがある（指を離した時・click で通る）
      if (ctx) {
        if (ctx.state !== 'running') { try { const r = ctx.resume(); if (r && r.catch) r.catch(() => {}); } catch { /* */ } }
        for (const x of Object.values(tracks)) { const e = x.el || x.plain; if (e && e.paused) { const r = e.play(); if (r && r.catch) r.catch(() => {}); } }
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.18;
      // 11/23 依頼主「引いている最中に急に音が出るのが気持ち悪い。操作を増やさず自然に始めたい」: ブラウザが音を許した瞬間に全部の音が全開で鳴っていた。
      // 最初に鳴り出す時だけ、全体の音量を 0 から 1.5 秒ほどかけて上げる（題名画面でも、線の途中でも、そっと始まる）
      master = ctx.createGain(); master.gain.value = 0; comp.connect(master); master.connect(ctx.destination);
      let warmed = false;
      const warm = () => { if (warmed || ctx.state !== 'running') return; warmed = true; const t = ctx.currentTime; master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(0.0001, t); if (!muted) master.gain.setTargetAtTime(0.9, t + 0.03, 0.6); };
      ctx.addEventListener('statechange', warm); warm();
      sfx = ctx.createGain(); sfx.gain.value = on ? 0.85 : 0; sfx.connect(comp);
      bgm = ctx.createGain(); bgm.gain.value = musicOn ? 0.55 : 0; bgm.connect(comp);
      const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      noise = buf;
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      fuseFilter = ctx.createBiquadFilter(); fuseFilter.type = 'bandpass'; fuseFilter.frequency.value = 3800; fuseFilter.Q.value = 0.7;
      fuseGain = ctx.createGain(); fuseGain.gain.value = 0;
      src.connect(fuseFilter); fuseFilter.connect(fuseGain); fuseGain.connect(sfx); src.start();
      // 筆の音: 紙を筆でこする「すーっ」。速く引くほど高く、大きく
      const src2 = ctx.createBufferSource(); src2.buffer = buf; src2.loop = true; src2.playbackRate.value = 0.6;
      penFilter = ctx.createBiquadFilter(); penFilter.type = 'bandpass'; penFilter.frequency.value = 800; penFilter.Q.value = 1.2;
      penGain = ctx.createGain(); penGain.gain.value = 0;
      src2.connect(penFilter); penFilter.connect(penGain); penGain.connect(sfx); src2.start(0, 0.7);
      A.prefetch();
      attachAll();
    },
    // 曲を先に用意する（遊べる状態になったら呼ぶ）。stream の曲は <audio> で少しずつ読み、ほかは中身だけ先に落としておく
    prefetch() {
      if (prefetched) return; prefetched = true;
      for (const [k, f, l] of bgmList) {
        if (streams(l)) { const el = new Audio(); el.preload = 'auto'; el.loop = true; el.src = f; els[k] = el; try { el.load(); } catch { /* */ } }
      }
      // 流す曲の読み込みを先にさせ、残りは少しあとから
      const get = (k, f) => { if (!bytes[k]) bytes[k] = fetch(f).then((r) => r.arrayBuffer()).catch(() => null); };
      for (const [k, f, l] of bgmList) if (l.stream && !streams(l)) get(k, f); // 枠の中: 最初の曲はすぐ落とし始める
      setTimeout(() => { for (const [k, f, l] of bgmList) if (!l.stream) get(k, f); }, 1200);
    },
    setSound(v) { on = v; if (sfx) sfx.gain.value = v ? 0.85 : 0; },
    setMusic(v) { musicOn = v; if (bgm) bgm.gain.value = v ? 0.55 : 0; refreshPlain(); },
    get soundOn() { return on; }, get musicOn() { return musicOn; },
    get state() { return { ctx: ctx ? ctx.state : null, tracks: Object.keys(tracks), current, playing: Object.fromEntries(Object.entries(els).map(([k, e]) => [k, +e.currentTime.toFixed(2)])) }; }, // 確かめる道具用
    mute(v) { // 戻るときは 0.3 秒ほどでそっと戻す（広告のあとなど）。まだ一度も鳴っていない間は、鳴り出しの時に上げる
      muted = !!v;
      if (master) { const t = ctx.currentTime; master.gain.cancelScheduledValues(t); if (v) master.gain.setValueAtTime(0, t); else if (ctx.state === 'running') { master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), t); master.gain.setTargetAtTime(0.9, t, 0.1); } }
      refreshPlain();
    },
    // 音の状態（ポーズの画面の隅に出す。実機で鳴らないときに、何で止まっているかを見る）
    diagText() {
      const tr = Object.entries(tracks).map(([k, x]) => { const e = x.el || x.plain; return `${k}:${x.plain ? 'P' : x.el ? 'S' : 'B'}${e ? (e.paused ? '-stop' : '-play') + (x.plain ? '-v' + e.volume.toFixed(2) : '') + (e.error ? '-e' + e.error.code : '') : ''}`; }).join(' ');
      return `${STREAM_OK ? 'top' : 'frame'} ctx:${ctx ? ctx.state + '/' + ctx.sampleRate : '-'} m:${musicOn ? 1 : 0}${muted ? 'x' : ''} now:${current || '-'} want:${A.wanted || '-'} | ${tr} | calm:${diag.calm || '-'} burn:${diag.burn || '-'}`;
    },
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
      void t; for (const [k, x] of Object.entries(tracks)) setTrack(x, k === name ? x.level : 0, fade / 3);
      current = tracks[name] ? name : null;
    },
    fuse(level, heat) { if (!ctx) return; const t = ctx.currentTime; fuseGain.gain.setTargetAtTime(level * (0.05 + heat * 0.03), t, 0.04); fuseFilter.frequency.setTargetAtTime(3000 + heat * 1500, t, 0.05); },
    pen(v) { if (!ctx) return; const t = ctx.currentTime; penGain.gain.setTargetAtTime(v > 0.02 ? 0.012 + v * v * 0.11 : 0, t, 0.035); penFilter.frequency.setTargetAtTime(650 + v * 2800, t, 0.05); },
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
    whoosh(level = 1) { // 放つ音: 指を離した瞬間の「しゅばっ」。雑音を高いほうへ一気に持ち上げる
      if (!ctx || !on) return;
      const t = ctx.currentTime, d = 0.24, n = ctx.createBufferSource(); n.buffer = noise;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2.2; f.frequency.setValueAtTime(650, t); f.frequency.exponentialRampToValueAtTime(5200, t + d * 0.8);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.001, t); g.gain.linearRampToValueAtTime(0.14 * level, t + 0.025); g.gain.exponentialRampToValueAtTime(0.001, t + d);
      n.connect(f); f.connect(g); g.connect(sfx); n.start(t, Math.random()); n.stop(t + d + 0.02);
      A.note(14, { vol: 0.06 * level, dur: 0.18, up: 12 });
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
  function fadeInIfWanted(k) { if (A.wanted === k && current !== k) { current = k; setTrack(tracks[k], tracks[k].level, 0.2); } }
  // 予備: WebAudio を通さず、<audio> をそのまま鳴らす（変換に失敗した・時間がかかりすぎたとき）。断られても、次に触れたとき unlock が鳴らし直す
  function plainTrack(k, f, l) {
    if (tracks[k]) return;
    const el = new Audio(f); el.loop = true; el.preload = 'auto';
    tracks[k] = { plain: el, level: l.gain ?? 1, target: 0 }; el.volume = 0;
    const r = el.play(); if (r && r.catch) r.catch(() => {});
    diag[k] = (diag[k] || '') + '>plain';
    if (A.wanted === k) { current = null; fadeInIfWanted(k); }
  }
  async function attachAll() {
    // 1) 流す曲（最初に鳴る静かな曲）: 届いたぶんからすぐ鳴る。全部を変換しないのでメモリも軽い
    for (const [k, f, l] of bgmList) {
      if (!streams(l) || tracks[k]) continue;
      try {
        const el = els[k];
        const src = ctx.createMediaElementSource(el), g = ctx.createGain(); g.gain.value = 0.0001; src.connect(g); g.connect(bgm);
        tracks[k] = { gain: g, level: l.gain ?? 1, el }; diag[k] = 'stream';
        const pr = el.play(); if (pr && pr.catch) pr.catch(() => {});
        fadeInIfWanted(k);
      } catch (e) { console.warn('bgm', k, e); }
    }
    // 2) 残りは、先に落としておいた中身を1曲ずつ変換（同時にやると重い）
    for (const [k, f, l] of bgmList) {
      if (streams(l) || tracks[k]) continue;
      try {
        if (!bytes[k]) bytes[k] = fetch(f).then((r) => r.arrayBuffer()).catch(() => null);
        diag[k] = 'dl';
        const ab = await bytes[k]; if (!ab) { diag[k] = 'dl-fail'; if (l.stream) plainTrack(k, f, l); continue; }
        diag[k] = 'dec' + Math.round(ab.byteLength / 1024) + 'k';
        const dec = ctx.decodeAudioData(ab.slice(0));
        const b = l.stream ? await Promise.race([dec, new Promise((_, rj) => setTimeout(() => rj(new Error('timeout')), 8000))]) : await dec;
        if (tracks[k]) continue; // 待つ間に予備で鳴り始めていた
        const s2 = ctx.createBufferSource(); s2.buffer = b; s2.loop = true; if (l.loopStart) s2.loopStart = l.loopStart;
        const g = ctx.createGain(); g.gain.value = 0.0001; s2.connect(g); g.connect(bgm); s2.start();
        tracks[k] = { gain: g, level: l.gain ?? 1 }; diag[k] = 'ok';
        fadeInIfWanted(k);
      } catch (e) { console.warn('bgm', k, e); diag[k] = 'err:' + ((e && (e.name || e.message)) || '?').slice(0, 14); if (l.stream) plainTrack(k, f, l); }
    }
  }
  return A;
}
