import assert from 'node:assert';
import { makeSolution, isValidSolution, makePuzzle, countSolutions } from './latincube.mjs';

function check(N) {
  const g = makeSolution(N, () => 0.5);
  assert.equal(g.length, N);
  assert.ok(isValidSolution(g, N), `N=${N} solution must satisfy all axis lines`);
}
for (const N of [3, 4, 5]) check(N);
console.log('Task1 OK');

function rngSeq(seed) {
  let s = seed >>> 0;
  return () => (s = (1664525 * s + 1013904223) >>> 0) / 4294967296;
}

for (const N of [3, 4]) {
  const rng = rngSeq(42);
  const { puzzle, solution } = makePuzzle(N, 'normal', rng);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (let k = 0; k < N; k++) {
    if (puzzle[i][j][k] !== -1) assert.equal(puzzle[i][j][k], solution[i][j][k]);
  }
  assert.equal(countSolutions(puzzle, N, 2), 1, `N=${N} puzzle must be unique`);
  let blanks = 0;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (let k = 0; k < N; k++) if (puzzle[i][j][k] === -1) blanks++;
  assert.ok(blanks > 0, `N=${N} must have blanks`);
}
console.log('Task2 OK');
