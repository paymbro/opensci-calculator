import { newCalc, press, frame, compare } from './harness.mjs';
import { formatBaseN } from '../src/apps/basen.js';
const run = (keys) => { const c = newCalc(); press(c, keys); const h = c.app.current(); return h ? formatBaseN(h.value, c.app.mode).lines.join(' / ') : 'none'; };
console.log(run('HOME MUL FORMAT FORMAT D1 D1 ADD D1 EXE'));           // binary 11+1
console.log(run('HOME MUL FORMAT D1 SHIFT D3 ADD D1 EXE'));             // hex 1F+1
console.log(run('HOME MUL CATALOG D2 D1 D1 D0 ADD CATALOG D2 D2 D1 D0 ADD CATALOG D2 D3 D1 D0 ADD CATALOG D2 D4 D1 D0 EXE'));
console.log(run('HOME MUL D1 D5 MUL D3 D7 EXE FORMAT'));
console.log(run('HOME MUL FORMAT FORMAT D1 D0 D1 D0 CATALOG D3 D3 D1 D1 D0 D0 EXE'));
console.log(run('HOME MUL FORMAT FORMAT CATALOG D3 D2 D1 D0 D1 D0 RPAR EXE'));
let c = newCalc(); press(c, 'HOME MUL FORMAT FORMAT D1 D1 ADD D1 EXE');
console.log('diff p152_4', compare(frame(c), 'p152_4', 'tests/out/p152_4.png'));
c = newCalc(); press(c, 'HOME MUL');
console.log('diff p151_5', compare(frame(c), 'p151_5', 'tests/out/p151_5.png'));
