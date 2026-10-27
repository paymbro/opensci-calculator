import { newCalc, press, frame, compare } from './harness.mjs';
const c = newCalc();
press(c, 'HOME D2 D1');           // Statistics, 1-Variable
// x: 1..10 with freq 1,2,1,2,2,2,3,4,2,1
const xs = [1,2,3,4,5,6,7,8,9,10], fs=[1,2,1,2,2,2,3,4,2,1];
for (const x of xs) press(c, String(x).split('').map(d=>'D'+d).join(' ') + ' EXE');
press(c, 'RIGHT ' + 'UP '.repeat(10));
for (const f of fs) press(c, 'D'+f+' EXE');
let l = frame(c); console.log(l.toAscii().split('\n').slice(0,75).join('\n'));
press(c, 'OK D1');
l = frame(c); console.log(l.toAscii());
console.log(c.top() && c.top().rows);
