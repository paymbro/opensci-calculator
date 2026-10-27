// AST evaluator.  Works on Real (num.js), Cx (complex), matrices and vectors.
import {
  Decimal, PI, E, Real, CalcError, mathErr, realPow, rootReal, mkTerm, normTerms, babs, bgcd, recognize,
} from './num.js';
import { parseSeq } from './parser.js';
import { UNIT_CONVERSIONS, SCI_CONSTANTS } from './constants.js';

// ---------------------------------------------------------------- complex
export class Cx {
  constructor(re, im) { this.re = re; this.im = im; }
  static of(v) { return v instanceof Cx ? v : new Cx(v, Real.int(0)); }
  isReal() { return this.im.isZero(); }
  add(o) { return new Cx(this.re.add(o.re), this.im.add(o.im)); }
  sub(o) { return new Cx(this.re.sub(o.re), this.im.sub(o.im)); }
  neg() { return new Cx(this.re.neg(), this.im.neg()); }
  mul(o) {
    return new Cx(this.re.mul(o.re).sub(this.im.mul(o.im)), this.re.mul(o.im).add(this.im.mul(o.re)));
  }
  conj() { return new Cx(this.re, this.im.neg()); }
  norm2() { return this.re.mul(this.re).add(this.im.mul(this.im)); }
  div(o) {
    const d = o.norm2();
    if (d.isZero()) throw mathErr();
    const n = this.mul(o.conj());
    return new Cx(n.re.div(d), n.im.div(d));
  }
  abs() { return this.norm2().sqrt(); }
}

const isMat = (v) => v && v.type === 'mat';
const isVec = (v) => v && v.type === 'vec';
const isCx = (v) => v instanceof Cx;
const isReal = (v) => v instanceof Real;

function simplify(v) {
  if (isCx(v) && v.im.isZero()) return v.re;
  return v;
}

function asReal(v, item) {
  if (isReal(v)) return v;
  if (isCx(v) && v.im.isZero()) return v.re;
  if (isCx(v)) throw new CalcError('Math', item);
  throw new CalcError('Math', item);
}

const fromDec = (d) => new Real(d).chk();

// exact value builder: terms as [n, d, r, p]
function exact(terms) {
  const ts = normTerms(terms.map(([n, d, r = 1, p = 0]) => mkTerm(BigInt(n), BigInt(d), BigInt(r), p)));
  let dec = new Decimal(0);
  for (const t of ts) {
    let v = new Decimal(t.n.toString()).div(t.d.toString()).times(new Decimal(t.r.toString()).sqrt());
    if (t.p) v = v.times(PI.pow(t.p));
    dec = dec.plus(v);
  }
  return new Real(dec, ts);
}

// ---------------------------------------------------------------- angles
function toDegrees(r, unit) {
  if (unit === 'deg') return r;
  if (unit === 'grad') return r.mul(Real.frac(9, 10));
  // radians
  if (r.ex && r.ex.length === 1 && r.ex[0].p === 1 && r.ex[0].r === 1n) return Real.frac(r.ex[0].n * 180n, r.ex[0].d);
  if (r.isZero()) return Real.int(0);
  return new Real(r.dec.times(180).div(PI));
}

function fromDegrees(deg, unit) {
  if (unit === 'deg') return deg;
  if (unit === 'grad') return deg.mul(Real.frac(10, 9));
  const q = deg.rational();
  if (q) return exact([[q.n, q.d * 180n, 1, 1]]);
  return new Real(deg.dec.times(PI).div(180));
}

export function angleConvert(r, fromUnit, toUnit) {
  return fromDegrees(toDegrees(r, fromUnit), toUnit);
}

const SIN_TABLE = {
  0: [], 15: [[1, 4, 6], [-1, 4, 2]], 30: [[1, 2]], 45: [[1, 2, 2]], 60: [[1, 2, 3]], 75: [[1, 4, 6], [1, 4, 2]],
  90: [[1, 1]],
};
const TAN_TABLE = { 0: [], 15: [[2, 1], [-1, 1, 3]], 30: [[1, 3, 3]], 45: [[1, 1]], 60: [[1, 1, 3]], 75: [[2, 1], [1, 1, 3]] };

function exactSinDeg(a) { // a integer multiple of 15 in [0,360)
  let sgn = 1;
  if (a >= 180) { a -= 180; sgn = -1; }
  if (a > 90) a = 180 - a;
  const t = SIN_TABLE[a];
  return exact(t.map(([n, d, r]) => [sgn * n, d, r || 1]));
}

function trigDeg(fn, deg) {
  // deg: Real in degrees
  const q = deg.rational();
  if (q && q.d === 1n) {
    const k = Number(((q.n % 360n) + 360n) % 360n);
    if (k % 15 === 0) {
      if (fn === 'sin') return exactSinDeg(k);
      if (fn === 'cos') return exactSinDeg((k + 90) % 360);
      if (fn === 'tan') {
        if (k % 180 === 90) throw mathErr();
        let a = k % 180, sgn = 1;
        if (a > 90) { a = 180 - a; sgn = -1; }
        return exact(TAN_TABLE[a].map(([n, d, r]) => [sgn * n, d, r || 1]));
      }
    }
  }
  const red = deg.dec.mod(360);
  const rad = red.times(PI).div(180);
  let v;
  if (fn === 'sin') v = Decimal.sin(rad);
  else if (fn === 'cos') v = Decimal.cos(rad);
  else {
    const c = Decimal.cos(rad);
    if (c.abs().lt('1e-30')) throw mathErr();
    v = Decimal.sin(rad).div(c);
  }
  if (v.abs().lt('1e-30')) v = new Decimal(0);
  return new Real(v);
}

const SPECIAL_SIN = [];
for (const a of [0, 15, 30, 45, 60, 75, 90]) SPECIAL_SIN.push([a, exactSinDeg(a)]);
const SPECIAL_TAN = [];
for (const a of [0, 15, 30, 45, 60, 75]) SPECIAL_TAN.push([a, exact(TAN_TABLE[a].map(([n, d, r]) => [n, d, r || 1]))]);

function exactInverse(fn, v) {
  // returns integer degrees for special values or null
  if (!v.ex) {
    const r = recognize(v);
    if (!r.ex) return null;
    v = r;
  }
  const neg = v.isNeg();
  const a = neg ? v.neg() : v;
  const table = fn === 'atan' ? SPECIAL_TAN : SPECIAL_SIN;
  for (const [deg, val] of table) {
    if (val.dec.minus(a.dec).abs().lt('1e-28')) {
      if (fn === 'asin' || fn === 'atan') return neg ? -deg : deg;
      if (fn === 'acos') return neg ? 180 - (90 - deg) : 90 - deg;
    }
  }
  if (fn === 'atan' && false) return null;
  return null;
}

// ---------------------------------------------------------------- helpers
function needInt(v, item) {
  const r = asReal(v, item);
  if (!r.isInt()) throw new CalcError('Math', item);
  return r.toBigInt();
}

function factorial(n) {
  if (n < 0n || n > 69n) throw mathErr();
  let f = 1n;
  for (let k = 2n; k <= n; k++) f *= k;
  return f;
}

function bgcdL(a, b) { return bgcd(a, b); }

// ---------------------------------------------------------------- evaluation
export class Evaluator {
  constructor(ctx) {
    this.ctx = ctx;
    this.depth = 0;
    this.flags = { dms: false };
  }

  get unit() { return this.ctx.angle || 'deg'; }

  ev(n) {
    if (++this.depth > 300) throw new CalcError('Stack');
    try { return this.ev2(n); } finally { this.depth--; }
  }

  real(n) { return asReal(this.ev(n), n.item); }

  ev2(n) {
    const ctx = this.ctx;
    switch (n.t) {
      case 'num': return n.v;
      case 'paren': return this.ev(n.a);
      case 'var': {
        if (ctx.bind && n.name in ctx.bind) return ctx.bind[n.name];
        const v = ctx.vars[n.name];
        if (v === undefined) return Real.int(0);
        if (isCx(v) && !ctx.complex && !v.im.isZero()) throw new CalcError('Math', n.item);
        return v;
      }
      case 'const':
        if (n.name === 'π') return Real.pi();
        if (n.name === '𝑒') return new Real(E);
        if (n.name === '𝑖') {
          if (!ctx.complex) throw new CalcError('Syntax', n.item);
          return new Cx(Real.int(0), Real.int(1));
        }
        if (n.name === 'Ans') {
          const a = ctx.ans === undefined ? Real.int(0) : ctx.ans;
          if (isCx(a) && !ctx.complex && !a.im.isZero()) throw new CalcError('Math', n.item);
          return a;
        }
        if (n.name === 'Ran#') return this.ranHash();
        break;
      case 'sciconst': {
        const c = SCI_CONSTANTS.find((k) => k.sym === n.name);
        return Real.fromDecimalString(c.value.replace(/^-/, '')).mul(c.value.startsWith('-') ? Real.int(-1) : Real.int(1));
      }
      case 'mvar': {
        const v = ctx.mvars && ctx.mvars[n.name];
        if (!v) throw new CalcError('Not Defined', n.item);
        return v;
      }
      case 'statvar':
        if (!ctx.stat) throw new CalcError('Syntax', n.item);
        return ctx.stat.get(n.name, n.item);
      case 'cell':
        if (!ctx.cell) throw new CalcError('Syntax', n.item);
        return ctx.cell(n.ref, n.item);
      case 'range': throw new CalcError('Syntax', n.item);
      case 'neg': return this.neg(this.ev(n.a), n);
      case 'bin': return this.bin(n);
      case 'frac': {
        const a = this.ev(n.a), b = this.ev(n.b);
        return this.div(a, b, n);
      }
      case 'mixed': {
        const i = this.real(n.i), a = this.real(n.a), b = this.real(n.b);
        if (b.isZero()) throw new CalcError('Math', n.item);
        const f = a.div(b);
        return i.isNeg() ? i.sub(f) : i.add(f);
      }
      case 'pow': return this.pow(this.ev(n.a), this.ev(n.b), n);
      case 'sci': {
        const a = this.ev(n.a);
        const e = this.real(n.e);
        if (!e.isInt()) throw new CalcError('Syntax', n.item);
        return this.mul(a, realPow(Real.int(10), e), n);
      }
      case 'sqrt': return this.sqrt(this.ev(n.a), n);
      case 'root': {
        const k = this.real(n.n), x = this.ev(n.a);
        if (isCx(x) && !x.im.isZero()) throw new CalcError('Math', n.item);
        const xr = asReal(x, n.item);
        if (k.isInt()) {
          const kk = k.toBigInt();
          if (kk === 0n) throw new CalcError('Math', n.item);
          if (kk < 0n) return rootReal(xr, -kk).inv();
          return rootReal(xr, kk);
        }
        return realPow(xr, k.inv());
      }
      case 'logb': return this.log(this.real(n.b), this.real(n.a), n);
      case 'post': return this.post(n);
      case 'dms': {
        this.flags.dms = true;
        let v = Real.int(0);
        const scale = [Real.int(1), Real.int(60), Real.int(3600)];
        let neg = false;
        n.parts.forEach((p, k) => {
          let x = this.real(p);
          if (k === 0 && x.isNeg()) { neg = true; x = x.neg(); }
          v = v.add(x.div(scale[k]));
        });
        return neg ? v.neg() : v;
      }
      case 'conv': {
        const c = UNIT_CONVERSIONS.find((u) => u.name === n.conv);
        const x = this.real(n.a);
        return c.f(x);
      }
      case 'call': return this.call(n);
      case 'eq': return this.sub(this.ev(n.a), this.ev(n.b), n);
      case 'baseprefix': return this.ev(n.a);
      default: break;
    }
    throw new CalcError('Syntax', n.item);
  }

  ranHash() {
    const k = Math.floor(this.rand() * 1000);
    return Real.frac(BigInt(k), 1000n);
  }

  rand() { return this.ctx.random ? this.ctx.random() : Math.random(); }

  neg(a, n) {
    if (isReal(a)) return a.neg();
    if (isCx(a)) return a.neg();
    if (isMat(a)) return mapMat(a, (x) => x.neg());
    if (isVec(a)) return { type: 'vec', a: a.a.map((x) => x.neg()) };
    throw new CalcError('Syntax', n.item);
  }

  bin(n) {
    const op = n.op;
    if (op === 'and' || op === 'or' || op === 'xor' || op === 'xnor') {
      return this.ctx.baseNLogic(op, this.real(n.a), this.real(n.b), n);
    }
    const a = this.ev(n.a), b = this.ev(n.b);
    switch (op) {
      case '+': return this.add(a, b, n);
      case '−': return this.sub(a, b, n);
      case '×': return this.mul(a, b, n);
      case '÷': return this.div(a, b, n);
      case '•': return this.dot(a, b, n);
      case 'nPr': case 'nCr': {
        const nn = needInt(a, n.item), r = needInt(b, n.item);
        if (nn < 0n || r < 0n || r > nn || nn >= 10n ** 10n) throw new CalcError('Math', n.item);
        if (op === 'nCr') return Real.int(binom(nn, r));
        let p = 1n;
        for (let k = nn - r + 1n; k <= nn; k++) {
          p *= k;
          if (p >= 10n ** 100n) throw new CalcError('Math', n.item);
        }
        return Real.int(p);
      }
      case '∠': {
        const r = asReal(a, n.item), th = asReal(b, n.item);
        if (!this.ctx.complex) throw new CalcError('Syntax', n.item);
        const deg = toDegrees(th, this.unit);
        return simplifyCx(new Cx(r.mul(trigDeg('cos', deg)), r.mul(trigDeg('sin', deg))));
      }
      default: throw new CalcError('Syntax', n.item);
    }
  }

  add(a, b, n) {
    if (isReal(a) && isReal(b)) return a.add(b);
    if ((isReal(a) || isCx(a)) && (isReal(b) || isCx(b))) return simplify(Cx.of(a).add(Cx.of(b)));
    if (isMat(a) && isMat(b)) return zipMat(a, b, (x, y) => x.add(y), n);
    if (isVec(a) && isVec(b)) return zipVec(a, b, (x, y) => x.add(y), n);
    throw new CalcError(isMat(a) || isMat(b) || isVec(a) || isVec(b) ? 'Dimension' : 'Syntax', n.item);
  }

  sub(a, b, n) {
    if (isReal(a) && isReal(b)) return a.sub(b);
    if ((isReal(a) || isCx(a)) && (isReal(b) || isCx(b))) return simplify(Cx.of(a).sub(Cx.of(b)));
    if (isMat(a) && isMat(b)) return zipMat(a, b, (x, y) => x.sub(y), n);
    if (isVec(a) && isVec(b)) return zipVec(a, b, (x, y) => x.sub(y), n);
    throw new CalcError(isMat(a) || isMat(b) || isVec(a) || isVec(b) ? 'Dimension' : 'Syntax', n.item);
  }

  mul(a, b, n) {
    if (isReal(a) && isReal(b)) return a.mul(b);
    if ((isReal(a) || isCx(a)) && (isReal(b) || isCx(b))) return simplify(Cx.of(a).mul(Cx.of(b)));
    if (isReal(a) && isMat(b)) return mapMat(b, (x) => a.mul(x));
    if (isMat(a) && isReal(b)) return mapMat(a, (x) => x.mul(b));
    if (isReal(a) && isVec(b)) return { type: 'vec', a: b.a.map((x) => a.mul(x)) };
    if (isVec(a) && isReal(b)) return { type: 'vec', a: a.a.map((x) => x.mul(b)) };
    if (isMat(a) && isMat(b)) return matMul(a, b, n);
    if (isMat(a) && isVec(b)) {
      // matrix × column vector
      const col = { type: 'mat', r: b.a.length, c: 1, a: b.a.map((x) => [x]) };
      const m = matMul(a, col, n);
      return { type: 'vec', a: m.a.map((row) => row[0]) };
    }
    if (isVec(a) && isMat(b)) {
      const row = { type: 'mat', r: 1, c: a.a.length, a: [a.a] };
      const m = matMul(row, b, n);
      return { type: 'vec', a: m.a[0] };
    }
    if (isVec(a) && isVec(b)) return cross(a, b, n);
    throw new CalcError('Syntax', n.item);
  }

  div(a, b, n) {
    if (isReal(a) && isReal(b)) {
      if (b.isZero()) throw new CalcError('Math', n.item);
      return a.div(b);
    }
    if ((isReal(a) || isCx(a)) && (isReal(b) || isCx(b))) {
      try { return simplify(Cx.of(a).div(Cx.of(b))); } catch (e) { throw new CalcError('Math', n.item); }
    }
    if (isMat(a) && isReal(b)) { if (b.isZero()) throw new CalcError('Math', n.item); return mapMat(a, (x) => x.div(b)); }
    if (isVec(a) && isReal(b)) { if (b.isZero()) throw new CalcError('Math', n.item); return { type: 'vec', a: a.a.map((x) => x.div(b)) }; }
    throw new CalcError('Syntax', n.item);
  }

  dot(a, b, n) {
    if (!isVec(a) || !isVec(b)) throw new CalcError('Syntax', n.item);
    if (a.a.length !== b.a.length) throw new CalcError('Dimension', n.item);
    return a.a.reduce((s, x, i) => s.add(x.mul(b.a[i])), Real.int(0));
  }

  pow(a, b, n) {
    if (isMat(a)) {
      const k = needInt(b, n.item);
      if (a.r !== a.c) throw new CalcError('Dimension', n.item);
      if (k < 0n) throw new CalcError('Math', n.item);
      let res = identity(a.r);
      for (let i = 0n; i < k; i++) res = matMul(res, a, n);
      return res;
    }
    if (isCx(a) || isCx(b)) {
      if (isCx(b) && !b.im.isZero()) throw new CalcError('Math', n.item);
      const br = asReal(b, n.item);
      if (!br.isInt()) throw new CalcError('Math', n.item);
      return cxPowInt(Cx.of(a), br.toBigInt(), n, this);
    }
    try { return realPow(asReal(a, n.item), asReal(b, n.item)); } catch (e) {
      if (e instanceof CalcError) { e.pos = e.pos || n.item; throw e; }
      throw new CalcError('Math', n.item);
    }
  }

  sqrt(a, n) {
    if (isCx(a)) {
      if (a.im.isZero()) a = a.re;
      else return cxSqrt(a);
    }
    a = asReal(a, n.item);
    if (a.isNeg()) {
      if (this.ctx.complex) return new Cx(Real.int(0), a.neg().sqrt());
      throw new CalcError('Math', n.item);
    }
    return a.sqrt();
  }

  log(base, x, n) {
    if (x.dec.lte(0) || base.dec.lte(0) || base.dec.eq(1)) throw new CalcError('Math', n.item);
    const v = Decimal.ln(x.dec).div(Decimal.ln(base.dec));
    return fromDec(v);
  }

  post(n) {
    const op = n.op;
    const a = this.ev(n.a);
    switch (op) {
      case '²': return this.pow(a, Real.int(2), n);
      case '³': return this.pow(a, Real.int(3), n);
      case '⁻¹':
        if (isMat(a)) return matInv(a, n);
        if (isReal(a)) { if (a.isZero()) throw new CalcError('Math', n.item); return a.inv(); }
        return this.div(Real.int(1), a, n);
      case '!': return Real.int(factorial(needInt(a, n.item)));
      case '%': return this.div(a, Real.int(100), n);
      case '°': return angleConvert(asReal(a, n.item), 'deg', this.unit);
      case 'ʳ': return angleConvert(asReal(a, n.item), 'rad', this.unit);
      case 'ᵍ': return angleConvert(asReal(a, n.item), 'grad', this.unit);
      case '▸t': return this.ctx.stat.normT(asReal(a, n.item), n.item);
      case 'x̂': case 'ŷ': case 'x̂1': case 'x̂2':
        if (!this.ctx.stat) throw new CalcError('Syntax', n.item);
        return this.ctx.stat.estimate(op, asReal(a, n.item), n.item);
      default: throw new CalcError('Syntax', n.item);
    }
  }

  trig(fn, x, n) {
    if (isCx(x) && !x.im.isZero()) throw new CalcError('Math', n.item);
    const r = asReal(x, n.item);
    const lim = { deg: '9e9', rad: '157079632.7', grad: '1e10' }[this.unit];
    if (r.dec.abs().gte(lim)) throw new CalcError('Math', n.item);
    return trigDeg(fn, toDegrees(r, this.unit));
  }

  invTrig(fn, x, n) {
    const r = asReal(x, n.item);
    if ((fn === 'asin' || fn === 'acos') && r.dec.abs().gt(1)) throw new CalcError('Math', n.item);
    const special = exactInverse(fn, r);
    if (special !== null) return fromDegrees(Real.int(special), this.unit);
    let rad;
    if (fn === 'asin') rad = Decimal.asin(r.dec);
    else if (fn === 'acos') rad = Decimal.acos(r.dec);
    else rad = Decimal.atan(r.dec);
    if (this.unit === 'rad') return fromDec(rad);
    const deg = rad.times(180).div(PI);
    return fromDec(this.unit === 'deg' ? deg : deg.times(10).div(9));
  }

  call(n) {
    const fn = n.fn;
    const A = n.args;
    const ctx = this.ctx;
    const argc = (k, k2 = k) => { if (A.length < k || A.length > k2) throw new CalcError('Syntax', n.item); };
    const R = (i) => this.real(A[i]);
    switch (fn) {
      case '(': argc(1); return this.ev(A[0]);
      case 'sin(': case 'cos(': case 'tan(': argc(1); return this.trig(fn.slice(0, 3), this.ev(A[0]), n);
      case 'sin⁻¹(': argc(1); return this.invTrig('asin', this.ev(A[0]), n);
      case 'cos⁻¹(': argc(1); return this.invTrig('acos', this.ev(A[0]), n);
      case 'tan⁻¹(': argc(1); return this.invTrig('atan', this.ev(A[0]), n);
      case 'sinh(': case 'cosh(': case 'tanh(': {
        argc(1);
        const x = R(0);
        if (fn !== 'tanh(' && x.dec.abs().gt('230.2585092')) throw new CalcError('Math', n.item);
        const v = fn === 'sinh(' ? Decimal.sinh(x.dec) : fn === 'cosh(' ? Decimal.cosh(x.dec) : Decimal.tanh(x.dec);
        return fromDec(v);
      }
      case 'sinh⁻¹(': argc(1); return fromDec(Decimal.asinh(R(0).dec));
      case 'cosh⁻¹(': {
        argc(1);
        const x = R(0);
        if (x.dec.lt(1)) throw new CalcError('Math', n.item);
        return fromDec(Decimal.acosh(x.dec));
      }
      case 'tanh⁻¹(': {
        argc(1);
        const x = R(0);
        if (x.dec.abs().gte(1)) throw new CalcError('Math', n.item);
        return fromDec(Decimal.atanh(x.dec));
      }
      case 'log(': {
        argc(1, 2);
        if (A.length === 2) return this.log(R(0), R(1), n);
        const x = R(0);
        if (x.dec.lte(0)) throw new CalcError('Math', n.item);
        return fromDec(Decimal.log10(x.dec));
      }
      case 'ln(': {
        argc(1);
        const x = R(0);
        if (x.dec.lte(0)) throw new CalcError('Math', n.item);
        return fromDec(Decimal.ln(x.dec));
      }
      case 'e^(': argc(1); return realPow(new Real(E), R(0));
      case '10^(': argc(1); return realPow(Real.int(10), R(0));
      case '√(': argc(1); return this.sqrt(this.ev(A[0]), n);
      case 'Abs(': {
        argc(1);
        const v = this.ev(A[0]);
        if (isReal(v)) return v.abs();
        if (isCx(v)) return v.abs();
        if (isMat(v)) return mapMat(v, (x) => x.abs());
        if (isVec(v)) return v.a.reduce((s, x) => s.add(x.mul(x)), Real.int(0)).sqrt();
        throw new CalcError('Syntax', n.item);
      }
      case 'Rnd(': {
        argc(1);
        const v = R(0);
        return ctx.round ? ctx.round(v) : v;
      }
      case 'Int(': argc(1); return fromDec(R(0).dec.trunc());
      case 'Intg(': argc(1); return fromDec(R(0).dec.floor());
      case 'GCD(': case 'LCM(': {
        argc(2);
        const a = needInt(this.ev(A[0]), n.item), b = needInt(this.ev(A[1]), n.item);
        if (babs(a) >= 10n ** 10n || babs(b) >= 10n ** 10n) throw new CalcError('Math', n.item);
        if (fn === 'GCD(') return Real.int(bgcdL(a, b));
        if (a < 0n || b < 0n) throw new CalcError('Math', n.item);
        if (a === 0n || b === 0n) return Real.int(0);
        return Real.int((a / bgcdL(a, b)) * b);
      }
      case 'RanInt#(': {
        argc(2);
        const a = needInt(this.ev(A[0]), n.item), b = needInt(this.ev(A[1]), n.item);
        if (a >= b) throw new CalcError('Math', n.item);
        const span = Number(b - a + 1n);
        return Real.int(a + BigInt(Math.floor(this.rand() * span)));
      }
      case 'Pol(': {
        argc(2);
        const x = R(0), y = R(1);
        if (x.isZero() && y.isZero()) throw new CalcError('Math', n.item);
        const r = x.mul(x).add(y.mul(y)).sqrt();
        let th;
        const deg = atan2Deg(y, x);
        th = fromDegrees(deg, this.unit);
        this.flags.pol = { r, th };
        return { type: 'pair', a: r, b: th, names: ['r', 'θ'] };
      }
      case 'Rec(': {
        argc(2);
        const r = R(0), th = R(1);
        const deg = toDegrees(th, this.unit);
        const x = r.mul(trigDeg('cos', deg)), y = r.mul(trigDeg('sin', deg));
        return { type: 'pair', a: x, b: y, names: ['x', 'y'] };
      }
      case 'f(': case 'g(': {
        argc(1);
        return this.userFunc(fn[0], this.ev(A[0]), n);
      }
      case 'd/dx(': {
        argc(2, 3);
        const a = R(1);
        const tol = A[2] ? R(2).dec : new Decimal('1e-10');
        return this.derivative(A[0], a, tol, n);
      }
      case '∫(': {
        argc(3, 4);
        const a = R(1), b = R(2);
        const tol = A[3] ? R(3).dec : new Decimal('1e-10');
        return this.integrate(A[0], a, b, tol, n);
      }
      case 'Σ(': {
        argc(3);
        const a = needInt(this.ev(A[1]), n.item), b = needInt(this.ev(A[2]), n.item);
        if (a > b) throw new CalcError('Math', n.item);
        if (b - a > 100000n) throw new CalcError('Time Out', n.item);
        let s = Real.int(0);
        for (let k = a; k <= b; k++) s = this.add(s, this.withX(Real.int(k), () => this.ev(A[0])), n);
        return s;
      }
      case 'Conjg(': { argc(1); const v = Cx.of(this.ev(A[0])); return simplify(v.conj()); }
      case 'Arg(': {
        argc(1);
        const v = Cx.of(this.ev(A[0]));
        if (v.re.isZero() && v.im.isZero()) throw new CalcError('Math', n.item);
        return fromDegrees(atan2Deg(v.im, v.re), this.unit);
      }
      case 'ReP(': { argc(1); return Cx.of(this.ev(A[0])).re; }
      case 'ImP(': { argc(1); return Cx.of(this.ev(A[0])).im; }
      case 'Det(': {
        argc(1);
        const m = this.ev(A[0]);
        if (!isMat(m)) throw new CalcError('Syntax', n.item);
        if (m.r !== m.c) throw new CalcError('Dimension', n.item);
        return det(m.a);
      }
      case 'Trn(': {
        argc(1);
        const m = this.ev(A[0]);
        if (!isMat(m)) throw new CalcError('Syntax', n.item);
        return { type: 'mat', r: m.c, c: m.r, a: m.a[0].map((_, j) => m.a.map((row) => row[j])) };
      }
      case 'Identity(': {
        argc(1);
        const k = needInt(this.ev(A[0]), n.item);
        if (k < 1n || k > 4n) throw new CalcError('Argument', n.item);
        return identity(Number(k));
      }
      case 'UnitV(': {
        argc(1);
        const v = this.ev(A[0]);
        if (!isVec(v)) throw new CalcError('Syntax', n.item);
        const len = v.a.reduce((s, x) => s.add(x.mul(x)), Real.int(0)).sqrt();
        if (len.isZero()) throw new CalcError('Math', n.item);
        return { type: 'vec', a: v.a.map((x) => x.div(len)) };
      }
      case 'Angle(': {
        argc(2);
        const a = this.ev(A[0]), b = this.ev(A[1]);
        if (!isVec(a) || !isVec(b)) throw new CalcError('Syntax', n.item);
        if (a.a.length !== b.a.length) throw new CalcError('Dimension', n.item);
        const d = this.dot(a, b, n);
        const la = a.a.reduce((s, x) => s.add(x.mul(x)), Real.int(0)).sqrt();
        const lb = b.a.reduce((s, x) => s.add(x.mul(x)), Real.int(0)).sqrt();
        if (la.isZero() || lb.isZero()) throw new CalcError('Math', n.item);
        let c = d.div(la.mul(lb));
        if (c.dec.gt(1)) c = Real.int(1);
        if (c.dec.lt(-1)) c = Real.int(-1);
        return this.invTrig('acos', c, n);
      }
      case 'P(': case 'Q(': case 'R(': argc(1); return ctx.stat.normProb(fn[0], R(0), n.item);
      case 'Min(': case 'Max(': case 'Mean(': case 'Sum(': {
        argc(1);
        if (!ctx.cellRange || A[0].t !== 'range') throw new CalcError('Syntax', n.item);
        return ctx.cellRange(fn.slice(0, -1), A[0].from, A[0].to, n.item);
      }
      case 'Neg(': case 'Not(': argc(1); return ctx.baseNUnary(fn.slice(0, 3), R(0), n);
      default: throw new CalcError('Syntax', n.item);
    }
  }

  withX(val, fn) {
    const old = this.ctx.bind;
    this.ctx.bind = { ...(old || {}), x: val };
    try { return fn(); } finally { this.ctx.bind = old; }
  }

  fx(ast, x) { return asReal(this.withX(x, () => this.ev(ast)), ast.item); }

  derivative(ast, a, tol, n) {
    // Central differences with Richardson extrapolation.
    const f = (x) => this.fx(ast, new Real(x)).dec;
    let h = a.dec.abs().gt(1) ? a.dec.abs().times('1e-3') : new Decimal('1e-3');
    let prev = null;
    const D0 = (hh) => f(a.dec.plus(hh)).minus(f(a.dec.minus(hh))).div(hh.times(2));
    const tab = [];
    for (let i = 0; i < 12; i++) {
      tab[i] = [D0(h)];
      let fac = new Decimal(4);
      for (let j = 1; j <= i; j++) {
        tab[i][j] = tab[i][j - 1].plus(tab[i][j - 1].minus(tab[i - 1][j - 1]).div(fac.minus(1)));
        fac = fac.times(4);
      }
      const cur = tab[i][i];
      if (prev && cur.minus(prev).abs().lte(tol.times(Decimal.max(1, cur.abs())))) {
        return fromDec(cleanSmall(cur));
      }
      prev = cur;
      h = h.div(2);
    }
    if (prev === null) throw new CalcError('Time Out', n.item);
    return fromDec(cleanSmall(prev));
  }

  integrate(ast, a, b, tol, n) {
    if (a.equalsApprox(b)) return Real.int(0);
    const f = (x) => this.fx(ast, new Real(x)).dec;
    const res = gaussKronrod(f, a.dec, b.dec, tol, 0);
    if (!res) throw new CalcError('Time Out', n.item);
    return fromDec(cleanSmall(res));
  }

  userFunc(name, x, n) {
    const ctx = this.ctx;
    const def = ctx.funcs && ctx.funcs[name];
    if (!def || !def.length) throw new CalcError('Not Defined', n.item);
    ctx.callStack = ctx.callStack || [];
    if (ctx.callStack.includes(name)) throw new CalcError('Circular', n.item);
    ctx.callStack.push(name);
    try {
      const ast = parseSeq(def, ctx.parseOpts || {});
      return this.withX(asReal(x, n.item), () => this.ev(ast));
    } finally { ctx.callStack.pop(); }
  }
}

function cleanSmall(d) { return d.abs().lt('1e-14') ? new Decimal(0) : d.toSignificantDigits(15); }

// 15-point Gauss–Kronrod adaptive quadrature
const XGK = ['0.991455371120812639206854697526329', '0.949107912342758524526189684047851',
  '0.864864423359769072789712788640926', '0.741531185599394439863864773280788',
  '0.586087235467691130294144845693013', '0.405845151377397166906606412076961',
  '0.207784955007898467600689403773245', '0'].map((s) => new Decimal(s));
const WGK = ['0.022935322010529224963732008058970', '0.063092092629978553290700663189204',
  '0.104790010322250183839876322541518', '0.140653259715525918745189590510238',
  '0.169004726639267902826583426598550', '0.190350578064785409913256402421014',
  '0.204432940075298892414161999234649', '0.209482141084727828012999174891714'].map((s) => new Decimal(s));
const WG = ['0.129484966168869693270611432679082', '0.279705391489276667901467771423780',
  '0.381830050505118944950369775488975', '0.417959183673469387755102040816327'].map((s) => new Decimal(s));

function gk15(f, a, b) {
  const c = a.plus(b).div(2), h = b.minus(a).div(2);
  const fc = f(c);
  let rk = fc.times(WGK[7]), rg = fc.times(WG[3]);
  for (let j = 0; j < 7; j++) {
    const dx = h.times(XGK[j]);
    const f1 = f(c.minus(dx)), f2 = f(c.plus(dx));
    rk = rk.plus(f1.plus(f2).times(WGK[j]));
    if (j % 2 === 1) rg = rg.plus(f1.plus(f2).times(WG[(j - 1) / 2]));
  }
  return [rk.times(h), rk.minus(rg).times(h).abs()];
}

function gaussKronrod(f, a, b, tol, depth) {
  const [r, err] = gk15(f, a, b);
  if (err.lte(Decimal.max(tol, r.abs().times(tol))) || depth > 14) {
    if (depth > 14 && err.gt(Decimal.max(tol, r.abs().times(tol)).times(1e6))) return null;
    return r;
  }
  const m = a.plus(b).div(2);
  const l = gaussKronrod(f, a, m, tol.div(2), depth + 1);
  if (l === null) return null;
  const rr = gaussKronrod(f, m, b, tol.div(2), depth + 1);
  if (rr === null) return null;
  return l.plus(rr);
}

function atan2Deg(y, x) {
  // exact for special angles
  if (x.isZero()) {
    if (y.isZero()) throw mathErr();
    return Real.int(y.isNeg() ? -90 : 90);
  }
  const t = y.div(x);
  const sp = exactInverse('atan', t);
  let deg;
  if (sp !== null) deg = Real.int(sp);
  else deg = new Real(Decimal.atan(t.dec).times(180).div(PI));
  if (x.isNeg()) deg = y.isNeg() ? deg.sub(Real.int(180)) : deg.add(Real.int(180));
  return deg;
}

function simplifyCx(c) { return c.im.isZero() ? c.re : c; }

function cxPowInt(z, k, n, ev) {
  if (babs(k) >= 10n ** 10n) throw new CalcError('Math', n.item);
  if (k === 0n) { if (z.re.isZero() && z.im.isZero()) throw new CalcError('Math', n.item); return Real.int(1); }
  let neg = k < 0n; let e = babs(k);
  let res = new Cx(Real.int(1), Real.int(0)), base = z;
  if (e > 1000n) {
    // De Moivre
    const r = z.abs(), th = atan2Deg(z.im, z.re);
    const rn = realPow(r, Real.int(e));
    const ang = th.mul(Real.int(e));
    res = new Cx(rn.mul(trigDeg('cos', ang)), rn.mul(trigDeg('sin', ang)));
  } else {
    while (e > 0n) {
      if (e & 1n) res = res.mul(base);
      e >>= 1n;
      if (e) base = base.mul(base);
    }
  }
  if (neg) res = new Cx(Real.int(1), Real.int(0)).div(res);
  return simplifyCx(res);
}

function cxSqrt(z) {
  const r = z.abs();
  let re = r.add(z.re).div(Real.int(2)).sqrt();
  let im = r.sub(z.re).div(Real.int(2)).sqrt();
  if (z.im.isNeg()) im = im.neg();
  return simplifyCx(new Cx(re, im));
}

function binom(n, r) {
  if (r > n - r) r = n - r;
  let c = 1n;
  for (let k = 1n; k <= r; k++) {
    c = (c * (n - r + k)) / k;
    if (c >= 10n ** 100n) throw mathErr();
  }
  return c;
}

// ---------------------------------------------------------------- matrices / vectors
function mapMat(m, f) { return { type: 'mat', r: m.r, c: m.c, a: m.a.map((row) => row.map(f)) }; }
function zipMat(a, b, f, n) {
  if (a.r !== b.r || a.c !== b.c) throw new CalcError('Dimension', n.item);
  return { type: 'mat', r: a.r, c: a.c, a: a.a.map((row, i) => row.map((x, j) => f(x, b.a[i][j]))) };
}
function zipVec(a, b, f, n) {
  if (a.a.length !== b.a.length) throw new CalcError('Dimension', n.item);
  return { type: 'vec', a: a.a.map((x, i) => f(x, b.a[i])) };
}
function matMul(a, b, n) {
  if (a.c !== b.r) throw new CalcError('Dimension', n.item);
  const out = [];
  for (let i = 0; i < a.r; i++) {
    const row = [];
    for (let j = 0; j < b.c; j++) {
      let s = Real.int(0);
      for (let k = 0; k < a.c; k++) s = s.add(a.a[i][k].mul(b.a[k][j]));
      row.push(s);
    }
    out.push(row);
  }
  return { type: 'mat', r: a.r, c: b.c, a: out };
}
export function identity(k) {
  return { type: 'mat', r: k, c: k, a: Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => Real.int(i === j ? 1 : 0))) };
}
function det(a) {
  const n = a.length;
  if (n === 1) return a[0][0];
  if (n === 2) return a[0][0].mul(a[1][1]).sub(a[0][1].mul(a[1][0]));
  let s = Real.int(0);
  for (let j = 0; j < n; j++) {
    const minor = a.slice(1).map((row) => row.filter((_, k) => k !== j));
    const term = a[0][j].mul(det(minor));
    s = j % 2 ? s.sub(term) : s.add(term);
  }
  return s;
}
function matInv(m, n) {
  if (m.r !== m.c) throw new CalcError('Dimension', n.item);
  const d = det(m.a);
  if (d.isZero() || d.dec.abs().lt('1e-30')) throw new CalcError('Math', n.item);
  const k = m.r;
  if (k === 1) return { type: 'mat', r: 1, c: 1, a: [[m.a[0][0].inv()]] };
  const adj = [];
  for (let i = 0; i < k; i++) {
    const row = [];
    for (let j = 0; j < k; j++) {
      const minor = m.a.filter((_, r) => r !== j).map((rr) => rr.filter((_, c) => c !== i));
      let c = det(minor);
      if ((i + j) % 2) c = c.neg();
      row.push(c.div(d));
    }
    adj.push(row);
  }
  return { type: 'mat', r: k, c: k, a: adj };
}
function cross(a, b, n) {
  if (a.a.length !== b.a.length) throw new CalcError('Dimension', n.item);
  const A = a.a.length === 2 ? [...a.a, Real.int(0)] : a.a;
  const B = b.a.length === 2 ? [...b.a, Real.int(0)] : b.a;
  return {
    type: 'vec', a: [A[1].mul(B[2]).sub(A[2].mul(B[1])), A[2].mul(B[0]).sub(A[0].mul(B[2])), A[0].mul(B[1]).sub(A[1].mul(B[0]))],
  };
}

export { toDegrees, fromDegrees, trigDeg, atan2Deg, isMat, isVec, isCx, isReal, asReal };
