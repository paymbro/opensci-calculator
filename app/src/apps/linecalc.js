// Linear "log" calculation screen used by the Statistics, Matrix and Vector apps: each executed
// calculation shows its input on one line and the result right-aligned on the next; older pairs
// scroll up (User's Guide p.85-90, 116-127).
import { Editor, cloneSeq } from '../core/expr.js';
import { inputKey } from '../core/input.js';
import { CalcError, Real } from '../core/num.js';
import { formatValue, seqText } from '../core/format.js';
import { lineTokens, evaluate, placeCursorAt, errorScreen, globalMenus, specInsert, drawResult, cut, ulen } from './common.js';
import { LCD } from '../core/lcd.js';
import { tokenText } from '../core/render.js';

const PER_LINE = 17;

export class LineCalcScreen {
  constructor(calc, opts) {
    this.calc = calc;
    this.opts = opts; // {label:[l1,l2], evalExtra(), parseOpts(), catalog, onResult(v, entry) → custom display?, onBack, status(), tools()}
    this.ed = new Editor({ math: false });
    this.entries = [];
    this.state = 'input';
  }
  status() { return this.opts.status ? this.opts.status() : null; }

  insertSpec(spec) {
    if (this.state === 'result') this.newInput(spec);
    specInsert(this.ed, spec, this.calc);
  }

  newInput(spec) {
    this.state = 'input';
    this.ed = new Editor({ math: false });
    const ansKeys = new Set(['ADD', 'SUB', 'MUL', 'DIV', 'SQR', 'RECIP', 'POW']);
    if (spec && spec.key && ansKeys.has(spec.key)) this.ed.insertToken(this.opts.ansToken || 'Ans');
  }

  key(k) {
    const calc = this.calc;
    if (k === 'OK') k = 'EXE'; // OK and EXE perform the same operation (User's Guide p.8)
    if (globalMenus(calc, k, this, { catalog: this.opts.catalog, storeValue: this.state === 'result' && this.entries.length ? () => this.entries[this.entries.length - 1].value : null })) return true;
    if (k === 'TOOLS' && this.opts.tools) { this.opts.tools(); return true; }
    if (k === 'EXE' || k === 'APPROX') {
      if (this.state === 'result' && this.ed.isEmpty()) return true;
      this.execute(k === 'APPROX' ? 'dec' : 'std');
      return true;
    }
    if (k === 'AC') {
      if (this.state === 'result' || !this.ed.isEmpty()) { this.ed = new Editor({ math: false }); this.state = 'input'; if (this.opts.clearLog !== false) this.entries = []; return true; }
      if (this.opts.onAC) { this.opts.onAC(); return true; }
      return true;
    }
    if (k === 'BACK') {
      if (this.state === 'result') { this.state = 'input'; this.ed.setFrom(this.entries[this.entries.length - 1].root); return true; }
      if (this.ed.isEmpty() && this.opts.onBack) { this.opts.onBack(); return true; }
      return true;
    }
    if (this.state === 'result') {
      if (k === 'LEFT' || k === 'RIGHT') { this.state = 'input'; this.ed.setFrom(this.entries[this.entries.length - 1].root); if (k === 'RIGHT') this.ed.home(); return true; }
      if (k === 'FORMAT') { const e = this.entries[this.entries.length - 1]; e.mode = e.mode === 'dec' ? 'std' : 'dec'; return true; }
      if (k === 'UP' || k === 'DOWN' || k === 'OK') return true;
      const ansKeys = new Set(['ADD', 'SUB', 'MUL', 'DIV', 'SQR', 'RECIP', 'POW']);
      this.state = 'input';
      this.ed = new Editor({ math: false });
      if (ansKeys.has(k)) this.ed.insertToken(this.opts.ansToken || 'Ans');
    }
    inputKey(this.ed, k, { settings: calc.settings });
    return true;
  }

  execute(mode) {
    const calc = this.calc;
    if (this.ed.isEmpty()) return;
    try {
      const r = evaluate(calc, this.ed, this.opts.evalExtra ? this.opts.evalExtra() : {}, this.opts.parseOpts ? this.opts.parseOpts() : {});
      const v = r.value;
      const entry = { root: cloneSeq(this.ed.root), value: v, mode };
      if (this.opts.onResult && this.opts.onResult(v, entry)) return;
      if (v && v.type === 'pair') { calc.mem.vars.x = v.a; calc.mem.vars.y = v.b; calc.mem.ans = v.a; } else if (v instanceof Real || (v && v.re)) calc.mem.ans = v;
      this.entries.push(entry);
      if (this.entries.length > 20) this.entries.shift();
      this.state = 'result';
    } catch (e) {
      if (!(e instanceof CalcError)) { console.error(e); e = new CalcError('Math'); }
      calc.push(errorScreen(calc, e, () => { this.state = 'input'; placeCursorAt(this.ed, e.pos); }));
    }
  }

  // text lines for the log
  inputLines(root) {
    const s = lineTokens(root).map((t) => t.text).join('');
    const lines = [];
    for (let i = 0; i < Math.max(1, ulen(s)); i += PER_LINE) lines.push(cut(s, i, i + PER_LINE));
    return lines;
  }

  render(lcd, blink) {
    const S = { ...this.calc.settings, io: 'LineI/LineO' };
    const lines = []; // {text} or {result: seq} or {cursorLine}
    for (const e of this.entries) {
      for (const l of this.inputLines(e.root)) lines.push({ text: l });
      lines.push({ result: this.opts.formatResult ? this.opts.formatResult(e.value, e.mode) : formatValue(e.value, S, e.mode) });
    }
    let curLineIdx = -1, curCol = 0;
    if (this.state === 'input') {
      const chars = [];
      lineTokens(this.ed.root).forEach((t, i) => { for (const ch of Array.from(t.text)) chars.push({ ch, i }); });
      let cc = chars.findIndex((c) => c.i === this.ed.i);
      if (cc < 0) cc = chars.length;
      const text = chars.map((c) => c.ch).join('');
      const nl = Math.max(1, Math.ceil((ulen(text) + 1) / PER_LINE));
      const base = lines.length;
      for (let i = 0; i < nl; i++) lines.push({ text: cut(text, i * PER_LINE, (i + 1) * PER_LINE) });
      curLineIdx = base + Math.floor(cc / PER_LINE);
      curCol = cc % PER_LINE;
    }
    const first = Math.max(0, lines.length - 4);
    for (let i = 0; i < 4; i++) {
      const L = lines[first + i];
      if (!L) break;
      const top = 9 + 16 * i;
      if (L.text !== undefined) lcd.bigText(L.text, 3, top);
      else drawResult(lcd, L.result, { bottom: top + 13 });
      if (first + i === curLineIdx && blink !== false) lcd.fill(3 + curCol * 11, top + 1, 3, 13, 3);
    }
    if (this.state === 'input' && this.ed.isEmpty() && this.entries.length === 0 && this.opts.label) {
      const [l1, l2] = this.opts.label;
      lcd.bigText(l1, 195 - LCD.bigWidth(l1), 44);
      lcd.bigText(l2, 195 - LCD.bigWidth(l2), 58);
    }
  }
}

export { seqText, tokenText };
