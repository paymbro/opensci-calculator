import { newCalc, press, frame, loadNative } from './harness.mjs';
const [name, keys, y0, y1, x0, x1] = process.argv.slice(2);
const c = newCalc(); press(c, keys); const lcd = frame(c);
const ref = loadNative(name);
const ch = (v) => ' .+#'[v];
let hdr = ''; for (let x = +x0; x < +x1; x++) hdr += x % 10;
console.log('    ' + hdr + '   ' + hdr);
for (let y = +y0; y < +y1; y++) {
  let a = '', b = '';
  for (let x = +x0; x < +x1; x++) { a += ch(lcd.get(x, y)); b += ch(ref.lv[y * ref.w + x]); }
  console.log(String(y).padStart(3) + ' ' + a + ' | ' + b);
}
