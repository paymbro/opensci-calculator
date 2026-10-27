import { newCalc, press, frame } from './harness.mjs';
import { seqText, formatValue, formatComplex } from '../src/core/format.js';
const P = (c) => c;
let c = newCalc();
press(c, 'HOME D5 D1 D3 D1 EXE D2 EXE NEG D3 EXE EXE'); // x^2+2x-3>=0
console.log('ineq', JSON.stringify(c.app.describe(), (k, v) => (v && v.dec ? v.dec.toString() : v)));
c = newCalc(); press(c, 'HOME ADD D1 D3 EXE D8 EXE D1 D2 EXE OK'); console.log('ratio', seqText(formatValue(c.app.x, c.settings)));
c = newCalc(); press(c, 'HOME ADD D1 D1 EXE D2 EXE D1 D0 EXE OK'); console.log('ratio2', seqText(formatValue(c.app.x, c.settings)));
c = newCalc(); press(c, 'HOME D7 LPAR D1 ADD SHIFT D9 RPAR POW D4 RIGHT ADD LPAR D1 SUB SHIFT D9 RPAR SQR EXE'); console.log('cplx', seqText(c.app.resultSeq(c.app.current())));
c = newCalc(); press(c, 'HOME D7 D2 CATALOG D1 D2 D4 D5 EXE'); console.log('cplx2', seqText(c.app.resultSeq(c.app.current())));
c = newCalc(); press(c, 'HOME D7 SQRT D2 RIGHT ADD SQRT D2 RIGHT SHIFT D9 EXE FMT2'); press(c, 'D4'); console.log('cplx3', seqText(c.app.resultSeq(c.app.current())));
c = newCalc(); press(c, 'HOME D6 D2 D1 D2 EXE D3 EXE D4 EXE D5 EXE OK D5 EXE D0 DOT D5 EXE OK'); console.log('dist', c.app.results.map(r=>r.dec.toSignificantDigits(10).toString()));
c = newCalc(); press(c, 'HOME D6 D3 D3 D6 EXE D3 D5 EXE D2 EXE OK'); console.log('npd', c.app.value.dec.toSignificantDigits(10).toString());
// matrix A=[[2,1],[1,1]] B=[[2,-1],[-1,2]] A*B
c = newCalc(); press(c, 'HOME D8 TOOLS D1 DOWN DOWN OK D2 EXE D1 EXE D1 EXE D1 EXE AC TOOLS D2 DOWN DOWN OK D2 EXE NEG D1 EXE NEG D1 EXE D2 EXE AC');
press(c, 'CATALOG D1 D1 MUL CATALOG D1 D2 EXE');
console.log('mat', c.mode, c.app.mode, c.calc ? '' : '', JSON.stringify(c.mem.mvars.MatAns && c.mem.mvars.MatAns.a.map(r=>r.map(x=>x.dec.toString()))));
