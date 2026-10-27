import { loadNative } from './harness.mjs';
const [name, y0, y1] = process.argv.slice(2);
const r = loadNative(name);
const lit = (x, y) => r.lv[y * r.w + x] >= 2;
// vertical lines
const vl = []; for (let x = 0; x < 196; x++) { let c = 0; for (let y = 0; y < 75; y++) if (lit(x, y)) c++; if (c >= 35) vl.push(x + ':' + c); }
console.log('vlines', vl.join(' '));
for (let y = +(y0 || 0); y < +(y1 || 75); y++) { const xs = []; for (let x = 0; x < 196; x++) if (lit(x, y)) xs.push(x); 
  // compress runs
  const runs = []; let i = 0; while (i < xs.length) { let j = i; while (j + 1 < xs.length && xs[j + 1] === xs[j] + 1) j++; runs.push(xs[i] === xs[j] ? '' + xs[i] : xs[i] + '-' + xs[j]); i = j + 1; }
  if (runs.length) console.log(String(y).padStart(2), runs.join(' ')); }
