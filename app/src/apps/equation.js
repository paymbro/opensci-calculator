// Equation app (User's Guide p.97-105): simultaneous linear equations (2-4 unknowns),
// polynomial equations (degree 2-4, optional complex roots, extrema), and Solver (Newton's method).
import { Decimal, Real, CalcError, recognize } from '../core/num.js';
import { Cx } from '../core/eval.js';
import { MenuScreen } from '../core/calc.js';
import { Editor } from '../core/expr.js';
import { inputKey } from '../core/input.js';
import { parseSeq } from '../core/parser.js';
import { Evaluator } from '../core/eval.js';
import { formatValue, formatComplex } from '../core/format.js';
import { COMMON, EQUATION_CAT } from '../core/catalog.js';
import { LCD } from '../core/lcd.js';
import { LINE_TOP } from '../core/ui.js';
import { CoefEditor } from './coefedit.js';
import { ParamForm, fmtSmall } from './widgets.js';
import { drawMathInput, drawLineInput, drawResult, errorScreen, globalMenus, specInsert, evalContext, placeCursorAt } from './common.js';

const D = (x) => new Decimal(x);
const VARN = ['x', 'y', 'z', 't'];

// ------------------------------------------------------------------ solvers
export function solveLinear(A, b) {
  // Gaussian elimination with exact Real arithmetic where possible
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = -1;
    for (let r = c; r < n; r++) if (!M[r][c].isZero() && M[r][c].dec.abs().gt('1e-30')) { if (p < 0 || M[r][c].dec.abs().gt(M[p][c].dec.abs())) p = r; }
    if (p < 0) return null; // singular
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c].div(M[c][c]);
      if (f.isZero()) continue;
      for (let k = c; k <= n; k++) M[r][k] = M[r][k].sub(f.mul(M[c][k]));
    }
  }
  return M.map((row, i) => row[n].div(row[i]));
}

function rank(rows) {
  const M = rows.map((r) => r.map((x) => x.dec));
  let rk = 0;
  const cols = M[0].length;
  for (let c = 0; c < cols && rk < M.length; c++) {
    let p = -1;
    for (let r = rk; r < M.length; r++) if (M[r][c].abs().gt('1e-25')) { p = r; break; }
    if (p < 0) continue;
    [M[rk], M[p]] = [M[p], M[rk]];
    for (let r = 0; r < M.length; r++) {
      if (r === rk) continue;
      const f = M[r][c].div(M[rk][c]);
      for (let k = c; k < cols; k++) M[r][k] = M[r][k].minus(f.times(M[rk][k]));
    }
    rk++;
  }
  return rk;
}

// complex Decimal helpers for polynomial roots
const cx = (re, im = D(0)) => ({ re: D(re), im: D(im) });
const cadd = (a, b) => ({ re: a.re.plus(b.re), im: a.im.plus(b.im) });
const csub = (a, b) => ({ re: a.re.minus(b.re), im: a.im.minus(b.im) });
const cmul = (a, b) => ({ re: a.re.times(b.re).minus(a.im.times(b.im)), im: a.re.times(b.im).plus(a.im.times(b.re)) });
const cdiv = (a, b) => { const d = b.re.pow(2).plus(b.im.pow(2)); return { re: a.re.times(b.re).plus(a.im.times(b.im)).div(d), im: a.im.times(b.re).minus(a.re.times(b.im)).div(d) }; };
const cabs = (a) => a.re.pow(2).plus(a.im.pow(2)).sqrt();

function polyRootsNumeric(coefs) {
  // Durand–Kerner on monic polynomial, then Newton polish
  const n = coefs.length - 1;
  const a0 = coefs[0];
  const c = coefs.map((x) => x.div(a0));
  const evalP = (z) => { let v = cx(1); for (let i = 1; i <= n; i++) v = cadd(cmul(v, z), cx(c[i])); return v; };
  let roots = [];
  const seed = cx('0.4', '0.9');
  let p = cx(1);
  for (let i = 0; i < n; i++) { roots.push(p); p = cmul(p, seed); }
  for (let it = 0; it < 500; it++) {
    let delta = D(0);
    roots = roots.map((z, i) => {
      let den = cx(1);
      roots.forEach((w, j) => { if (j !== i) den = cmul(den, csub(z, w)); });
      if (den.re.isZero() && den.im.isZero()) den = cx('1e-30');
      const nz = csub(z, cdiv(evalP(z), den));
      delta = Decimal.max(delta, cabs(csub(nz, z)));
      return nz;
    });
    if (delta.lt('1e-30')) break;
  }
  return roots.map((z) => {
    const re = z.re.abs().lt('1e-25') ? D(0) : z.re;
    const im = z.im.abs().lt('1e-20') ? D(0) : z.im;
    return { re, im };
  });
}

export function solvePolynomial(coefs) {
  // coefs: Real[] from highest degree; returns array of Real|Cx
  const n = coefs.length - 1;
  if (coefs[0].isZero()) throw new CalcError('Math');
  if (n === 2) {
    const [a, b, c] = coefs;
    const disc = b.mul(b).sub(Real.int(4).mul(a).mul(c));
    const two_a = Real.int(2).mul(a);
    if (!disc.isNeg()) {
      const s = disc.sqrt();
      return [b.neg().add(s).div(two_a), b.neg().sub(s).div(two_a)].sort((p, q) => -p.cmp(q));
    }
    const s = disc.neg().sqrt();
    const re = b.neg().div(two_a), im = s.div(two_a.abs());
    return [new Cx(re, im), new Cx(re, im.neg())];
  }
  const roots = polyRootsNumeric(coefs.map((r) => r.dec));
  const real = roots.filter((z) => z.im.isZero()).map((z) => recognize(new Real(z.re))).sort((p, q) => -p.cmp(q));
  const comp = roots.filter((z) => !z.im.isZero()).sort((p, q) => q.im.cmp(p.im)).map((z) => new Cx(recognize(new Real(z.re)), recognize(new Real(z.im))));
  return [...real, ...comp];
}

function polyEvalReal(coefs, x) { let v = Real.int(0); for (const c of coefs) v = v.mul(x).add(c); return v; }

// ------------------------------------------------------------------ app
export class EquationApp {
  constructor(calc) {
    this.calc = calc;
    this.mode = 'menu';
    this.complexRoots = !!(calc.mem.appState.eq && calc.mem.appState.eq.complexRoots);
  }
  start() { this.mode = 'menu'; this.showMainMenu(); }
  powerOn() { this.start(); }
  onSettingsChange() {}
  status() {
    const S = this.calc.settings;
    const st = { mathI: this.calc.math, angle: S.angle, fix: S.numFormat.kind === 'Fix', sci: S.numFormat.kind === 'Sci' };
    if (this.mode === 'solution') {
      st.down = this.solIdx < this.solutions.length - 1;
      st.up = this.solIdx > 0;
      if (this.kind === 'poly' && this.complexRoots) st.cplx = S.complex === 'r∠θ' ? '∠' : 'i';
    }
    if ((this.mode === 'editor') && this.kind === 'poly' && this.complexRoots) st.cplx = this.calc.settings.complex === 'r∠θ' ? '∠' : 'i';
    return st;
  }

  showMainMenu() {
    const calc = this.calc;
    calc.push(new MenuScreen(calc, {
      group: 'eqmain', acCloses: false,
      items: [{ label: 'Simul Equation' }, { label: 'Polynomial' }, { label: 'Solver' }],
      onSelect: (it, i) => {
        if (i === 0) calc.push(new MenuScreen(calc, {
          group: 'eqmain', acCloses: false, items: [{ label: '2 Unknowns' }, { label: '3 Unknowns' }, { label: '4 Unknowns' }],
          onSelect: (x, j) => { calc.closeGroup('eqmain'); this.openSimul(j + 2); },
        }));
        if (i === 1) calc.push(new MenuScreen(calc, {
          group: 'eqmain', acCloses: false, items: [{ label: 'ax²+bx+c=0' }, { label: 'ax³+bx²+cx+d=0' }, { label: 'ax⁴+bx³+cx²…+e=0' }],
          onSelect: (x, j) => { calc.closeGroup('eqmain'); this.openPoly(j + 2); },
        }));
        if (i === 2) { calc.closeGroup('eqmain'); this.openSolver(); }
      },
      onBack: () => { calc.pop(); if (this.mode === 'menu') calc.showHome = true; },
      status: () => ({ mathI: this.calc.math, angle: this.calc.settings.angle }),
    }));
  }

  openSimul(n) {
    this.kind = 'simul'; this.n = n; this.mode = 'editor';
    const values = Array.from({ length: n }, () => Array.from({ length: n + 1 }, () => Real.int(0)));
    const names = n === 4 ? ['x', 'y', 'z', 't'] : ['x', 'y', 'z'];
    this.editor = new CoefEditor(this.calc, {
      x0: 8, y0: 15, rowH: 12, cellW: 60, visibleCols: 3, visibleRows: 3, brace: '{', suffixW: 14, digits: 6,
      label: (r, c) => (c < n ? names[c] + (c < n - 1 ? ' +' : ' =') : ''),
    }, values);
  }

  openPoly(deg) {
    this.kind = 'poly'; this.deg = deg; this.mode = 'editor';
    const values = [Array.from({ length: deg + 1 }, () => Real.int(0))];
    const terms = { 2: ['𝑥²+', '𝑥 +', '=0'], 3: ['𝑥³+', '𝑥²+', '𝑥 +', '=0'], 4: ['𝑥⁴+', '𝑥³+', '𝑥²+', '𝑥 +', '=0'] }[deg];
    const titles = { 2: 'ax²+bx+c=0', 3: 'ax³+bx²+cx+d=0', 4: 'ax⁴+bx³+cx²+dx+e=0' };
    this.editor = new CoefEditor(this.calc, {
      title: titles[deg], x0: 3, y0: 30, rowH: 12, cellW: 64, visibleCols: 3, visibleRows: 1, suffixW: 16, digits: 6,
      label: (r, c) => terms[c],
    }, values);
  }

  key(k) {
    const calc = this.calc;
    if (this.mode === 'solver') { this.solverKey(k); return; }
    if (this.mode === 'solution') { this.solutionKey(k); return; }
    if (this.mode !== 'editor') return;
    const ed = this.editor;
    if (ed.editing) { ed.key(k); return; }
    switch (k) {
      case 'EXE': this.solve(); return;
      case 'AC': ed.clearAll(); return;
      case 'BACK': this.mode = 'menu'; this.showMainMenu(); return;
      case 'TOOLS':
        if (this.kind === 'poly') {
          calc.push(new MenuScreen(calc, {
            group: 'eqtools', items: [{ label: 'Complex Roots', sub: true }],
            onSelect: () => calc.push(new MenuScreen(calc, {
              group: 'eqtools', items: [{ label: 'On', radio: this.complexRoots }, { label: 'Off', radio: !this.complexRoots }],
              onSelect: (x, j) => { this.complexRoots = j === 0; calc.mem.appState.eq = { complexRoots: this.complexRoots }; calc.closeGroup('eqtools'); },
            })),
            status: () => this.status(),
          }));
        }
        return;
      default: ed.key(k);
    }
  }

  solve() {
    const calc = this.calc;
    const ed = this.editor;
    try {
      if (this.kind === 'simul') {
        const n = this.n;
        const A = ed.values.map((row) => row.slice(0, n));
        const b = ed.values.map((row) => row[n]);
        const sol = solveLinear(A, b);
        if (!sol) {
          const rA = rank(A), rAb = rank(ed.values);
          this.showMessage(rA < rAb ? 'No Solution' : 'Infinite Solutions');
          return;
        }
        this.solutions = sol.map((v, i) => ({ label: (n === 4 ? ['x', 'y', 'z', 't'] : VARN)[i] + '=', value: v }));
      } else {
        const coefs = ed.values[0];
        if (coefs[0].isZero()) throw new CalcError('Math');
        let roots = solvePolynomial(coefs);
        const realOnly = roots.filter((r) => !(r instanceof Cx));
        if (!this.complexRoots) {
          if (!realOnly.length) { this.showMessage('No Real Roots'); return; }
          roots = realOnly;
        }
        const title = { 2: 'ax²+bx+c=0', 3: 'ax³+bx²+cx+d=0', 4: 'ax⁴+bx³+cx²+dx+e=0' }[this.deg];
        const sub = ['₁', '₂', '₃', '₄'];
        const many = roots.length > 1 && !(roots.length === 2 && roots[0] instanceof Real && roots[1] instanceof Real && roots[0].equalsApprox(roots[1]));
        if (this.deg === 2 && roots.length === 2 && roots[0] instanceof Real && roots[0].equalsApprox(roots[1])) roots = [roots[0]];
        this.solutions = roots.map((v, i) => ({ title, label: '𝑥' + (roots.length > 1 ? sub[i] : '') + '=', value: v }));
        void many;
        // extrema
        if (this.deg === 2) {
          const [a, b, c] = coefs;
          const xv = b.neg().div(Real.int(2).mul(a));
          const yv = polyEvalReal(coefs, xv);
          const t = (a.isNeg() ? 'Max' : 'Min') + ' of y=ax²+bx+c';
          this.solutions.push({ title: t, label: '𝑥=', value: xv }, { title: t, label: 'y=', value: yv });
          void c;
        } else if (this.deg === 3) {
          const [a, b, c] = coefs;
          // derivative 3ax²+2bx+c
          const da = Real.int(3).mul(a), db = Real.int(2).mul(b);
          const disc = db.mul(db).sub(Real.int(4).mul(da).mul(c));
          if (disc.dec.lte('1e-30')) this.solutions.push({ title: 'y=ax³+bx²+cx+d', label: '', value: null, message: 'No Local Max/Min' });
          else {
            const s = disc.sqrt();
            const x1 = db.neg().add(s).div(Real.int(2).mul(da)), x2 = db.neg().sub(s).div(Real.int(2).mul(da));
            const pts = [x1, x2].map((x) => ({ x, y: polyEvalReal(coefs, x) }));
            // local max has the larger y between the two critical points
            pts.sort((p, q) => -p.y.cmp(q.y));
            const [mx, mn] = pts;
            this.solutions.push(
              { title: 'Local Max of y=', label: '𝑥=', value: mx.x }, { title: 'Local Max of y=', label: 'y=', value: mx.y },
              { title: 'Local Min of y=', label: '𝑥=', value: mn.x }, { title: 'Local Min of y=', label: 'y=', value: mn.y },
            );
          }
        }
      }
      this.solIdx = 0;
      this.mode = 'solution';
      this.solFmt = null;
    } catch (e) {
      calc.push(errorScreen(calc, e instanceof CalcError ? e : new CalcError('Math'), () => {}));
    }
  }

  showMessage(msg) {
    this.solutions = [{ label: '', value: null, message: msg }];
    this.solIdx = 0;
    this.mode = 'solution';
  }

  solutionKey(k) {
    const calc = this.calc;
    switch (k) {
      case 'DOWN': case 'EXE': case 'OK':
        if (this.solIdx < this.solutions.length - 1) { this.solIdx++; this.solFmt = null; } else this.mode = 'editor';
        return;
      case 'UP': if (this.solIdx > 0) { this.solIdx--; this.solFmt = null; } return;
      case 'AC': case 'BACK': this.mode = 'editor'; return;
      case 'FORMAT': this.solFmt = this.solFmt === 'dec' ? null : 'dec'; return;
      case 'FMT2': {
        const s = this.solutions[this.solIdx];
        if (!s.value) return;
        const items = s.value instanceof Cx
          ? [['■π√(Standard)', null], ['Decimal', 'dec'], ['Rectangular Coord', 'rect'], ['Polar Coord', 'polar']]
          : [['■π√(Standard)', null], ['Decimal', 'dec']];
        calc.push(new MenuScreen(calc, { group: 'format', items: items.map(([label]) => ({ label })), onSelect: (it, i) => { calc.pop(); this.solFmt = items[i][1]; }, status: () => this.status() }));
        return;
      }
      case 'VARIABLE': {
        const s = this.solutions[this.solIdx];
        if (s.value) calc.push(storeOnly(calc, s.value));
        return;
      }
      default: return;
    }
  }

  // ------------------------------------------------------------------ solver
  openSolver() {
    this.kind = 'solver'; this.mode = 'solver';
    this.solver = { ed: this.calc.newEditor(), stage: 'input', state: {} };
  }

  solverKey(k) {
    const calc = this.calc;
    const sv = this.solver;
    if (sv.stage === 'input') {
      if (globalMenus(calc, k, { insertSpec: (spec) => specInsert(sv.ed, spec, calc) }, { catalog: [EQUATION_CAT, ...COMMON] })) return;
      if (k === 'EXE') { this.solverPrepare(); return; }
      if (k === 'AC') { sv.ed.clear(); return; }
      if (k === 'BACK') { if (sv.ed.isEmpty()) { this.mode = 'menu'; this.showMainMenu(); } return; }
      if (k === 'UP' || k === 'DOWN') return;
      inputKey(sv.ed, k, { settings: calc.settings, allowEq: true });
      return;
    }
    if (sv.stage === 'result') {
      if (k === 'EXE' || k === 'OK' || k === 'AC' || k === 'BACK') { sv.stage = 'input'; return; }
      return;
    }
    if (sv.stage === 'form' || sv.stage === 'target') sv.form.key(k);
  }

  solverPrepare() {
    const calc = this.calc;
    const sv = this.solver;
    let ast;
    try { ast = parseSeq(sv.ed.root, { allowEquals: true }); } catch (e) {
      calc.push(errorScreen(calc, e, () => placeCursorAt(sv.ed, e.pos)));
      return;
    }
    const vars = new Set();
    const walk = (n) => {
      if (!n || typeof n !== 'object') return;
      if (n.t === 'var') vars.add(n.name);
      for (const key of Object.keys(n)) if (key !== 'item') { const v = n[key]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object' && v.t) walk(v); }
    };
    walk(ast);
    if (!vars.size) { calc.push(errorScreen(calc, new CalcError('Variable'), () => {})); return; }
    sv.ast = ast;
    const order = ['x', 'y', 'z', 'A', 'B', 'C', 'D', 'E', 'F'].filter((v) => vars.has(v));
    const choose = (target) => {
      sv.target = target;
      sv.stage = 'form';
      const label = target === 'x' ? '𝑥' : target === 'y' ? '𝑦' : target === 'z' ? '𝑧' : target;
      sv.form = new ParamForm(calc, {
        title: null, colon: '=',
        fields: [{ label: label + ' ', kind: 'value', get: () => calc.mem.vars[target], display: () => fmtSmall(calc, calc.mem.vars[target], 12), set: (v) => { calc.mem.vars[target] = v; } }],
        action: { label: 'Execute', run: () => this.solverRun() },
        onBack: () => { sv.stage = 'input'; },
        statusFn: () => this.status(),
      });
      sv.form.headerLines = ['Enter Initial', 'Value'];
    };
    if (order.length > 1) {
      sv.stage = 'target';
      sv.form = new (class {
        constructor(app) { this.app = app; this.menu = new MenuScreen(calc, { items: order.map((v) => ({ label: v === 'x' ? '𝑥' : v === 'y' ? '𝑦' : v === 'z' ? '𝑧' : v })), onSelect: (it, i) => choose(order[i]), onBack: () => { sv.stage = 'input'; }, title: 'Solve Target' }); }
        key(k2) { return this.menu.key(k2); }
        render(lcd) { this.menu.render(lcd); }
      })(this);
    } else choose(order[0]);
  }

  solverRun() {
    const calc = this.calc;
    const sv = this.solver;
    const target = sv.target;
    const ctx = evalContext(calc);
    const f = (x) => {
      const ev = new Evaluator({ ...ctx, bind: { [target]: new Real(x) } });
      const v = ev.ev(sv.ast);
      if (!(v instanceof Real)) throw new CalcError('Math');
      return v.dec;
    };
    let x = calc.mem.vars[target].dec;
    let ok = false;
    try {
      for (let it = 0; it < 150; it++) {
        const fx = f(x);
        if (fx.isZero()) { ok = true; break; }
        const h = x.abs().gt(1) ? x.abs().times('1e-12') : D('1e-12');
        const d = f(x.plus(h)).minus(f(x.minus(h))).div(h.times(2));
        if (d.isZero()) { x = x.plus(h.times(1e6)); continue; }
        const nx = x.minus(fx.div(d));
        if (nx.minus(x).abs().lte(Decimal.max(x.abs(), 1).times('1e-18'))) { x = nx; ok = true; break; }
        x = nx;
      }
    } catch (e) {
      calc.push(errorScreen(calc, new CalcError('Cannot Solve'), () => {}));
      sv.stage = 'input';
      return;
    }
    let lr;
    try { lr = f(x); } catch (e) { lr = D(0); }
    if (!ok && lr.abs().gt('1e-10')) { calc.push(errorScreen(calc, new CalcError('Cannot Solve'), () => {})); sv.stage = 'input'; return; }
    const xr = new Real(x.abs().lt('1e-30') ? D(0) : x);
    calc.mem.vars[target] = xr;
    calc.mem.ans = xr;
    sv.result = { x: xr, lr: new Real(lr.abs().lt('1e-25') ? D(0) : lr) };
    sv.stage = 'result';
  }

  // ------------------------------------------------------------------ render
  render(lcd, blink) {
    const S = this.calc.settings;
    if (this.mode === 'editor') { this.editor.render(lcd, blink); return; }
    if (this.mode === 'solution') {
      const s = this.solutions[this.solIdx];
      let line = 0;
      if (s.title) { lcd.bigText(s.title, 3, 9); line = 1; }
      if (s.message) { lcd.bigText(s.message, 3, 9 + 16 * line); return; }
      lcd.bigText(s.label, 3, 9 + 16 * line);
      const v = s.value;
      let seq;
      if (v instanceof Cx) seq = this.solFmt === 'polar' ? formatComplex(v, S, 'std', true) : this.solFmt === 'rect' ? formatComplex(v, S, 'std', false) : formatComplex(v, S, this.solFmt === 'dec' ? 'dec' : 'std');
      else seq = formatValue(v, S, this.solFmt === 'dec' ? 'dec' : 'std');
      drawResult(lcd, seq);
      return;
    }
    if (this.mode === 'solver') {
      const sv = this.solver;
      if (sv.stage === 'input') {
        if (this.calc.math) drawMathInput(lcd, sv.ed, { top: 9, blink, state: sv.state });
        else drawLineInput(lcd, sv.ed, { top: 9, blink, state: sv.state });
      } else if (sv.stage === 'form') {
        lcd.bigText('Enter Initial', 3, LINE_TOP(0));
        lcd.bigText('Value', 3, LINE_TOP(1));
        const f = sv.form;
        f.title = null; f.rows = 2;
        const save = LINE_TOP;
        // draw the form two lines lower
        const tmp = new LCD(196, 75);
        f.render(tmp, blink);
        lcd.blit(tmp, 0, 11, 196, 32, 0, 43, true);
        void save;
      } else if (sv.stage === 'target') sv.form.render(lcd);
      else if (sv.stage === 'result') {
        const t = sv.target === 'x' ? '𝑥' : sv.target === 'y' ? '𝑦' : sv.target === 'z' ? '𝑧' : sv.target;
        lcd.bigText(t + '=', 3, LINE_TOP(0));
        drawResult(lcd, formatValue(sv.result.x, { ...S, io: S.io.replace('MathO', 'DecimalO') }), { bottom: LINE_TOP(1) + 13 });
        lcd.bigText('L−R=', 3, LINE_TOP(2));
        drawResult(lcd, formatValue(sv.result.lr, { ...S, io: S.io.replace('MathO', 'DecimalO') }), { bottom: LINE_TOP(3) + 13 });
      }
    }
  }
}

export function storeOnly(calc, value) {
  const names = ['A', 'B', 'C', 'D', 'E', 'F', 'x', 'y', 'z'];
  return {
    group: 'variable', sel: 0,
    key(k) {
      if (k === 'UP') { if (this.sel >= 2) this.sel -= 2; return true; }
      if (k === 'DOWN') { if (this.sel + 2 < names.length) this.sel += 2; return true; }
      if (k === 'LEFT') { if (this.sel % 2) this.sel--; return true; }
      if (k === 'RIGHT') { if (this.sel % 2 === 0 && this.sel + 1 < names.length) this.sel++; return true; }
      if (k === 'BACK' || k === 'AC' || k === 'VARIABLE') { calc.pop(); return true; }
      if (k === 'OK' || k === 'EXE') {
        const name = names[this.sel];
        calc.push(new MenuScreen(calc, { group: 'variable', title: name + '=', items: [{ label: 'Store' }], onSelect: () => { calc.mem.vars[name] = value; calc.pop(); } }));
        return true;
      }
      return true;
    },
    render(lcd) {
      names.forEach((v, i) => {
        const col = i % 2, row = Math.floor(i / 2);
        const x = 3 + col * 96, y = 12 + row * 13;
        lcd.smallText((v === 'x' ? '𝑥' : v === 'y' ? '𝑦' : v === 'z' ? '𝑧' : v) + '=' + calc.formatVarValue(calc.mem.vars[v]), x, y);
        if (i === this.sel) { lcd.invert(2, y - 1, col ? 94 : 92, 11); lcd.fill(x + 84, y, 5, 8, 0); }
      });
    },
  };
}

export function makeEquation(calc) { return new EquationApp(calc); }
void Editor; void LCD;
