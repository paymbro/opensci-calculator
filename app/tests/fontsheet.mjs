import { BIG, SMALL } from '../src/core/fonts.js';
import { LCD } from '../src/core/lcd.js';
import { writePNG } from './png.mjs';
import { lcdToRGB } from './harness.mjs';
for (const [name, F, cw, ch] of [['big', BIG, 16, 18], ['small', SMALL, 12, 13]]) {
  const keys = Object.keys(F).sort();
  const cols = 16, rows = Math.ceil(keys.length / cols);
  const l = new LCD(cols * cw * 2, rows * (ch + 12));
  keys.forEach((k, i) => {
    const x = (i % cols) * cw * 2, y = Math.floor(i / cols) * (ch + 12);
    l.bitmap(F[k], x + 2, y + 1);
    l.smallText(k.codePointAt(0) > 0xe000 && k.codePointAt(0) < 0xf000 ? 'PU' : k, x + cw + 4, y + 2);
  });
  writePNG(`tests/out/font_${name}.png`, l.w * 3, l.h * 3, lcdToRGB(l, 3));
}
