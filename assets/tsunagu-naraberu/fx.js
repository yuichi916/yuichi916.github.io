// 見た目だけの動き（物理）。ゲームの中身（match）は読むだけで、決して変えない（バランスは中身で測ってある）。
// 1刻みごとに「刻みの前の盤」と「刻みの後の盤」を比べて、どのつぶ・パネルがどこへ動いたかを割り出し、
// 元の位置から重力とばねで動かして見せる。単位はマス（cell）。描画は render.js がこの値を読む。
import { ROWS as TR, COLS as TC, GARBAGE } from './tsunagu.js';
import { COLS as NC, ROWS as NR, GARB } from './naraberu.js';

const G = 0.024;          // 落下の重力（マス/刻み²）。3マス落ちるのに約0.27秒
const SPRING = 0.32, DAMP = 0.2;   // 着地でつぶれたあと戻るばね
const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];

const rnd = (() => { let s = 1234567; return () => { s = (s * 1103515245 + 12345) >>> 0; return s / 4294967296; }; })();

export function createFx() {
  const P = [newState(), newState()];
  const parts = [];        // 飛び散るしずく・破片・星 {p, x, y, vx, vy, g, r, col, life, age, kind, rot, vr}

  function newState() {
    return { cells: new Map(), piece: null, shakeT: 0 };
  }
  function reset() { P[0] = newState(); P[1] = newState(); parts.length = 0; }

  // ---- 刻みの前の写し ----
  function snapshot(match) {
    return match.players.map(pl => {
      const b = pl.board;
      if (pl.kind === 'tsunagu') {
        return { kind: 'tsunagu', grid: b.grid.map(r => r.slice()), piece: b.piece ? { ...b.piece } : null,
          phase: b.phase, timer: b.timer, popping: b.popping ? b.popping.map(c => c.slice()) : null };
      }
      return { kind: 'naraberu', C: Array.from(b.C), S: Array.from(b.S), T: Array.from(b.T), riseCount: b.riseCount,
        blocks: new Map([...b.blocks].map(([id, bl]) => [id, bl.y])) };
    });
  }

  // ---- 刻みの後: 動きを割り出す ----
  function afterStep(match, events, pre) {
    match.players.forEach((pl, p) => {
      const ev = events.filter(e => e.p === p);
      if (pl.kind === 'tsunagu') afterTsunagu(p, pl.board, pre[p], ev);
      else afterNaraberu(p, pl.board, pre[p], ev);
    });
  }

  function afterTsunagu(p, b, pre, ev) {
    const S = P[p];
    const removedNow = pre.phase === 'pop' && pre.timer === 1;      // この刻みで消えた
    const removed = new Set(removedNow && pre.popping ? pre.popping.map(([x, y]) => y * TC + x) : []);
    const locked = ev.some(e => e.type === 'lock');
    const garbageNow = ev.some(e => e.type === 'garbage');
    const changed = removedNow || locked || garbageNow;
    // 消えたつぶのしずく
    if (removedNow) for (const [x, y] of pre.popping) burst(p, 'tsunagu', x + 0.5, y - 0.5, pre.grid[y][x]);
    if (changed) {
      const next = new Map();
      for (let x = 0; x < TC; x++) {
        // 刻みの前に残っていたつぶ（下から）
        const list0 = [];
        for (let y = TR - 1; y >= 0; y--) {
          const c = pre.grid[y][x];
          if (c && !removed.has(y * TC + x)) list0.push({ y, c, vis: S.cells.get(y * TC + x) });
        }
        // 置いた組のうち、この列に入るもの（下から）
        const fromPiece = [];
        if (locked && pre.piece) {
          const pc = pre.piece, cx = pc.x + DX[pc.rot], cy = pc.y + DY[pc.rot];
          const a = { x: pc.x, y: pc.y, c: pc.a }, bb = { x: cx, y: cy, c: pc.b };
          // 見えていた位置（なめらかに追っていて少し上にある）から落とし、置いた瞬間に跳ばないようにする
          const lag = S.piece ? Math.min(0, S.piece.y - pc.y) : 0;
          const vis = lag < -0.01 ? { off: lag, v: 0, sq: 0, sqv: 0 } : null;
          for (const q of [a, bb].filter(q => q.x === x).sort((u, v) => v.y - u.y)) fromPiece.push({ y: q.y, c: q.c, vis });
        }
        const list1 = [];
        for (let y = TR - 1; y >= 0; y--) if (b.grid[y][x]) list1.push({ y, c: b.grid[y][x] });
        const src = list0.concat(fromPiece);
        let gi = 0;
        for (let k = 0; k < list1.length; k++) {
          const dst = list1[k];
          let y0, v = 0;
          if (k < src.length && src[k].c === dst.c) {
            const s0 = src[k];
            y0 = s0.y + (s0.vis ? s0.vis.off : 0); v = s0.vis ? s0.vis.v : 0;
          } else if (dst.c === GARBAGE && k >= src.length) {
            y0 = -1.2 - gi * 1.05 - rnd() * 0.6; gi++;                 // 上から降ってくるおじゃま
          } else { y0 = dst.y; }
          const off = y0 - dst.y;
          const old = S.cells.get(dst.y * TC + x);
          if (off < -0.01) next.set(dst.y * TC + x, { off, v, sq: 0, sqv: 0 });
          else if (k < src.length && src[k].vis) next.set(dst.y * TC + x, { ...src[k].vis, off: 0 });
          else if (old && !changed) next.set(dst.y * TC + x, old);
        }
      }
      S.cells = next;
    }
    // 操作中の組: なめらかに追う
    if (b.piece) {
      const pc = b.piece, ang = pc.rot * Math.PI / 2;
      const spawned = ev.some(e => e.type === 'spawn') || !S.piece || (pre.piece === null);
      if (spawned) S.piece = { x: pc.x, y: pc.y - 0.6, ang };
      S.piece.tx = pc.x; S.piece.ty = pc.y; S.piece.tang = ang;
    } else S.piece = null;
  }

  function afterNaraberu(p, b, pre, ev) {
    const S = P[p];
    // せり上がり: 全体が1段上がった
    const up = b.riseCount - pre.riseCount;
    if (up > 0) {
      const next = new Map();
      for (const [i, v] of S.cells) if (i - up * NC >= 0) next.set(i - up * NC, v);
      S.cells = next;
    }
    // 消えたパネルの破片
    for (let i = 0; i < pre.S.length; i++) {
      if (pre.S[i] === 1 && pre.T[i] === 1 && pre.C[i] > 0 && pre.C[i] !== GARB) {
        const y = Math.floor(i / NC) - up, x = i % NC;
        burst(p, 'naraberu', x + 0.5, y + 0.5, pre.C[i]);
      }
    }
    // 入れ替え: 2枚が横にすべる
    if (ev.some(e => e.type === 'swap')) {
      const i = b.cursor.y * NC + b.cursor.x;
      S.cells.set(i, { ...(S.cells.get(i) || {}), ox: 1, sq: 0, sqv: 0 });
      S.cells.set(i + 1, { ...(S.cells.get(i + 1) || {}), ox: -1, sq: 0, sqv: 0 });
    }
    // 落ちていたパネルの着地: ぽよんとつぶれる
    for (let i = 0; i < b.S.length; i++) {
      const j = i + up * NC;
      if (j < pre.S.length && pre.S[j] === 2 && b.S[i] === 0 && b.C[i] > 0 && b.C[i] !== GARB) {
        const v = S.cells.get(i) || { ox: 0 };
        S.cells.set(i, { ...v, sq: -0.22, sqv: 0 });
      }
    }
    // 落下中のパネル: 1刻みで1マス下がる → 少しだけ上から追わせて、カクカクを和らげる
    for (let i = 0; i < b.S.length; i++) {
      if (b.S[i] === 2 && b.C[i] > 0) { const v = S.cells.get(i) || { ox: 0 }; S.cells.set(i, { ...v, oy: -0.55 }); }
    }
    // おじゃまブロックの着地: 盤が揺れる
    for (const [id, bl] of b.blocks) {
      const y0 = pre.blocks.get(id);
      if (y0 !== undefined && y0 !== bl.y + up) S.blockMoving = (S.blockMoving || new Set()).add(id);
      else if (S.blockMoving && S.blockMoving.has(id)) { S.blockMoving.delete(id); S.shakeT = 14; }
    }
  }

  // ---- しずく・破片・星 ----
  function burst(p, kind, x, y, c) {
    const n = kind === 'tsunagu' ? 8 : 6;
    for (let k = 0; k < n; k++) {
      const a = rnd() * Math.PI * 2, sp = 0.05 + rnd() * 0.13;
      parts.push({ p, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.12, g: 0.011, r: kind === 'tsunagu' ? 0.1 + rnd() * 0.12 : 0.12 + rnd() * 0.1,
        c, life: 34 + rnd() * 16, age: 0, kind: kind === 'tsunagu' ? 'drop' : 'shard', rot: rnd() * 6, vr: (rnd() - 0.5) * 0.4 });
    }
    for (let k = 0; k < 3; k++) {
      const a = rnd() * Math.PI * 2, sp = 0.03 + rnd() * 0.05;
      parts.push({ p, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.05, g: 0.002, r: 0.16 + rnd() * 0.12, c: 0, life: 30 + rnd() * 12, age: 0, kind: 'star', rot: rnd() * 6, vr: 0.15 });
    }
  }

  // ---- 1刻みぶんの物理 ----
  function tick() {
    for (const S of P) {
      for (const [i, v] of S.cells) {
        if (v.off !== undefined && v.off < 0) {
          v.v += G; v.off += v.v;
          if (v.off >= 0) { v.sq = -Math.min(0.34, 0.06 + v.v * 1.4); v.sqv = 0; v.off = 0; v.v = 0; }
        }
        if (v.sq || v.sqv) {
          v.sqv += -SPRING * v.sq - DAMP * v.sqv; v.sq += v.sqv;
          if (Math.abs(v.sq) < 0.002 && Math.abs(v.sqv) < 0.002) { v.sq = 0; v.sqv = 0; }
        }
        if (v.ox) { v.ox -= Math.sign(v.ox) * 0.25; if (Math.abs(v.ox) < 0.01) v.ox = 0; }
        if (v.oy) { v.oy *= 0.35; if (Math.abs(v.oy) < 0.01) v.oy = 0; }
        if (!v.off && !v.sq && !v.sqv && !v.ox && !v.oy) S.cells.delete(i);
      }
      if (S.piece) {
        const q = S.piece;
        q.x += (q.tx - q.x) * 0.5;
        const dy = q.ty - q.y; q.y += dy > 0 ? Math.max(Math.min(dy, 0.22), dy * 0.45) : dy * 0.6;
        let d = q.tang - q.ang; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
        q.ang += d * 0.42;
      }
      if (S.shakeT > 0) S.shakeT--;
    }
    for (let k = parts.length - 1; k >= 0; k--) {
      const q = parts[k];
      q.vy += q.g; q.x += q.vx; q.y += q.vy; q.vx *= 0.985; q.rot += q.vr; q.age++;
      if (q.age >= q.life) parts.splice(k, 1);
    }
  }

  return {
    reset, snapshot, afterStep, tick,
    tsunaguCell: (p, x, y) => P[p].cells.get(y * TC + x),
    naraberuCell: (p, i) => P[p].cells.get(i),
    piece: p => P[p].piece,
    shake: p => P[p].shakeT,
    parts,
  };
}
