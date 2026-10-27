import { newCalc, press, frame, compare } from './harness.mjs';
const cases = [
  ['p037_8', 'D7 MUL D8 SUB D4 MUL D5 EXE'],
  ['p043_6', 'D2 ADD D2 EXE'],
  ['p043_9', 'D2 ADD D2 EXE D3 ADD D3 EXE'],
  ['p043_11', 'D2 ADD D2 EXE D3 ADD D3 EXE UP'],
  ['p043_20', 'D4 MUL D3 ADD D2 EXE'],
  ['p044_5', 'D4 MUL D3 ADD D2 EXE LEFT DEL DEL SUB D7 EXE'],
  ['p044_19', 'D3 MUL D4 EXE DIV D3 D0 EXE'],
  ['p044_27', 'D1 D2 D3 ADD D4 D5 D6 EXE D7 D8 D9 SUB ANS EXE'],
  ['p038_12', 'D2 FRAC D3 RIGHT ADD SHIFT FRAC D1 RIGHT D1 DOWN D2 EXE'],
  ['p039_20', 'LPAR D5 SQR RPAR POW D3 EXE'],
  ['p039_27', 'LPAR D1 ADD D1 RPAR POW D2 ADD D2 EXE'],
  ['p039_32', 'SQRT D2 RIGHT MUL D3 EXE'],
  ['p040_10', 'SHIFT SQRT D5 RIGHT D3 D2 EXE'],
  ['p040_21', 'D1 D0 SHIFT POW EXE'],
  ['p048_10', 'D2 MUL SQRT D2 EXE'],
  ['p048_12', 'D2 MUL SQRT D2 EXE FORMAT'],
  ['p050_13', 'D3 DIV D2 EXE'],
  ['p051_11', 'SHIFT D7 DIV D6 EXE FORMAT'],
  ['p051_4', 'SHIFT D7 DIV D6 EXE'],
  ['p052_10', 'D2 D0 D3 D6 D1 D6 D2 EXE'],
];
let total = 0;
for (const [name, keys] of cases) {
  const c = newCalc();
  press(c, keys);
  const d = compare(frame(c), name, `tests/out/${name}.png`);
  total += d;
  console.log(name.padEnd(10), String(d).padStart(5));
}
console.log('total', total);
