// Drive the calculator with key sequences and compare frames with the manual's screenshots.
import { Calculator } from '../src/core/calc.js';
import { APP_FACTORIES } from '../src/apps/index.js';
import { writePNG, readPNG } from './png.mjs';

export function newCalc() { return new Calculator({ apps: APP_FACTORIES }); }

export function press(calc, seq) {
  for (const k of seq.split(/\s+/).filter(Boolean)) calc.press(k);
  return calc;
}

export function frame(calc, blink = false) { calc.blink = blink; return calc.render(); }

const SHADE = [255, 170, 85, 0];
export function lcdToRGB(lcd, scale = 1) {
  const w = lcd.w * scale, h = lcd.h * scale;
  const out = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = SHADE[lcd.get(Math.floor(x / scale), Math.floor(y / scale))];
    out.set([v, v, v], (y * w + x) * 3);
  }
  return out;
}

export function loadNative(name) {
  const p = readPNG(new URL(`../../references/extract/native/${name}.png`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
  const lv = new Uint8Array(p.w * p.h);
  for (let i = 0; i < lv.length; i++) { const g = p.gray[i]; lv[i] = g <= 42 ? 3 : g <= 127 ? 2 : g <= 212 ? 1 : 0; }
  return { w: p.w, h: p.h, lv };
}

// returns {diff, png} ; writes side-by-side comparison (ours | official | diff) when out given
export function compare(lcd, name, out, opts = {}) {
  const ref = loadNative(name);
  // some manual screenshots are offset by one row (status icons on rows 1-7 instead of 2-8)
  let dy = opts.dy, dx = opts.dx || 0;
  if (dy === undefined) {
    let best = null;
    for (const cand of [0, -1, 1]) {
      let d = 0;
      for (let y = 0; y < 75; y++) for (let x = 0; x < 196; x++) {
        const ry = y + cand; const b = ry >= 0 && ry < ref.h ? ref.lv[ry * ref.w + x] : 0;
        if ((lcd.get(x, y) >= 2) !== (b >= 2)) d++;
      }
      if (best === null || d < best[0]) best = [d, cand];
    }
    dy = best[1];
  }
  let diff = 0;
  const sc = 3, W = 196, H = 75, gap = 6;
  const tw = (W * 3 + gap * 2) * sc, th = H * sc;
  const img = new Uint8Array(tw * th * 3).fill(230);
  const put = (ox, x, y, rgb) => { for (let j = 0; j < sc; j++) for (let i = 0; i < sc; i++) img.set(rgb, (((y * sc + j) * tw) + (ox + x) * sc + i) * 3); };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const a = lcd.get(x, y);
    const ry = y + dy, rx = x + dx;
    const b = ry >= 0 && ry < ref.h && rx >= 0 && rx < ref.w ? ref.lv[ry * ref.w + rx] : 0;
    const A = (a >= 2), B = (b >= 2);
    if (A !== B) diff++;
    put(0, x, y, [SHADE[a], SHADE[a], SHADE[a]]);
    put(W + gap, x, y, [SHADE[b], SHADE[b], SHADE[b]]);
    put(2 * (W + gap), x, y, A === B ? (A ? [120, 120, 120] : [255, 255, 255]) : (A ? [220, 0, 0] : [0, 90, 220]));
  }
  if (out) writePNG(out, tw, th, img);
  return diff;
}
