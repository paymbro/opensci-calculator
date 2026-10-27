// LCD framebuffer for the fx-991CW+ UK display.
// The official screenshots in the User's Guide are 196 x 75 pixels with four gray levels
// (0 = background, 1 = light gray, 2 = dark gray, 3 = black); this module draws into that grid.
import { BIG, SMALL } from './fonts.js';
import { ICONS } from './icons.js';
import { TINY, TINY_PITCH } from './tinyfont.js';

export const W = 196;
export const H = 75;
export const CELL = 11;       // big-font advance
export const LINE_H = 14;     // big-font cell height
export const SEP_GAP = 4;     // extra gap inserted by the digit separator (big font)
export const SMALL_SEP_GAP = 4;

const LEVEL = { ' ': 0, '.': 1, '+': 2, '#': 3 };

// Multi-code-point symbols drawn as single LCD glyphs (private-use code points in fonts.js)
export function normalize(str) {
  return str.replace(/⁻¹/gu, '').replace(/𝑥̄/gu, '').replace(/𝑦̄/gu, '').replace(/x̂|𝑥̂/gu, '').replace(/ŷ|𝑦̂/gu, '');
}

export class LCD {
  constructor(w = W, h = H) {
    this.w = w; this.h = h;
    this.px = new Uint8Array(w * h);
    this.ghost = new Uint8Array(w * h);   // faint "unlit indicator" pixels (status bar)
    this.ghostMode = false;
  }

  clear() { this.px.fill(0); this.ghost.fill(0); }

  set(x, y, v = 3) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    if (this.ghostMode) { if (v) this.ghost[y * this.w + x] = 1; return; }
    this.px[y * this.w + x] = v;
  }

  // draw with fn() into the ghost layer (shown faintly where nothing else is lit)
  ghostly(fn) { this.ghostMode = true; try { fn(); } finally { this.ghostMode = false; } }

  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.px[y * this.w + x];
  }

  fill(x, y, w, h, v = 3) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, v);
  }

  hline(x, y, w, v = 3) { this.fill(x, y, w, 1, v); }
  vline(x, y, h, v = 3) { this.fill(x, y, 1, h, v); }

  rect(x, y, w, h, v = 3) {
    this.hline(x, y, w, v); this.hline(x, y + h - 1, w, v);
    this.vline(x, y, h, v); this.vline(x + w - 1, y, h, v);
  }

  invert(x, y, w, h) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const xx = x + i, yy = y + j;
      if (xx < 0 || yy < 0 || xx >= this.w || yy >= this.h) continue;
      this.px[yy * this.w + xx] = 3 - this.px[yy * this.w + xx];
    }
  }

  // Draw a bitmap given as array of strings (levels ' ', '.', '+', '#').
  // opts.level overrides lit pixels' level, opts.inv draws inverted (clearing lit pixels),
  // opts.clip = {x0,x1} limits drawing horizontally.
  bitmap(rows, x, y, opts = {}) {
    const lvlOverride = opts.level;
    for (let j = 0; j < rows.length; j++) {
      const r = rows[j];
      for (let i = 0; i < r.length; i++) {
        const c = r[i];
        if (c === ' ') continue;
        const xx = x + i;
        if (opts.clip && (xx < opts.clip.x0 || xx > opts.clip.x1)) continue;
        let v = lvlOverride !== undefined ? (LEVEL[c] === 3 ? lvlOverride : Math.min(LEVEL[c], lvlOverride)) : LEVEL[c];
        if (opts.inv) v = 3 - v;
        this.set(xx, y + j, v);
      }
    }
  }

  icon(name, x, y, opts) {
    const b = ICONS[name];
    if (b) this.bitmap(b, x, y, opts);
  }

  // Big font text. Returns advance width. `sep` positions (indices before which to add the
  // digit-separator gap) can be passed as a Set.
  bigText(str, x, y, opts = {}) {
    let cx = x;
    const chars = Array.from(normalize(str));
    chars.forEach((ch, i) => {
      if (opts.sep && opts.sep.has(i)) cx += SEP_GAP;
      const g = BIG[ch] || BIG['?'];
      if (ch !== ' ') this.bitmap(g, cx, y, opts);
      cx += CELL;
    });
    return cx - x;
  }

  static bigWidth(str, sepCount = 0) {
    return Array.from(normalize(str)).length * CELL + sepCount * SEP_GAP;
  }

  // Small proportional font, 1 px spacing between glyphs.
  smallText(str, x, y, opts = {}) {
    let cx = x;
    const chars = Array.from(normalize(str));
    chars.forEach((ch, i) => {
      if (opts.sep && opts.sep.has(i)) cx += SMALL_SEP_GAP;
      const g = SMALL[ch] || SMALL['?'];
      if (ch !== ' ') this.bitmap(g, cx, y, opts);
      cx += (g[0] ? g[0].length : 3) + 1;
    });
    return cx - x;
  }

  static smallWidth(str, sepCount = 0) {
    let w = 0;
    for (const ch of Array.from(normalize(str))) {
      const g = SMALL[ch] || SMALL['?'];
      w += (g[0] ? g[0].length : 3) + 1;
    }
    return w + sepCount * SMALL_SEP_GAP;
  }

  // 5×7 monospaced table font (grids). Characters it lacks fall back to the small font.
  tinyText(str, x, y, opts = {}) {
    let cx = x;
    for (const ch of Array.from(normalize(str))) {
      const g = TINY[ch];
      if (g) { this.bitmap(g, cx, y, opts); cx += TINY_PITCH; } else if (ch === ' ') cx += TINY_PITCH;
      else { const s = SMALL[ch] || SMALL['?']; this.bitmap(s, cx, y - 1, opts); cx += (s[0] ? s[0].length : 3) + 1; }
    }
    return cx - x;
  }

  static tinyWidth(str) {
    let w = 0;
    for (const ch of Array.from(normalize(str))) {
      if (TINY[ch] || ch === ' ') w += TINY_PITCH;
      else { const s = SMALL[ch] || SMALL['?']; w += (s[0] ? s[0].length : 3) + 1; }
    }
    return w ? w - 1 : 0;   // ink width (no trailing gap)
  }

  // Copy a region from another LCD (sx,sy,w,h) to (dx,dy); zero pixels are copied too when opaque.
  blit(src, sx, sy, w, h, dx, dy, opaque = false) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const v = src.get(sx + i, sy + j);
      if (v || opaque) this.set(dx + i, dy + j, v);
    }
  }

  // Text dump for tests/debugging.
  toAscii() {
    const out = [];
    for (let y = 0; y < this.h; y++) {
      let s = '';
      for (let x = 0; x < this.w; x++) s += ' .+#'[this.px[y * this.w + x]];
      out.push(s);
    }
    return out.join('\n');
  }
}
