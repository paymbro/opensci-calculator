// Reusable app screens: parameter forms, result lists, table/grid editors, inline value editing.
import { LCD } from '../core/lcd.js';
import { BIG } from '../core/fonts.js';
import { LINE_TOP, drawScrollBar } from '../core/ui.js';
import { inputKey } from '../core/input.js';
import { CalcError, Real } from '../core/num.js';
import { decimalText } from '../core/format.js';
import { drawMathInput, drawLineInput, evaluate, errorScreen, globalMenus, specInsert, drawResult } from './common.js';
import { MenuScreen } from '../core/calc.js';

import { ARROW } from '../core/ui.js';
export const BULLET = BIG['◐'];

// ------------------------------------------------------------------ inline value editor
// Wraps an Editor for entering one numeric value (expressions allowed). Returns Real on commit.
export class ValueInput {
  constructor(calc, { firstKey, allowNeg = true, complex = false, math = null } = {}) {
    this.calc = calc;
    this.ed = calc.newEditor();
    if (math !== null) this.ed.math = math;
    this.complex = complex;
    this.state = {};
    if (firstKey) this.key(firstKey);
  }
  key(k) {
    if (['CATALOG', 'CATLIST', 'VARIABLE', 'FUNCTION'].includes(k)) {
      return globalMenus(this.calc, k, { insertSpec: (spec) => specInsert(this.ed, spec, this.calc) });
    }
    return inputKey(this.ed, k, { settings: this.calc.settings, allowI: this.complex });
  }
  value(extra = {}) {
    const r = evaluate(this.calc, this.ed, { complex: this.complex, ...extra });
    return r.value;
  }
  // draw on the bottom line (MathI natural input at y=58) or linear
  draw(lcd, blink, { top = 58, x = 3 } = {}) {
    if (this.ed.math) drawMathInput(lcd, this.ed, { x, top: Math.min(top, 75 - 14 - this.extraAsc()), blink, state: this.state });
    else drawLineInput(lcd, this.ed, { top, blink, maxLines: 1, state: this.state });
  }
  extraAsc() { return 0; }
}

export function fmtSmall(calc, v, maxLen = 10) {
  if (!(v instanceof Real)) return v === null || v === undefined ? '' : String(v);
  const S = { ...calc.settings, digitSep: false };
  let s = decimalText(v.dec, S, { kind: 'Norm', n: 1 });
  // grid cells cut long decimals to the cell width (manual p.109: 0.96875 is shown as 0.9687)
  const dot = s.indexOf('.');
  if (s.length > maxLen && !s.includes('×') && dot >= 0 && dot < maxLen - 1) s = s.slice(0, maxLen);
  if (s.length > maxLen) s = decimalText(v.dec, S, { kind: 'Sci', n: Math.max(1, maxLen - 5) });
  return s.replace('×10^', 'E');
}

// ------------------------------------------------------------------ parameter form
// fields: [{label, get(), set(v), kind:'menu'|'value'|'text', options:[[label,val]], width}]
// action: {label:'Execute'|'Confirm', run(), enabled()}
export class ParamForm {
  constructor(calc, { title = null, fields, action, onBack, labelWidth = null, statusFn, group = 'app', colon = ':' }) {
    Object.assign(this, { calc, title, fields, action, onBack, statusFn, group, colon });
    this.sel = 0;
    this.top = 0;
    this.editing = null;
    this.labelWidth = labelWidth ?? Math.max(...fields.map((f) => Array.from(f.label).length));
    this.rows = title ? 3 : 4;
  }
  get items() { return [...this.fields, { action: true }]; }
  status() { return this.statusFn ? this.statusFn() : null; }
  ensure() {
    if (this.sel < this.top) this.top = this.sel;
    if (this.sel >= this.top + this.rows) this.top = this.sel - this.rows + 1;
  }
  key(k) {
    const calc = this.calc;
    const items = this.items;
    const it = items[this.sel];
    if (this.editing) {
      if (k === 'EXE' || k === 'OK' || ((k === 'DOWN' || k === 'UP') && false)) {
        try {
          const v = this.editing.value();
          if (it.validate) it.validate(v);
          it.set(v);
          this.editing = null;
          this.sel = Math.min(this.sel + 1, items.length - 1);
          this.ensure();
        } catch (e) {
          calc.push(errorScreen(calc, e instanceof CalcError ? e : new CalcError('Math'), () => {}));
        }
        return true;
      }
      if (k === 'AC') { if (this.editing.ed.isEmpty()) this.editing = null; else this.editing.ed.clear(); return true; }
      if (k === 'BACK') { this.editing = null; return true; }
      this.editing.key(k);
      return true;
    }
    switch (k) {
      case 'UP': this.sel = (this.sel - 1 + items.length) % items.length; this.ensure(); return true;
      case 'DOWN': this.sel = (this.sel + 1) % items.length; this.ensure(); return true;
      case 'BACK': if (this.onBack) this.onBack(); return true;
      case 'OK': case 'EXE': case 'RIGHT':
        if (it.action) { if (k !== 'RIGHT' && (!this.action.enabled || this.action.enabled())) this.action.run(); return true; }
        if (it.kind === 'menu') {
          calc.push(new MenuScreen(calc, {
            group: this.group, items: it.options.map(([label, val]) => ({ label, radio: val === it.get() })),
            sel: Math.max(0, it.options.findIndex(([, v]) => v === it.get())),
            onSelect: (x, i) => { it.set(it.options[i][1]); calc.pop(); if (it.after) it.after(); },
            status: this.statusFn,
          }));
          return true;
        }
        if (it.kind === 'value' && k !== 'RIGHT') { this.editing = new ValueInput(calc, {}); return true; }
        return true;
      default: break;
    }
    if (it.kind === 'value' && /^(D\d|DOT|NEG|SUB|LPAR|ANS|PI|E|SQRT|FRAC|VA|VB|VC|VD|VE|VF|VX|VY|VZ|X)$/.test(k)) {
      this.editing = new ValueInput(calc, { firstKey: k });
      return true;
    }
    return false;
  }
  render(lcd, blink) {
    let line = 0;
    if (this.title) { lcd.bigText(this.title, 3, LINE_TOP(0)); line = 1; }
    const items = this.items;
    for (let r = 0; r < this.rows; r++) {
      const idx = this.top + r;
      if (idx >= items.length) break;
      const it = items[idx];
      const top = LINE_TOP(line + r);
      const hl = idx === this.sel;
      if (it.action) {
        const en = !this.action.enabled || this.action.enabled();
        lcd.bitmap(BULLET, 3, top, { level: en ? 3 : 2 });
        lcd.bigText(this.action.label, 14, top, { level: en ? 3 : 2 });
      } else {
        const label = it.label + ' '.repeat(Math.max(0, this.labelWidth - Array.from(it.label).length));
        lcd.bigText(label + this.colon, 3, top);
        if (!(this.editing && hl)) {
          const v = it.display ? it.display() : String(it.get() ?? '');
          lcd.bigText(v, 3 + (Array.from(label).length + 1) * 11, top);
        }
      }
      if (it.kind === 'menu') lcd.bitmap(ARROW, 180, top + 4, { level: 2 });
      if (hl) lcd.invert(2, top, 188, 15);
      if (hl && this.editing) {
        // inline editing on the selected line (cleared area after the colon)
        const x0 = 3 + (this.labelWidth + 1) * 11;
        lcd.fill(x0, top, 190 - x0, 15, 3);
        const tmp = new LCD(196, 75);
        this.editing.draw(tmp, blink, { top: top - 1, x: x0 });
        for (let yy = top; yy < top + 15; yy++) for (let xx = x0; xx < 190; xx++) if (tmp.get(xx, yy)) lcd.set(xx, yy, 0);
      }
    }
    if (items.length > this.rows) drawScrollBar(lcd, this.top, this.rows, items.length, this.title ? LINE_TOP(1) : 11);
  }
}

// ------------------------------------------------------------------ small-font result list
// rows: [[label, valueString]] ; shows 6 lines, scrollable with ▲▼
export class ResultList {
  constructor(calc, { rows, onBack, statusFn, header = null, valueX = 80 }) {
    Object.assign(this, { calc, rows, onBack, statusFn, header, valueX });
    this.top = 0;
    this.visible = header ? 5 : 6;
  }
  status() { return this.statusFn ? this.statusFn() : null; }
  key(k) {
    if (k === 'UP') { this.top = Math.max(0, this.top - 1); return true; }
    if (k === 'DOWN') { this.top = Math.min(Math.max(0, this.rows.length - this.visible), this.top + 1); return true; }
    if (k === 'PGUP') { this.top = Math.max(0, this.top - this.visible); return true; }
    if (k === 'PGDN') { this.top = Math.min(Math.max(0, this.rows.length - this.visible), this.top + this.visible); return true; }
    if (k === 'BACK' || k === 'AC' || k === 'OK' || k === 'EXE') { if (this.onBack) this.onBack(); return true; }
    return true;
  }
  render(lcd) {
    let y = 12;
    if (this.header) { lcd.smallText(this.header, 40, y); y += 10; }
    for (let i = 0; i < this.visible; i++) {
      const r = this.rows[this.top + i];
      if (!r) break;
      lcd.smallText(r[0], 40, y + i * 10);
      lcd.smallText('=' + r[1], this.valueX, y + i * 10);
    }
    if (this.rows.length > this.visible) drawScrollBar(lcd, this.top, this.visible, this.rows.length, 11);
  }
}

// ------------------------------------------------------------------ grid / table editor
// Spreadsheet-like table with numbered rows and named columns (Statistics, Table, Distribution,
// Math Box).  Geometry measured from the User's Guide screenshots (p.79-83, 94-95, 108-111, 137):
// grey column rules at x = 21 + 42·c spanning rows 11-58, headers on rows 12-18, data rows every
// 10 px from y=21, 5×7 table font right-aligned 4 px before the rule (row numbers end at x=19),
// selected cell = black bar from rule+3 to next rule-4, 8 rows high.
export const GRID_X0 = 21, GRID_CW = 42;
export class GridView {
  constructor({ cols, rowsVisible = 4, align = 'right', headerTop = 12, top = 11, headerDx = [] }) {
    Object.assign(this, { cols, rowsVisible, align, headerTop, gridTop: top, headerDx });
    this.row = 0; this.col = 0; this.top = 0;
  }
  ensure() {
    if (this.row < this.top) this.top = this.row;
    if (this.row >= this.top + this.rowsVisible) this.top = this.row - this.rowsVisible + 1;
  }
  colX(c) { return GRID_X0 + c * GRID_CW; }
  // getCell(r,c) → string ; rowCount ; header labels
  draw(lcd, { rowCount, getCell, headers, selVisible = true, firstRow = 1, numbers = true }) {
    const y0 = this.gridTop;
    const centre = (t, L) => L + 1 + Math.floor((GRID_CW - 1 - LCD.tinyWidth(t)) / 2);
    headers.forEach((h, c) => lcd.tinyText(h, centre(h, this.colX(c)) + (this.headerDx[c] || 0), this.headerTop));
    for (let i = 0; i < this.rowsVisible; i++) {
      const r = this.top + i;
      const y = y0 + 10 + i * 10;
      if (numbers) { const num = String(r + firstRow); lcd.tinyText(num, GRID_X0 - 1 - LCD.tinyWidth(num), y); }
      for (let c = 0; c < this.cols; c++) {
        const L = this.colX(c);
        const txt = r < rowCount ? getCell(r, c) : '';
        if (txt) lcd.tinyText(txt, this.align === 'center' ? centre(txt, L) : L + GRID_CW - 3 - LCD.tinyWidth(txt), y);
        if (selVisible && r === this.row && c === this.col) lcd.invert(L + 3, y, GRID_CW - 6, 8);
      }
    }
    for (let c = 0; c <= this.cols; c++) lcd.vline(this.colX(c), y0, 10 * (this.rowsVisible + 1) - 2, 2);
  }
}

export { drawResult, ARROW };
