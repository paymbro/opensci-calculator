// Statistics app (User's Guide p.76-93): data editor, 1-/2-variable results, 7 regression types,
// Statistics Calc screen with statistical variables, normal distribution P( Q( R( ▸t.
import { Decimal, Real, CalcError, PI } from '../core/num.js';
import { MenuScreen } from '../core/calc.js';
import { LCD } from '../core/lcd.js';
import { COMMON, statisticsCategory, regressionItems } from '../core/catalog.js';
import { decimalText } from '../core/format.js';
import { ValueInput, ResultList, GridView, fmtSmall } from './widgets.js';
import { LineCalcScreen } from './linecalc.js';
import { errorScreen, drawResult } from './common.js';

export const REG_TYPES = [
  ['y=a+bx', 'lin'], ['y=a+bx+cx²', 'quad'], ['y=a+b·ln(x)', 'log'], ['y=a·𝑒^(bx)', 'exp'],
  ['y=a·b^x', 'abexp'], ['y=a·x^b', 'pow'], ['y=a+b/x', 'inv'],
];

const D = (x) => new Decimal(x);

// ------------------------------------------------------------------ statistics engine
export class StatData {
  constructor(rows, twoVar, freq) { this.rows = rows; this.twoVar = twoVar; this.freq = freq; }
  pts() {
    return this.rows.map((r) => ({ x: r.x.dec, y: this.twoVar ? (r.y ? r.y.dec : D(0)) : null, f: this.freq ? (r.f ? r.f.dec : D(1)) : D(1) }));
  }
  sums() {
    const P = this.pts();
    if (!P.length) throw new CalcError('Math');
    const s = { n: D(0), x: D(0), x2: D(0), y: D(0), y2: D(0), xy: D(0), x3: D(0), x2y: D(0), x4: D(0) };
    for (const p of P) {
      if (p.f.isNeg()) throw new CalcError('Math');
      s.n = s.n.plus(p.f);
      s.x = s.x.plus(p.x.times(p.f)); s.x2 = s.x2.plus(p.x.pow(2).times(p.f));
      if (this.twoVar) {
        s.y = s.y.plus(p.y.times(p.f)); s.y2 = s.y2.plus(p.y.pow(2).times(p.f)); s.xy = s.xy.plus(p.x.times(p.y).times(p.f));
        s.x3 = s.x3.plus(p.x.pow(3).times(p.f)); s.x2y = s.x2y.plus(p.x.pow(2).times(p.y).times(p.f)); s.x4 = s.x4.plus(p.x.pow(4).times(p.f));
      }
    }
    if (s.n.isZero()) throw new CalcError('Math');
    return s;
  }
  get(name) {
    const s = this.sums();
    const n = s.n;
    const mean = (a) => a.div(n);
    const varp = (a, a2) => a2.div(n).minus(mean(a).pow(2));
    const vars = (a, a2) => { if (n.lte(1)) throw new CalcError('Math'); return a2.minus(a.pow(2).div(n)).div(n.minus(1)); };
    const clamp = (v) => (v.isNeg() ? D(0) : v);
    switch (name) {
      case 'n': return n;
      case 'Σ𝑥': return s.x; case 'Σ𝑥²': return s.x2; case 'Σ𝑦': return s.y; case 'Σ𝑦²': return s.y2;
      case 'Σ𝑥𝑦': return s.xy; case 'Σ𝑥³': return s.x3; case 'Σ𝑥²𝑦': return s.x2y; case 'Σ𝑥⁴': return s.x4;
      case '𝑥̄': return mean(s.x); case '𝑦̄': return mean(s.y);
      case 'σ²𝑥': return clamp(varp(s.x, s.x2)); case 'σ𝑥': return clamp(varp(s.x, s.x2)).sqrt();
      case 's²𝑥': return clamp(vars(s.x, s.x2)); case 's𝑥': return clamp(vars(s.x, s.x2)).sqrt();
      case 'σ²𝑦': return clamp(varp(s.y, s.y2)); case 'σ𝑦': return clamp(varp(s.y, s.y2)).sqrt();
      case 's²𝑦': return clamp(vars(s.y, s.y2)); case 's𝑦': return clamp(vars(s.y, s.y2)).sqrt();
      case 'min(𝑥)': return Decimal.min(...this.pts().map((p) => p.x));
      case 'max(𝑥)': return Decimal.max(...this.pts().map((p) => p.x));
      case 'min(𝑦)': return Decimal.min(...this.pts().map((p) => p.y));
      case 'max(𝑦)': return Decimal.max(...this.pts().map((p) => p.y));
      case 'Q₁': return this.quartile(1); case 'Med': return this.quartile(2); case 'Q₃': return this.quartile(3);
      default: break;
    }
    throw new CalcError('Syntax');
  }
  // Casio quartile method: median of the lower/upper half (median excluded when n is odd)
  quartile(q) {
    const P = this.pts().filter((p) => p.f.gt(0)).sort((a, b) => a.x.cmp(b.x));
    for (const p of P) if (!p.f.isInteger()) throw new CalcError('Math');
    const N = P.reduce((a, p) => a + p.f.toNumber(), 0);
    if (N < 1) throw new CalcError('Math');
    const at = (k) => { // 1-based k-th value
      let c = 0;
      for (const p of P) { c += p.f.toNumber(); if (k <= c) return p.x; }
      return P[P.length - 1].x;
    };
    const median = (lo, hi) => { // positions lo..hi inclusive
      const m = hi - lo + 1;
      if (m % 2) return at(lo + (m - 1) / 2);
      return at(lo + m / 2 - 1).plus(at(lo + m / 2)).div(2);
    };
    if (q === 2) return median(1, N);
    if (N === 1) return at(1);
    const half = Math.floor(N / 2);
    if (q === 1) return median(1, half);
    return median(N - half + 1, N);
  }
  regression(type) {
    const P = this.pts();
    if (P.length < 1) throw new CalcError('Math');
    const tf = {
      lin: [(x) => x, (y) => y], quad: null, log: [(x) => { if (x.lte(0)) throw new CalcError('Math'); return Decimal.ln(x); }, (y) => y],
      exp: [(x) => x, (y) => { if (y.lte(0)) throw new CalcError('Math'); return Decimal.ln(y); }],
      abexp: [(x) => x, (y) => { if (y.lte(0)) throw new CalcError('Math'); return Decimal.ln(y); }],
      pow: [(x) => { if (x.lte(0)) throw new CalcError('Math'); return Decimal.ln(x); }, (y) => { if (y.lte(0)) throw new CalcError('Math'); return Decimal.ln(y); }],
      inv: [(x) => { if (x.isZero()) throw new CalcError('Math'); return D(1).div(x); }, (y) => y],
    }[type];
    if (type === 'quad') {
      let n = D(0), sx = D(0), sx2 = D(0), sx3 = D(0), sx4 = D(0), sy = D(0), sxy = D(0), sx2y = D(0);
      for (const p of P) {
        n = n.plus(p.f); sx = sx.plus(p.x.times(p.f)); sx2 = sx2.plus(p.x.pow(2).times(p.f)); sx3 = sx3.plus(p.x.pow(3).times(p.f));
        sx4 = sx4.plus(p.x.pow(4).times(p.f)); sy = sy.plus(p.y.times(p.f)); sxy = sxy.plus(p.x.times(p.y).times(p.f)); sx2y = sx2y.plus(p.x.pow(2).times(p.y).times(p.f));
      }
      const Sxx = sx2.minus(sx.pow(2).div(n)), Sxy = sxy.minus(sx.times(sy).div(n)), Sxx2 = sx3.minus(sx.times(sx2).div(n));
      const Sx2x2 = sx4.minus(sx2.pow(2).div(n)), Sx2y = sx2y.minus(sx2.times(sy).div(n));
      const den = Sxx.times(Sx2x2).minus(Sxx2.pow(2));
      if (den.isZero()) throw new CalcError('Math');
      const b = Sxy.times(Sx2x2).minus(Sx2y.times(Sxx2)).div(den);
      const c = Sx2y.times(Sxx).minus(Sxy.times(Sxx2)).div(den);
      const a = sy.div(n).minus(b.times(sx.div(n))).minus(c.times(sx2.div(n)));
      return { a, b, c };
    }
    let n = D(0), sX = D(0), sY = D(0), sXX = D(0), sYY = D(0), sXY = D(0);
    for (const p of P) {
      const X = tf[0](p.x), Y = tf[1](p.y);
      n = n.plus(p.f); sX = sX.plus(X.times(p.f)); sY = sY.plus(Y.times(p.f));
      sXX = sXX.plus(X.pow(2).times(p.f)); sYY = sYY.plus(Y.pow(2).times(p.f)); sXY = sXY.plus(X.times(Y).times(p.f));
    }
    const Sxx = sXX.minus(sX.pow(2).div(n)), Syy = sYY.minus(sY.pow(2).div(n)), Sxy = sXY.minus(sX.times(sY).div(n));
    if (Sxx.isZero()) throw new CalcError('Math');
    let b = Sxy.div(Sxx);
    let a = sY.div(n).minus(b.times(sX.div(n)));
    const rden = Sxx.times(Syy).sqrt();
    const r = rden.isZero() ? D(0) : Sxy.div(rden);
    if (type === 'exp' || type === 'pow') a = Decimal.exp(a);
    if (type === 'abexp') { a = Decimal.exp(a); b = Decimal.exp(b); }
    return { a, b, r };
  }
  estimate(type, op, v) {
    const R = this.regression(type);
    const { a, b } = R;
    switch (op) {
      case 'ŷ':
        switch (type) {
          case 'lin': return a.plus(b.times(v));
          case 'quad': return a.plus(b.times(v)).plus(R.c.times(v.pow(2)));
          case 'log': if (v.lte(0)) throw new CalcError('Math'); return a.plus(b.times(Decimal.ln(v)));
          case 'exp': return a.times(Decimal.exp(b.times(v)));
          case 'abexp': return a.times(b.pow(v));
          case 'pow': if (v.lte(0)) throw new CalcError('Math'); return a.times(v.pow(b));
          case 'inv': if (v.isZero()) throw new CalcError('Math'); return a.plus(b.div(v));
          default: break;
        }
        break;
      case 'x̂':
        switch (type) {
          case 'lin': if (b.isZero()) throw new CalcError('Math'); return v.minus(a).div(b);
          case 'log': return Decimal.exp(v.minus(a).div(b));
          case 'exp': { const t = v.div(a); if (t.lte(0)) throw new CalcError('Math'); return Decimal.ln(t).div(b); }
          case 'abexp': { const t = v.div(a); if (t.lte(0) || b.lte(0)) throw new CalcError('Math'); return Decimal.ln(t).div(Decimal.ln(b)); }
          case 'pow': { const t = v.div(a); if (t.lte(0)) throw new CalcError('Math'); return t.pow(D(1).div(b)); }
          case 'inv': { const t = v.minus(a); if (t.isZero()) throw new CalcError('Math'); return b.div(t); }
          default: break;
        }
        break;
      case 'x̂1': case 'x̂2': {
        if (type !== 'quad') throw new CalcError('Syntax');
        const c = R.c;
        if (c.isZero()) throw new CalcError('Math');
        const disc = b.pow(2).minus(c.times(4).times(a.minus(v)));
        if (disc.isNeg()) throw new CalcError('Math');
        const sq = disc.sqrt();
        return op === 'x̂1' ? b.neg().plus(sq).div(c.times(2)) : b.neg().minus(sq).div(c.times(2));
      }
      default: break;
    }
    throw new CalcError('Syntax');
  }
}

// standard normal cumulative distribution
export function phi(t) {
  // Φ(t) = ½ erfc(−t/√2), erfc via continued fraction / series with Decimal
  return D(0.5).times(erfc(t.neg().div(D(2).sqrt())));
}
export function erfc(x) {
  if (x.isNeg()) return D(2).minus(erfc(x.neg()));
  if (x.lt(3)) {
    // series erf(x) = 2/√π Σ (−1)^n x^(2n+1)/(n!(2n+1))
    let sum = D(0), term = x, n = 0;
    const x2 = x.times(x);
    while (term.abs().gt('1e-30') && n < 400) {
      sum = sum.plus(term.div(2 * n + 1));
      n++;
      term = term.times(x2).neg().div(n);
    }
    return D(1).minus(sum.times(2).div(PI.sqrt()));
  }
  // continued fraction for large x
  let f = D(0);
  for (let k = 120; k >= 1; k--) f = D(k).div(2).div(x.plus(f));
  return Decimal.exp(x.times(x).neg()).div(PI.sqrt()).div(x.plus(f));
}

// ------------------------------------------------------------------ app
export class StatisticsApp {
  constructor(calc) {
    this.calc = calc;
    const st = calc.mem.appState.stat;
    this.twoVar = st ? st.twoVar : false;
    this.freq = st ? st.freq : true;
    this.rows = [];
    this.regType = 'lin';
    this.grid = new GridView({ cols: 2 });
    this.mode = 'select';
    this.editing = null;
  }

  start() { this.mode = 'select'; this.rows = []; this.showTypeMenu(true); }
  powerOn() { this.start(); }
  onSettingsChange() {}

  status() { return { angle: this.calc.settings.angle, fix: this.calc.settings.numFormat.kind === 'Fix', sci: this.calc.settings.numFormat.kind === 'Sci' }; }

  get cols() { return this.twoVar ? (this.freq ? ['𝑥', '𝑦', 'Freq'] : ['𝑥', '𝑦']) : (this.freq ? ['𝑥', 'Freq'] : ['𝑥']); }
  maxRows() { const n = this.cols.length; return n === 1 ? 160 : n === 2 ? 80 : 53; }
  data() { return new StatData(this.rows, this.twoVar, this.freq); }

  showTypeMenu(atLaunch) {
    const calc = this.calc;
    calc.push(new MenuScreen(calc, {
      group: 'stattype', acCloses: false,
      items: [{ label: '1-Variable' }, { label: '2-Variable' }],
      onSelect: (it, i) => {
        calc.pop();
        const two = i === 1;
        if (two !== this.twoVar || atLaunch) this.rows = [];
        this.twoVar = two;
        this.save();
        this.mode = 'editor';
        this.grid = new GridView({ cols: this.cols.length });
      },
      onBack: () => { calc.pop(); if (this.mode === 'select') { calc.showHome = true; } },
      status: () => this.status(),
    }));
  }

  save() { this.calc.mem.appState.stat = { twoVar: this.twoVar, freq: this.freq }; }

  // ---------------------------------------------------------------- editor keys
  key(k) {
    if (this.mode === 'calc') { this.calcScreen.key(k); return; }
    if (this.mode !== 'editor') return;
    const calc = this.calc, g = this.grid;
    if (this.editing) {
      if (k === 'EXE' || k === 'OK' || k === 'DOWN') {
        try {
          const v = this.editing.value();
          if (!(v instanceof Real)) throw new CalcError('Math');
          this.setCell(g.row, g.col, v);
          this.editing = null;
          if (g.row < this.maxRows() - 1) { g.row++; g.ensure(); }
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
      case 'RIGHT': if (g.col < this.cols.length - 1) g.col++; return;
      case 'PGUP': g.row = Math.max(0, g.row - 4); g.ensure(); return;
      case 'PGDN': g.row = Math.min(this.rows.length, g.row + 4); g.ensure(); return;
      case 'DEL': if (g.row < this.rows.length) this.rows.splice(g.row, 1); return;
      case 'OK': this.resultsMenu(); return;
      case 'TOOLS': this.toolsMenu(); return;
      case 'BACK': this.showTypeMenu(false); return;
      case 'AC': return;
      case 'VARIABLE': {
        // store the highlighted value (variables locked for editing here)
        const v = this.cellValue(g.row, g.col);
        calc.push(variableStoreScreen(calc, v));
        return;
      }
      case 'SETTINGS': case 'CATALOG': case 'CATLIST': case 'FUNCTION':
        return;
      default: break;
    }
    if (/^(D\d|DOT|NEG|SUB|LPAR|ANS|PI|E|SQRT|FRAC|VA|VB|VC|VD|VE|VF|VX|VY|VZ|X|SIN|COS|TAN|LOG|LN|LOGB)$/.test(k)) {
      this.editing = new ValueInput(calc, { firstKey: k, math: false });
    }
  }

  colKey(c) { return ['x', this.twoVar ? 'y' : 'f', 'f'][c] === 'f' && this.cols[c] === 'Freq' ? 'f' : ['x', 'y', 'f'][c]; }
  cellValue(r, c) {
    const row = this.rows[r];
    if (!row) return null;
    const name = this.cols[c];
    return name === '𝑥' ? row.x : name === '𝑦' ? row.y : row.f;
  }
  setCell(r, c, v) {
    while (this.rows.length <= r) this.rows.push({ x: Real.int(0), y: Real.int(0), f: Real.int(1) });
    const row = this.rows[r];
    const name = this.cols[c];
    if (name === '𝑥') row.x = v; else if (name === '𝑦') row.y = v; else row.f = v;
  }

  toolsMenu() {
    const calc = this.calc;
    const g = 'stattools';
    const editMenu = () => new MenuScreen(calc, {
      group: g, items: [{ label: 'Insert Row' }, { label: 'Delete All' }],
      onSelect: (it, i) => {
        calc.closeGroup(g);
        if (i === 0) { if (this.rows.length < this.maxRows()) this.rows.splice(this.grid.row, 0, { x: Real.int(0), y: Real.int(0), f: Real.int(1) }); } else { this.rows = []; this.grid.row = 0; this.grid.top = 0; }
      },
    });
    const sortMenu = () => {
      const items = [['𝑥 Ascending', 'x', 1], ['𝑥 Descending', 'x', -1]];
      if (this.twoVar) items.push(['𝑦 Ascending', 'y', 1], ['𝑦 Descending', 'y', -1]);
      if (this.freq) items.push(['Freq Ascending', 'f', 1], ['Freq Descending', 'f', -1]);
      return new MenuScreen(calc, {
        group: g, items: items.map(([label]) => ({ label })),
        onSelect: (it, i) => {
          calc.closeGroup(g);
          const [, key, dir] = items[i];
          this.rows.sort((a, b) => a[key].dec.cmp(b[key].dec) * dir);
        },
      });
    };
    const freqMenu = () => new MenuScreen(calc, {
      group: g, title: 'Frequency?', items: [{ label: 'On', radio: this.freq }, { label: 'Off', radio: !this.freq }],
      onSelect: (it, i) => {
        calc.closeGroup(g);
        const f = i === 0;
        if (f !== this.freq) { this.freq = f; this.rows = []; this.grid = new GridView({ cols: this.cols.length }); this.save(); }
      },
    });
    calc.push(new MenuScreen(calc, {
      group: g,
      items: [{ label: 'Select Type', sub: true }, { label: 'Edit', sub: true }, { label: 'Sort', sub: true }, { label: 'Frequency', sub: true }],
      onSelect: (it, i) => {
        if (i === 0) { calc.closeGroup(g); this.showTypeMenu(false); }
        if (i === 1) calc.push(editMenu());
        if (i === 2) calc.push(sortMenu());
        if (i === 3) calc.push(freqMenu());
      },
      status: () => this.status(),
    }));
  }

  // ---------------------------------------------------------------- results
  resultsMenu() {
    const calc = this.calc;
    const g = 'statres';
    const items = this.twoVar
      ? [{ label: '2-Var Results' }, { label: 'Reg Results', sub: true }, { label: 'Statistics Calc', sub: true }]
      : [{ label: '1-Var Results' }, { label: 'Statistics Calc' }];
    calc.push(new MenuScreen(calc, {
      group: g, items,
      onSelect: (it, i) => {
        if (i === 0) { calc.closeGroup(g); this.showVarResults(); return; }
        if (this.twoVar) {
          calc.push(this.regTypeMenu(g, (t) => { calc.closeGroup(g); this.regType = t; if (i === 1) this.showRegResults(); else this.openCalc(); }));
          return;
        }
        calc.closeGroup(g);
        this.openCalc();
      },
      status: () => this.status(),
    }));
  }

  regTypeMenu(group, then) {
    return new MenuScreen(this.calc, {
      group, items: REG_TYPES.map(([label]) => ({ label })),
      sel: REG_TYPES.findIndex(([, t]) => t === this.regType),
      onSelect: (it, i) => then(REG_TYPES[i][1]),
      status: () => this.status(),
    });
  }

  fmtStat(v) {
    const S = { ...this.calc.settings, digitSep: false };
    return decimalText(v, S, this.calc.settings.numFormat.kind === 'Norm' ? { kind: 'Norm', n: this.calc.settings.numFormat.n } : this.calc.settings.numFormat);
  }

  varRows() {
    const d = this.data();
    const names = this.twoVar
      ? ['𝑥̄', 'Σ𝑥', 'Σ𝑥²', 'σ²𝑥', 'σ𝑥', 's²𝑥', 's𝑥', 'n', '𝑦̄', 'Σ𝑦', 'Σ𝑦²', 'σ²𝑦', 'σ𝑦', 's²𝑦', 's𝑦', 'Σ𝑥𝑦', 'Σ𝑥³', 'Σ𝑥²𝑦', 'Σ𝑥⁴', 'min(𝑥)', 'max(𝑥)', 'min(𝑦)', 'max(𝑦)']
      : ['𝑥̄', 'Σ𝑥', 'Σ𝑥²', 'σ²𝑥', 'σ𝑥', 's²𝑥', 's𝑥', 'n', 'min(𝑥)', 'Q₁', 'Med', 'Q₃', 'max(𝑥)'];
    return names.map((nm) => {
      let v;
      try { v = this.fmtStat(d.get(nm)); } catch (e) { v = 'ERROR'; }
      return [nm, v];
    });
  }

  showVarResults() {
    const calc = this.calc;
    try { this.data().sums(); } catch (e) { calc.push(errorScreen(calc, e, () => {})); return; }
    calc.push(Object.assign(new ResultList(calc, { rows: this.varRows(), onBack: () => calc.pop(), statusFn: () => this.status() }), { group: 'statview' }));
  }

  regRows() {
    const R = this.data().regression(this.regType);
    const keys = this.regType === 'quad' ? ['a', 'b', 'c'] : ['a', 'b', 'r'];
    return keys.map((k) => [k, this.fmtStat(R[k])]);
  }

  showRegResults() {
    const calc = this.calc;
    let rows;
    try { rows = this.regRows(); } catch (e) { calc.push(errorScreen(calc, e instanceof CalcError ? e : new CalcError('Math'), () => {})); return; }
    const label = REG_TYPES.find(([, t]) => t === this.regType)[0];
    calc.push(Object.assign(new ResultList(calc, { rows, header: label, onBack: () => calc.pop(), statusFn: () => this.status(), valueX: 76 }), { group: 'statview' }));
  }

  // ---------------------------------------------------------------- statistics calc screen
  statContext() {
    const app = this;
    return {
      get: (name) => new Real(app.data().get(name)),
      estimate: (op, v) => new Real(app.data().estimate(app.regType, op, v.dec)),
      normProb: (which, t) => {
        if (app.twoVar) throw new CalcError('Syntax');
        let p;
        const td = t.dec;
        if (which === 'P') p = phi(td);
        else if (which === 'R') p = D(1).minus(phi(td));
        else p = phi(td.abs()).minus(0.5);
        return new Real(p.toDecimalPlaces(4));
      },
      normT: (x) => {
        if (app.twoVar) throw new CalcError('Syntax');
        const d = app.data();
        const s = d.get('σ𝑥');
        if (s.isZero()) throw new CalcError('Math');
        return new Real(x.dec.minus(d.get('𝑥̄')).div(s));
      },
    };
  }

  catalog() {
    const cat = statisticsCategory(this.twoVar);
    if (this.twoVar) cat.items = cat.items.map((c) => (c.label === 'Regression' ? { label: 'Regression', items: regressionItems(this.regType) } : c));
    return [cat, ...COMMON];
  }

  openCalc() {
    const calc = this.calc;
    const label = this.twoVar ? REG_TYPES.find(([, t]) => t === this.regType)[0] : '1-Variable';
    this.mode = 'calc';
    this.calcScreen = new LineCalcScreen(calc, {
      label: ['Statistics', label],
      catalog: this.catalog(),
      evalExtra: () => ({ stat: this.statContext() }),
      status: () => this.status(),
      onBack: () => { this.mode = 'editor'; },
      onAC: () => {},
      tools: () => {
        const g = 'statcalctools';
        const items = this.twoVar
          ? [{ label: '2-Var Results' }, { label: 'Reg Results' }, { label: 'Select Reg Type', sub: true }]
          : [{ label: '1-Var Results' }];
        calc.push(new MenuScreen(calc, {
          group: g, items,
          onSelect: (it, i) => {
            if (i === 0) { calc.closeGroup(g); this.showVarResults(); }
            if (i === 1) { calc.closeGroup(g); this.showRegResults(); }
            if (i === 2) calc.push(this.regTypeMenu(g, (t) => { calc.closeGroup(g); this.regType = t; this.openCalc(); }));
          },
          status: () => this.status(),
        }));
      },
    });
  }

  // ---------------------------------------------------------------- render
  render(lcd, blink) {
    if (this.mode === 'calc') { this.calcScreen.render(lcd, blink); return; }
    if (this.mode !== 'editor') return;
    const g = this.grid;
    g.cols = this.cols.length;
    g.draw(lcd, {
      rowCount: this.rows.length,
      headers: this.cols.map((h) => ({ '𝑥': 'x', '𝑦': 'y' })[h] || h),
      getCell: (r, c) => { const v = this.cellValue(r, c); return v ? fmtSmall(this.calc, v, 6) : ''; },
      selVisible: !this.editing,
    });
    if (this.editing) {
      this.editing.draw(lcd, blink, { top: 58 });
    } else {
      const v = this.cellValue(g.row, g.col);
      if (v) drawResult(lcd, formatCell(this.calc, v));
    }
  }
}

function formatCell(calc, v) {
  const S = { ...calc.settings, io: 'LineI/DecimalO' };
  return decimalSeqLocal(v, S);
}
import { decimalSeq } from '../core/format.js';
function decimalSeqLocal(v, S) { return decimalSeq(v.dec, S); }

export function variableStoreScreen(calc, value) {
  // VARIABLE pressed in an editor: variable list with the highlighted value available for Store
  return {
    group: 'variable',
    sel: 0,
    key(k) {
      const names = ['A', 'B', 'C', 'D', 'E', 'F', 'x', 'y', 'z'];
      if (k === 'UP') { if (this.sel >= 2) this.sel -= 2; return true; }
      if (k === 'DOWN') { if (this.sel + 2 < names.length) this.sel += 2; return true; }
      if (k === 'LEFT') { if (this.sel % 2) this.sel--; return true; }
      if (k === 'RIGHT') { if (this.sel % 2 === 0 && this.sel + 1 < names.length) this.sel++; return true; }
      if (k === 'BACK' || k === 'AC' || k === 'VARIABLE') { calc.pop(); return true; }
      if ((k === 'OK' || k === 'EXE') && value) {
        const name = names[this.sel];
        calc.push(new MenuScreen(calc, {
          group: 'variable', title: name + '=', items: [{ label: 'Store' }],
          onSelect: () => { calc.mem.vars[name] = value; calc.pop(); },
        }));
        return true;
      }
      return true;
    },
    render(lcd) {
      const names = ['A', 'B', 'C', 'D', 'E', 'F', 'x', 'y', 'z'];
      names.forEach((v, i) => {
        const col = i % 2, row = Math.floor(i / 2);
        const x = 3 + col * 96, y = 12 + row * 13;
        lcd.smallText((v === 'x' ? '𝑥' : v === 'y' ? '𝑦' : v === 'z' ? '𝑧' : v) + '=' + calc.formatVarValue(calc.mem.vars[v]), x, y);
        if (i === this.sel) { lcd.invert(2, y - 1, col ? 94 : 92, 11); lcd.fill(x + 84, y, 5, 8, 0); }
      });
    },
  };
}

export function makeStatistics(calc) { return new StatisticsApp(calc); }
void LCD;
