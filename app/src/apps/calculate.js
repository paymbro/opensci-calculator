// Calculate app (and the base for Complex / Base-N style "expression → result" apps).
import { Editor, cloneSeq } from '../core/expr.js';
import { inputKey } from '../core/input.js';
import { CalcError, Real, recognize } from '../core/num.js';
import { Cx } from '../core/eval.js';
import {
  formatValue, sexagesimalSeq, standardFormSeq, primeFactorSeq, recurringSeq, mixedSeq, formatComplex, decimalSeq,
} from '../core/format.js';
import { MenuScreen } from '../core/calc.js';
import { COMMON } from '../core/catalog.js';
import {
  drawMathInput, drawLineInput, drawResult, evaluate, placeCursorAt, errorScreen, globalMenus, specInsert,
} from './common.js';

const ANS_KEYS = new Set(['ADD', 'SUB', 'MUL', 'DIV', 'SQR', 'RECIP', 'POW', 'FRAC']);
const ANS_CATALOG_POSTFIX = new Set(['%', '!', '°', 'ʳ', 'ᵍ', '▫', '³']);

export class CalculateApp {
  constructor(calc, opts = {}) {
    this.calc = calc;
    this.opts = opts;               // { complex, catalog, title }
    this.history = [];              // [{root, value, mode, fmt}]
    this.hpos = -1;                 // index into history while showing a result
    this.ed = calc.newEditor();
    this.state = 'input';           // 'input' | 'result'
    this.inState = {};
    this.resState = {};
  }

  start() { this.ed = this.calc.newEditor(); this.state = 'input'; this.history = []; this.hpos = -1; }
  powerOn() { this.start(); }
  onSettingsChange() { this.start(); }

  get S() { return this.calc.settings; }

  status() {
    const cur = this.state === 'result' && this.hpos >= 0 ? this.hpos : this.history.length;
    const nf = this.S.numFormat;
    return {
      mathI: this.calc.math, angle: this.S.angle, fix: nf.kind === 'Fix', sci: nf.kind === 'Sci',
      cplx: this.opts.complex ? (this.S.complex === 'r∠θ' ? '∠' : 'i') : null,
      // live result: ▲ whenever history exists; browsing older entries: ▲ if older ones remain, ▼ always
      up: this.state === 'result' ? (cur === this.history.length - 1 ? true : cur > 0) : this.history.length > 0,
      down: this.state === 'result' && cur < this.history.length - 1,
    };
  }

  // ------------------------------------------------------------ keys
  key(k) {
    const calc = this.calc;
    if (globalMenus(calc, k, this, { catalog: this.opts.catalog || COMMON, storeValue: this.state === 'result' ? () => this.current().value : null })) return;
    if (k === 'TOOLS') { calc.push(this.toolsMenu()); return; }
    if (k === 'QR') return; // QR codes intentionally not provided in this app
    if (k === 'OK') k = 'EXE'; // OK and EXE perform the same operation (User's Guide p.8)

    if (this.state === 'result') {
      if (this.resultKey(k)) return;
    }
    switch (k) {
      case 'EXE': this.execute('std'); return;
      case 'APPROX': this.execute('dec'); return;
      case 'AC': this.ed.clear(); this.state = 'input'; this.hpos = -1; return;
      case 'UP':
        if (this.ed.up()) return;
        if (this.history.length) this.showHistory(this.history.length - 1);
        return;
      case 'DOWN': this.ed.down(); return;
      case 'BACK': return;
      case 'FORMAT': case 'FMT2': return;
      case 'OK': return;
      default: break;
    }
    this.edKey(k);
  }

  edKey(k) {
    inputKey(this.ed, k, { settings: this.S, allowI: !!this.opts.complex });
  }

  resultKey(k) {
    const ed = this.ed;
    const startNew = () => { ed.clear(); this.state = 'input'; this.hpos = -1; };
    switch (k) {
      case 'UP': if (this.hpos > 0) this.showHistory(this.hpos - 1); return true;
      case 'DOWN': if (this.hpos < this.history.length - 1) this.showHistory(this.hpos + 1); return true;
      case 'LEFT': case 'BACK': this.editCurrent(true); return true;
      case 'RIGHT': this.editCurrent(false); return true;
      case 'DEL': this.editCurrent(true); return true;
      case 'INS': this.editCurrent(true); return true;
      case 'EXE': this.ed.setFrom(this.current().root); this.execute('std'); return true;
      case 'APPROX': this.ed.setFrom(this.current().root); this.execute('dec'); return true;
      case 'AC': startNew(); return true;
      case 'FORMAT':
        if (this.S.formatKey === 'toggle') this.toggleFormat(); else this.formatMenu();
        return true;
      case 'FMT2':
        if (this.S.formatKey === 'toggle') this.formatMenu(); else this.toggleFormat();
        return true;
      case 'OK': case 'PGUP': case 'PGDN': return true;
      default: break;
    }
    if (ANS_KEYS.has(k) && !(k === 'FRAC' && this.calc.math && false)) {
      startNew();
      ed.insertToken('Ans');
      this.edKey(k);
      return true;
    }
    // any other input key starts a new calculation
    startNew();
    return false;
  }

  insertSpec(spec) {
    if (this.state === 'result') {
      const post = spec.tokens && spec.tokens.length === 1 && ANS_CATALOG_POSTFIX.has(spec.tokens[0]);
      this.ed.clear(); this.state = 'input'; this.hpos = -1;
      if (post || (spec.key && ANS_KEYS.has(spec.key))) this.ed.insertToken('Ans');
    }
    specInsert(this.ed, spec, this.calc);
  }

  editCurrent(atEnd) {
    const h = this.current();
    this.ed.setFrom(h.root);
    if (!atEnd) this.ed.home();
    this.state = 'input';
    this.hpos = -1;
  }

  current() { return this.history[this.hpos]; }

  showHistory(i) {
    this.hpos = i;
    this.state = 'result';
    this.ed.setFrom(this.history[i].root);
    this.resState = {};
  }

  // ------------------------------------------------------------ execute
  execute(mode) {
    const calc = this.calc;
    if (this.ed.isEmpty()) return;
    let res;
    try {
      res = evaluate(calc, this.ed, this.evalExtra(), this.parseOpts());
      this.checkValue(res.value);
    } catch (e) {
      if (!(e instanceof CalcError)) { console.error(e); e = new CalcError('Math'); }
      calc.push(errorScreen(calc, e, () => { this.state = 'input'; placeCursorAt(this.ed, e.pos); }));
      return;
    }
    let v = res.value;
    if (v && v.type === 'pair') {
      calc.mem.vars.x = v.a; calc.mem.vars.y = v.b;
      calc.mem.ans = v.a;
    } else calc.mem.ans = v;
    const entry = { root: cloneSeq(this.ed.root), value: v, mode, fmt: null, dms: res.flags.dms };
    this.history.push(entry);
    if (this.history.length > 30) this.history.shift();
    this.hpos = this.history.length - 1;
    this.state = 'result';
    this.resState = {};
  }

  evalExtra() { return { complex: !!this.opts.complex }; }
  parseOpts() { return {}; }
  checkValue(v) {
    if (v instanceof Cx && !this.opts.complex && !v.im.isZero()) throw new CalcError('Math');
    if (v && (v.type === 'mat' || v.type === 'vec')) throw new CalcError('Syntax');
  }

  // ------------------------------------------------------------ FORMAT
  toggleFormat() {
    const h = this.current();
    if (!h) return;
    h.fmt = null;
    h.mode = h.mode === 'dec' ? 'std' : 'dec';
  }

  formatOptions(h) {
    const v = h.value, S = this.S;
    const opts = [];
    const math = this.calc.math;
    if (v instanceof Cx || (this.opts.complex && v instanceof Real)) {
      opts.push(['π(Standard)', 'std'], ['Decimal', 'dec'], ['Rectangular Coord', 'rect'], ['Polar Coord', 'polar']);
      return opts;
    }
    if (!(v instanceof Real)) return opts;
    if (math) opts.push(['π(Standard)', 'std']);
    else opts.push(['π(Standard)', 'std']);
    opts.push(['Decimal', 'dec']);
    const rr = v.ex ? v : recognize(v);
    const q = rr.rational();
    if (q && q.d === 1n && q.n > 0n && q.n.toString().length <= 10) opts.push(['Prime Factor', 'prime']);
    if (math && recurringSeq(v)) opts.push(['Recurring Decimal', 'rec']);
    if (q && q.d !== 1n && mixedSeq(v, S, 'improper')) opts.push(['Improper Fraction', 'improper'], ['Mixed Number', 'mixed']);
    opts.push(['Standard Form', 'stdform'], ['Sexagesimal', 'sexa']);
    return opts;
  }

  formatMenu() {
    const h = this.current();
    if (!h) return;
    const options = this.formatOptions(h);
    if (!options.length) return;
    this.calc.push(new MenuScreen(this.calc, {
      group: 'format', items: options.map(([label]) => ({ label })),
      onSelect: (it, i) => {
        this.calc.pop();
        const f = options[i][1];
        if (f === 'std') { h.fmt = null; h.mode = 'std'; } else if (f === 'dec') { h.fmt = null; h.mode = 'dec'; } else h.fmt = f;
      },
      status: () => this.status(),
    }));
  }

  resultSeq(h) {
    const S = this.S;
    const v = h.value;
    if (h.fmt) {
      let s = null;
      switch (h.fmt) {
        case 'prime': s = primeFactorSeq(v); break;
        case 'rec': s = recurringSeq(v); break;
        case 'improper': s = mixedSeq(v, S, 'improper'); break;
        case 'mixed': s = mixedSeq(v, S, 'mixed'); break;
        case 'stdform': s = standardFormSeq(v instanceof Real ? v : v.re, S); break;
        case 'sexa': s = sexagesimalSeq(v, S); break;
        case 'rect': s = formatComplex(Cx.of(v), S, 'std', false); break;
        case 'polar': s = formatComplex(Cx.of(v), S, 'std', true); break;
        default: break;
      }
      if (s) return s;
    }
    if (h.dms && v instanceof Real && h.mode !== 'dec') {
      const s = sexagesimalSeq(v, S);
      if (s) return s;
    }
    return formatValue(v, S, h.mode);
  }

  // ------------------------------------------------------------ tools
  toolsMenu() {
    return new MenuScreen(this.calc, {
      group: 'tools', items: [{ label: 'Undo' }],
      onSelect: () => { this.calc.pop(); if (this.state === 'result') this.editCurrent(true); this.ed.doUndo(); },
      status: () => this.status(),
    });
  }

  // ------------------------------------------------------------ render
  render(lcd, blink) {
    const calc = this.calc;
    if (calc.math) {
      drawMathInput(lcd, this.ed, { top: 9, blink, showCursor: this.state === 'input', state: this.inState });
      if (this.state === 'result') drawResult(lcd, this.resultSeq(this.current()), { state: this.resState });
    } else {
      const small = this.S.multiLineFont === 'small';
      const r = drawLineInput(lcd, this.ed, { top: 9, blink, showCursor: this.state === 'input', small, state: this.inState, maxLines: small ? 6 : 4 });
      if (this.state === 'result') {
        const lineH = small ? 11 : 16;
        const bottom = 9 + r.lines * lineH + (small ? 9 : 13);
        drawResult(lcd, this.resultSeq(this.current()), { bottom: Math.min(bottom, 71), state: this.resState });
      }
    }
  }
}

export function makeCalculate(calc) { return new CalculateApp(calc); }
