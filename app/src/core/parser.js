// Safe recursive-descent parser: editor sequences → AST.  No string evaluation is ever used.
// Operator priorities follow the User's Guide "Calculation Priority Sequence" (p.159-160):
//  1 parentheses  2 functions  3 postfix (x², x⁻¹, !, °′″, °ʳᵍ, %, ▸t, powers, roots)  4 fractions
//  5 negative sign / base prefix  6 unit conversions, x̂ ŷ  7 omitted multiplication  8 nPr nCr ∠
//  9 dot product  10 × ÷  11 + −  12 and  13 or xor xnor
import { CalcError, Real } from './num.js';

export const FUNCS = new Set([
  'sin(', 'cos(', 'tan(', 'sin⁻¹(', 'cos⁻¹(', 'tan⁻¹(', 'sinh(', 'cosh(', 'tanh(', 'sinh⁻¹(', 'cosh⁻¹(',
  'tanh⁻¹(', 'log(', 'ln(', '√(', 'Abs(', 'Rnd(', 'GCD(', 'LCM(', 'RanInt#(', 'Pol(', 'Rec(', 'd/dx(', '∫(',
  'Σ(', 'f(', 'g(', 'Conjg(', 'Arg(', 'ReP(', 'ImP(', 'Det(', 'Trn(', 'Identity(', 'UnitV(', 'Angle(',
  'P(', 'Q(', 'R(', 'Min(', 'Max(', 'Mean(', 'Sum(', 'Neg(', 'Not(', 'e^(', '10^(', 'Int(', 'Intg(', '(',
]);
export const POSTFIX = new Set(['²', '³', '⁻¹', '!', '%', '°', 'ʳ', 'ᵍ', '▸t', 'x̂', 'ŷ', 'x̂1', 'x̂2']);
export const VARS = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'x', 'y', 'z']);
export const CONSTS = new Set(['π', '𝑒', '𝑖', 'Ans', 'Ran#']);
const BIN_LEVEL = {
  'or': 13, 'xor': 13, 'xnor': 13, 'and': 12, '+': 11, '−': 11, '×': 10, '÷': 10, '•': 9, 'nPr': 8, 'nCr': 8, '∠': 8,
};

// Tokens that are values on their own (for implicit multiplication).
function startsValue(t) {
  if (!t) return false;
  if (t.tmpl) return !['pow', 'sci'].includes(t.tmpl.k);
  const v = t.v;
  if (/^[0-9.]$/.test(v)) return true;
  if (FUNCS.has(v)) return true;
  if (VARS.has(v) || CONSTS.has(v)) return true;
  if (/^(Mat|Vct)(A|B|C|D|Ans)$/.test(v)) return true;
  if (t.kind === 'statvar' || t.kind === 'sciconst' || t.kind === 'cell' || t.kind === 'num') return true;
  if (v === '$') return true;
  return false;
}

export class Parser {
  constructor(seq, opts = {}) {
    this.opts = opts;       // {lineMode, cells(bool), statVars(Set), baseN}
    this.toks = lex(seq, opts);
    this.p = 0;
  }

  peek(o = 0) { return this.toks[this.p + o]; }
  next() { return this.toks[this.p++]; }
  err(t, kind = 'Syntax') { throw new CalcError(kind, t ? t.item : undefined); }

  parse() {
    if (!this.toks.length) this.err(null);
    const e = this.parseTop();
    if (this.p < this.toks.length) this.err(this.peek());
    return e;
  }

  // top level: optional '=' (Solver equations) / relational for Inequality not used here
  parseTop() {
    const a = this.parseLevel(13);
    const t = this.peek();
    if (t && t.v === '=' && this.opts.allowEquals) {
      this.next();
      const b = this.parseLevel(13);
      return { t: 'eq', a, b, item: t.item };
    }
    return a;
  }

  parseLevel(lv) {
    if (lv === 7) return this.parseImplicit();
    let a = this.parseLevel(lv - 1);
    for (;;) {
      const t = this.peek();
      if (!t || t.tmpl || BIN_LEVEL[t.v] !== lv) break;
      this.next();
      const b = this.parseLevel(lv - 1);
      a = { t: 'bin', op: t.v, a, b, item: t.item };
    }
    return a;
  }

  // level 7: implicit multiplication (juxtaposition)
  parseImplicit() {
    let a = this.parseUnit();
    for (;;) {
      const t = this.peek();
      if (!t || !startsValue(t)) break;
      if (t.v === '(-)') break;
      const b = this.parseUnit();
      a = { t: 'bin', op: '×', a, b, implicit: true, item: t.item };
    }
    return a;
  }

  // level 6: unit conversions / statistical estimates (postfix)
  parseUnit() {
    let a = this.parseNeg();
    for (;;) {
      const t = this.peek();
      if (t && t.kind === 'unitconv') { this.next(); a = { t: 'conv', conv: t.v, a, item: t.item }; continue; }
      if (t && ['x̂', 'ŷ', 'x̂1', 'x̂2'].includes(t.v)) { this.next(); a = { t: 'post', op: t.v, a, item: t.item }; continue; }
      break;
    }
    return a;
  }

  // level 5: negative sign and base prefixes
  parseNeg() {
    const t = this.peek();
    if (t && (t.v === '(-)' || (t.v === '−' && this.opts.lenientMinus))) {
      this.next();
      return { t: 'neg', a: this.parseNeg(), item: t.item };
    }
    if (t && t.kind === 'baseprefix') {
      this.next();
      const n = this.parseNeg();
      return { t: 'baseprefix', base: t.v, a: n, item: t.item };
    }
    return this.parseFrac();
  }

  // level 4: linear fractions a⌟b, mixed a⌟b⌟c
  parseFrac() {
    let a = this.parsePostfix();
    const t = this.peek();
    if (t && t.v === '⌟') {
      this.next();
      const b = this.parsePostfix();
      const t2 = this.peek();
      if (t2 && t2.v === '⌟') {
        this.next();
        const c = this.parsePostfix();
        return { t: 'mixed', i: a, a: b, b: c, item: t.item };
      }
      a = { t: 'frac', a, b, item: t.item };
    }
    return a;
  }

  // level 3: postfix operators, powers and roots (left to right)
  parsePostfix() {
    let a = this.parsePrimary();
    for (;;) {
      const t = this.peek();
      if (!t) break;
      if (t.tmpl && t.tmpl.k === 'pow') { this.next(); a = { t: 'pow', a, b: this.sub(t.tmpl.s[0], t), item: t.item }; continue; }
      if (t.tmpl && t.tmpl.k === 'sci') { this.next(); a = { t: 'sci', a, e: this.sub(t.tmpl.s[0], t), item: t.item }; continue; }
      if (!t.tmpl && POSTFIX.has(t.v) && !['x̂', 'ŷ', 'x̂1', 'x̂2'].includes(t.v)) {
        this.next(); a = { t: 'post', op: t.v, a, item: t.item }; continue;
      }
      if (!t.tmpl && t.v === '▫') { a = this.parseDms(a); continue; }
      if (!t.tmpl && t.v === '^(') {
        this.next();
        const b = this.parseLevel(13);
        this.closeParen();
        a = { t: 'pow', a, b, item: t.item };
        continue;
      }
      if (!t.tmpl && t.v === 'ˣ√(') {
        this.next();
        const b = this.parseLevel(13);
        this.closeParen();
        a = { t: 'root', n: a, a: b, item: t.item };
        continue;
      }
      if (!t.tmpl && t.v === '⏨') {
        this.next();
        let neg = false;
        if (this.peek() && this.peek().v === '(-)') { this.next(); neg = true; }
        const e = this.parsePrimary();
        a = { t: 'sci', a, e: neg ? { t: 'neg', a: e } : e, item: t.item };
        continue;
      }
      break;
    }
    return a;
  }

  // degrees ▫ minutes ▫ seconds ▫ (each part followed by the °′″ symbol)
  parseDms(d) {
    const t = this.next(); // '▫'
    const parts = [d];
    for (let k = 0; k < 2; k++) {
      const n = this.peek();
      if (!n || !(n.kind === 'num' || n.v === '(')) break;
      const save = this.p;
      const v = this.parsePrimary();
      const m = this.peek();
      if (m && m.v === '▫') { this.next(); parts.push(v); } else { this.p = save; break; }
    }
    return { t: 'dms', parts, item: t.item };
  }

  closeParen() {
    const t = this.peek();
    if (t && t.v === ')') { this.next(); return; }
    if (!t) return; // auto-close at end of expression
    if (t.v === ',') this.err(t);
    // other tokens: implicit close is not allowed mid expression unless list ends
  }

  sub(seq, owner) {
    const p = new Parser(seq, this.opts);
    if (!p.toks.length) this.err(owner);
    const e = p.parseTop();
    if (p.p < p.toks.length) p.err(p.peek());
    return e;
  }

  subOpt(seq) {
    const p = new Parser(seq, this.opts);
    if (!p.toks.length) return null;
    const e = p.parseTop();
    if (p.p < p.toks.length) p.err(p.peek());
    return e;
  }

  parseArgs() {
    const args = [];
    if (this.peek() && this.peek().v === ')') { this.next(); return args; }
    for (;;) {
      if (!this.peek()) break;
      args.push(this.parseTop());
      const t = this.peek();
      if (t && t.v === ',') { this.next(); continue; }
      if (t && t.v === ')') { this.next(); break; }
      if (!t) break;
      this.err(t);
    }
    return args;
  }

  parsePrimary() {
    const t = this.next();
    if (!t) this.err(this.toks[this.toks.length - 1]);
    if (t.tmpl) return this.parseTemplate(t);
    if (t.kind === 'num') return { t: 'num', v: t.val, rec: t.rec, item: t.item, text: t.text };
    if (t.kind === 'statvar') return { t: 'statvar', name: t.v, item: t.item };
    if (t.kind === 'sciconst') return { t: 'sciconst', name: t.v, item: t.item };
    if (t.kind === 'cell') return { t: 'cell', ref: t.ref, item: t.item, ...this.maybeRange(t) };
    const v = t.v;
    if (VARS.has(v)) return { t: 'var', name: v, item: t.item };
    if (CONSTS.has(v)) return { t: 'const', name: v, item: t.item };
    if (/^(Mat|Vct)(A|B|C|D|Ans)$/.test(v)) return { t: 'mvar', name: v, item: t.item };
    if (v === '(') {
      const e = this.parseLevel(13);
      this.closeParen();
      return { t: 'paren', a: e, item: t.item };
    }
    if (FUNCS.has(v)) {
      const args = this.parseArgs();
      return { t: 'call', fn: v, args, item: t.item };
    }
    this.err(t);
  }

  maybeRange(t) {
    const n = this.peek();
    if (n && n.v === ':') {
      this.next();
      const e = this.next();
      if (!e || e.kind !== 'cell') this.err(n);
      return { t: 'range', from: t.ref, to: e.ref };
    }
    return {};
  }

  parseTemplate(t) {
    const it = t.tmpl;
    const s = it.s;
    switch (it.k) {
      case 'frac': return { t: 'frac', a: this.sub(s[0], t), b: this.sub(s[1], t), item: t.item };
      case 'mixed': return { t: 'mixed', i: this.sub(s[0], t), a: this.sub(s[1], t), b: this.sub(s[2], t), item: t.item };
      case 'sqrt': return { t: 'sqrt', a: this.sub(s[0], t), item: t.item };
      case 'root': return { t: 'root', n: this.sub(s[0], t), a: this.sub(s[1], t), item: t.item };
      case 'logb': return { t: 'logb', b: this.sub(s[0], t), a: this.sub(s[1], t), item: t.item };
      case 'abs': return { t: 'call', fn: 'Abs(', args: [this.sub(s[0], t)], item: t.item };
      case 'ddx': return { t: 'call', fn: 'd/dx(', args: [this.sub(s[0], t), this.sub(s[1], t)], item: t.item };
      case 'int': return { t: 'call', fn: '∫(', args: [this.sub(s[0], t), this.sub(s[1], t), this.sub(s[2], t)], item: t.item };
      case 'sum': return { t: 'call', fn: 'Σ(', args: [this.sub(s[0], t), this.sub(s[1], t), this.sub(s[2], t)], item: t.item };
      case 'pow': case 'sci': this.err(t); break;
      case 'rec': this.err(t); break;
      default: this.err(t);
    }
  }
}

// ---------------------------------------------------------------- lexer
const UNITCONV = /▸/;
export function lex(seq, opts = {}) {
  const out = [];
  let i = 0;
  while (i < seq.length) {
    const it = seq[i];
    if (it.k !== 't') {
      if (it.k === 'rec') { // recurring block directly after a decimal number is handled in number lexing
        throw new CalcError('Syntax', it);
      }
      out.push({ tmpl: it, item: it });
      i++;
      continue;
    }
    const v = it.v;
    // number literal
    if (/^[0-9.]$/.test(v) || (opts.baseN && /^[A-F]$/.test(v) && opts.hexLetters)) {
      let text = '';
      const start = it;
      while (i < seq.length && seq[i].k === 't' && /^[0-9.]$/.test(seq[i].v)) { text += seq[i].v; i++; }
      let rec = null;
      if (i < seq.length && seq[i].k === 'rec') {
        rec = seq[i].s[0].map((x) => (x.k === 't' ? x.v : '?')).join('');
        if (!/^[0-9]+$/.test(rec) || !text.includes('.')) throw new CalcError('Syntax', seq[i]);
        i++;
      }
      if ((text.match(/\./g) || []).length > 1 || text === '.') {
        if (text === '.') text = '0';
        else throw new CalcError('Syntax', start);
      }
      out.push({ kind: 'num', v: text, text, rec, val: numberValue(text, rec), item: start });
      continue;
    }
    if (opts.cells && /^[A-E]$/.test(v.replace('$', ''))) {
      // spreadsheet cell reference: [$]Letter[$]digits
      let j = i, ref = '';
      if (seq[j].v === '$') { ref += '$'; j++; }
      if (j < seq.length && seq[j].k === 't' && /^[A-E]$/.test(seq[j].v)) {
        ref += seq[j].v; j++;
        if (j < seq.length && seq[j].k === 't' && seq[j].v === '$') { ref += '$'; j++; }
        let digits = '';
        while (j < seq.length && seq[j].k === 't' && /^[0-9]$/.test(seq[j].v)) { digits += seq[j].v; j++; }
        if (digits) {
          out.push({ kind: 'cell', v: ref + digits, ref: ref + digits, item: it });
          i = j;
          continue;
        }
      }
    }
    if (v === '$' && opts.cells) {
      let j = i + 1, ref = '$';
      if (j < seq.length && /^[A-E]$/.test(seq[j].v)) {
        ref += seq[j].v; j++;
        if (j < seq.length && seq[j].v === '$') { ref += '$'; j++; }
        let digits = '';
        while (j < seq.length && seq[j].k === 't' && /^[0-9]$/.test(seq[j].v)) { digits += seq[j].v; j++; }
        if (digits) { out.push({ kind: 'cell', v: ref + digits, ref: ref + digits, item: it }); i = j; continue; }
      }
    }
    if (UNITCONV.test(v) && v !== '▸t') { out.push({ kind: 'unitconv', v, item: it }); i++; continue; }
    if (v.startsWith('stat:')) { out.push({ kind: 'statvar', v: v.slice(5), item: it }); i++; continue; }
    if (v.startsWith('const:')) { out.push({ kind: 'sciconst', v: v.slice(6), item: it }); i++; continue; }
    if (['d', 'h', 'b', 'o'].includes(v) && opts.baseN) { out.push({ kind: 'baseprefix', v, item: it }); i++; continue; }
    out.push({ v, item: it });
    i++;
  }
  // in Base-N hexadecimal mode, letters A-F following digits/letters form numbers: handled by baseN lexer
  return out;
}

export function numberValue(text, rec) {
  if (!rec) return Real.fromDecimalString(text);
  // a.bcd + recurring block r:  value = a.bcd + 0.000…(r repeating)
  const [ip, fp = ''] = text.split('.');
  const nonRep = BigInt((ip || '0') + fp);
  const scaleNon = 10n ** BigInt(fp.length);
  const repInt = BigInt(rec);
  const repDen = (10n ** BigInt(rec.length) - 1n) * scaleNon;
  // total = nonRep/scaleNon + repInt/repDen
  const n = nonRep * (10n ** BigInt(rec.length) - 1n) + repInt;
  return Real.frac(n, repDen);
}

export function parseSeq(seq, opts) {
  return new Parser(seq, opts).parse();
}
