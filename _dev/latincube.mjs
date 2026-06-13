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
