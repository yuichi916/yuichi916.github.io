// つなぐ派の盤: 2個1組が落ち、同色4つ以上の連結で消える。
// grid[y][x]: 13行×6列。y=0 は隠し行（消えない・見えない）。0=空 1〜5=色 6=おじゃま
import { createRng } from './rng.js';
import { tsunaguDamage } from './damage.js';

export const ROWS = 13;
export const COLS = 6;
export const GARBAGE = 6;
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

export const emptyGrid = () => Array.from({ length: ROWS }, () => Array(COLS).fill(0));
export const cloneGrid = g => g.map(r => r.slice());

export function childPos(p) {
  return { x: p.x + DX[p.rot], y: p.y + DY[p.rot] };
}

const free = (g, x, y) => x >= 0 && x < COLS && y >= 0 && y < ROWS && g[y][x] === 0;

export function applyGravity(g) {
  for (let x = 0; x < COLS; x++) {
    let w = ROWS - 1;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (g[y][x] !== 0) { const v = g[y][x]; g[y][x] = 0; g[w][x] = v; w--; }
    }
  }
}

// 隠し行(y=0)を除き、同色4つ以上の群を返す
export function findGroups(g) {
  const seen = new Uint8Array(ROWS * COLS);
  const groups = [];
  for (let y = 1; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const c = g[y][x];
      if (c < 1 || c > 5 || seen[y * COLS + x]) continue;
      const cells = [];
      const st = [[x, y]];
      seen[y * COLS + x] = 1;
      while (st.length) {
        const [cx, cy] = st.pop();
        cells.push([cx, cy]);
        for (let d = 0; d < 4; d++) {
          const nx = cx + DX[d], ny = cy + DY[d];
          if (nx < 0 || nx >= COLS || ny < 1 || ny >= ROWS) continue;
          if (seen[ny * COLS + nx] || g[ny][nx] !== c) continue;
          seen[ny * COLS + nx] = 1;
          st.push([nx, ny]);
        }
      }
      if (cells.length >= 4) groups.push({ color: c, cells });
    }
  }
  return groups;
}

// 群を消し（隣接おじゃまも）、その段の情報を返す
export function popGroups(g, groups, chain, cfg) {
  const n = groups.reduce((s, gr) => s + gr.cells.length, 0);
  const colors = new Set(groups.map(gr => gr.color)).size;
  const D = tsunaguDamage({ n, chain, groupSizes: groups.map(gr => gr.cells.length), colors }, cfg);
  for (const gr of groups) {
    for (const [x, y] of gr.cells) {
      g[y][x] = 0;
      for (let d = 0; d < 4; d++) {
        const nx = x + DX[d], ny = y + DY[d];
        if (nx >= 0 && nx < COLS && ny >= 1 && ny < ROWS && g[ny][nx] === GARBAGE) g[ny][nx] = 0;
      }
    }
  }
  return { n, D };
}

// 時間を飛ばして連鎖を最後まで解決する（AI・テスト用）
export function resolveAll(g, cfg) {
  let chains = 0, D = 0, cleared = 0;
  applyGravity(g);
  for (;;) {
    const groups = findGroups(g);
    if (!groups.length) break;
    chains++;
    const r = popGroups(g, groups, chains, cfg);
    D += r.D; cleared += r.n;
    applyGravity(g);
  }
  return { chains, D, cleared };
}

// 組を (x, rot) で真下に落として置く。置けなければ false
export function dropPiece(g, x, rot, a, b) {
  const p = { x, y: 1, rot, a, b };
  if (!pieceFits(g, p)) return false;
  while (pieceFits(g, { ...p, y: p.y + 1 })) p.y++;
  placePiece(g, p);
  return true;
}

function placePiece(g, p) {
  const c = childPos(p);
  if (p.y >= 0) g[p.y][p.x] = p.a;
  if (c.y >= 0) g[c.y][c.x] = p.b;
  applyGravity(g);
}

function pieceFits(g, p) {
  const c = childPos(p);
  return free(g, p.x, p.y) && free(g, c.x, c.y);
}

export function createTsunagu({ cfg, seed, takeGarbage }) {
  const rng = createRng(seed);
  const randPiece = () => ({ a: rng.int(cfg.colorsT) + 1, b: rng.int(cfg.colorsT) + 1 });
  const fallFrames = Math.round(cfg.tsunaguFallSec * 60);
  const popFrames = Math.round(cfg.tsunaguPopSec * 60);

  const B = {
    kind: 'tsunagu',
    grid: emptyGrid(),
    piece: null,
    next: [randPiece(), randPiece()],
    phase: 'spawn',
    chain: 0,
    timer: 0,
    fallTimer: 0,
    frame: 0,
    popping: null, // 消去演出中のセル [[x,y]...]
    pieceId: 0,
    isDead: () => B.phase === 'dead',
    step,
  };

  function spawn(ev) {
    if (B.grid[1][2] !== 0) { B.phase = 'dead'; B.piece = null; ev.push({ type: 'dead' }); return; }
    if (B.grid[0][2] !== 0) B.grid[0][2] = 0;
    const n = B.next.shift();
    B.next.push(randPiece());
    B.piece = { x: 2, y: 1, rot: 0, a: n.a, b: n.b };
    B.pieceId++;
    B.phase = 'fall';
    B.fallTimer = 0;
  }

  function tryMove(dx, dy) {
    const p = { ...B.piece, x: B.piece.x + dx, y: B.piece.y + dy };
    if (!pieceFits(B.grid, p)) return false;
    B.piece = p;
    return true;
  }

  function rotate(dir) {
    const p = B.piece;
    const nr = (p.rot + dir + 4) % 4;
    const cand = { ...p, rot: nr };
    if (pieceFits(B.grid, cand)) { B.piece = cand; return true; }
    const kick = { ...cand, x: p.x - DX[nr], y: p.y - DY[nr] };
    if (pieceFits(B.grid, kick)) { B.piece = kick; return true; }
    if (nr === 1 || nr === 3) {
      const fr = (p.rot + 2) % 4;
      const flip = { ...p, rot: fr };
      if (pieceFits(B.grid, flip)) { B.piece = flip; return true; }
      const fk = { ...flip, x: p.x - DX[fr], y: p.y - DY[fr] };
      if (pieceFits(B.grid, fk)) { B.piece = fk; return true; }
    }
    return false;
  }

  function lock(ev) {
    placePiece(B.grid, B.piece);
    B.piece = null;
    B.chain = 0;
    ev.push({ type: 'lock' });
    checkPop(ev);
  }

  function checkPop(ev) {
    const groups = findGroups(B.grid);
    if (groups.length) {
      B.chain++;
      B.popping = groups.flatMap(g => g.cells);
      B.pendingGroups = groups;
      B.phase = 'pop';
      B.timer = popFrames;
      const n = B.popping.length;
      const colors = new Set(groups.map(g => g.color)).size;
      const D = tsunaguDamage({ n, chain: B.chain, groupSizes: groups.map(g => g.cells.length), colors }, cfg);
      ev.push({ type: 'pop', chain: B.chain, n, cells: B.popping });
      ev.push({ type: 'attack', D, chain: B.chain });
      return;
    }
    // 連鎖終わり: おじゃまの着弾
    const n = takeGarbage();
    if (n > 0) {
      dropGarbage(n);
      ev.push({ type: 'garbage', n });
      B.phase = 'garbage';
      B.timer = cfg.tsunaguGarbageFrames;
      return;
    }
    spawn(ev);
  }

  function dropGarbage(n) {
    const per = Math.floor(n / COLS);
    const counts = Array(COLS).fill(per);
    const cols = [0, 1, 2, 3, 4, 5];
    for (let i = 0; i < n % COLS; i++) {
      const j = i + rng.int(COLS - i);
      [cols[i], cols[j]] = [cols[j], cols[i]];
      counts[cols[i]]++;
    }
    for (let x = 0; x < COLS; x++) {
      let y = ROWS - 1;
      while (y >= 0 && B.grid[y][x] !== 0) y--;
      for (let k = 0; k < counts[x] && y >= 0; k++, y--) B.grid[y][x] = GARBAGE;
    }
  }

  function step(inp) {
    const ev = [];
    B.frame++;
    switch (B.phase) {
      case 'spawn':
        spawn(ev);
        break;
      case 'fall': {
        if (inp.a) rotate(-1);
        if (inp.b) rotate(1);
        if (inp.left) tryMove(-1, 0);
        if (inp.right) tryMove(1, 0);
        if (inp.up) {
          while (tryMove(0, 1));
          lock(ev);
          break;
        }
        B.fallTimer++;
        const th = inp.downHeld ? cfg.tsunaguSoftFrames : fallFrames;
        if (B.fallTimer >= th) {
          B.fallTimer = 0;
          if (!tryMove(0, 1)) lock(ev);
        }
        break;
      }
      case 'pop':
        if (--B.timer <= 0) {
          popGroups(B.grid, B.pendingGroups, B.chain, cfg);
          B.popping = null;
          applyGravity(B.grid);
          checkPop(ev);
        }
        break;
      case 'garbage':
        if (--B.timer <= 0) spawn(ev);
        break;
      default:
        break;
    }
    return ev;
  }

  return B;
}
