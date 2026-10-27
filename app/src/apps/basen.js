// Base-N app (User's Guide p.150-154): 32-bit integer arithmetic in decimal, hexadecimal, binary and
// octal, base prefixes d/h/b/o, logical operations Neg, Not, and, or, xor, xnor.
import { Editor, cloneSeq } from '../core/expr.js';
import { inputKey } from '../core/input.js';
import { CalcError, Real } from '../core/num.js';
import { BASEN_CATS } from '../core/catalog.js';
import { LCD } from '../core/lcd.js';
import { tokenText } from '../core/render.js';
import { errorScreen, placeCursorAt, globalMenus, specInsert, cut, ulen } from './common.js';

const MODES = ['Decimal', 'Hexadecimal', 'Binary', 'Octal'];
const RADIX = { Decimal: 10, Hexadecimal: 16, Binary: 2, Octal: 8 };
const PREFIX_RADIX = { d: 10, h: 16, b: 2, o: 8 };
const MASK = (1n << 32n) - 1n;

const toSigned = (u) => (u & (1n << 31n) ? u - (1n << 32n) : u);
function checkRange(v, radix) {
  // decimal: signed 32-bit; other bases: the 32-bit pattern (two's complement)
  if (v < -(1n << 31n) || v > (1n << 31n) - 1n) throw new CalcError('Math');
  return v;
}

// ------------------------------------------------------------------ evaluator (BigInt)
export function evalBaseN(seq, radix, vars, ans) {
  // tokens: digits, hex:A..F, operators, parentheses, prefixes, Neg( Not(, variables, Ans
  const toks = [];
  for (let i = 0; i < seq.length; i++) {
    const it = seq[i];
    if (it.k !== 't') throw new CalcError('Syntax', it);
    let v = it.v;
    if (v.startsWith('hex:')) v = v.slice(4);
    toks.push({ v, item: it, isHex: it.v.startsWith('hex:') || (radix === 16 && /^[A-F]$/.test(it.v) && false) });
  }
  let p = 0;
  const peek = () => toks[p];
  const err = (t) => { throw new CalcError('Syntax', t ? t.item : undefined); };
  const digitVal = (ch) => (/[0-9]/.test(ch) ? ch.charCodeAt(0) - 48 : 'ABCDEF'.indexOf(ch) + 10);
  const number = (r) => {
    let n = 0n, any = false;
    while (peek() && (/^[0-9]$/.test(peek().v) || (peek().isHex && /^[A-F]$/.test(peek().v)))) {
      const d = digitVal(peek().v);
      if (d >= r) err(peek());
      n = n * BigInt(r) + BigInt(d);
      any = true;
      p++;
      if (n > MASK) throw new CalcError('Math');
    }
    if (!any) err(peek());
    if (peek() && peek().v === '.') err(peek());
    // non-decimal literals are 32-bit patterns
    return r === 10 ? n : toSigned(n);
  };
  const primary = () => {
    const t = peek();
    if (!t) err(toks[toks.length - 1]);
    if (/^[0-9]$/.test(t.v) || (t.isHex && /^[A-F]$/.test(t.v))) return number(radix);
    if (['d', 'h', 'b', 'o'].includes(t.v)) { p++; const neg = peek() && peek().v === '(-)'; if (neg) p++; const n = number(PREFIX_RADIX[t.v]); return neg ? -n : n; }
    if (t.v === '(') { p++; const v = expr(); if (peek() && peek().v === ')') p++; return v; }
    if (t.v === 'Neg(' || t.v === 'Not(') {
      p++; const v = expr(); if (peek() && peek().v === ')') p++;
      return t.v === 'Neg(' ? checkRange(toSigned((-v) & MASK)) : toSigned((~v) & MASK);
    }
    if (t.v === 'Ans') { p++; return ans; }
    if (/^[A-Fxyz]$/.test(t.v)) { p++; const r = vars[t.v]; return r ? BigInt(r.dec.trunc().toFixed(0)) : 0n; }
    err(t);
  };
  const unary = () => {
    const t = peek();
    if (t && (t.v === '(-)' || t.v === '−')) { p++; return -unary(); }
    return primary();
  };
  const implicitOK = (t) => t && (t.v === '(' || /^[A-Fxyz]$/.test(t.v) && !t.isHex || t.v === 'Ans' || t.v === 'Neg(' || t.v === 'Not(');
  const term = () => {
    let a = unary();
    for (;;) {
      const t = peek();
      if (t && (t.v === '×' || t.v === '÷')) {
        p++; const b = unary();
        if (t.v === '÷') { if (b === 0n) throw new CalcError('Math'); a = a / b; } else a = a * b;
        checkRange(a);
      } else if (implicitOK(t)) { a = a * unary(); checkRange(a); } else break;
    }
    return a;
  };
  const sum = () => {
    let a = term();
    for (;;) {
      const t = peek();
      if (t && (t.v === '+' || t.v === '−')) { p++; const b = term(); a = t.v === '+' ? a + b : a - b; checkRange(a); } else break;
    }
    return a;
  };
  const andE = () => {
    let a = sum();
    while (peek() && peek().v === 'and') { p++; a = toSigned((a & sum()) & MASK); }
    return a;
  };
  const expr = () => {
    let a = andE();
    for (;;) {
      const t = peek();
      if (!t || !['or', 'xor', 'xnor'].includes(t.v)) break;
      p++;
      const b = andE();
      const ua = a & MASK, ub = b & MASK;
      a = toSigned(t.v === 'or' ? ua | ub : t.v === 'xor' ? ua ^ ub : (~(ua ^ ub)) & MASK);
    }
    return a;
  };
  if (!toks.length) err(null);
  const v = expr();
  if (p < toks.length) err(peek());
  return checkRange(v);
}

export function formatBaseN(v, mode) {
  const u = v & MASK;
  switch (mode) {
    case 'Decimal': return { lines: [v.toString()] };
    case 'Hexadecimal': return { lines: [u.toString(16).toUpperCase().padStart(8, '0')] };
    case 'Octal': return { lines: [u.toString(8).padStart(11, '0')] };
    case 'Binary': {
      const b = u.toString(2).padStart(32, '0');
      const g = (s) => s.match(/.{4}/g).join(' ');
      return { lines: [g(b.slice(0, 16)), g(b.slice(16))] };
    }
    default: return { lines: ['?'] };
  }
}

export class BaseNApp {
  constructor(calc) { this.calc = calc; this.mode = 'Decimal'; this.start(); }
  start() { this.mode = 'Decimal'; this.ed = new Editor({ math: false }); this.history = []; this.state = 'input'; this.hpos = -1; }
  powerOn() { this.start(); }
  status() {
    return { up: this.state === 'result' ? true : this.history.length > 0, down: this.state === 'result' && this.hpos < this.history.length - 1 };
  }
  insertSpec(spec) {
    if (this.state === 'result') this.newInput();
    specInsert(this.ed, spec, this.calc);
  }
  newInput() { this.ed = new Editor({ math: false }); this.state = 'input'; this.hpos = -1; }
  key(k) {
    const calc = this.calc;
    if (k === 'CATALOG' || k === 'CATLIST') { globalMenus(calc, k, this, { catalog: BASEN_CATS }); return; }
    if (k === 'VARIABLE') { globalMenus(calc, k, this, { storeValue: this.state === 'result' ? () => Real.int(this.current().value) : null }); return; }
    if (k === 'SETTINGS') { globalMenus(calc, k, this); return; }
    if (k === 'FUNCTION' || k === 'TOOLS') return;
    if (k === 'FORMAT') {
      this.mode = MODES[(MODES.indexOf(this.mode) + 1) % 4];
      return;
    }
    if (k === 'EXE') {
      if (this.state === 'result') { this.ed.setFrom(this.current().root); }
      if (this.ed.isEmpty()) return;
      try {
        const v = evalBaseN(this.ed.root, RADIX[this.mode], calc.mem.vars, this.ansValue());
        calc.mem.ans = Real.int(v);
        this.history.push({ root: cloneSeq(this.ed.root), value: v, mode: this.mode });
        this.hpos = this.history.length - 1;
        this.state = 'result';
      } catch (e) {
        if (!(e instanceof CalcError)) e = new CalcError('Math');
        calc.push(errorScreen(calc, e, () => { this.state = 'input'; placeCursorAt(this.ed, e.pos); }));
      }
      return;
    }
    if (k === 'AC') { this.newInput(); return; }
    if (this.state === 'result') {
      if (k === 'UP') { if (this.hpos > 0) { this.hpos--; this.ed.setFrom(this.current().root); } return; }
      if (k === 'DOWN') { if (this.hpos < this.history.length - 1) { this.hpos++; this.ed.setFrom(this.current().root); } return; }
      if (k === 'LEFT' || k === 'BACK') { this.state = 'input'; this.ed.setFrom(this.current().root); return; }
      if (k === 'RIGHT') { this.state = 'input'; this.ed.setFrom(this.current().root); this.ed.home(); return; }
      const ansKeys = new Set(['ADD', 'SUB', 'MUL', 'DIV']);
      this.newInput();
      if (ansKeys.has(k)) this.ed.insertToken('Ans');
    }
    if (k === 'UP' && this.state === 'input') { if (this.history.length) { this.hpos = this.history.length - 1; this.state = 'result'; this.ed.setFrom(this.current().root); } return; }
    // digit validity for the current base
    const digit = { D0: 0, D1: 1, D2: 2, D3: 3, D4: 4, D5: 5, D6: 6, D7: 7, D8: 8, D9: 9 }[k];
    if (digit !== undefined && digit >= RADIX[this.mode] && !this.prefixActive()) return;
    if (/^V[A-F]$/.test(k)) {
      if (this.mode === 'Hexadecimal' || this.prefixActive() === 'h') { this.ed.insertToken('hex:' + k[1]); return; }
      return; // letters are only hex digits here; variables via the VARIABLE key
    }
    if (['DOT', 'EXP10', 'FRAC', 'SQRT', 'POW', 'SQR', 'SIN', 'COS', 'TAN', 'LOGB', 'PI', 'E', 'I', 'DMS', 'MIXED', 'ROOT', 'RECIP', 'LOG', 'LN', 'ASIN', 'ACOS', 'ATAN', 'X', 'VX', 'VY', 'VZ'].includes(k)) return;
    inputKey(this.ed, k, { settings: calc.settings });
  }
  prefixActive() {
    const seq = this.ed.seq;
    for (let i = this.ed.i - 1; i >= 0; i--) {
      const v = seq[i].v;
      if (/^[0-9]$|^hex:/.test(v)) continue;
      return ['d', 'h', 'b', 'o'].includes(v) ? v : null;
    }
    return null;
  }
  ansValue() { const a = this.calc.mem.ans; return a instanceof Real ? BigInt(a.dec.trunc().toFixed(0)) : 0n; }
  current() { return this.history[this.hpos]; }
  render(lcd, blink) {
    lcd.bigText('[' + this.mode + ']', 3, 9);
    const text = this.ed.root.map((t) => (t.v.startsWith('hex:') ? t.v.slice(4) : tokenText(t.v))).join('');
    const per = 17;
    const shown = cut(text, 0, per * 2);
    // line pitch 14 px in this app (manual screenshots p.150-154)
    lcd.bigText(cut(shown, 0, per), 3, 23);
    if (ulen(shown) > per) lcd.bigText(cut(shown, per), 3, 37);
    if (this.state === 'input' && blink !== false) {
      let ci = 0;
      for (let i = 0; i < this.ed.i; i++) ci += Array.from(this.ed.root[i].v.startsWith('hex:') ? 'A' : tokenText(this.ed.root[i].v)).length;
      const line = Math.floor(ci / per), col = ci % per;
      lcd.fill(3 + col * 11, 24 + line * 14, 3, 13, 3);
    }
    if (this.state === 'result') {
      const f = formatBaseN(this.current().value, this.mode);
      if (f.lines.length === 2) {
        // 16 digits per line in groups of four separated by the 4-px separator gap
        f.lines.forEach((l, i) => { const d = l.replace(/ /g, ''); lcd.bigText(d, 195 - LCD.bigWidth(d, 3), 37 + 14 * i, { sep: new Set([4, 8, 12]) }); });
      } else {
        const l = f.lines[0];
        lcd.bigText(l, 195 - LCD.bigWidth(l), ulen(shown) > per ? 51 : 37);
      }
    } else if (this.ed.isEmpty() && !this.history.length) {
      lcd.bigText('Press [FORMAT]', 195 - LCD.bigWidth('Press [FORMAT]'), 44);
      lcd.bigText('to change format.', 195 - LCD.bigWidth('to change format.'), 58);
    }
  }
}

export const makeBaseN = (calc) => new BaseNApp(calc);
