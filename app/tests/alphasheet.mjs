// Render the letters and digits of both fonts as plain text lines for visual checking.
import { LCD } from '../src/core/lcd.js';
import { writePNG } from './png.mjs';
import { lcdToRGB } from './harness.mjs';
const l = new LCD(196 * 2, 120);
l.bigText('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 0, 0);
l.bigText('abcdefghijklmnopqrstuvwxyz+-×÷=()', 0, 16);
l.smallText('ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789 .,:+-', 0, 36);
l.smallText('abcdefghijklmnopqrstuvwxyz 𝑥𝑦𝑧 μεπσθλℏ₀₁₂', 0, 50);
l.tinyText('ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789', 0, 66);
l.tinyText('abcdefghijklmnopqrstuvwxyz 𝑥 .-+()', 0, 78);
l.bigText('2 Unknowns  Frequency  tan⁻¹(', 0, 92);
writePNG('tests/out/alphabet.png', l.w * 2, l.h * 2, lcdToRGB(l, 2));
