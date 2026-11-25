// 一筆花火 2 — 音。効果音は全部、録音（CC0: sfx/CREDITS.txt）を 1 本にまとめた sfx/sfx.mp3 から切り出して鳴らす。
// 2026-11-25: その場の合成（発振器・雑音）をやめた。Playgama の決まり 3.3.2「コードで合成した音は受け付けない」。
// 連鎖の音は箏と同じ仲間（ダンチャイン）→ 高い所はグロッケン。ペンタトニックで駆け上がる
import { SFX, SFX_FILE, PITCH } from './sfx.js';
const PENTA = [0, 2, 4, 7, 9];
const KOTO = Object.keys(PITCH).filter((k) => k.startsWith('ko')), GLOCK = Object.keys(PITCH).filter((k) => k.startsWith('gl'));
const NOTE_TOP = 5000; // これより高い音は、1 オクターブずつ折り返す（前は連鎖 25 個で人に聞こえない高さまで上がっていた）
// 音の大きさの釣り合い（前の音を実測して合わせた値: _dev/qa/sfx_level.py）
const MIX = { koto: 0.8, glock: 1.55, boom: 1, sub: 0.5, crackle: 0.34, whoosh: 0.1, gust: 0.12, launch: 0.07, tap: 0.2, caught: 0.19, graze: 0.36, fuse: 1.85, pen: 2.3 };
export function createAudio(bgmList) {
  let ctx = null, master, sfx, bgm, fuseGain, fuseFilter, penGain, penFilter, lastThump = 0, thumps = 0;
  let bank = null, bankP = null, base = 0, loopsOn = false; const lastPick = {};
  const tracks = {}; let current = null, on = true, musicOn = true;
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
      loadBank(); // 落とし損ねていたら、触れたときにもう一度
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
      fuseFilter = ctx.createBiquadFilter(); fuseFilter.type = 'bandpass'; fuseFilter.frequency.value = 3800; fuseFilter.Q.value = 0.5;
      fuseGain = ctx.createGain(); fuseGain.gain.value = 0; fuseFilter.connect(fuseGain); fuseGain.connect(sfx);
      // 筆の音: 紙を筆でこする「すーっ」（録音の輪）。速く引くほど高く、大きく
      penFilter = ctx.createBiquadFilter(); penFilter.type = 'bandpass'; penFilter.frequency.value = 800; penFilter.Q.value = 0.8;
      penGain = ctx.createGain(); penGain.gain.value = 0; penFilter.connect(penGain); penGain.connect(sfx);
      startLoops();
      A.prefetch();
      attachAll();
    },
    // 曲を先に用意する（遊べる状態になったら呼ぶ）。stream の曲は <audio> で少しずつ読み、ほかは中身だけ先に落としておく
    prefetch() {
      loadBank();
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
    get state() { return { sfx: !!bank, ctx: ctx ? ctx.state : null, tracks: Object.keys(tracks), current, playing: Object.fromEntries(Object.entries(els).map(([k, e]) => [k, +e.currentTime.toFixed(2)])) }; }, // 確かめる道具用
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
    fuse(level, heat) { if (!ctx) return; const t = ctx.currentTime; fuseGain.gain.setTargetAtTime(level * (0.05 + heat * 0.03) * MIX.fuse, t, 0.04); fuseFilter.frequency.setTargetAtTime(3000 + heat * 1500, t, 0.05); },
    pen(v) { if (!ctx) return; const t = ctx.currentTime; penGain.gain.setTargetAtTime((v > 0.02 ? 0.012 + v * v * 0.11 : 0) * MIX.pen, t, 0.035); penFilter.frequency.setTargetAtTime(650 + v * 2800, t, 0.05); },
    note(n, { vol = 0.2, pan = 0, dur = 0.5, up = 0 } = {}) {
      if (!ctx || !on || !bank) return;
      const oct = Math.floor(n / 5), step = PENTA[((n % 5) + 5) % 5]; let f = 293.66 * 2 ** ((step + oct * 12 + up) / 12);
      while (f > NOTE_TOP) f /= 2;
      // 箏（低い所）とグロッケン（高い所）を、850〜1700Hz で入れ替える
      const w = Math.max(0, Math.min(1, Math.log2(f / 850))), len = Math.max(0.12, dur);
      if (w < 1) { const k = near(KOTO, f); hit(k, { vol: vol * (1 - w * 0.75) * MIX.koto, rate: f / PITCH[k], pan, len }); }
      if (w > 0) { const k = near(GLOCK, f); hit(k, { vol: vol * (0.25 + w * 0.75) * MIX.glock, rate: f / PITCH[k], pan, len: len * 1.2 }); }
    },
    boom(size = 1, pan = 0, delay = 0) {
      if (!ctx || !on || !bank) return;
      const now = ctx.currentTime; if (now - lastThump > 0.25) { thumps = 0; lastThump = now; } if (++thumps > 7) return;
      const t = now + delay, big = size >= 1.7, mid = size >= 0.95;
      const k = pick(big ? 'bl' : mid ? 'bm' : 'bs', big || mid ? 3 : 4), r = (big ? 0.86 : mid ? 0.92 : 0.98) + Math.random() * 0.16;
      hit(k, { vol: MIX.boom * (big ? 0.32 * Math.min(3.2, size) ** 0.9 : mid ? 0.43 * size ** 0.87 : 0.3 + size * 0.42), rate: r, pan: pan * 0.8, at: t });
      if (big) hit('dr0', { vol: MIX.sub * Math.min(1.3, size / 2), rate: 0.72 + Math.random() * 0.08, at: t });
      A.crackle(size, pan, t + 0.16 + Math.random() * 0.12);
    },
    crackle(size, pan, t0) {
      if (!ctx || !on || !bank || (size < 0.8 && Math.random() < 0.4)) return;
      hit(pick('cr', 4), { vol: MIX.crackle * Math.min(1.5, 0.45 + size * 0.4), rate: 0.9 + Math.random() * 0.25, pan, at: t0 });
    },
    whoosh(level = 1) { // 放つ音: 指を離した瞬間の「しゅばっ」
      if (!ctx || !on) return;
      hit(pick('wh', 2), { vol: MIX.whoosh * level, rate: 1.05 + Math.random() * 0.2 });
      A.note(14, { vol: 0.06 * level, dur: 0.18, up: 12 });
    },
    gust(level = 1) { if (!ctx || !on) return; const big = level >= 1; hit(big ? 'gu0' : 'gu1', { vol: MIX.gust * (big ? 1 : 0.5), rate: big ? 1.5 : 1.6 }); }, // 風
    launch(pan = 0) { if (!ctx || !on) return; const k = pick('la', 3); hit(k, { vol: MIX.launch, rate: 0.52 + Math.random() * 0.12, pan, len: 0.9 }); }, // 打ち上げ（ひゅう）
    ui(kind = 'tap') {
      if (!ctx || !on) return;
      if (kind === 'tap') hit(pick('tp', 2), { vol: MIX.tap, rate: 1 + Math.random() * 0.06 });
      if (kind === 'caught') { // 追いつかれた: ほかの音を一瞬下げて、低く沈む音をはっきり聞かせる
        A.duck(0.45, 0.3);
        hit('dr1', { vol: MIX.caught, rate: 0.75, out: master }); hit('sz0', { vol: MIX.caught * 0.7, rate: 0.85, out: master });
        hit('ko0', { vol: MIX.caught * 0.8, rate: 0.9, to: 0.45, len: 0.5, out: master });
      }
      if (kind === 'mikiri') { A.note(20, { vol: 0.2, dur: 0.25 }); setTimeout(() => A.note(23, { vol: 0.2, dur: 0.5 }), 60); }
      if (kind === 'win') [10, 12, 14, 15, 17, 20].forEach((n, i) => setTimeout(() => A.note(n, { vol: 0.17, dur: 0.8 }), i * 90));
      if (kind === 'lose') [12, 10, 7].forEach((n, i) => setTimeout(() => A.note(n, { vol: 0.13, dur: 0.7 }), i * 170));
      if (kind === 'heat') A.note(17, { vol: 0.18, dur: 0.3 });
      if (kind === 'graze') hit(pick('gz', 2), { vol: MIX.graze, rate: 1 + Math.random() * 0.2 }); // かすり: ごく短い、乾いた高い音
      if (kind === 'spell') { // 技の名乗り: 低い一打のあとに、下から上へ鳴る
        A.duck(0.5, 0.45); A.boom(1.3, 0);
        [5, 9, 12, 16].forEach((n, i) => setTimeout(() => A.note(n, { vol: 0.15, dur: 0.6, up: -12 }), 90 + i * 70));
      }
      if (kind === 'tsugi') [12, 15, 19].forEach((n, i) => setTimeout(() => A.note(n, { vol: 0.17, dur: 0.45 }), i * 55));
    },
  };
  // ---- 録音を鳴らす道具
  function pick(p, n) { let i = Math.floor(Math.random() * n); if (n > 1 && i === lastPick[p]) i = (i + 1) % n; lastPick[p] = i; return p + i; } // 同じ音を続けない
  function near(list, f) { let b = list[0]; for (const k of list) if (Math.abs(Math.log2(f / PITCH[k])) < Math.abs(Math.log2(f / PITCH[b]))) b = k; return b; }
  // len: 鳴らす長さ（半分を過ぎたら消していく）。to: 鳴っている間に変える速さ（音の高さ）
  function hit(name, { vol = 1, rate = 1, pan = 0, at = 0, len = 0, to = 0, out = null } = {}) {
    if (!ctx || !bank || !on) return;
    const m = SFX[name]; if (!m) return;
    const t = Math.max(at, ctx.currentTime), s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = bank; s.playbackRate.setValueAtTime(rate, t);
    if (to) s.playbackRate.exponentialRampToValueAtTime(to, t + (len || 0.5));
    g.gain.setValueAtTime(vol, t); let end = m[1] / Math.min(rate, to || rate);
    if (len) { g.gain.setTargetAtTime(0.0001, t + len * 0.45, len * 0.22); end = Math.min(end, len * 1.6); }
    s.connect(g); let o = g;
    if (pan) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); o = p; }
    o.connect(out || sfx); s.start(t, base + m[0], m[1]); s.stop(t + end + 0.02);
  }
  // 1 本の音声を落として、ほどく。頭の合図の音を探し、そこを 0 として切り出す（頭の詰め物の長さがブラウザで違うため）
  function loadBank() {
    if (bank || bankP) return;
    const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    bankP = fetch(SFX_FILE).then((r) => { if (!r.ok) throw new Error('sfx ' + r.status); return r.arrayBuffer(); })
      .then((ab) => new Promise((ok, ng) => { const c = ctx || new OC(1, 1, 44100), p = c.decodeAudioData(ab, ok, ng); if (p && p.catch) p.catch(ng); }))
      .then((b) => { const d = b.getChannelData(0), n = Math.min(d.length, b.sampleRate); let i = 0; while (i < n && Math.abs(d[i]) < 0.3) i++; base = i < n ? i / b.sampleRate : 0; bank = b; diag.sfx = 'ok'; startLoops(); })
      .catch((e) => { diag.sfx = 'err:' + String((e && e.message) || e).slice(0, 14); bankP = null; });
  }
  function startLoops() {
    if (!ctx || !bank || loopsOn) return; loopsOn = true;
    for (const [k, f] of [['fuse', fuseFilter], ['pen', penFilter]]) {
      const s = ctx.createBufferSource(); s.buffer = bank; s.loop = true; s.loopStart = base + SFX[k][0]; s.loopEnd = s.loopStart + SFX[k][1]; s.connect(f); s.start(0, s.loopStart);
    }
  }
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
