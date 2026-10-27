import { newCalc, press, frame } from './harness.mjs';
import { seqText, formatValue, formatComplex } from '../src/core/format.js';
const show = (c) => console.log(frame(c).toAscii().split('\n').filter(r=>r.trim()).join('\n'));
let c = newCalc();
press(c, 'HOME D4 D1 D2');  // Equation > Simul > 3 unknowns
press(c, 'D1 EXE NEG D1 EXE D1 EXE D2 EXE D1 EXE D1 EXE NEG D1 EXE D0 EXE NEG D1 EXE D1 EXE D1 EXE D4 EXE');
press(c, 'EXE');
console.log(c.app.solutions.map(s => s.label + seqText(formatValue(s.value, c.settings))));
c = newCalc();
press(c, 'HOME D4 D2 D1 D1 EXE D2 EXE NEG D2 EXE EXE');
console.log(c.app.solutions.map(s => (s.title||'') + ' ' + s.label + seqText(formatValue(s.value, c.settings))));
c = newCalc();
press(c, 'HOME D4 D2 D1 TOOLS D1 D1 D2 EXE D3 EXE D4 EXE EXE');
console.log(c.app.solutions.map(s => (s.title||'') + ' ' + s.label + seqText(s.value.re ? formatComplex(s.value, c.settings) : formatValue(s.value, c.settings))));
// Table: f(x)=x^2+1/2, start -1 end 1 step 0.5
c = newCalc();
press(c, 'HOME D3 TOOLS D2 D1 X SQR ADD D1 FRAC D2 EXE TOOLS D1 NEG D1 EXE D1 EXE D0 DOT D5 EXE OK');
console.log(c.app.rows.map(r => r.x.toString() + ' -> ' + seqText(formatValue(r.f, c.settings))));
