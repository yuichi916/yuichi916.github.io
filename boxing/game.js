// クリック・ボクシング v2 — キャラセレクト + 2モード
//   - boxer  : 既存のボクシング (HP, KO)
//   - shy_girl: クリックで感情遷移 (no combat)

const CANVAS_W = 1080;
const CANVAS_H = 1920;
const FPS = 30;

// ── 状態定数 (boxer 用) ─────────────────────────────────────────
const STATE = {
  IDLE: 'idle',
  GUARD: 'guard',
  HIT_BODY_PRE: 'hit_body_pre',
  HIT_BODY_IMPACT: 'hit_body_impact',
  HIT_FACE_PRE: 'hit_face_pre',
  HIT_FACE_IMPACT: 'hit_face_impact',
  DODGE_LEFT: 'dodge_left',
  DODGE_RIGHT: 'dodge_right',
  GROGGY: 'groggy',
  KO_FALLING: 'ko_falling',
  KO_DOWN: 'ko_down',
  VICTORY: 'victory',
};

const STATE_DURATION = {
  [STATE.IDLE]: 0,
  [STATE.GUARD]: 600,
  [STATE.HIT_BODY_PRE]: 80,
  [STATE.HIT_BODY_IMPACT]: 400,
  [STATE.HIT_FACE_PRE]: 80,
  [STATE.HIT_FACE_IMPACT]: 400,
  [STATE.DODGE_LEFT]: 350,
  [STATE.DODGE_RIGHT]: 350,
  [STATE.GROGGY]: 0,
  [STATE.KO_FALLING]: 600,
  [STATE.KO_DOWN]: 0,
  [STATE.VICTORY]: 0,
};

// ── ゲーム状態 ─────────────────────────────────────────────
const game = {
  charKey: null,        // 'boxer' | 'shy_girl'
  mode: null,           // 'combat' | 'react'
  charDef: null,        // sprites.json の characters.<key>
  oppHp: 100,
  oppMaxHp: 100,
  playerHp: 100,
  playerMaxHp: 100,
  state: 'idle',
  stateStart: 0,
  combo: 0,
  comboTimer: 0,
  glove: null,
  gloveStart: 0,
  oppCounterTimer: 0,
  ended: false,
  reactCycleIdx: 0,
};

// ── アセットロード ─────────────────────────────────────────────
let assetMap = null;
const sprites = { chars: {}, gloves: {}, bg: null };

async function loadAssetMap() {
  const res = await fetch('sprites.json');
  assetMap = await res.json();
}

async function loadCharacterSprites(charKey) {
  if (sprites.chars[charKey]) return;
  const def = assetMap.characters[charKey];
  const stateMap = {};
  for (const [state, paths] of Object.entries(def.states)) {
    stateMap[state] = [];
    for (const p of paths) {
      const img = await loadImage(p, () => placeholderChar(charKey, state));
      stateMap[state].push(img);
    }
  }
  sprites.chars[charKey] = stateMap;
}

async function loadCommonSprites() {
  for (const [name, p] of Object.entries(assetMap.gloves)) {
    sprites.gloves[name] = await loadImage(p, () => placeholderGlove(name));
  }
  sprites.bg = await loadImage(assetMap.bg.ring, () => placeholderBg());
}

function loadImage(src, fallbackFn) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(fallbackFn());
    img.src = src;
  });
}

// ── プレースホルダー (sprites 未生成時のフォールバック) ───────────
function placeholderChar(charKey, state) {
  const c = document.createElement('canvas');
  c.width = 600; c.height = 1000;
  const ctx = c.getContext('2d');
  ctx.fillStyle = charKey === 'boxer' ? '#c97f5a' : '#f0d8c0';
  ctx.fillRect(100, 200, 400, 600);
  ctx.fillStyle = '#000a';
  ctx.fillRect(0, 0, c.width, 40);
  ctx.fillStyle = '#ffd54a';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(`[ph] ${charKey}/${state}`, 10, 28);
  return c;
}

function placeholderGlove(name) {
  const c = document.createElement('canvas');
  c.width = 400; c.height = 400;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#d32f2f';
  ctx.beginPath(); ctx.arc(200, 200, 150, 0, Math.PI * 2); ctx.fill();
  return c;
}

function placeholderBg() {
  const c = document.createElement('canvas');
  c.width = 1216; c.height = 832;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(608, 416, 100, 608, 416, 700);
  g.addColorStop(0, '#3a2418');
  g.addColorStop(1, '#0a0604');
  ctx.fillStyle = g; ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

// ── レンダリング ─────────────────────────────────────────────
const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');

function draw() {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // 背景: ring (両モード共通だが shy_girl では別の場でも可)
  if (sprites.bg) {
    // 中央に大きく配置 (フィット)
    const bgRatio = sprites.bg.width / sprites.bg.height;
    const drawW = CANVAS_W;
    const drawH = drawW / bgRatio;
    ctx.drawImage(sprites.bg, 0, 100, drawW, drawH);
    // 上下フェード
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    grad.addColorStop(0, 'rgba(0,0,0,0.6)');
    grad.addColorStop(0.3, 'rgba(0,0,0,0.0)');
    grad.addColorStop(0.7, 'rgba(0,0,0,0.0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  // キャラ
  if (game.charDef && sprites.chars[game.charKey]) {
    const charSprites = sprites.chars[game.charKey];
    const frames = charSprites[game.state] || charSprites['idle'];
    if (frames && frames.length > 0) {
      const idx = Math.floor((Date.now() - game.stateStart) / 400) % frames.length;
      const img = frames[idx];
      const aspect = img.width / img.height;
      const drawH = 1300;
      const drawW = drawH * aspect;
      ctx.drawImage(img, (CANVAS_W - drawW) / 2, 250, drawW, drawH);
    }
  }

  // グローブ (combat モードのみ)
  if (game.mode === 'combat' && game.glove && sprites.gloves[game.glove]) {
    const elapsed = Date.now() - game.gloveStart;
    if (elapsed < 200) {
      const img = sprites.gloves[game.glove];
      const isLeft = game.glove.startsWith('left');
      const x = isLeft ? 50 : CANVAS_W - 450;
      const y = CANVAS_H - 600 + Math.sin(elapsed / 200 * Math.PI) * -100;
      ctx.drawImage(img, x, y, 400, 400);
    } else {
      game.glove = null;
    }
  }

  // デバッグ
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '14px monospace';
  ctx.fillText(`${game.charKey}/${game.mode}/${game.state} hp=${game.oppHp}`, 20, CANVAS_H - 20);
}

function setState(s) {
  game.state = s;
  game.stateStart = Date.now();
  console.log(`[STATE] → ${s}`);
}

function update() {
  if (game.ended) return;
  const now = Date.now();
  const elapsed = now - game.stateStart;
  const dur = STATE_DURATION[game.state] || 0;

  if (game.mode === 'combat' && dur > 0 && elapsed >= dur) {
    transitionFromTimeoutCombat();
  }

  if (game.mode === 'combat' && game.comboTimer && now - game.comboTimer > 1000) {
    game.combo = 0;
  }

  if (game.mode === 'combat' && !game.ended && game.oppCounterTimer && now >= game.oppCounterTimer) {
    triggerCounter();
  }

  updateHud();
}

function transitionFromTimeoutCombat() {
  switch (game.state) {
    case STATE.HIT_BODY_PRE:
      setState(STATE.HIT_BODY_IMPACT);
      applyDamageToOpp(8 + Math.floor(Math.random() * 5));
      break;
    case STATE.HIT_FACE_PRE:
      setState(STATE.HIT_FACE_IMPACT);
      applyDamageToOpp(12 + Math.floor(Math.random() * 7));
      break;
    case STATE.HIT_BODY_IMPACT:
    case STATE.HIT_FACE_IMPACT:
    case STATE.DODGE_LEFT:
    case STATE.DODGE_RIGHT:
    case STATE.GUARD:
      if (game.oppHp > 30) setState(STATE.IDLE);
      else setState(STATE.GROGGY);
      break;
    case STATE.KO_FALLING:
      setState(STATE.KO_DOWN);
      endGame(true);
      break;
  }
}

function applyDamageToOpp(dmg) {
  const before = game.oppHp;
  game.oppHp = Math.max(0, game.oppHp - dmg);
  flashMessage(`${dmg} HIT!`);
  if (game.oppHp <= 0 && before > 0) {
    setTimeout(() => setState(STATE.KO_FALLING), 350);
    return;
  }
  if (game.oppHp < 30 && before >= 30) {
    flashMessage('GROGGY!');
  }
}

function applyDamageToPlayer(dmg) {
  game.playerHp = Math.max(0, game.playerHp - dmg);
  flashMessage(`-${dmg}`, '#ff6666');
  if (game.playerHp <= 0) endGame(false);
}

function triggerCounter() {
  game.oppCounterTimer = 0;
  const dmg = 6 + Math.floor(Math.random() * 8);
  if (Math.random() < 0.4) applyDamageToPlayer(dmg);
}

function endGame(playerWon) {
  game.ended = true;
  if (playerWon) {
    flashMessage('K.O. !!', '#ffd54a', 4000);
    setTimeout(() => setState(STATE.KO_DOWN), 100);
  } else {
    flashMessage('YOU LOSE', '#ff4444', 4000);
    setState(STATE.VICTORY);
  }
  document.getElementById('btn-restart').style.display = '';
}

// ── 入力処理 ─────────────────────────────────────────────

function attemptPunch(type) {
  if (game.mode !== 'combat') {
    // shy_girl モード: クリックで次の感情へ
    cycleReact();
    return;
  }
  if (game.ended) return;
  if ([STATE.HIT_BODY_PRE, STATE.HIT_FACE_PRE, STATE.KO_FALLING, STATE.KO_DOWN].includes(game.state)) return;

  const isJab = type === 'jab';
  game.glove = isJab ? 'left_jab_extended' : 'right_cross_extended';
  game.gloveStart = Date.now();

  const dodgeChance = game.state === STATE.GROGGY ? 0 : 0.25;
  if (Math.random() < dodgeChance) {
    setState(isJab ? STATE.DODGE_RIGHT : STATE.DODGE_LEFT);
    flashMessage('MISS', '#888');
    return;
  }
  if (game.state === STATE.IDLE && Math.random() < 0.2) {
    setState(STATE.GUARD);
    flashMessage('BLOCKED', '#bbb');
    return;
  }

  game.combo++;
  game.comboTimer = Date.now();
  setState(isJab ? STATE.HIT_BODY_PRE : STATE.HIT_FACE_PRE);
  if (game.oppHp > 30) {
    game.oppCounterTimer = Date.now() + 1500 + Math.random() * 1500;
  }
}

// ── shy_girl react モード ─────────────────────────────────────
function cycleReact() {
  const cycle = game.charDef.react_cycle || ['idle'];
  game.reactCycleIdx = (game.reactCycleIdx + 1) % cycle.length;
  const next = cycle[game.reactCycleIdx];
  setState(next);
  // 数秒後に idle に戻す
  setTimeout(() => {
    if (game.state === next) setState('idle');
  }, 2000);
}

function updateHud() {
  if (game.mode === 'combat') {
    const oppPct = game.oppHp / game.oppMaxHp * 100;
    const playerPct = game.playerHp / game.playerMaxHp * 100;
    document.getElementById('opp-hp').style.width = oppPct + '%';
    document.getElementById('player-hp').style.width = playerPct + '%';
    document.getElementById('opp-hp-text').textContent = `${game.oppHp} / ${game.oppMaxHp}`;
    document.getElementById('player-hp-text').textContent = `${game.playerHp} / ${game.playerMaxHp}`;
    const comboEl = document.getElementById('combo-text');
    comboEl.textContent = game.combo > 1 ? `COMBO ×${game.combo}` : '';
  }
}

function flashMessage(text, color = '#ffd54a', duration = 600) {
  const el = document.getElementById('message');
  el.textContent = text;
  el.style.color = color;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), duration);
}

// ── キャラ選択 → ゲーム開始 ─────────────────────────────────
async function startGame(charKey) {
  game.charKey = charKey;
  game.charDef = assetMap.characters[charKey];
  game.mode = game.charDef.mode;
  await loadCharacterSprites(charKey);

  // mode に応じた UI 切替
  const gameScreen = document.getElementById('game-screen');
  if (game.mode === 'react') {
    gameScreen.classList.add('react-mode');
    flashMessage(`${game.charDef.label}に話しかけよう`, '#ffd54a', 1500);
  } else {
    gameScreen.classList.remove('react-mode');
  }

  // リセット
  game.oppHp = game.oppMaxHp;
  game.playerHp = game.playerMaxHp;
  game.combo = 0;
  game.ended = false;
  game.oppCounterTimer = 0;
  game.reactCycleIdx = 0;
  setState('idle');

  // 画面切替
  document.getElementById('char-select').classList.add('hidden');
  gameScreen.classList.remove('hidden');
}

function backToSelect() {
  document.getElementById('game-screen').classList.add('hidden');
  document.getElementById('char-select').classList.remove('hidden');
}

function restart() {
  document.getElementById('btn-restart').style.display = 'none';
  startGame(game.charKey);
}

// ── 初期化 ─────────────────────────────────────────────
async function init() {
  await loadAssetMap();
  await loadCommonSprites();

  setInterval(update, 1000 / FPS);
  function loop() {
    draw();
    requestAnimationFrame(loop);
  }
  loop();

  // キャラ選択カード
  document.querySelectorAll('.char-card').forEach((card) => {
    card.addEventListener('click', () => startGame(card.dataset.char));
  });

  // ゲーム内ボタン
  document.getElementById('btn-jab').addEventListener('click', () => attemptPunch('jab'));
  document.getElementById('btn-cross').addEventListener('click', () => attemptPunch('cross'));
  document.getElementById('btn-restart').addEventListener('click', restart);
  document.getElementById('btn-back').addEventListener('click', backToSelect);

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const isLeft = x < rect.width / 2;
    attemptPunch(isLeft ? 'jab' : 'cross');
  });

  console.log('=== Boxing Game v2 Ready ===');
}

init();
