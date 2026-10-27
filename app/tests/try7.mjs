import { newCalc, press, frame, compare } from './harness.mjs';
const c = newCalc();
press(c, 'HOME DOWN DOWN DOWN OK'); // Spreadsheet (row 4 col 1)
console.log(c.appId);
press(c, 'D7 MUL D5 EXE D7 MUL D6 EXE SHIFT D4 D2 ADD D7 EXE');
press(c, 'UP UP UP RIGHT SHIFT LPAR SHIFT D4 D1 ADD D7 EXE');
press(c, 'LEFT DOWN DOWN SHIFT LPAR CATALOG D1 D7 SHIFT D4 D1 CATALOG D1 D3 SHIFT D4 D3 RPAR EXE');
const v = (r, col) => { const x = c.app.values[r][col]; return x && x.dec ? x.dec.toString() : String(x); };
console.log('A1..A4', v(0,0), v(1,0), v(2,0), v(3,0), 'B1', v(0,1));
// fill formula B1:B3 =2A1-3
press(c, 'UP UP UP UP RIGHT TOOLS D1 D2 SHIFT D4 D1 SUB D3 OK DOWN DEL D3 EXE OK');
console.log('B1..B3', v(0,1), v(1,1), v(2,1));
press(c, 'RIGHT TOOLS D2 SHIFT D5 D1 MUL D3 OK DOWN DEL D3 EXE OK');
console.log('C1..C3', v(0,2), v(1,2), v(2,2));
console.log('diff p134_29', compare(frame(c), 'p134_29', 'tests/out/p134_29.png'));
