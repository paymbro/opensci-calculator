import { newCalc, press, frame, compare } from './harness.mjs';
const c = newCalc();
press(c, 'D7 MUL D8 SUB D4 MUL D5 EXE');
const lcd = frame(c);
console.log(lcd.toAscii().split('\n').slice(0, 75).join('\n'));
console.log('diff', compare(lcd, 'p037_8', 'tests/out_p037_8.png'));
