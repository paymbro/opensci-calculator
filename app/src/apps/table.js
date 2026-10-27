// Table app (User's Guide p.93-97): number table of f(x) and/or g(x).
import { Real, CalcError } from '../core/num.js';
import { MenuScreen } from '../core/calc.js';
import { parseSeq } from '../core/parser.js';
import { Evaluator } from '../core/eval.js';
import { decimalSeq } from '../core/format.js';
import { ValueInput, GridView, ParamForm, fmtSmall } from './widgets.js';
import { errorScreen, drawResult, evalContext, functionMenu } from './common.js';
import { LINE_TOP } from '../core/ui.js';

export class TableApp {
  constructor(calc) {
    this.calc = calc;
    const st = calc.mem.appState.table || {};
    this.type = st.type || 'f';            // 'fg' | 'f' | 'g'
    this.range = st.range ? st.range.map((s) => Real.fromDecimalString(s)) : [Real.int(1), Real.int(5), Real.int(1)];
    this.rows = [];
    this.grid = new GridView({ cols: 2 });
    this.editing = null;
  }

  start() { this.rows = []; this.grid = new GridView({ cols: this.cols().length }); this.editing = null; }
  powerOn() { this.start(); }
  onSettingsChange() { this.start(); }
  status() { return { mathI: this.calc.math, angle: this.calc.settings.angle, fix: this.calc.settings.numFormat.kind === 'Fix', sci: this.calc.settings.numFormat.kind === 'Sci' }; }

  cols() { return this.type === 'fg' ? ['𝑥', 'f(𝑥)', 'g(𝑥)'] : this.type === 'f' ? ['𝑥', 'f(𝑥)'] : ['𝑥', 'g(𝑥)']; }
  colWidth() { return this.type === 'fg' ? 44 : 44; }
  maxRows() { return this.type === 'fg' ? 30 : 45; }
  save() { this.calc.mem.appState.table = { type: this.type, range: this.range.map((r) => r.dec.toString()) }; }

  fval(name, x) {
    const def = this.calc.mem.funcs[name];
    if (!def || !def.length) return null;
    try {
      const ctx = evalContext(this.calc, { bind: { x } });
      const ev = new Evaluator(ctx);
      ctx.callStack = [name];
      return ev.ev(parseSeq(def));
    } catch (e) { return 'ERROR'; }
  }

  rowFor(x) {
    const r = { x };
    if (this.type !== 'g') r.f = this.fval('f', x);
    if (this.type !== 'f') r.g = this.fval('g', x);
    return r;
  }

  generate() {
    const [start, end, step] = this.range;
    if (step.isZero() || (end.dec.minus(start.dec).div(step.dec)).isNeg()) throw new CalcError('Range ERROR');
    const n = end.dec.minus(start.dec).div(step.dec).floor().toNumber() + 1;
    if (n > this.maxRows()) throw new CalcError('Range ERROR');
    this.rows = [];
    for (let i = 0; i < n; i++) this.rows.push(this.rowFor(start.add(step.mul(Real.int(i)))));
    this.calc.mem.vars.x = this.rows.length ? this.rows[this.rows.length - 1].x : this.calc.mem.vars.x;
    this.grid = new GridView({ cols: this.cols().length });
  }

  recalc() { this.rows = this.rows.map((r) => this.rowFor(r.x)); }

  key(k) {
    const calc = this.calc, g = this.grid;
    if (this.editing) {
      if (k === 'EXE' || k === 'OK' || k === 'DOWN') {
        try {
          const v = this.editing.value();
          if (!(v instanceof Real)) throw new CalcError('Math');
          this.setX(g.row, v);
          this.editing = null;
          if (g.row < this.maxRows() - 1 && g.row < this.rows.length) { g.row++; g.ensure(); }
        } catch (e) { calc.push(errorScreen(calc, e instanceof CalcError ? e : new CalcError('Math'), () => {})); }
        return;
      }
      if (k === 'AC') { this.editing = null; return; }
      this.editing.key(k);
      return;
    }
    switch (k) {
      case 'UP': if (g.row > 0) g.row--; g.ensure(); return;
      case 'DOWN': if (g.row < Math.min(this.rows.length, this.maxRows() - 1)) g.row++; g.ensure(); return;
      case 'LEFT': if (g.col > 0) g.col--; return;
      case 'RIGHT': if (g.col < this.cols().length - 1) g.col++; return;
      case 'PGUP': g.row = Math.max(0, g.row - 4); g.ensure(); return;
      case 'PGDN': g.row = Math.min(this.rows.length, g.row + 4); g.ensure(); return;
      case 'DEL': if (g.row < this.rows.length) this.rows.splice(g.row, 1); return;
      case 'TOOLS': this.tools(); return;
      case 'FUNCTION': calc.push(functionMenu(calc, { insertSpec() {}, onFuncDefined: () => this.recalc() }, { defineOnly: true })); return;
      case 'VARIABLE': return;
      case 'AC': case 'BACK': case 'OK': return;
      case 'ADD': case 'EXE': case 'SUB':
        if (g.col === 0 && g.row === this.rows.length && g.row > 0) {
          const above = this.rows[g.row - 1].x;
          this.setX(g.row, k === 'SUB' ? above.sub(this.range[2]) : above.add(this.range[2]));
          if (g.row < this.maxRows() - 1) { g.row++; g.ensure(); }
          return;
        }
        if (k !== 'SUB') return;
        break;
      default: break;
    }
    if (g.col === 0 && /^(D\d|DOT|NEG|SUB|LPAR|ANS|PI|E|SQRT|FRAC|VA|VB|VC|VD|VE|VF|VX|VY|VZ|X)$/.test(k)) {
      this.editing = new ValueInput(calc, { firstKey: k });
    }
  }

  setX(r, v) {
    if (r >= this.rows.length) { if (this.rows.length >= this.maxRows()) return; this.rows.push(this.rowFor(v)); } else this.rows[r] = this.rowFor(v);
  }

  tools() {
    const calc = this.calc, gname = 'tabletools';
    const rangeForm = () => {
      const f = new ParamForm(calc, {
        title: 'Table Range', group: gname,
        fields: ['Start', 'End', 'Step'].map((label, i) => ({
          label, kind: 'value', get: () => this.range[i], display: () => fmtSmall(calc, this.range[i], 12), set: (v) => { this.range[i] = v; this.save(); },
        })),
        action: { label: 'Execute', run: () => {
          try { this.generate(); calc.closeGroup(gname); } catch (e) { calc.push(errorScreen(calc, e, () => {})); }
        } },
        onBack: () => calc.pop(), statusFn: () => this.status(),
      });
      f.group = gname;
      return f;
    };
    calc.push(new MenuScreen(calc, {
      group: gname,
      items: [{ label: 'Table Range' }, { label: 'Define f(𝑥)/g(𝑥)', sub: true }, { label: 'Table Type', sub: true }, { label: 'Edit', sub: true }, { label: 'Recalculate' }],
      onSelect: (it, i) => {
        if (i === 0) calc.push(rangeForm());
        if (i === 1) { calc.closeGroup(gname); calc.push(functionMenu(calc, { insertSpec() {}, onFuncDefined: () => this.recalc() }, { defineOnly: true })); }
        if (i === 2) calc.push(new MenuScreen(calc, {
          group: gname, items: [['f(𝑥)/g(𝑥)', 'fg'], ['f(𝑥)', 'f'], ['g(𝑥)', 'g']].map(([label, v]) => ({ label, radio: this.type === v })),
          onSelect: (x, j) => { this.type = ['fg', 'f', 'g'][j]; this.save(); this.start(); calc.closeGroup(gname); },
        }));
        if (i === 3) calc.push(new MenuScreen(calc, {
          group: gname, items: [{ label: 'Insert Row' }, { label: 'Delete All' }],
          onSelect: (x, j) => {
            calc.closeGroup(gname);
            if (j === 0) { if (this.rows.length < this.maxRows() && this.grid.row < this.rows.length) this.rows.splice(this.grid.row, 0, this.rowFor(this.rows[this.grid.row].x)); } else { this.rows = []; this.grid.row = 0; this.grid.top = 0; }
          },
        }));
        if (i === 4) { calc.closeGroup(gname); this.recalc(); }
      },
      status: () => this.status(),
    }));
  }

  cellValue(r, c) {
    const row = this.rows[r];
    if (!row) return null;
    const name = this.cols()[c];
    return name === '𝑥' ? row.x : name === 'f(𝑥)' ? row.f : row.g;
  }

  render(lcd, blink) {
    const g = this.grid;
    const cols = this.cols();
    g.cols = cols.length;
    g.draw(lcd, {
      rowCount: this.rows.length, headers: cols,
      getCell: (r, c) => { const v = this.cellValue(r, c); return v === null ? '' : v === 'ERROR' ? 'ERROR' : fmtSmall(this.calc, v instanceof Real ? v : v.re || v, 6); },
      selVisible: !this.editing,
    });
    const missing = cols.slice(1).find((n) => { const d = this.calc.mem.funcs[n[0]]; return !d || !d.length; });
    if (this.editing) this.editing.draw(lcd, blink, { top: 58 });
    else if (missing) lcd.bigText(missing + ':None', 3, LINE_TOP(3));
    else {
      const v = this.cellValue(g.row, g.col);
      if (v instanceof Real) drawResult(lcd, decimalSeq(v.dec, this.calc.settings));
      else if (v === 'ERROR') drawResult(lcd, [{ k: 't', v: 'E' }, { k: 't', v: 'R' }, { k: 't', v: 'R' }, { k: 't', v: 'O' }, { k: 't', v: 'R' }]);
    }
  }
}

export function makeTable(calc) { return new TableApp(calc); }
