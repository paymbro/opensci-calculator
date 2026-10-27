// Matrix (p.114-121) and Vector (p.121-127) apps.
import { Real, CalcError } from '../core/num.js';
import { MenuScreen } from '../core/calc.js';
import { LCD } from '../core/lcd.js';
import { COMMON, MATRIX_CAT, VECTOR_CAT } from '../core/catalog.js';
import { ParamForm } from './widgets.js';
import { CoefEditor } from './coefedit.js';
import { LineCalcScreen } from './linecalc.js';
import { errorScreen } from './common.js';

class MatVecApp {
  constructor(calc, kind) {
    this.calc = calc;
    this.kind = kind; // 'Mat' | 'Vct'
    this.names = ['A', 'B', 'C', 'D'].map((c) => kind + c);
    this.mode = 'calc';
    this.view = null;
  }
  get M() { return this.calc.mem.mvars; }
  start() { this.mode = 'calc'; this.view = null; this.newCalc(); }
  powerOn() { this.start(); }
  status() { const S = this.calc.settings; return { angle: S.angle, fix: S.numFormat.kind === 'Fix', sci: S.numFormat.kind === 'Sci' }; }

  newCalc() {
    const calc = this.calc;
    const isMat = this.kind === 'Mat';
    this.calcScreen = new LineCalcScreen(calc, {
      label: ['Press [TOOLS]', 'to define ' + (isMat ? 'Matrix.' : 'Vector.')],
      catalog: [isMat ? MATRIX_CAT : VECTOR_CAT, ...COMMON],
      ansToken: this.kind + 'Ans',
      status: () => this.status(),
      tools: () => this.varList(),
      onResult: (v) => {
        if (v && (v.type === 'mat' || v.type === 'vec')) {
          if ((v.type === 'mat') !== isMat) throw new CalcError('Syntax');
          this.M[this.kind + 'Ans'] = v;
          this.openView(this.kind + 'Ans', true);
          return true;
        }
        return false;
      },
    });
  }

  dims(v) { return v.type === 'mat' ? `${v.r}×${v.c}` : `${v.a.length}`; }

  varList() {
    const calc = this.calc;
    const g = 'mvlist';
    calc.push(new MenuScreen(calc, {
      group: g,
      items: this.names.map((n) => ({ label: n + ':' + (this.M[n] ? this.dims(this.M[n]) : 'None') })),
      onSelect: (it, i) => {
        const name = this.names[i];
        if (!this.M[name]) { this.defineNew(name, g); return; }
        calc.push(new MenuScreen(calc, {
          group: g, items: [{ label: 'Edit' }, { label: 'Define New' }],
          onSelect: (x, j) => { if (j === 0) { calc.closeGroup(g); this.openView(name, false); } else this.defineNew(name, g); },
        }));
      },
      status: () => this.status(),
    }));
  }

  defineNew(name, g) {
    const calc = this.calc;
    const isMat = this.kind === 'Mat';
    const st = { rows: 2, cols: 2, dim: 2 };
    const fields = isMat
      ? [
        { label: 'Rows', kind: 'menu', options: [[':1', 1], [':2', 2], [':3', 3], [':4', 4]], get: () => st.rows, set: (v) => { st.rows = v; }, display: () => String(st.rows) },
        { label: 'Columns', kind: 'menu', options: [[':1', 1], [':2', 2], [':3', 3], [':4', 4]], get: () => st.cols, set: (v) => { st.cols = v; }, display: () => String(st.cols) },
      ]
      : [{ label: 'Dimensions', kind: 'menu', options: [[':2', 2], [':3', 3]], get: () => st.dim, set: (v) => { st.dim = v; }, display: () => String(st.dim) }];
    fields.forEach((f) => { f.options = f.options.map(([l, v]) => [String(v), v]); });
    const form = new ParamForm(calc, {
      title: isMat ? 'Matrix Size?' : 'Vector Dimension?', fields, labelWidth: isMat ? 12 : 11, group: g,
      action: { label: 'Confirm', run: () => {
        if (isMat) this.M[name] = { type: 'mat', r: st.rows, c: st.cols, a: Array.from({ length: st.rows }, () => Array.from({ length: st.cols }, () => Real.int(0))) };
        else this.M[name] = { type: 'vec', a: Array.from({ length: st.dim }, () => Real.int(0)) };
        calc.closeGroup(g);
        this.openView(name, false);
      } },
      onBack: () => calc.pop(), statusFn: () => this.status(),
    });
    form.group = g;
    calc.push(form);
  }

  openView(name, isAns) {
    const v = this.M[name];
    const isMat = v.type === 'mat';
    const rows = isMat ? v.a.map((r) => [...r]) : v.a.map((x) => [x]);
    const cols = isMat ? v.c : 1;
    this.view = {
      name, isAns,
      editor: new CoefEditor(this.calc, {
        x0: 12, y0: 22, rowH: 10, cellW: cols === 1 ? 36 : cols <= 2 ? 42 : cols === 3 ? 42 : 40, visibleCols: Math.min(cols, 4), visibleRows: Math.min(rows.length, 3),
        brace: '[', digits: 6, selX: 1,
      }, rows),
    };
    this.mode = 'view';
  }

  commitView() {
    const vw = this.view;
    const v = this.M[vw.name];
    if (v.type === 'mat') v.a = vw.editor.values.map((r) => [...r]);
    else v.a = vw.editor.values.map((r) => r[0]);
  }

  key(k) {
    const calc = this.calc;
    if (this.mode === 'calc') { this.calcScreen.key(k); return; }
    const vw = this.view;
    const ed = vw.editor;
    if (ed.editing) {
      if (vw.isAns) { ed.editing = null; return; }
      ed.key(k);
      this.commitView();
      return;
    }
    if (k === 'AC' || k === 'BACK' || (k === 'OK' && !vw.isAns)) { this.commitView(); this.mode = 'calc'; return; }
    if (vw.isAns) {
      if (k === 'TOOLS') {
        const g = 'mvstore';
        calc.push(new MenuScreen(calc, {
          group: g, items: [{ label: 'Store', sub: true }],
          onSelect: () => calc.push(new MenuScreen(calc, {
            group: g, items: this.names.map((n) => ({ label: n })),
            onSelect: (x, j) => { this.M[this.names[j]] = cloneMV(this.M[vw.name]); calc.closeGroup(g); },
          })),
          status: () => this.status(),
        }));
        return;
      }
      const cont = { ADD: '+', SUB: '−', MUL: '×', DIV: '÷', SQR: '²', RECIP: '⁻¹', POW: '^(' };
      if (k in cont) {
        this.mode = 'calc';
        this.calcScreen.state = 'input';
        this.calcScreen.ed.clear();
        this.calcScreen.ed.insertToken(this.kind + 'Ans');
        this.calcScreen.key(k);
        return;
      }
      if (['UP', 'DOWN', 'LEFT', 'RIGHT'].includes(k)) ed.key(k);
      return;
    }
    if (k === 'TOOLS') { this.commitView(); this.varList(); return; }
    ed.key(k);
    this.commitView();
  }

  render(lcd, blink) {
    if (this.mode === 'calc') { this.calcScreen.render(lcd, blink); return; }
    const vw = this.view;
    lcd.smallText(vw.name + '=', 3, 11);
    vw.editor.render(lcd, blink);
  }
}

function cloneMV(v) {
  if (v.type === 'mat') return { type: 'mat', r: v.r, c: v.c, a: v.a.map((r) => [...r]) };
  return { type: 'vec', a: [...v.a] };
}

export const makeMatrix = (calc) => new MatVecApp(calc, 'Mat');
export const makeVector = (calc) => new MatVecApp(calc, 'Vct');
void LCD; void errorScreen;
