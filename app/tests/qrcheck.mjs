import { encodeQR } from '../src/core/qr.js';
import { writePNG } from './png.mjs';
const cases = [['https://example.com/calc/', 3], ['https://example.com/calc/', 11], ['Hello calculator 1+2=3', 3], ['x'.repeat(200), 11]];
cases.forEach(([t, v], i) => {
  const g = encodeQR(t, v, v); const n = g.length, sc = 8, q = 4;
  const W = (n + 2 * q) * sc; const rgb = new Uint8Array(W * W * 3).fill(255);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (g[r][c]) for (let y = 0; y < sc; y++) for (let x = 0; x < sc; x++) rgb.set([0,0,0], (((r + q) * sc + y) * W + (c + q) * sc + x) * 3);
  writePNG(`tests/out/qr${i}.png`, W, W, rgb);
  console.log(i, 'version', v, 'modules', n);
});
