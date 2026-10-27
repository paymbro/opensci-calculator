// Spreadsheet app (User's Guide p.127-134): 45 rows × 5 columns (A1:E45), constants and formulas
// with relative/absolute references, Grab, Min/Max/Mean/Sum, fill, cut/copy & paste, Auto Calc.
import { Editor, cloneSeq, tok } from '../core/expr.js';
import { inputKey, insertCatalogItem } from '../core/input.js';
import { CalcError, Real } from '../core/num.js';
import { parseSeq } from '../core/parser.js';
import { Evaluator } from '../core/eval.js';
import { MenuScreen } from '../core/calc.js';
import { LCD } from '../core/lcd.js';
import { decimalSeq } from '../core/format.js';
import { COMMON, SPREADSHEET_CAT } from '../core/catalog.js';
import { tokenText } from '../core/render.js';
import { fmtSmall, ParamForm } from './widgets.js';
import { errorScreen, evalContext, globalMenus, drawResult, specInsert, cut } from './common.js';
import { variableStoreScreen } from './statistics.js';

const ROWS = 45, COLS = 5, LETTERS = 'ABCDE';
const CAPACITY = 2380;

function parseRef(ref) {
  const m = /^(\$?)([A-E])(\$?)(\d+)$/.exec(ref);
  if (!m) return null;
  return { absC: !!m[1], c: LETTERS.indexOf(m[2]), absR: !!m[3], r: parseInt(m[4], 10) - 1 };
}

// shift relative references in a token sequence by (dr, dc); out-of-range references become '?'
export function shiftRefs(seq, dr, dc) {
  const out = [];
  for (let i = 0; i < seq.length; i++) {
    const t = seq[i];
    if (t.k !== 't') { out.push(t); continue; }
    // collect a reference: [$]L[$]digits
    let j = i, ref = '';
    if (seq[j] && seq[j].v === '$') { ref += '$'; j++; }
    if (seq[j] && seq[j].k === 't' && /^[A-E]$/.test(seq[j].v)) {
      ref += seq[j].v; j++;
      if (seq[j] && seq[j].v === '$') { ref += '$'; j++; }
      let digits = '';
      while (seq[j] && seq[j].k === 't' && /^\d$/.test(seq[j].v)) { digits += seq[j].v; j++; }
      if (digits) {
        const p = parseRef(ref + digits);
        let c = p.c + (p.absC ? 0 : dc), r = p.r + (p.absR ? 0 : dr);
        const bad = c < 0 || c >= COLS || r < 0 || r >= ROWS;
        const s = (p.absC ? '$' : '') + (bad && !p.absC ? '?' : LETTERS[c]) + (p.absR ? '$' : '') + (bad && !p.absR ? '?' : String(r + 1));
        for (const ch of Array.from(s)) out.push(tok(ch));
        i = j - 1;
        continue;
      }
    }
    out.push(t);
  }
  return out;
}

export class SpreadsheetApp {
  constructor(calc) {
    this.calc = calc;
    const st = calc.mem.appState.sheet || {};
    this.autoCalc = st.autoCalc !== false;
    this.showCell = st.showCell || 'formula';
    this.start();
  }
  start() {
    this.cells = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    this.values = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    this.r = 0; this.c = 0; this.top = 0; this.left = 0;
    this.ed = null; this.grab = null; this.paste = null;
  }
  powerOn() { this.start(); }
  off() { this.start(); }
  save() { this.calc.mem.appState.sheet = { autoCalc: this.autoCalc, showCell: this.showCell }; }
  status() { return { angle: this.calc.settings.angle, fix: this.calc.settings.numFormat.kind === 'Fix', sci: this.calc.settings.numFormat.kind === 'Sci' }; }

  usedBytes() {
    let n = 0;
    for (const row of this.cells) for (const cell of row) {
      if (!cell) continue;
      n += cell.formula ? cell.seq.length + 15 : 14;
    }
    return n;
  }

  ensure() {
    if (this.r < this.top) this.top = this.r;
    if (this.r > this.top + 3) this.top = this.r - 3;
    if (this.c < this.left) this.left = this.c;
    if (this.c > this.left + 3) this.left = this.c - 3;
  }

  // ---------------------------------------------------------------- evaluation
  cellValue(r, c, stack = []) {
    const cell = this.cells[r][c];
    if (!cell) return Real.int(0);
    if (!cell.formula) return cell.value;
    const key = r * COLS + c;
    if (stack.includes(key)) throw new CalcError('Circular');
    if (stack.length > 60) throw new CalcError('Memory');
    return this.evalSeq(cell.seq, [...stack, key]);
  }

  evalSeq(seq, stack = []) {
    const ast = parseSeq(seq, { cells: true });
    const app = this;
    const ctx = evalContext(this.calc, {
      cell: (ref) => {
        const p = parseRef(ref);
        if (!p || p.r >= ROWS) throw new CalcError('Math');
        return app.cellValue(p.r, p.c, stack);
      },
      cellRange: (fn, from, to) => {
        const a = parseRef(from), b = parseRef(to);
        if (!a || !b) throw new CalcError('Syntax');
        const vals = [];
        for (let r = Math.min(a.r, b.r); r <= Math.max(a.r, b.r); r++) {
          for (let c = Math.min(a.c, b.c); c <= Math.max(a.c, b.c); c++) if (app.cells[r][c]) vals.push(app.cellValue(r, c, stack));
        }
        if (!vals.length) throw new CalcError('Math');
        if (fn === 'Sum') return vals.reduce((s, v) => s.add(v), Real.int(0));
        if (fn === 'Mean') return vals.reduce((s, v) => s.add(v), Real.int(0)).div(Real.int(vals.length));
        if (fn === 'Min') return vals.reduce((m, v) => (v.cmp(m) < 0 ? v : m));
        return vals.reduce((m, v) => (v.cmp(m) > 0 ? v : m));
      },
    });
    const v = new Evaluator(ctx).ev(ast);
    if (!(v instanceof Real)) throw new CalcError('Math');
    return v;
  }

  recalcAll() {
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const cell = this.cells[r][c];
      if (!cell) { this.values[r][c] = null; continue; }
      if (!cell.formula) { this.values[r][c] = cell.value; continue; }
      try { this.values[r][c] = this.cellValue(r, c); } catch (e) { this.values[r][c] = 'ERROR'; }
    }
  }

  // store the editor content into (r, c)
  commit(r, c, seq) {
    const calc = this.calc;
    if (!seq.length) return true;
    const isFormula = seq[0].k === 't' && seq[0].v === '=';
    let cell;
    if (isFormula) {
      if (seq.length - 1 > 49) throw new CalcError('Memory');
      cell = { formula: true, seq: cloneSeq(seq.slice(1)) };
      // validate syntax / circularity now
      const prev = this.cells[r][c];
      this.cells[r][c] = cell;
      try { this.cellValue(r, c); } catch (e) {
        if (e.kind === 'Circular' || e.kind === 'Syntax' || e.kind === 'Memory') { this.cells[r][c] = prev; throw e; }
      }
    } else {
      if (seq.length > 49) throw new CalcError('Memory');
      let v = this.evalSeq(seq);
      // constants keep 10 significant digits when 11 or more were entered
      v = new Real(v.dec.toSignificantDigits(10), v.ex);
      cell = { formula: false, value: v };
      this.cells[r][c] = cell;
    }
    if (this.usedBytes() > CAPACITY) { this.cells[r][c] = null; throw new CalcError('Memory'); }
    if (this.autoCalc) this.recalcAll(); else this.values[r][c] = cell.formula ? this.safeValue(r, c) : cell.value;
    void calc;
    return true;
  }

  safeValue(r, c) { try { return this.cellValue(r, c); } catch (e) { return 'ERROR'; } }

  cellText(r, c) {
    const cell = this.cells[r][c];
    if (!cell) return [];
    if (cell.formula) return [tok('='), ...cloneSeq(cell.seq)];
    const t = cell.value.dec.toSignificantDigits(10).toString().replace('e+', 'e').replace('-', '(-)');
    const out = [];
    for (const ch of t.match(/\(-\)|./g)) out.push(tok(ch === 'e' ? '⏨' : ch));
    return out;
  }

  // ---------------------------------------------------------------- keys
  key(k) {
    const calc = this.calc;
    if (this.grab) { this.grabKey(k); return; }
    if (this.ed) { this.editKey(k); return; }
    if (this.paste) {
      if (k === 'OK' || k === 'EXE') { this.doPaste(); return; }
      if (k === 'BACK' || k === 'AC') { this.paste = null; return; }
    }
    switch (k) {
      case 'UP': if (this.r > 0) this.r--; this.ensure(); return;
      case 'DOWN': if (this.r < ROWS - 1) this.r++; this.ensure(); return;
      case 'LEFT': if (this.c > 0) this.c--; this.ensure(); return;
      case 'RIGHT': if (this.c < COLS - 1) this.c++; this.ensure(); return;
      case 'PGUP': this.r = Math.max(0, this.r - 4); this.ensure(); return;
      case 'PGDN': this.r = Math.min(ROWS - 1, this.r + 4); this.ensure(); return;
      case 'DEL': this.cells[this.r][this.c] = null; if (this.autoCalc) this.recalcAll(); else this.values[this.r][this.c] = null; return;
      case 'OK': this.startEdit(true); return;
      case 'TOOLS': this.tools(); return;
      case 'VARIABLE': { const v = this.values[this.r][this.c]; calc.push(variableStoreScreen(calc, v instanceof Real ? v : null)); return; }
      case 'SETTINGS': globalMenus(calc, k, this); return;
      case 'AC': case 'BACK': case 'EXE': case 'FORMAT': return;
      default: break;
    }
    if (k === 'CATALOG' || k === 'CATLIST') { this.startEdit(false); this.editKey(k); return; }
    // any input key starts a new entry
    const probe = new Editor({ math: false });
    if (inputKey(probe, k, { settings: calc.settings }) && probe.root.length) {
      this.startEdit(false);
      this.editKey(k);
    }
  }

  startEdit(existing) {
    this.ed = new Editor({ math: false });
    if (existing) { this.ed.setFrom(this.cellText(this.r, this.c)); }
  }

  editKey(k) {
    const calc = this.calc;
    const ed = this.ed;
    if (k === 'EXE') {
      try {
        this.commit(this.r, this.c, ed.root);
        this.ed = null;
        if (this.r < ROWS - 1) this.r++;
        this.ensure();
      } catch (e) {
        if (!(e instanceof CalcError)) e = new CalcError('Math');
        calc.push(errorScreen(calc, e, () => {}));
      }
      return;
    }
    if (k === 'AC' || k === 'BACK') { this.ed = null; return; }
    if (k === 'CATALOG' || k === 'CATLIST') {
      globalMenus(calc, k, { insertSpec: (spec) => {
        if (spec.grab) { this.grab = { r: this.r, c: this.c }; return; }
        specInsert(ed, spec, calc);
      } }, { catalog: [SPREADSHEET_CAT, ...COMMON] });
      return;
    }
    if (k === 'VARIABLE' || k === 'FUNCTION') { globalMenus(calc, k, { insertSpec: (spec) => specInsert(ed, spec, calc) }); return; }
    if (k === 'UP' || k === 'DOWN') return;
    inputKey(ed, k, { settings: calc.settings, allowEq: true });
  }

  grabKey(k) {
    const g = this.grab;
    switch (k) {
      case 'UP': if (g.r > 0) g.r--; return;
      case 'DOWN': if (g.r < ROWS - 1) g.r++; return;
      case 'LEFT': if (g.c > 0) g.c--; return;
      case 'RIGHT': if (g.c < COLS - 1) g.c++; return;
      case 'OK': case 'EXE':
        for (const ch of Array.from(LETTERS[g.c] + String(g.r + 1))) this.ed.insertToken(ch);
        this.grab = null;
        return;
      case 'AC': case 'BACK': this.grab = null; return;
      default: return;
    }
  }

  doPaste() {
    const p = this.paste;
    const src = p.cell;
    let cell = null;
    if (src) cell = src.formula ? { formula: true, seq: p.cut ? cloneSeq(src.seq) : shiftRefs(src.seq, this.r - p.r, this.c - p.c) } : { formula: false, value: src.value };
    this.cells[this.r][this.c] = cell;
    if (p.cut) { if (!(this.r === p.r && this.c === p.c)) this.cells[p.r][p.c] = null; this.paste = null; }
    else if (this.r < ROWS - 1) this.r++;
    this.ensure();
    if (this.autoCalc) this.recalcAll(); else this.values[this.r][this.c] = cell ? this.safeValue(this.r, this.c) : null;
  }

  tools() {
    const calc = this.calc, g = 'sheettools';
    const fill = (formula) => {
      const st = { expr: new Editor({ math: false }), range: LETTERS[this.c] + (this.r + 1) + ':' + LETTERS[this.c] + (this.r + 1) };
      const exprField = {
        label: formula ? 'Form' : 'Value', kind: 'text',
        display: () => (formula ? '=' : '') + st.expr.root.map((t) => tokenText(t.v)).join(''),
        get: () => st.expr,
      };
      const rangeField = { label: 'Range', kind: 'text', display: () => st.range, get: () => st.range };
      const form = new FillForm(calc, this, formula, st, [exprField, rangeField], () => calc.pop());
      form.group = g;
      calc.push(form);
    };
    const items = [
      { label: 'Fill Formula' }, { label: 'Fill Value' }, { label: 'Edit Cell' }, { label: 'Cut & Paste' }, { label: 'Copy & Paste' },
      { label: 'Delete All' }, { label: 'Recalculate' }, { label: 'Available Memory' }, { label: 'Auto Calc', sub: true }, { label: 'Show Cell', sub: true },
    ];
    calc.push(new MenuScreen(calc, {
      group: g, items,
      onSelect: (it, i) => {
        switch (i) {
          case 0: fill(true); break;
          case 1: fill(false); break;
          case 2: calc.closeGroup(g); this.startEdit(true); break;
          case 3: calc.closeGroup(g); this.paste = { cut: true, r: this.r, c: this.c, cell: this.cells[this.r][this.c] }; break;
          case 4: calc.closeGroup(g); this.paste = { cut: false, r: this.r, c: this.c, cell: this.cells[this.r][this.c] }; break;
          case 5: calc.closeGroup(g); this.start(); break;
          case 6: calc.closeGroup(g); this.recalcAll(); break;
          case 7: calc.push({ group: g, key: (k) => { if (['BACK', 'OK', 'EXE'].includes(k)) calc.pop(); return true; }, render: (lcd) => {
            lcd.bigText('Available Memory', 3, 11);
            const t = String(CAPACITY - this.usedBytes()) + 'bytes';
            lcd.bigText(t, 195 - LCD.bigWidth(t), 43);
          } }); break;
          case 8: calc.push(new MenuScreen(calc, { group: g, items: [{ label: 'On', radio: this.autoCalc }, { label: 'Off', radio: !this.autoCalc }], onSelect: (x, j) => { this.autoCalc = j === 0; this.save(); calc.closeGroup(g); } })); break;
          case 9: calc.push(new MenuScreen(calc, { group: g, items: [{ label: 'Formula', radio: this.showCell === 'formula' }, { label: 'Value', radio: this.showCell === 'value' }], onSelect: (x, j) => { this.showCell = j === 0 ? 'formula' : 'value'; this.save(); calc.closeGroup(g); } })); break;
          default: break;
        }
      },
      status: () => this.status(),
    }));
  }

  // ---------------------------------------------------------------- render
  render(lcd, blink) {
    const sel = this.grab ? this.grab : { r: this.r, c: this.c };
    // header and grid, measured from the User's Guide (p.129): 41-px cells starting at x=22 with
    // 1-px separators, header row y=11-19, data rows 10 px apart from y=20, row numbers in x=2-21
    lcd.vline(21, 11, 9, 2);
    lcd.fill(2, 19, 20, 1, 2);
    for (let j = 0; j < 4; j++) {
      const c = this.left + j;
      const x = 22 + j * 42;
      lcd.fill(x, 11, 41, 9, c === sel.c ? 3 : 2);
      lcd.vline(x + 41, 11, 9, 1);
      lcd.tinyText(LETTERS[c], x + 19, 12, { level: 0 });
    }
    lcd.fill(190, 11, 4, 9, 2);
    for (let i = 0; i < 4; i++) {
      const r = this.top + i;
      const y = 20 + i * 10;
      const cur = r === sel.r;
      lcd.fill(2, y, 20, 9, cur ? 3 : 2);
      const num = String(r + 1);
      lcd.tinyText(num, 20 - LCD.tinyWidth(num), y + 1, { level: 0 });
      if (i < 3) { lcd.hline(2, y + 9, 20, 1); lcd.hline(22, y + 9, 172, 2); }
      for (let j = 0; j < 4; j++) {
        const c = this.left + j;
        const x = 22 + j * 42;
        lcd.vline(x + 41, y, 9, 2);
        const v = this.values[r][c];
        const isSel = cur && c === sel.c;
        if (isSel) lcd.fill(x, y, 41, 9, 3);
        if (v !== null && v !== undefined) {
          const t = v === 'ERROR' ? 'ERROR' : fmtSmall(this.calc, v, 6);
          lcd.tinyText(t, x + 38 - LCD.tinyWidth(t), y + 1, { level: isSel ? 0 : 3 });
        }
      }
    }
    // bottom line
    if (this.grab) { lcd.bigText('Set:[OK]', 3, 59); return; }
    if (this.paste && !this.ed) { lcd.bigText('Paste:[OK]', 3, 59); return; }
    if (this.ed) {
      const text = this.ed.root.map((t) => tokenText(t.v)).join('');
      let ci = 0;
      for (let i = 0; i < this.ed.i; i++) ci += Array.from(tokenText(this.ed.root[i].v)).length;
      const off = Math.max(0, ci - 16);
      lcd.bigText(cut(text, off, off + 17), 3, 59);
      if (blink !== false) lcd.fill(3 + (ci - off) * 11, 60, 3, 13, 3);
      return;
    }
    const cell = this.cells[this.r][this.c];
    if (!cell) return;
    if (cell.formula && this.showCell === 'formula') {
      const text = '=' + cell.seq.map((t) => tokenText(t.v)).join('');
      lcd.bigText(cut(text, 0, 17), 195 - LCD.bigWidth(cut(text, 0, 17)), 59);
    } else {
      const v = this.values[this.r][this.c];
      if (v instanceof Real) drawResult(lcd, decimalSeq(v.dec, this.calc.settings));
      else if (v === 'ERROR') lcd.bigText('ERROR', 140, 59);
    }
  }
}

// Fill Formula / Fill Value form
class FillForm {
  constructor(calc, sheet, formula, st, fields, onBack) {
    Object.assign(this, { calc, sheet, formula, st, fields, onBack });
    this.sel = 0;
    this.editing = null;
  }
  key(k) {
    const calc = this.calc;
    if (this.editing !== null) {
      const ed = this.editing;
      if (k === 'EXE' || k === 'OK') {
        if (this.sel === 1) this.st.range = ed.root.map((t) => t.v).join('');
        this.editing = null;
        if (k === 'EXE') this.sel = Math.min(this.sel + 1, 2);   // OK confirms in place, EXE also moves down
        return true;
      }
      if (k === 'AC') { ed.clear(); return true; }
      if (k === 'BACK') { this.editing = null; return true; }
      if (k === 'CATALOG' || k === 'CATLIST') { globalMenus(calc, k, { insertSpec: (spec) => specInsert(ed, spec, calc) }, { catalog: [SPREADSHEET_CAT, ...COMMON] }); return true; }
      inputKey(ed, k, { settings: calc.settings });
      return true;
    }
    if (k === 'UP') { this.sel = (this.sel + 2) % 3; return true; }
    if (k === 'DOWN') { this.sel = (this.sel + 1) % 3; return true; }
    if (k === 'BACK') { this.onBack(); return true; }
    if (k === 'OK' || k === 'EXE') {
      if (this.sel === 2) { this.apply(); return true; }
      this.editing = this.sel === 0 ? this.st.expr : (() => { const e = new Editor({ math: false }); e.setFrom(Array.from(this.st.range).map((ch) => tok(ch))); return e; })();
      return true;
    }
    if (this.sel < 2) {
      this.editing = this.sel === 0 ? this.st.expr : (() => { const e = new Editor({ math: false }); e.setFrom(Array.from(this.st.range).map((ch) => tok(ch))); return e; })();
      if (k !== 'DEL' && this.sel === 1) this.editing.clear();
      return this.key(k);
    }
    return false;
  }
  apply() {
    const calc = this.calc, sh = this.sheet;
    const m = /^([A-E])(\d+):([A-E])(\d+)$/.exec(this.st.range);
    if (!m) { calc.push(errorScreen(calc, new CalcError('Range ERROR'), () => {})); return; }
    const c1 = 'ABCDE'.indexOf(m[1]), r1 = parseInt(m[2], 10) - 1, c2 = 'ABCDE'.indexOf(m[3]), r2 = parseInt(m[4], 10) - 1;
    if (r1 < 0 || r2 >= ROWS || r1 > r2 || c1 > c2) { calc.push(errorScreen(calc, new CalcError('Range ERROR'), () => {})); return; }
    try {
      const base = cloneSeq(this.st.expr.root);
      for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) {
        const seq = shiftRefs(base, r - r1, c - c1);
        if (this.formula) sh.commit(r, c, [tok('='), ...seq]);
        else sh.commit(r, c, seq);
      }
      calc.closeGroup(this.group);
    } catch (e) { calc.push(errorScreen(calc, e instanceof CalcError ? e : new CalcError('Math'), () => {})); }
  }
  render(lcd, blink) {
    lcd.bigText(this.formula ? 'Fill Formula' : 'Fill Value', 3, 11);
    this.fields.forEach((f, i) => {
      const top = 27 + 16 * i;
      lcd.bigText(f.label.padEnd(5, ' ') + ':', 3, top);
      if (this.editing && this.sel === i) {
        const ed = this.editing;
        const text = (i === 0 && this.formula ? '=' : '') + ed.root.map((t) => tokenText(t.v)).join('');
        lcd.bigText(cut(text, 0, 10), 3 + 6 * 11, top);
        if (blink !== false) { let ci = (i === 0 && this.formula ? 1 : 0); for (let q = 0; q < ed.i; q++) ci += Array.from(tokenText(ed.root[q].v)).length; lcd.fill(3 + (6 + Math.min(ci, 10)) * 11, top + 1, 3, 13, 3); }
      } else lcd.bigText(cut(f.display(), 0, 10), 3 + 6 * 11, top);
      if (this.sel === i && !this.editing) lcd.invert(2, top, 188, 15);
    });
    const top = 59;
    lcd.bitmap(['   #####   ', '  #######  ', ' ### ##### ', ' ###  #### ', ' ###   ### ', ' ###  #### ', ' ### ##### ', '  #######  ', '   #####   '], 2, top + 3);
    lcd.bigText('Confirm', 14, top);
    if (this.sel === 2) lcd.invert(2, top, 188, 15);
  }
}

export const makeSpreadsheet = (calc) => new SpreadsheetApp(calc);
void ParamForm; void decimalSeq;
