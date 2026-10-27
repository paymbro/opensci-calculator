// Numeric core: every real value carries a high-precision Decimal approximation (`dec`) and, when
// the calculation allowed it, an exact symbolic form (`ex`) made of terms  (n/d)·√r·π^p.
// The exact form drives Natural Textbook output (fractions, √ and π forms); the Decimal value
// drives everything else.
import DecimalBase from '../vendor/decimal.mjs';

export const Decimal = DecimalBase.clone({
  precision: 34, rounding: DecimalBase.ROUND_HALF_UP, toExpNeg: -7, toExpPos: 21, maxE: 9e15, minE: -9e15,
});
export const PI = Decimal.acos(-1);
export const E = Decimal.exp(1);

export class CalcError extends Error {
  constructor(kind, pos) {
    super(kind + ' ERROR');
    this.kind = kind;       // 'Math' | 'Syntax' | 'Stack' | 'Argument' | 'Dimension' | 'Variable' | ...
    this.pos = pos;         // optional cursor location (input item id) of the error
  }
}
export const mathErr = () => new CalcError('Math');

// ---------------------------------------------------------------- BigInt helpers
export const babs = (a) => (a < 0n ? -a : a);
export function bgcd(a, b) {
  a = babs(a); b = babs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}
const BIG_LIMIT = 10n ** 40n;
const tooBig = (x) => babs(x) > BIG_LIMIT;

// Factor out the largest square: returns [s, f] with n = s² · f, f square-free; null if too hard.
export function squareFactor(n) {
  if (n < 0n) return null;
  if (n === 0n) return [0n, 1n];
  let s = 1n, f = 1n, m = n;
  for (let p = 2n; p * p <= m; p += (p === 2n ? 1n : 2n)) {
    if (p > 1000000n) return null;
    let e = 0;
    while (m % p === 0n) { m /= p; e++; }
    if (e) {
      s *= p ** BigInt(e >> 1);
      if (e & 1) f *= p;
    }
  }
  f *= m;
  return [s, f];
}

// ---------------------------------------------------------------- exact terms
// term: {n, d, r, p}  value = n/d * sqrt(r) * pi^p ; d > 0, gcd(n,d)=1, r square-free >= 1
function mkTerm(n, d, r = 1n, p = 0) {
  if (d < 0n) { n = -n; d = -d; }
  const g = bgcd(n, d) || 1n;
  return { n: n / g, d: d / g, r, p };
}

function normTerms(terms) {
  const map = new Map();
  for (const t of terms) {
    if (t.n === 0n) continue;
    const k = t.r + ':' + t.p;
    const o = map.get(k);
    if (o) map.set(k, mkTerm(o.n * t.d + t.n * o.d, o.d * t.d, t.r, t.p));
    else map.set(k, t);
  }
  const out = [...map.values()].filter((t) => t.n !== 0n);
  for (const t of out) if (tooBig(t.n) || tooBig(t.d) || tooBig(t.r)) return null;
  if (out.length > 6) return null;
  return out;
}

function termMul(a, b) {
  const p = a.p + b.p;
  if (p > 3 || p < -3) return null;
  const g = bgcd(a.r, b.r);
  const r = (a.r / g) * (b.r / g);
  return mkTerm(a.n * b.n * g, a.d * b.d, r, p);
}

function exAdd(a, b) { return normTerms([...a, ...b]); }
function exNeg(a) { return a.map((t) => ({ ...t, n: -t.n })); }
function exMul(a, b) {
  const out = [];
  for (const x of a) for (const y of b) {
    const t = termMul(x, y);
    if (!t) return null;
    out.push(t);
  }
  return normTerms(out);
}
function exInv(a) {
  if (a.length === 0) return null;
  if (a.length === 1) {
    const t = a[0];
    // 1/(n/d √r π^p) = d/(n r) √r π^-p
    return normTerms([mkTerm(t.d, t.n * t.r, t.r, -t.p)]);
  }
  if (a.length === 2) {
    // (x + y) with x rational-ish and y surd of same pi power → conjugate
    const [x, y] = a;
    if (x.p === y.p && (x.r === 1n || y.r === 1n)) {
      const conj = [x, { ...y, n: -y.n }];
      const den = exMul(a, conj); // rational * pi^(2p)
      if (!den || den.length !== 1 || den[0].r !== 1n) return null;
      const inv = exInv(den);
      return inv ? exMul(conj, inv) : null;
    }
  }
  return null;
}

// ---------------------------------------------------------------- Real
export class Real {
  constructor(dec, ex = null) {
    this.dec = dec instanceof Decimal ? dec : new Decimal(dec);
    this.ex = ex; // array of terms or null
  }

  static int(n) { return Real.frac(BigInt(n), 1n); }
  static frac(n, d) {
    n = BigInt(n); d = BigInt(d);
    if (d === 0n) throw mathErr();
    const t = mkTerm(n, d);
    return new Real(new Decimal(t.n.toString()).div(t.d.toString()), normTerms([t]));
  }
  static fromDecimalString(s) {
    // exact rational from decimal literal like "12.345" or "1.2e5"
    const m = /^(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(s);
    if (!m) throw new CalcError('Syntax');
    const ip = m[1] || '0', fp = m[2] || '', ex = parseInt(m[3] || '0', 10);
    let n = BigInt(ip + fp), d = 10n ** BigInt(fp.length);
    if (ex > 0) n *= 10n ** BigInt(ex); else if (ex < 0) d *= 10n ** BigInt(-ex);
    if (babs(BigInt(ex)) > 200n) return new Real(new Decimal(s));
    return Real.frac(n, d);
  }
  static dec(d) { return new Real(d instanceof Decimal ? d : new Decimal(d)); }
  static pi() { return new Real(PI, [mkTerm(1n, 1n, 1n, 1)]); }
  static sqrtInt(r) { return Real.frac(1n, 1n).sqrt(); }

  isZero() { return this.ex ? this.ex.length === 0 : this.dec.isZero(); }
  isNeg() { return this.dec.isNeg() && !this.isZero(); }
  sign() { return this.isZero() ? 0 : this.dec.isNeg() ? -1 : 1; }
  // exact rational? returns {n,d} or null
  rational() {
    if (!this.ex) return null;
    if (this.ex.length === 0) return { n: 0n, d: 1n };
    if (this.ex.length === 1 && this.ex[0].r === 1n && this.ex[0].p === 0) return { n: this.ex[0].n, d: this.ex[0].d };
    return null;
  }
  isInt() {
    const q = this.rational();
    if (q) return q.d === 1n;
    return this.dec.isInteger();
  }
  toBigInt() {
    const q = this.rational();
    if (q && q.d === 1n) return q.n;
    return BigInt(this.dec.toFixed(0));
  }
  toNumber() { return this.dec.toNumber(); }

  add(o) { return new Real(this.dec.plus(o.dec), this.ex && o.ex ? exAdd(this.ex, o.ex) : null).chk(); }
  sub(o) { return new Real(this.dec.minus(o.dec), this.ex && o.ex ? exAdd(this.ex, exNeg(o.ex)) : null).chk(); }
  neg() { return new Real(this.dec.neg(), this.ex ? exNeg(this.ex) : null); }
  mul(o) { return new Real(this.dec.times(o.dec), this.ex && o.ex ? exMul(this.ex, o.ex) : null).chk(); }
  div(o) {
    if (o.isZero()) throw mathErr();
    let ex = null;
    if (this.ex && o.ex) {
      const inv = exInv(o.ex);
      ex = inv ? exMul(this.ex, inv) : null;
    }
    return new Real(this.dec.div(o.dec), ex).chk();
  }
  inv() { return Real.int(1).div(this); }
  abs() { return this.isNeg() ? this.neg() : this; }

  // Range check (|x| < 1e100) and tiny-value flush.
  chk() {
    const a = this.dec.abs();
    if (a.gte('1e100')) throw mathErr();
    if (!a.isZero() && a.lt('1e-99') && !this.ex) return new Real(0, []);
    if (this.ex) {
      // verify the exact form is consistent (cheap guard)
    }
    return this;
  }

  sqrt() {
    if (this.isNeg()) throw mathErr();
    let ex = null;
    const q = this.rational();
    if (q) {
      const sf = squareFactor(q.n * q.d);
      if (sf) ex = normTerms([mkTerm(sf[0], q.d, sf[1])]);
    } else if (this.ex && this.ex.length === 1 && this.ex[0].p === 0) {
      // sqrt(n/d √r) not representable; leave decimal
    }
    return new Real(this.dec.sqrt(), ex);
  }

  // integer power with exact tracking
  powInt(k) {
    k = BigInt(k);
    if (k === 0n) {
      if (this.isZero()) throw mathErr();
      return Real.int(1);
    }
    const neg = k < 0n;
    let e = babs(k);
    let ex = null;
    if (this.ex && e <= 400n) {
      let base = this.ex, acc = [mkTerm(1n, 1n)];
      let ok = true;
      while (e > 0n && ok) {
        if (e & 1n) { acc = exMul(acc, base); if (!acc) ok = false; }
        e >>= 1n;
        if (e > 0n && ok) { base = exMul(base, base); if (!base) ok = false; }
      }
      if (ok && acc) ex = neg ? exInv(acc) : acc;
    }
    if (neg && this.isZero()) throw mathErr();
    const dec = this.dec.pow(new Decimal(k.toString()));
    return new Real(dec, ex).chk();
  }

  equalsApprox(o) { return this.dec.minus(o.dec).abs().lte(this.dec.abs().times('1e-25')); }
  cmp(o) { return this.dec.cmp(o.dec); }
  toString() { return this.dec.toString(); }
}

export const ZERO = Real.int(0);
export const ONE = Real.int(1);

// x^y for reals (general)
export function realPow(x, y) {
  const q = y.rational();
  if (q && q.d === 1n) {
    if (babs(q.n) > 100000n && !x.dec.abs().eq(1)) {
      // large integer exponents: decimal
      if (x.isZero()) { if (q.n < 0n) throw mathErr(); return Real.int(0); }
      return new Real(x.dec.pow(y.dec)).chk();
    }
    return x.powInt(q.n);
  }
  if (x.isZero()) {
    if (y.dec.lte(0)) throw mathErr();
    return Real.int(0);
  }
  if (q) {
    // rational exponent n/d
    if (x.isNeg()) {
      if (q.d % 2n === 0n) throw mathErr();
      return realPow(x.neg(), y).neg().mul(q.n % 2n === 0n ? Real.int(-1) : Real.int(1));
    }
    const r = rootReal(x, q.d);
    return r.powInt(q.n);
  }
  if (x.isNeg()) throw mathErr();
  return new Real(x.dec.pow(y.dec)).chk();
}

// n-th root (n positive integer BigInt)
export function rootReal(x, n) {
  n = BigInt(n);
  if (n <= 0n) throw mathErr();
  if (n === 1n) return x;
  if (n === 2n) return x.sqrt();
  if (x.isNeg()) {
    if (n % 2n === 0n) throw mathErr();
    return rootReal(x.neg(), n).neg();
  }
  if (x.isZero()) return Real.int(0);
  const dec = x.dec.pow(new Decimal(1).div(n.toString()));
  const q = x.rational();
  if (q) {
    const a = intRoot(q.n, n), b = intRoot(q.d, n);
    if (a !== null && b !== null) return Real.frac(a, b);
  }
  return new Real(dec);
}

function intRoot(v, n) {
  if (v < 0n) return null;
  if (v === 0n || v === 1n) return v;
  const approx = BigInt(Math.round(Number(v) ** (1 / Number(n))));
  for (let c = approx - 2n; c <= approx + 2n; c++) if (c >= 0n && c ** n === v) return c;
  return null;
}

// ---------------------------------------------------------------- recognition (display aid)
// Continued-fraction search for p/q with |q| <= maxDen approximating x within tolerance.
export function recognizeRational(dec, maxDen = 10n ** 10n, relTol = '1e-26') {
  if (dec.isZero()) return { n: 0n, d: 1n };
  const neg = dec.isNeg();
  let x = dec.abs();
  if (x.gte('1e15')) {
    if (x.isInteger()) return { n: BigInt(x.toFixed(0)) * (neg ? -1n : 1n), d: 1n };
    return null;
  }
  let h0 = 0n, h1 = 1n, k0 = 1n, k1 = 0n;
  let y = x;
  for (let i = 0; i < 60; i++) {
    const a = BigInt(y.floor().toFixed(0));
    const h2 = a * h1 + h0, k2 = a * k1 + k0;
    if (k2 > maxDen) break;
    h0 = h1; h1 = h2; k0 = k1; k1 = k2;
    const approx = new Decimal(h1.toString()).div(k1.toString());
    if (approx.minus(x).abs().lte(x.times(relTol))) return { n: neg ? -h1 : h1, d: k1 };
    const frac = y.minus(y.floor());
    if (frac.isZero()) break;
    y = new Decimal(1).div(frac);
  }
  return null;
}

// Try to give a Decimal-only Real an exact form (rational, π·rational or √rational).
export function recognize(r) {
  if (r.ex) return r;
  const q = recognizeRational(r.dec, 10n ** 12n);
  if (q) return new Real(r.dec, normTerms([mkTerm(q.n, q.d)]));
  const qp = recognizeRational(r.dec.div(PI), 10n ** 6n);
  if (qp && qp.n !== 0n) return new Real(r.dec, normTerms([mkTerm(qp.n, qp.d, 1n, 1)]));
  const sq = r.dec.times(r.dec);
  const q2 = recognizeRational(sq, 10n ** 8n);
  if (q2 && q2.n > 0n) {
    const sf = squareFactor(q2.n * q2.d);
    if (sf && sf[1] > 1n) {
      const t = mkTerm(sf[0] * (r.dec.isNeg() ? -1n : 1n), q2.d, sf[1]);
      return new Real(r.dec, [t]);
    }
  }
  return r;
}

export { mkTerm, normTerms };
