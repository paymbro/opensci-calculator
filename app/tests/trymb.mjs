// Math Box result tables vs the User's Guide screenshots (p.136, p.139).
import { newCalc, press, frame, compare } from './harness.mjs';

const rowsFor = (counts) => counts.flatMap(([sum, n]) => Array.from({ length: n }, () => [sum >= 1 ? 1 : 0, sum >= 2 ? 1 : 0, sum >= 3 ? 1 : 0]));
const cases = [
  ['mb_dicelist', 'dice', 3, [[1, 6, 4], [4, 3, 6], [3, 5, 1], [1, 6, 6]], 'list'],
  ['mb_coinlist', 'coin', 3, [[0, 1, 1], [1, 1, 0], [0, 0, 1], [0, 0, 0]], 'list'],
  ['mb_coinfreq', 'coin', 3, rowsFor([[0, 31], [1, 90], [2, 95], [3, 34]]), 'heads'],
];
let tot = 0;
for (const [name, kind, n, rows, what] of cases) {
  const c = newCalc();
  press(c, 'HOME SUB');
  const app = c.app;
  app.result = { kind, n, rows };
  app.screen = what === 'list' ? app.listScreen(null) : app.freqScreen(null, what);
  c.overlays.length = 0;
  const d = compare(frame(c), name, `tests/out/${name}.png`);
  tot += d;
  console.log(name.padEnd(12), d);
}
console.log('total', tot);
