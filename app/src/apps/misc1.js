// Inequality (p.105-106), Ratio (p.134-136), Complex (p.111-114) and Distribution (p.106-111) apps.
import { Decimal, Real, CalcError, recognize, PI } from '../core/num.js';
import { Cx } from '../core/eval.js';
import { MenuScreen } from '../core/calc.js';
import { LCD } from '../core/lcd.js';
import { LINE_TOP } from '../core/ui.js';
import { formatValue, decimalSeq, seqText } from '../core/format.js';
import { COMMON, COMPLEX_CAT } from '../core/catalog.js';
import { tok } from '../core/expr.js';
import { CoefEditor } from './coefedit.js';
import { ParamForm, GridView, ValueInput, fmtSmall } from './widgets.js';
import { solvePolynomial, storeOnly } from './equation.js';
import { CalculateApp } from './calculate.js';
import { drawResult, errorScreen } from './common.js';
import { phi } from './statistics.js';

const D = (x) => new Decimal(x);

// ================================================================== Inequality
const INEQ_SYMBOLS = ['>', '<', '≥', '≤'];
const INEQ_TITLES = { 2: 'ax²+bx+c', 3: 'ax³+bx²+cx+d', 4: 'ax⁴+bx³+cx²+dx+e' };

export function solveInequality(coefs, sym) {
  // returns { kind: 'all'|'none'|'intervals', parts: [{lo, hi, loIncl, hiIncl}|{point}] }
  const roots = solvePolynomial(coefs).filter((r) => !(r instanceof Cx));
  const uniq = [];
  for (const r of roots.sort((a, b) => a.cmp(b))) if (!uniq.length || !uniq[uniq.length - 1].equalsApprox(r)) uniq.push(r);
  const pval = (x) => { let v = D(0); for (const c of coefs) v = v.times(x).plus(c.dec); return v; };
  const ok = (v) => (sym === '>' ? v.gt(0) : sym === '<' ? v.lt(0) : sym === '≥' ? v.gte(0) : v.lte(0));
  const strict = sym === '>' || sym === '<';
  const pts = uniq.map((r) => r.dec);
  // test points in each open interval
  const tests = [];
  if (!pts.length) tests.push(D(0));
  else {
    tests.push(pts[0].minus(1));
    for (let i = 0; i < pts.length - 1; i++) tests.push(pts[i].plus(pts[i + 1]).div(2));
    tests.push(pts[pts.length - 1].plus(1));
  }
  const inSet = tests.map((t) => ok(pval(t)));
  if (!pts.length) return inSet[0] ? { kind: 'all' } : { kind: 'none' };
  const parts = [];
  // walk intervals: interval i is (pts[i-1], pts[i]) ; i from 0..k
  let cur = null;
  for (let i = 0; i <= pts.length; i++) {
    if (inSet[i]) {
      if (!cur) cur = { lo: i === 0 ? null : uniq[i - 1], loIncl: !strict && i > 0 };
      cur.hi = i === pts.length ? null : uniq[i]; cur.hiIncl = !strict && i < pts.length;
      // merge across a root when both sides are in the set (and the root itself satisfies)
      if (i < pts.length && inSet[i + 1] && !strict) continue;
      if (i < pts.length && inSet[i + 1] && strict) { parts.push(cur); cur = null; continue; }
      parts.push(cur); cur = null;
    } else if (!strict && i < pts.length && !inSet[i] && !inSet[i + 1]) {
      parts.push({ point: uniq[i] });
    }
  }
  if (parts.length === 1 && parts[0].lo === null && parts[0].hi === null) return { kind: 'all' };
  if (!parts.length) return { kind: 'none' };
  return { kind: 'intervals', parts };
}

export class InequalityApp {
  constructor(calc) { this.calc = calc; this.mode = 'menu'; }
  start() { this.mode = 'menu'; this.showMenu(); }
  powerOn() { this.start(); }
  status() { const S = this.calc.settings; return { mathI: this.calc.math, angle: S.angle, fix: S.numFormat.kind === 'Fix', sci: S.numFormat.kind === 'Sci' }; }
  showMenu() {
    const calc = this.calc;
    calc.push(new MenuScreen(calc, {
      group: 'ineq', acCloses: false,
      items: [2, 3, 4].map((d) => ({ label: INEQ_TITLES[d] })),
      onSelect: (it, i) => {
        const deg = i + 2;
        calc.push(new MenuScreen(calc, {
          group: 'ineq', acCloses: false,
          items: INEQ_SYMBOLS.map((s) => ({ label: INEQ_TITLES[deg] + s + '0' })),
          onSelect: (x, j) => { calc.closeGroup('ineq'); this.open(deg, INEQ_SYMBOLS[j]); },
        }));
      },
      onBack: () => { calc.pop(); if (this.mode === 'menu') calc.showHome = true; },
      status: () => this.status(),
    }));
  }
  open(deg, sym) {
    this.deg = deg; this.sym = sym; this.mode = 'editor';
    const terms = { 2: ['𝑥²+', '𝑥 +', sym + '0'], 3: ['𝑥³+', '𝑥²+', '𝑥 +', sym + '0'], 4: ['𝑥⁴+', '𝑥³+', '𝑥²+', '𝑥 +', sym + '0'] }[deg];
    this.editor = new CoefEditor(this.calc, {
      title: INEQ_TITLES[deg] + sym + '0', x0: 3, y0: 30, rowH: 12, cellW: 64, visibleCols: 3, visibleRows: 1, suffixW: 16,
      label: (r, c) => terms[c],
    }, [Array.from({ length: deg + 1 }, () => Real.int(0))]);
  }
  key(k) {
    const calc = this.calc;
    if (this.mode === 'result') { if (['EXE', 'OK', 'AC', 'BACK'].includes(k)) this.mode = 'editor'; return; }
    if (this.mode !== 'editor') return;
    if (this.editor.editing) { this.editor.key(k); return; }
    if (k === 'EXE') {
      try {
        const coefs = this.editor.values[0];
        if (coefs[0].isZero()) throw new CalcError('Math');
        this.result = solveInequality(coefs, this.sym);
        this.mode = 'result';
      } catch (e) { calc.push(errorScreen(calc, e instanceof CalcError ? e : new CalcError('Math'), () => {})); }
      return;
    }
    if (k === 'AC') { this.editor.clearAll(); return; }
    if (k === 'BACK') { this.mode = 'menu'; this.showMenu(); return; }
    this.editor.key(k);
  }
  // build "x≤a,b≤x" template and the value list
  describe() {
    const r = this.result;
    if (r.kind === 'all') return { text: 'All Real Numbers' };
    if (r.kind === 'none') return { text: 'No Solution' };
    const letters = ['a', 'b', 'c', 'd'];
    let li = 0;
    const tmpl = [], vals = [], inst = [];
    const lt = (incl) => (incl ? '≤' : '<');
    for (const p of r.parts) {
      if (p.point) { const L = letters[li++]; tmpl.push('𝑥=' + L); vals.push([L, p.point]); inst.push(['𝑥=', p.point]); continue; }
      const seg = [], seg2 = [];
      if (p.lo !== null) { const L = letters[li++]; seg.push(L + lt(p.loIncl)); vals.push([L, p.lo]); seg2.push([p.lo, lt(p.loIncl)]); }
      seg.push('𝑥');
      if (p.hi !== null) { const L = letters[li++]; seg.push(lt(p.hiIncl) + L); vals.push([L, p.hi]); seg2.push([lt(p.hiIncl), p.hi]); }
      tmpl.push(seg.join(''));
      inst.push(seg2);
    }
    return { tmpl: tmpl.join(','), vals, parts: r.parts };
  }
  render(lcd, blink) {
    if (this.mode === 'editor') { this.editor.render(lcd, blink); return; }
    if (this.mode !== 'result') return;
    const d = this.describe();
    const S = this.calc.settings;
    if (d.text) { lcd.bigText(d.text, 3, LINE_TOP(0)); return; }
    if (S.io === 'MathI/MathO') {
      lcd.bigText(d.tmpl, 3, 9);
      // natural display of the solution with exact values
      const seq = [];
      const lt = (incl) => (incl ? '≤' : '<');
      d.parts.forEach((p, i) => {
        if (i) seq.push(tok(','));
        if (p.point) { seq.push(tok('x'), tok('='), ...formatValue(p.point, S)); return; }
        if (p.lo !== null) seq.push(...formatValue(p.lo, S), tok(lt(p.loIncl)));
        seq.push(tok('x'));
        if (p.hi !== null) seq.push(tok(lt(p.hiIncl)), ...formatValue(p.hi, S));
      });
      drawResult(lcd, seq);
    } else {
      lcd.smallText(d.tmpl, 3, 11);
      d.vals.forEach(([L, v], i) => {
        const y = 22 + i * 10;
        lcd.smallText(L + '=', 3, y);
        const t = fmtSmall(this.calc, v, 14);
        lcd.smallText(t, 190 - LCD.smallWidth(t), y);
      });
    }
  }
}

// ================================================================== Ratio
export class RatioApp {
  constructor(calc) { this.calc = calc; this.mode = 'menu'; this.kind = 'X:D'; }
  start() { this.mode = 'menu'; this.showMenu(); }
  powerOn() { this.start(); }
  status() { const S = this.calc.settings; return { mathI: this.calc.math, angle: S.angle, fix: S.numFormat.kind === 'Fix', sci: S.numFormat.kind === 'Sci' }; }
  showMenu() {
    const calc = this.calc;
    calc.push(new MenuScreen(calc, {
      group: 'ratio', acCloses: false,
      items: [{ label: 'A:B=X:D' }, { label: 'A:B=C:X' }],
      onSelect: (it, i) => { calc.closeGroup('ratio'); this.open(i === 0 ? 'X:D' : 'C:X'); },
      onBack: () => { calc.pop(); if (this.mode === 'menu') calc.showHome = true; },
      status: () => this.status(),
    }));
  }
  open(kind) {
    this.kind = kind; this.mode = 'editor';
    const xFirst = kind === 'X:D';
    this.editor = new CoefEditor(this.calc, {
      x0: 3, y0: 32, rowH: 12, cellW: 46, visibleCols: 4, visibleRows: 1, suffixW: 8,
      label: (r, c) => [':', '=', ':', ''][c],
      prefix: (r, c) => ((xFirst && c === 2) || (!xFirst && c === 3) ? 'X' : ''),
    }, [[Real.int(1), Real.int(1), Real.int(1)]]);
    // editor has only A, B and the known third value; render X separately
  }
  key(k) {
    const calc = this.calc;
    if (this.mode === 'result') {
      if (['EXE', 'OK', 'AC', 'BACK'].includes(k)) this.mode = 'editor';
      if (k === 'VARIABLE') calc.push(storeOnly(calc, this.x));
      if (k === 'FORMAT') this.dec = !this.dec;
      return;
    }
    if (this.mode !== 'editor') return;
    if (this.editor.editing) { this.editor.key(k); return; }
    if (k === 'OK' || k === 'EXE') {
      if (k === 'EXE' && this.editor.c < 2) { this.editor.key('RIGHT'); return; }
      try {
        const [A, B, C] = this.editor.values[0];
        if (A.isZero() || B.isZero() || C.isZero()) throw new CalcError('Math');
        this.x = this.kind === 'X:D' ? A.mul(C).div(B) : B.mul(C).div(A);
        calc.mem.ans = this.x;
        this.mode = 'result'; this.dec = false;
      } catch (e) { calc.push(errorScreen(calc, e instanceof CalcError ? e : new CalcError('Math'), () => {})); }
      return;
    }
    if (k === 'AC' || k === 'HOME') { this.editor.clearAll(Real.int(1)); return; }
    if (k === 'BACK') { this.editor.clearAll(Real.int(1)); this.mode = 'menu'; this.showMenu(); return; }
    this.editor.key(k);
  }
  render(lcd, blink) {
    if (this.mode === 'result') {
      lcd.bigText('X=', 3, 9);
      drawResult(lcd, formatValue(this.x, this.calc.settings, this.dec ? 'dec' : 'std'));
      return;
    }
    if (this.mode !== 'editor') return;
    // A : B = X : D   (or A : B = C : X) — values right-aligned above underscores
    const ed = this.editor;
    const vals = ed.values[0];
    const slots = this.kind === 'X:D' ? [0, 1, 'X', 2] : [0, 1, 2, 'X'];
    const xs = [3, 50, 120, 150];
    slots.forEach((s, i) => {
      const x = xs[i], w = 40, y = 34;
      if (s === 'X') { lcd.smallText('X:', x + 22, y); return; }
      const t = fmtSmall(this.calc, vals[s], 6);
      lcd.smallText(t, x + w - 4 - LCD.smallWidth(t), y);
      lcd.hline(x + 2, y + 10, w - 8, 3);
      lcd.smallText(i === 0 ? ':' : i === 1 ? '=' : ':', x + w - 2, y);
      if (s === ed.c && !ed.editing) lcd.invert(x + 2, y - 1, w - 6, 11);
    });
    if (ed.editing) ed.editing.draw(lcd, blink, { top: 58 });
    else drawResult(lcd, decimalSeq(vals[ed.c].dec, this.calc.settings));
  }
}

// ================================================================== Complex
export function makeComplex(calc) {
  // % cannot be input in the Complex app (User's Guide p.61)
  const common = COMMON.map((c) => (c.label === 'Probability' ? { ...c, items: c.items.filter((it) => it.label !== '%') } : c));
  return new CalculateApp(calc, { complex: true, catalog: [COMPLEX_CAT, ...common] });
}

// ================================================================== Distribution
const DISTS = [
  { id: 'BPD', label: 'Binomial PD', list: true, params: ['N', 'p'] },
  { id: 'BCD', label: 'Binomial CD', list: true, params: ['N', 'p'] },
  { id: 'NPD', label: 'Normal PD', list: false, params: ['𝑥', 'μ', 'σ'] },
  { id: 'NCD', label: 'Normal CD', list: false, params: ['Lower', 'Upper', 'μ', 'σ'] },
  { id: 'INV', label: 'Inverse Normal', list: false, params: ['Area', 'μ', 'σ'] },
  { id: 'PPD', label: 'Poisson PD', list: true, params: ['λ'] },
  { id: 'PCD', label: 'Poisson CD', list: true, params: ['λ'] },
];

function lnFact(n) { let s = D(0); for (let k = 2; k <= n; k++) s = s.plus(Decimal.ln(k)); return s; }

export function distValue(id, x, P) {
  const need = (c) => { if (!c) throw new CalcError('Math'); };
  switch (id) {
    case 'BPD': case 'BCD': {
      const N = P.N.dec, p = P.p.dec;
      need(N.isInteger() && N.gte(0) && N.lte(100000) && p.gte(0) && p.lte(1));
      need(x.isInteger() && x.gte(0) && x.lte(N));
      const n = N.toNumber();
      const pmf = (k) => {
        if (p.isZero()) return k === 0 ? D(1) : D(0);
        if (p.eq(1)) return k === n ? D(1) : D(0);
        return Decimal.exp(lnFact(n).minus(lnFact(k)).minus(lnFact(n - k)).plus(Decimal.ln(p).times(k)).plus(Decimal.ln(D(1).minus(p)).times(n - k)));
      };
      if (id === 'BPD') return pmf(x.toNumber());
      let s = D(0);
      for (let k = 0; k <= x.toNumber(); k++) s = s.plus(pmf(k));
      return Decimal.min(s, 1);
    }
    case 'PPD': case 'PCD': {
      const l = P['λ'].dec;
      need(l.gt(0) && l.lte(100000000) && x.isInteger() && x.gte(0) && x.lte(100000));
      const pmf = (k) => Decimal.exp(l.neg().plus(Decimal.ln(l).times(k)).minus(lnFact(k)));
      if (id === 'PPD') return pmf(x.toNumber());
      let s = D(0);
      for (let k = 0; k <= x.toNumber(); k++) s = s.plus(pmf(k));
      return Decimal.min(s, 1);
    }
    case 'NPD': {
      const mu = P['μ'].dec, sg = P['σ'].dec;
      need(sg.gt(0));
      const z = P['𝑥'].dec.minus(mu).div(sg);
      return Decimal.exp(z.pow(2).div(-2)).div(sg.times(PI.times(2).sqrt()));
    }
    case 'NCD': {
      const mu = P['μ'].dec, sg = P['σ'].dec;
      need(sg.gt(0));
      const lo = P.Lower.dec, hi = P.Upper.dec;
      need(lo.lte(hi));
      return phi(hi.minus(mu).div(sg)).minus(phi(lo.minus(mu).div(sg)));
    }
    case 'INV': {
      const mu = P['μ'].dec, sg = P['σ'].dec, a = P.Area.dec;
      need(sg.gt(0) && a.gt(0) && a.lt(1));
      // bisection + Newton on Φ
      let lo = D(-40), hi = D(40);
      for (let i = 0; i < 200; i++) { const m = lo.plus(hi).div(2); if (phi(m).lt(a)) lo = m; else hi = m; }
      return lo.plus(hi).div(2).times(sg).plus(mu);
    }
    default: throw new CalcError('Math');
  }
}

export class DistributionApp {
  constructor(calc) {
    this.calc = calc;
    const saved = calc.mem.appState.dist || {};
    this.P = {};
    const def = { N: '0', p: '0', '𝑥': '0', 'μ': '0', 'σ': '1', Lower: '0', Upper: '0', Area: '0', 'λ': '0' };
    for (const k of Object.keys(def)) this.P[k] = Real.fromDecimalString(saved[k] || def[k]);
    this.mode = 'menu';
    this.xs = [];
    this.grid = new GridView({ cols: 2, headerDx: [-2, -1] }); // header offsets measured (p.108-111)
  }
  save() { const o = {}; for (const k of Object.keys(this.P)) o[k] = this.P[k].dec.toString(); this.calc.mem.appState.dist = o; }
  start() { this.mode = 'menu'; this.xs = []; this.showMenu(); }
  powerOn() { this.start(); }
  status() { return { angle: this.calc.settings.angle }; }
  showMenu() {
    const calc = this.calc;
    calc.push(new MenuScreen(calc, {
      group: 'dist', acCloses: false,
      items: DISTS.map((d) => ({ label: d.label, sub: d.list })),
      onSelect: (it, i) => {
        const d = DISTS[i];
        this.dist = d;
        if (!d.list) { calc.closeGroup('dist'); this.openParams(false); return; }
        calc.push(new MenuScreen(calc, {
          group: 'dist', acCloses: false, items: [{ label: 'List' }, { label: 'Variable' }],
          onSelect: (x, j) => { calc.closeGroup('dist'); if (j === 0) this.openList(); else this.openParams(false); },
        }));
      },
      onBack: () => { calc.pop(); if (this.mode === 'menu') calc.showHome = true; },
      status: () => this.status(),
    }));
  }
  openList() { this.mode = 'list'; this.results = null; this.editing = null; }
  openParams(fromList) {
    const calc = this.calc;
    this.mode = 'params';
    const d = this.dist;
    const names = fromList ? d.params : (['BPD', 'BCD', 'PPD', 'PCD'].includes(d.id) ? ['𝑥', ...d.params] : d.params);
    this.fromList = fromList;
    this.form = new ParamForm(calc, {
      title: d.label,
      fields: names.map((nm) => ({
        label: ' ' + nm, kind: 'value', get: () => this.P[nm], display: () => fmtSmall(calc, this.P[nm], 12),
        set: (v) => { this.P[nm] = v; this.save(); },
      })),
      action: { label: 'Execute', run: () => this.execute() },
      onBack: () => { if (fromList) this.mode = 'list'; else { this.mode = 'menu'; this.showMenu(); } },
      statusFn: () => this.status(),
    });
  }
  execute() {
    const calc = this.calc;
    try {
      if (this.fromList) {
        this.results = this.xs.map((x) => { try { return new Real(distValue(this.dist.id, x.dec, this.P)); } catch (e) { return 'ERROR'; } });
        this.mode = 'list'; this.grid.row = 0; this.grid.col = 0; this.grid.top = 0;
      } else {
        const x = this.P['𝑥'] ? this.P['𝑥'].dec : D(0);
        const v = new Real(distValue(this.dist.id, x, this.P));
        this.value = v;
        calc.mem.ans = v;
        this.mode = 'value';
      }
    } catch (e) { calc.push(errorScreen(calc, e instanceof CalcError ? e : new CalcError('Math'), () => {})); }
  }
  key(k) {
    const calc = this.calc;
    if (this.mode === 'params') { this.form.key(k); return; }
    if (this.mode === 'value') {
      if (['OK', 'EXE', 'BACK', 'AC'].includes(k)) this.mode = 'params';
      if (k === 'VARIABLE') calc.push(storeOnly(calc, this.value));
      return;
    }
    if (this.mode !== 'list') return;
    const g = this.grid;
    if (this.editing) {
      if (k === 'EXE' || k === 'OK' || k === 'DOWN') {
        try {
          const v = this.editing.value();
          if (!(v instanceof Real)) throw new CalcError('Math');
          if (g.row >= this.xs.length) this.xs.push(v); else this.xs[g.row] = v;
          this.results = null; this.editing = null;
          if (g.row < 44) { g.row++; g.ensure(); }
        } catch (e) { calc.push(errorScreen(calc, e instanceof CalcError ? e : new CalcError('Math'), () => {})); }
        return;
      }
      if (k === 'AC') { this.editing = null; return; }
      this.editing.key(k);
      return;
    }
    switch (k) {
      case 'UP': if (g.row > 0) g.row--; g.ensure(); return;
      case 'DOWN': if (g.row < Math.min(this.xs.length, 44)) g.row++; g.ensure(); return;
      case 'LEFT': g.col = 0; return;
      case 'RIGHT': if (this.results) g.col = 1; return;
      case 'OK': case 'EXE': this.openParams(true); return;
      case 'DEL': if (g.row < this.xs.length) { this.xs.splice(g.row, 1); this.results = null; } return;
      case 'BACK': this.mode = 'menu'; this.showMenu(); return;
      case 'VARIABLE': { const v = g.col === 0 ? this.xs[g.row] : this.results && this.results[g.row]; if (v instanceof Real) calc.push(storeOnly(calc, v)); return; }
      case 'TOOLS':
        calc.push(new MenuScreen(calc, {
          group: 'disttools', items: [{ label: 'Edit', sub: true }],
          onSelect: () => calc.push(new MenuScreen(calc, {
            group: 'disttools', items: [{ label: 'Insert Row' }, { label: 'Delete All' }],
            onSelect: (x, j) => {
              calc.closeGroup('disttools');
              if (j === 0) { if (this.xs.length < 45) this.xs.splice(g.row, 0, Real.int(0)); } else { this.xs = []; g.row = 0; g.top = 0; }
              this.results = null;
            },
          })),
          status: () => this.status(),
        }));
        return;
      default: break;
    }
    if (g.col === 0 && /^(D\d|DOT|NEG|SUB|LPAR|ANS|PI|E|SQRT|FRAC|VA|VB|VC|VD|VE|VF|VX|VY|VZ|X)$/.test(k)) {
      this.editing = new ValueInput(calc, { firstKey: k, math: false });
    }
  }
  render(lcd, blink) {
    if (this.mode === 'params') { this.form.render(lcd, blink); return; }
    if (this.mode === 'value') {
      const nm = this.dist.id === 'INV' ? '𝑥Inv=' : 'p=';
      lcd.bigText(nm, 3, 9);
      drawResult(lcd, decimalSeq(this.value.dec, this.calc.settings));
      return;
    }
    if (this.mode !== 'list') return;
    const g = this.grid;
    g.draw(lcd, {
      rowCount: this.xs.length, headers: ['x', 'P'],
      getCell: (r, c) => {
        if (c === 0) return fmtSmall(this.calc, this.xs[r], 6);
        const v = this.results && this.results[r];
        return v === 'ERROR' ? 'ERROR' : v ? fmtSmall(this.calc, v, 6) : '';
      },
      selVisible: !this.editing,
    });
    const parts = this.dist.label.split(' ');
    lcd.bigText(parts[0], 107, 10);
    lcd.bigText(parts.slice(1).join(' '), 107, 26);
    if (this.editing) this.editing.draw(lcd, blink, { top: 58 });
    else {
      const v = g.col === 0 ? this.xs[g.row] : this.results && this.results[g.row];
      if (v instanceof Real) drawResult(lcd, decimalSeq(v.dec, this.calc.settings));
    }
  }
}

export const makeInequality = (calc) => new InequalityApp(calc);
export const makeRatio = (calc) => new RatioApp(calc);
export const makeDistribution = (calc) => new DistributionApp(calc);
void recognize; void seqText;
