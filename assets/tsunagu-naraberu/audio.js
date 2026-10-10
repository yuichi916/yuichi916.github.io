// 音。BGM（タイトル／対戦／ピンチ）と効果音は Suno で作った曲・音、キャラの声は ElevenLabs。
// どれも WebAudio のバッファで鳴らす。読み込めない・まだ読み込み中の音は、合成音で代わりに鳴らす。最初の操作のあとで有効になる。
const BASE = new URL('./', import.meta.url).href;
const BGM = { title: 'sound/bgm_title.mp3', battle: 'sound/bgm_battle.mp3', pinch: 'sound/bgm_pinch.mp3' };
const SE = ['pop', 'clear', 'chain', 'land', 'swap', 'garbage', 'attack', 'win', 'lose'];
const VOL = { master: 1, bgm: 0.34, se: 0.7, voice: 0.95, synth: 0.32 };

export function createAudio() {
  let ac = null, master = null, bgmBus = null, seBus = null, voiceBus = null, synthBus = null, muted = false;
  try { muted = localStorage.getItem('tn-muted') === '1'; } catch { /* 保存できない環境 */ }
  const buf = new Map();          // 名前 → AudioBuffer
  let want = null, cur = null;    // 鳴らしたい曲／鳴っている曲 {name, src, g}
  const lastSe = new Map(), voiceEnd = [0, 0], pendingLoad = new Set();
  let vols = { bgm: 70, se: 80, voice: 90 }; // 設定画面の音量（0〜100）
  const applyVols = () => { if (!ac) return; bgmBus.gain.value = VOL.bgm * vols.bgm / 70; seBus.gain.value = VOL.se * vols.se / 80; synthBus.gain.value = VOL.synth * vols.se / 80; voiceBus.gain.value = VOL.voice * vols.voice / 90; };

  function ensure() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = muted ? 0 : VOL.master; master.connect(ac.destination);
    const bus = v => { const g = ac.createGain(); g.gain.value = v; g.connect(master); return g; };
    bgmBus = bus(VOL.bgm); seBus = bus(VOL.se); voiceBus = bus(VOL.voice); synthBus = bus(VOL.synth);
    applyVols();
    // 曲を先に読み、効果音・かけ声はそのあと
    const jobs = [['bgm_title', BGM.title], ['bgm_battle', BGM.battle], ['bgm_pinch', BGM.pinch],
      ...SE.map(n => [`se_${n}`, `sound/se_${n}.mp3`])];
    (async () => { for (const [name, path] of jobs) await load(name, path); })();
  }

  async function load(name, path) {
    try {
      const r = await fetch(BASE + path);
      if (!r.ok) return;
      buf.set(name, await ac.decodeAudioData(await r.arrayBuffer()));
      if (want && `bgm_${want}` === name) bgm(want);
    } catch { /* 読めない音は合成音で代わりに鳴らす */ }
  }

  // ---- BGM: 曲をつなぎ目なくループし、切り替えは 0.7 秒で重ねる ----
  function bgm(name) {
    want = name;
    if (!ac) return;
    if (cur && cur.name === name) return;
    const t = ac.currentTime;
    if (cur) { const old = cur; old.g.gain.cancelScheduledValues(t); old.g.gain.setValueAtTime(old.g.gain.value, t); old.g.gain.linearRampToValueAtTime(0, t + 0.7); old.src.stop(t + 0.75); cur = null; }
    const b = name && buf.get(`bgm_${name}`);
    if (!b) return;
    const src = ac.createBufferSource(), g = ac.createGain();
    src.buffer = b; src.loop = true;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + 0.7);
    src.connect(g); g.connect(bgmBus); src.start(t);
    cur = { name, src, g };
  }

  // ---- 効果音 ----
  function play(name, bus, { vol = 1, rate = 1, gap = 0.04 } = {}) {
    if (!ac || muted) return true;
    const b = buf.get(name);
    if (!b) return false;
    const t = ac.currentTime;
    if (t - (lastSe.get(name) || -1) < gap) return true;   // 同じ音の重ねすぎを防ぐ
    lastSe.set(name, t);
    const src = ac.createBufferSource(), g = ac.createGain();
    src.buffer = b; src.playbackRate.value = rate; g.gain.value = vol;
    src.connect(g); g.connect(bus); src.start(t);
    return true;
  }

  function tone(freq, dur, type = 'sine', vol = 0.5, slide = 0, when = 0) {
    if (!ac || muted) return;
    const t = ac.currentTime + when;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(synthBus);
    o.start(t); o.stop(t + dur + 0.02);
  }

  const SCALE = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760];
  const semis = n => Math.pow(2, n / 12);

  function onEvents(events, humanPlayers, match) {
    for (const e of events) {
      const mine = humanPlayers.includes(e.p);
      const kind = match ? match.players[e.p].kind : 'tsunagu';
      const quiet = mine || humanPlayers.length === 0 ? 1 : 0.6;   // 相手の音は少し小さく
      switch (e.type) {
        case 'pop': {
          // そろった瞬間。つなぐ派はここで消える音、ならべる派は光り始める音（はじける音は popcell で1枚ずつ）
          const up = semis(Math.min(9, (e.chain - 1) * 1.5));
          if (kind === 'tsunagu') {
            if (!play('se_pop', seBus, { vol: quiet, rate: up })) {
              const f = SCALE[Math.min(SCALE.length - 1, e.chain - 1)];
              tone(f, 0.16, 'triangle', 0.45); tone(f * 1.5, 0.12, 'sine', 0.2, 0, 0.04);
            }
          } else tone(1320 * up, 0.08, 'sine', 0.12 * quiet);
          if (e.chain >= 2) play('se_chain', seBus, { vol: 0.75 * quiet, rate: semis(Math.min(7, e.chain - 2)) });
          break;
        }
        case 'popcell': {
          // 1枚ずつ、だんだん高く
          const up = semis(Math.min(14, e.k * 1.2));
          if (!play('se_clear', seBus, { vol: 0.8 * quiet, rate: up, gap: 0.03 })) tone(660 * up, 0.08, 'triangle', 0.3 * quiet);
          break;
        }
        case 'reveal': tone(520 * semis(e.k * 2), 0.07, 'sine', 0.16 * quiet); break;
        case 'garbage': if (!play('se_garbage', seBus, { vol: quiet })) tone(140, 0.25, 'sawtooth', 0.25, 0.5); break;
        case 'lock': if (mine && !play('se_land', seBus, { vol: 0.55, gap: 0.06 })) tone(220, 0.05, 'sine', 0.2); break;
        case 'swap': if (mine && !play('se_swap', seBus, { vol: 0.5, gap: 0.03 })) tone(660, 0.04, 'square', 0.08); break;
        case 'attack': if (e.D >= 6 && !play('se_attack', seBus, { vol: quiet, gap: 0.2 })) tone(90, 0.35, 'sawtooth', 0.22, 2.2); break;
        default: break;
      }
    }
  }

  // かけ声: キャラごとの声（ElevenLabs）。対戦するキャラの分だけ読む。同じプレイヤーは前の声が終わるまで重ねない
  const VOICE_KEYS = ['select', 'start', 'c1', 'c2', 'c3', 'c4', 'c5', 'ouch', 'danger', 'win', 'lose'];
  function loadVoices(ids) {
    if (!ac) return;
    for (const id of new Set(ids)) for (const k of VOICE_KEYS) {
      const name = `v_${id}_${k}`;
      if (!buf.has(name) && !pendingLoad.has(name)) { pendingLoad.add(name); load(name, `voice/${id}_${k}.mp3`); }
    }
  }
  function voice(p, id, key, human = true) {
    if (!ac || muted || !id) return;
    const b = buf.get(`v_${id}_${key}`);
    if (!b) return;
    const t = ac.currentTime;
    if (t < voiceEnd[p] && key !== 'win' && key !== 'lose') return;
    voiceEnd[p] = t + b.duration;
    const src = ac.createBufferSource(), g = ac.createGain();
    src.buffer = b; g.gain.value = human ? 1 : 0.7;
    src.connect(g); g.connect(voiceBus); src.start(t);
  }

  return {
    ensure,
    onEvents,
    voice,
    loadVoices,
    setVolumes(v) { vols = { ...vols, ...v }; applyVols(); },
    bgm,
    get bgmName() { return want; },
    get loaded() { return [...buf.keys()]; },   // 検証用: 読み込めた音の名前
    get playing() { return cur ? cur.name : null; },
    move() { tone(880, 0.025, 'square', 0.05); },
    win() { bgm(null); if (!play('se_win', seBus, { gap: 0.5 })) [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, 'triangle', 0.35, 0, i * 0.12)); },
    lose() { bgm(null); if (!play('se_lose', seBus, { gap: 0.5 })) [392, 330, 262, 196].forEach((f, i) => tone(f, 0.35, 'triangle', 0.3, 0, i * 0.15)); },
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      try { localStorage.setItem('tn-muted', muted ? '1' : '0'); } catch { /* 保存できない環境 */ }
      if (master) master.gain.value = muted ? 0 : VOL.master;
      return muted;
    },
  };
}
