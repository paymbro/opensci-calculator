import { newCalc, press, frame, loadNative } from './harness.mjs';
const [name, keys, dyArg] = process.argv.slice(2);
const dy = +(dyArg || 0);
const c = newCalc(); press(c, keys);
const l = frame(c); const ref = loadNative(name);
for (let y = 0; y < 75; y++) {
  const ours = [], man = [];
  for (let x = 0; x < 196; x++) { if (l.get(x, y) >= 2) ours.push(x); if ((ref.lv[(y + dy) * ref.w + x] || 0) >= 2) man.push(x); }
  if (ours.join() !== man.join()) console.log(String(y).padStart(2), 'ours', ours.join(','), '\n   man ', man.join(','));
}
