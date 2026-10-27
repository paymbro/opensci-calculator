// Random key fuzzing across all apps: no key sequence may throw an exception or crash rendering.
import { newCalc, frame } from './harness.mjs';
import { KEY_IDS } from '../src/core/keys.js';
let seed = 12345;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const apps = ['D1','D2','D3','D4','D5','D6','D7','D8','D9','D0','ADD','SUB','MUL'];
let fails = 0;
for (let a = 0; a < apps.length; a++) {
  for (let run = 0; run < 25; run++) {
    const c = newCalc();
    const keys = ['HOME', apps[a]];
    try {
      c.press('HOME'); c.press(apps[a]);
      for (let i = 0; i < 120; i++) {
        let k = KEY_IDS[Math.floor(rnd() * KEY_IDS.length)];
        if (k === 'ON' || k === 'HOME' || (k === 'AC' && rnd() < 0.5)) k = 'EXE';
        keys.push(k);
        c.press(k);
        frame(c, i % 2 === 0);
      }
    } catch (e) {
      fails++;
      if (fails < 15) console.log('FAIL app', apps[a], e.stack.split('\n').slice(0, 4).join(' | '), '\n keys:', keys.slice(-12).join(' '));
    }
  }
}
console.log('fails', fails);
