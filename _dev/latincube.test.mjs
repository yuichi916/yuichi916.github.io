import assert from 'node:assert';
import { makeSolution, isValidSolution } from './latincube.mjs';

function check(N) {
  const g = makeSolution(N, () => 0.5);
  assert.equal(g.length, N);
  assert.ok(isValidSolution(g, N), `N=${N} solution must satisfy all axis lines`);
}
for (const N of [3, 4, 5]) check(N);
console.log('Task1 OK');
