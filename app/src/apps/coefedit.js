// Coefficient / element editor used by the Equation, Inequality, Ratio, Matrix and Vector apps:
// a grid of values shown in the small font, the highlighted cell inverted, the full value of the
// highlighted cell (or the expression being typed) on the bottom line in the big font.
import { LCD } from '../core/lcd.js';
import { Real, CalcError } from '../core/num.js';
import { Cx } from '../core/eval.js';
import { decimalSeq, formatValue } from '../core/format.js';
import { ValueInput, fmtSmall } from './widgets.js';
import { errorScreen, drawResult } from './common.js';
import { variableStoreScreen } from './statistics.js';

export class CoefEditor {
  // layout: { rows, cols, cellW, x0, y0, rowH, visibleCols, visibleRows, label(r,c) → suffix text, prefix(r,c), brace, title }
  constructor(calc, layout, values) {
    this.calc = calc;
    this.L = layout;
    this.values = values; // 2D array of Real
    this.r = 0; this.c = 0; this.left = 0; this.top = 0;
    this.editing = null;
  }

  get rows() { return this.values.length; }
  get cols() { return this.values[0].length; }

  ensure() {
    const vc = this.L.visibleCols || this.cols, vr = this.L.visibleRows || this.rows;
    if (this.c < this.left) this.left = this.c;
    if (this.c >= this.left + vc) this.left = this.c - vc + 1;
    if (this.r < this.top) this.top = this.r;
    if (this.r >= this.top + vr) this.top = this.r - vr + 1;
  }

  // returns true if handled; 'commit' callbacks via onChange
  key(k) {
    const calc = this.calc;
    if (this.editing) {
      if (k === 'EXE' || k === 'OK') {
        try {
          const v = this.editing.value();
          if (!(v instanceof Real) && !(this.L.complex && v instanceof Cx)) throw new CalcError('Math');
          this.values[this.r][this.c] = v;
          this.editing = null;
          this.advance();
        } catch (e) { calc.push(errorScreen(calc, e instanceof CalcError ? e : new CalcError('Math'), () => {})); }
        return true;
      }
      if (k === 'AC') { this.editing = null; return true; }
      if (k === 'BACK') { this.editing = null; return true; }
      this.editing.key(k);
      return true;
    }
    switch (k) {
      case 'UP': if (this.r > 0) this.r--; this.ensure(); return true;
      case 'DOWN': if (this.r < this.rows - 1) this.r++; this.ensure(); return true;
      case 'LEFT': if (this.c > 0) this.c--; this.ensure(); return true;
      case 'RIGHT': if (this.c < this.cols - 1) this.c++; this.ensure(); return true;
      case 'VARIABLE': calc.push(variableStoreScreen(calc, this.values[this.r][this.c])); return true;
      default: break;
    }
    if (/^(D\d|DOT|NEG|SUB|LPAR|ANS|PI|E|I|SQRT|FRAC|MIXED|ROOT|VA|VB|VC|VD|VE|VF|VX|VY|VZ|X|SIN|COS|TAN|ASIN|ACOS|ATAN|LOG|LN|LOGB)$/.test(k)) {
      this.editing = new ValueInput(calc, { firstKey: k, complex: !!this.L.complex });
      return true;
    }
    return false;
  }

  advance() {
    if (this.c < this.cols - 1) this.c++;
    else if (this.r < this.rows - 1) { this.r++; this.c = 0; }
    this.ensure();
  }

  clearAll(v = Real.int(0)) { this.values = this.values.map((row) => row.map(() => v)); }

  render(lcd, blink) {
    const L = this.L;
    const vc = L.visibleCols || this.cols, vr = L.visibleRows || this.rows;
    if (L.title) lcd.smallText(L.title, 3, 11);
    for (let i = 0; i < vr; i++) {
      const r = this.top + i;
      if (r >= this.rows) break;
      const y = L.y0 + i * L.rowH;
      for (let j = 0; j < vc; j++) {
        const c = this.left + j;
        if (c >= this.cols) break;
        const x = L.x0 + j * L.cellW;
        const v = this.values[r][c];
        const txt = v instanceof Cx ? fmtSmall(this.calc, v.re, 6) + (v.im.isZero() ? '' : '…') : fmtSmall(this.calc, v, L.digits || 6);
        const valueRight = x + L.cellW - (L.suffixW || 0) - 2;
        if (L.prefix) { const p = L.prefix(r, c); if (p) lcd.smallText(p, x, y); }
        lcd.smallText(txt, valueRight - LCD.smallWidth(txt), y);
        const suf = L.label ? L.label(r, c) : '';
        if (suf) lcd.smallText(suf, valueRight + 1, y);
        if (r === this.r && c === this.c && !this.editing) lcd.invert(x + (L.selX || 0), y - 1, L.cellW - (L.suffixW || 0) - (L.selX || 0), 11);
      }
    }
    if (L.brace) {
      const h = vr * L.rowH;
      if (L.brace === '{') {
        lcd.vline(L.x0 - 3, L.y0 + 1, h - 3, 3);
        lcd.set(L.x0 - 2, L.y0, 3); lcd.set(L.x0 - 2, L.y0 + h - 2, 3); lcd.set(L.x0 - 4, L.y0 + Math.floor(h / 2) - 1, 3);
      } else {
        lcd.vline(L.x0 - 4, L.y0 - 1, h, 3); lcd.vline(L.x0 - 3, L.y0 - 1, h, 3);
        lcd.hline(L.x0 - 4, L.y0 - 1, 4, 3); lcd.hline(L.x0 - 4, L.y0 + h - 2, 4, 3);
        const xr = L.x0 + vc * L.cellW;
        lcd.vline(xr + 1, L.y0 - 1, h, 3); lcd.vline(xr + 2, L.y0 - 1, h, 3);
        lcd.hline(xr - 1, L.y0 - 1, 4, 3); lcd.hline(xr - 1, L.y0 + h - 2, 4, 3);
      }
    }
    if (this.editing) this.editing.draw(lcd, blink, { top: 58 });
    else {
      const v = this.values[this.r][this.c];
      const S = { ...this.calc.settings, io: 'LineI/DecimalO' };
      drawResult(lcd, v instanceof Cx ? formatValue(v, S, 'dec') : decimalSeq(v.dec, this.calc.settings));
    }
  }
}
