import { newCalc, press, frame, compare } from './harness.mjs';
const cases = [
  ['p079_0', 'HOME D2 D1'], ['p079_1', 'HOME D2 D2'],
  ['p080_9', 'HOME D2 D2 D1 D7 D0 EXE D1 D7 D9 EXE D1 D7 D3 EXE RIGHT UP UP UP D6 D6 EXE D7 D5 EXE D6 D8 EXE'],
  ['p077_6', 'HOME D2 D1 OK'], ['p078_0', 'HOME D2 D2 OK'],
  ['p084_1', 'HOME D2 D2 OK D2'],
  ['p155_6', 'D1 D4 DIV D0 MUL D2 EXE'],
  ['p016_5', 'SETTINGS D2 D1'], ['p019_5', 'SETTINGS D2'], ['p024_3', 'SETTINGS'], ['p025_9', 'SETTINGS D1'], ['p025_13', 'SETTINGS D1 D1'],
  ['p031_11', 'CATALOG'], ['p032_7', 'SHIFT CATALOG'], ['p033_0', 'TOOLS'], ['p049_3', 'D3 DIV D2 EXE SHIFT FORMAT'],
  ['p045_0', 'VARIABLE'], ['p068_2', 'CATALOG D6'], ['p068_4', 'CATALOG D6 D1'], ['p069_3', 'CATALOG D7'],
  ['p072_1', 'FUNCTION'], ['p022_1', 'HOME'],
  ['p098_1', 'HOME D4'], ['p099_2', 'HOME D4 D1'], ['p101_0', 'HOME D4 D2'], ['p106_5', 'HOME D5'],
  ['p108_2', 'HOME D6'], ['p115_7', 'HOME D8'], ['p115_9', 'HOME D8 TOOLS'], ['p115_12', 'HOME D8 TOOLS D1'],
  ['p122_13', 'HOME D9'], ['p138_0', 'HOME SUB'], ['p129_13', 'HOME DOWN DOWN DOWN OK D7 MUL D5 EXE D7 MUL D6 EXE SHIFT D4 D2 ADD D7 EXE'],
  ['p151_5', 'HOME MUL'],
  ['p094_10', 'HOME D3'], ['p095_18', 'HOME D3 TOOLS D2 D1 X SQR ADD D1 FRAC D2 EXE TOOLS D1 NEG D1 EXE D1 EXE D0 DOT D5 EXE OK'],
  ['p108_10', 'HOME D6 D2 D1 D2 EXE D3 EXE D4 EXE D5 EXE'], ['p109_5', 'HOME D6 D2 D1 D2 EXE D3 EXE D4 EXE D5 EXE OK D5 EXE D0 DOT D5 EXE OK'],
];
let tot = 0;
for (const [n, k] of cases) {
  const c = newCalc(); if (k.startsWith('HOME')) { press(c, k); } else press(c, k);
  let d; try { d = compare(frame(c), n, `tests/out/${n}.png`); } catch (e) { d = 'ERR ' + e.message; }
  tot += typeof d === 'number' ? d : 0;
  console.log(n.padEnd(9), d);
}
console.log('total', tot);
