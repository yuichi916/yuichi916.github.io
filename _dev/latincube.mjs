// LatinCube core logic (dev module — TDD here, then inline into sudoku.html).
// g[i][j][k] in 0..N-1. Constraint: every axis-parallel line (X/Y/Z) is a
// permutation of 0..N-1.

function permute(N, rng) {
  const a = [...Array(N).keys()];
  for (let i = N - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// (pi[i] + pj[j] + pk[k]) mod N is a valid 3-axis latin cube; symbol permute
// diversifies the glyph assignment.
export function makeSolution(N, rng = Math.random) {
  const pi = permute(N, rng);
  const pj = permute(N, rng);
  const pk = permute(N, rng);
  const sym = permute(N, rng);
  const g = [];
  for (let i = 0; i < N; i++) {
    g[i] = [];
    for (let j = 0; j < N; j++) {
      g[i][j] = [];
      for (let k = 0; k < N; k++) {
        const base = (pi[i] + pj[j] + pk[k]) % N;
        g[i][j][k] = sym[base];
      }
    }
  }
  return g;
}

const idx = (N, i, j, k) => (i * N + j) * N + k;

// Candidates for a cell: symbols not already used on its 3 axis lines.
function candidates(flat, N, i, j, k) {
  const used = new Set();
  for (let t = 0; t < N; t++) {
    const a = flat[idx(N, t, j, k)]; if (a >= 0) used.add(a);
    const b = flat[idx(N, i, t, k)]; if (b >= 0) used.add(b);
    const c = flat[idx(N, i, j, t)]; if (c >= 0) used.add(c);
  }
  const res = [];
  for (let v = 0; v < N; v++) if (!used.has(v)) res.push(v);
  return res;
}

// Count solutions up to `limit` (2 is enough for uniqueness). grid3d uses -1 for blanks.
export function countSolutions(grid3d, N, limit = 2) {
  const flat = new Int8Array(N * N * N);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (let k = 0; k < N; k++) flat[idx(N, i, j, k)] = grid3d[i][j][k];
  let count = 0;
  function solve() {
    let best = -1, bestC = null;
    for (let p = 0; p < flat.length; p++) {
      if (flat[p] !== -1) continue;
      const i = Math.floor(p / (N * N)), j = Math.floor((p % (N * N)) / N), k = p % N;
      const c = candidates(flat, N, i, j, k);
      if (c.length === 0) return;
      if (bestC === null || c.length < bestC.length) { best = p; bestC = c; if (c.length === 1) break; }
    }
    if (best === -1) { count++; return; }
    for (const v of bestC) {
      flat[best] = v;
      solve();
      flat[best] = -1;
      if (count >= limit) return;
    }
  }
  solve();
  return count;
}

const BLANK_RATIO = { easy: 0.35, normal: 0.5, hard: 0.62 };

export function makePuzzle(N, difficulty = 'normal', rng = Math.random) {
  const solution = makeSolution(N, rng);
  const puzzle = solution.map((p) => p.map((r) => r.slice()));
  const cells = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (let k = 0; k < N; k++) cells.push([i, j, k]);
  for (let m = cells.length - 1; m > 0; m--) { const r = Math.floor(rng() * (m + 1)); [cells[m], cells[r]] = [cells[r], cells[m]]; }
  const target = Math.floor(N * N * N * BLANK_RATIO[difficulty]);
  let blanks = 0;
  for (const [i, j, k] of cells) {
    if (blanks >= target) break;
    const keep = puzzle[i][j][k];
    puzzle[i][j][k] = -1;
    if (countSolutions(puzzle, N, 2) === 1) blanks++;
    else puzzle[i][j][k] = keep;
  }
  return { puzzle, solution };
}

export function isValidSolution(g, N) {
  const lineOK = (vals) => {
    const seen = new Set(vals);
    return seen.size === N && [...seen].every((v) => v >= 0 && v < N);
  };
  for (let a = 0; a < N; a++) {
    for (let b = 0; b < N; b++) {
      const lx = [], ly = [], lz = [];
      for (let t = 0; t < N; t++) {
        lx.push(g[t][a][b]);
        ly.push(g[a][t][b]);
        lz.push(g[a][b][t]);
      }
      if (!lineOK(lx) || !lineOK(ly) || !lineOK(lz)) return false;
    }
  }
  return true;
}
