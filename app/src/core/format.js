// Result formatting: values → display sequences (same item structure as the input editor, so the
// same layout code draws input and output).  Also plain-text renderings for tests.
import { Decimal, PI, Real, recognize, babs, bgcd } from './num.js';
import { Cx, toDegrees, fromDegrees, atan2Deg } from './eval.js';
import { tok } from './expr.js';

export const DEFAULT_SETTINGS = {
  io: 'MathI/MathO',          // 'MathI/MathO' | 'MathI/DecimalO' | 'LineI/LineO' | 'LineI/DecimalO'
  angle: 'deg',
  numFormat: { kind: 'Norm', n: 2 },  // Norm 1/2, Fix 0-9, Sci 1-10
  fraction: 'improper',       // 'improper' | 'mixed'
  complex: 'a+bi',            // 'a+bi' | 'r∠θ'
  decimalMark: 'dot',
  digitSep: true,
  x10Key: 'sci',              // 'sci' | 'power'
  formatKey: 'toggle',        // 'toggle' | 'menu'
  contrast: 4,
  autoPowerOff: 10,
  multiLineFont: 'normal',
  showOptionNum: true,
  qrVersion: 11,
};

const T = (v) => tok(v);
const digitsToks = (s) => Array.from(s).map((c) => T(c === '-' ? '-' : c));
const SEP = ' '; // separator token (renders as a 4-px gap)

// ---------------------------------------------------------------- decimal numbers
// returns { mant: '1.2345', exp: null|int, neg }
export function decimalParts(dec, nf) {
  const neg = dec.isNeg() && !dec.isZero();
  let a = dec.abs();
  if (a.isZero()) {
    if (nf.kind === 'Fix') return { mant: nf.n ? '0.' + '0'.repeat(nf.n) : '0', exp: null, neg: false };
    if (nf.kind === 'Sci') return { mant: nf.n > 1 ? '0.' + '0'.repeat(nf.n - 1) : '0', exp: 0, neg: false };
    return { mant: '0', exp: null, neg: false };
  }
  if (nf.kind === 'Sci') {
    const s = a.toExponential(nf.n - 1);
    const [m, e] = s.split('e');
    return { mant: m, exp: parseInt(e, 10), neg };
  }
  // 10 significant digits first (Norm) / Fix decimals
  if (nf.kind === 'Fix') {
    const r = a.toDecimalPlaces(nf.n);
    if (r.gte('1e10')) {
      const s = a.toExponential(nf.n);
      const [m, e] = s.split('e');
      return { mant: m, exp: parseInt(e, 10), neg };
    }
    const s = r.toFixed(nf.n);
    return { mant: s, exp: null, neg: neg && !r.isZero() };
  }
  // Norm
  const r = a.toSignificantDigits(10);
  const lower = nf.n === 1 ? new Decimal('1e-2') : new Decimal('1e-9');
  if (r.gte('1e10') || r.lt(lower)) {
    const s = r.toExponential();
    let [m, e] = s.split('e');
    if (m.includes('.')) m = m.replace(/0+$/, '').replace(/\.$/, '');
    return { mant: m, exp: parseInt(e, 10), neg };
  }
  let s = r.toFixed();
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return { mant: s, exp: null, neg };
}

function sepInt(intStr, settings) {
  // returns tokens with separator gaps every 3 digits
  if (!settings.digitSep || intStr.length < 4) return digitsToks(intStr);
  const out = [];
  const first = intStr.length % 3 || 3;
  out.push(...digitsToks(intStr.slice(0, first)));
  for (let i = first; i < intStr.length; i += 3) { out.push(T(SEP)); out.push(...digitsToks(intStr.slice(i, i + 3))); }
  return out;
}

export function decimalSeq(dec, settings, nf = settings.numFormat) {
  const p = decimalParts(dec, nf);
  const out = [];
  if (p.neg) out.push(T('-'));
  let [ip, fp] = p.mant.split('.');
  if (p.exp === null) out.push(...sepInt(ip, settings));
  else out.push(...digitsToks(ip));
  if (fp !== undefined) { out.push(T(settings.decimalMark === 'comma' ? ',' : '.')); out.push(...digitsToks(fp)); }
  if (p.exp !== null) out.push({ k: 'exp10', s: [digitsToks(String(p.exp))] });
  return out;
}

export function decimalText(dec, settings, nf = settings.numFormat) { return seqText(decimalSeq(dec, settings, nf)); }

// ---------------------------------------------------------------- exact forms
const nd = (x) => babs(x).toString().length;

function fracFits(n, d) {
  // digits of the mixed-number form incl. separators must be <= 10
  n = babs(n);
  if (d === 1n) return nd(n) <= 10;
  const ip = n / d, rem = n % d;
  const total = (ip > 0n ? nd(ip) + 1 : 0) + nd(rem) + nd(d) + 1;
  return total <= 10;
}

function fracSeq(n, d, settings, lineMode) {
  const neg = n < 0n;
  n = babs(n);
  const out = [];
  if (neg) out.push(T('-'));
  if (d === 1n) { out.push(...sepInt(n.toString(), settings)); return out; }
  const mixed = settings.fraction === 'mixed' && n > d;
  if (lineMode) {
    if (mixed) out.push(...sepInt((n / d).toString(), settings), T('⌟'), ...sepInt((n % d).toString(), settings), T('⌟'), ...sepInt(d.toString(), settings));
    else out.push(...sepInt(n.toString(), settings), T('⌟'), ...sepInt(d.toString(), settings));
    return out;
  }
  if (mixed) out.push({ k: 'mixed', s: [sepInt((n / d).toString(), settings), sepInt((n % d).toString(), settings), sepInt(d.toString(), settings)] });
  else out.push({ k: 'frac', s: [sepInt(n.toString(), settings), sepInt(d.toString(), settings)] });
  return out;
}

// Natural display of an exact real value or null if it doesn't fit Casio's display ranges.
function exactSeq(r, settings) {
  const ts = r.ex;
  if (!ts) return null;
  if (ts.length === 0) return [T('0')];
  // rational
  if (ts.length === 1 && ts[0].r === 1n && ts[0].p === 0) {
    const { n, d } = ts[0];
    if (!fracFits(n, d)) return null;
    return fracSeq(n, d, settings, false);
  }
  // π form: q·π
  if (ts.length === 1 && ts[0].r === 1n && ts[0].p === 1) {
    if (r.dec.abs().gte('1e6')) return null;
    const { n, d } = ts[0];
    if (!fracFits(n, d)) return null;
    const out = [];
    if (n < 0n) out.push(T('-'));
    const an = babs(n);
    if (d === 1n) { if (an !== 1n) out.push(...digitsToks(an.toString())); out.push(T('π')); return out; }
    if (settings.fraction === 'mixed' && an > d) {
      out.push({ k: 'mixed', s: [digitsToks((an / d).toString()), digitsToks((an % d).toString()), digitsToks(d.toString())] }, T('π'));
    } else out.push({ k: 'frac', s: [digitsToks(an.toString()), digitsToks(d.toString())] }, T('π'));
    return out;
  }
  if (ts.some((t) => t.p !== 0)) return null;
  // surd forms: at most 2 terms
  if (ts.length > 2) return null;
  const surds = ts.filter((t) => t.r !== 1n).sort((a, b) => (a.r > b.r ? -1 : 1));
  const rat = ts.filter((t) => t.r === 1n);
  const ordered = [...rat, ...surds];
  // range checks (a√b/c ± d√e/f; 1≤a<100, 1<b<1000, 1≤c<100, 0≤d<100, 0≤e<1000, 1≤f<100)
  for (const t of ordered) {
    if (babs(t.n) >= 100n || t.d >= 100n || t.r >= 1000n) return null;
  }
  // common denominator
  const L = ordered.reduce((acc, t) => (acc * t.d) / bgcd(acc, t.d), 1n);
  const num = [];
  ordered.forEach((t, i) => {
    const coef = t.n * (L / t.d);
    const neg = coef < 0n;
    const ac = babs(coef);
    if (i > 0) num.push(T(neg ? '−' : '+'));
    else if (neg) num.push(T('-'));
    if (t.r === 1n) num.push(...digitsToks(ac.toString()));
    else {
      if (ac !== 1n) num.push(...digitsToks(ac.toString()));
      num.push({ k: 'sqrt', s: [digitsToks(t.r.toString())] });
    }
  });
  if (L === 1n) return num;
  // a single negative term over denominator: show the sign before the fraction
  if (ordered.length === 1 && num[0].v === '-') return [T('-'), { k: 'frac', s: [num.slice(1), digitsToks(L.toString())] }];
  return [{ k: 'frac', s: [num, digitsToks(L.toString())] }];
}

// ---------------------------------------------------------------- public: value → display
// mode: 'std' (natural/exact if possible) | 'dec'
export function formatReal(r, settings, mode = 'std', opts = {}) {
  const lineMode = settings.io.startsWith('LineI');
  const decOut = settings.io.endsWith('DecimalO');
  if (mode === 'std' && !decOut) {
    const rr = r.ex ? r : recognize(r);
    if (lineMode) {
      // LineO: fractions only
      if (rr.ex && rr.ex.length <= 1 && (rr.ex.length === 0 || (rr.ex[0].r === 1n && rr.ex[0].p === 0))) {
        const q = rr.rational();
        if (q && fracFits(q.n, q.d)) {
          if (q.d === 1n && settings.numFormat.kind !== 'Norm') return decimalSeq(r.dec, settings);
          return fracSeq(q.n, q.d, settings, true);
        }
      }
    } else if (rr.ex) {
      const q = rr.rational();
      if (q && q.d === 1n && settings.numFormat.kind !== 'Norm') return decimalSeq(r.dec, settings);
      const s = exactSeq(rr, settings);
      if (s) return s;
    }
  }
  return decimalSeq(r.dec, settings);
}

export function formatValue(v, settings, mode = 'std') {
  if (v instanceof Real) return formatReal(v, settings, mode);
  if (v instanceof Cx) return formatComplex(v, settings, mode);
  if (v && v.type === 'pair') {
    return [T(v.names[0] === 'r' ? 'r' : '𝑥'), T('='), ...formatReal(v.a, settings, mode), T(','), T(v.names[1] === 'θ' ? 'θ' : '𝑦'), T('='), ...formatReal(v.b, settings, mode)];
  }
  return [T('?')];
}

export function formatComplex(c, settings, mode = 'std', polar = settings.complex === 'r∠θ') {
  if (polar) {
    const r = c.abs();
    if (r.isZero()) return [T('0')];
    const th = fromDegrees(atan2Deg(c.im, c.re), settings.angle);
    return [...formatReal(r, settings, mode), T('∠'), ...formatReal(th, settings, mode)];
  }
  // natural display: a single fraction (−3+√23𝑖)/4 when both parts share a denominator
  if (mode === 'std' && settings.io.startsWith('MathI') && !settings.io.endsWith('DecimalO') && !c.re.isZero() && !c.im.isZero()) {
    const re = c.re.ex ? c.re : recognize(c.re), im = c.im.ex ? c.im : recognize(c.im);
    if (re.ex && im.ex && re.ex.length === 1 && im.ex.length === 1 && re.ex[0].p === 0 && im.ex[0].p === 0) {
      const a = re.ex[0], b = im.ex[0];
      const L = (a.d * b.d) / bgcd(a.d, b.d);
      if (L > 1n && babs(a.n) < 100n * a.d && babs(b.n) < 100n && a.r < 1000n && b.r < 1000n && L < 100n) {
        const term = (t, first) => {
          const coef = t.n * (L / t.d), ac = babs(coef), out = [];
          if (!first) out.push(T(coef < 0n ? '−' : '+')); else if (coef < 0n) out.push(T('-'));
          if (t.r === 1n) out.push(...digitsToks(ac.toString()));
          else { if (ac !== 1n) out.push(...digitsToks(ac.toString())); out.push({ k: 'sqrt', s: [digitsToks(t.r.toString())] }); }
          return out;
        };
        const imTerm = term(b, false);
        if (imTerm.length === 2 && imTerm[1].v === '1') imTerm.pop();
        return [{ k: 'frac', s: [[...term(a, true), ...imTerm, T('𝑖')], digitsToks(L.toString())] }];
      }
    }
  }
  const out = [];
  const reZero = c.re.isZero();
  if (!reZero) out.push(...formatReal(c.re, settings, mode));
  if (!c.im.isZero()) {
    let im = formatReal(c.im.abs(), settings, mode);
    const neg = c.im.isNeg();
    if (!reZero) out.push(T(neg ? '−' : '+'));
    else if (neg) out.push(T('-'));
    if (im.length === 1 && im[0].v === '1') im = [];
    // imaginary unit after the coefficient (inside the numerator for fractions)
    if (im.length === 1 && im[0].k === 'frac') {
      im = [{ k: 'frac', s: [[...im[0].s[0], T('𝑖')], im[0].s[1]] }];
      out.push(...im);
    } else out.push(...im, T('𝑖'));
  }
  if (!out.length) out.push(T('0'));
  return out;
}

// ---------------------------------------------------------------- FORMAT-menu conversions
export function sexagesimalSeq(r, settings) {
  const neg = r.isNeg();
  let a = r.dec.abs();
  if (a.gt('9999999.999')) return null;
  let d = a.floor();
  let rem = a.minus(d).times(60);
  let m = rem.floor();
  let s = rem.minus(m).times(60);
  // rounding of seconds to fit 10 digits
  const used = d.toFixed().length + 2;
  const dp = Math.max(0, Math.min(2, 10 - used - 2));
  s = s.toDecimalPlaces(dp);
  if (s.gte(60)) { s = s.minus(60); m = m.plus(1); }
  if (m.gte(60)) { m = m.minus(60); d = d.plus(1); }
  let ss = s.toFixed(dp);
  if (ss.includes('.')) ss = ss.replace(/0+$/, '').replace(/\.$/, '');
  return [...(neg ? [T('-')] : []), ...digitsToks(d.toFixed()), T('°'), ...digitsToks(m.toFixed()), T('′'), ...digitsToks(ss), T('″')];
}

export function standardFormSeq(r, settings) {
  const dec = r.dec;
  if (dec.isZero()) return [T('0')];
  const s = dec.abs().toSignificantDigits(10).toExponential();
  let [m, e] = s.split('e');
  if (m.includes('.')) m = m.replace(/0+$/, '').replace(/\.$/, '');
  return [...(dec.isNeg() ? [T('-')] : []), ...digitsToks(m), { k: 'exp10', s: [digitsToks(String(parseInt(e, 10)))] }];
}

export function primeFactorSeq(r) {
  const q = r.ex ? r.rational() : recognize(r).rational();
  if (!q || q.d !== 1n || q.n <= 0n || q.n.toString().length > 10) return null;
  let n = q.n;
  if (n === 1n) return [T('1')];
  const fs = [];
  // trial division by primes of up to three digits; a remainder below 1009² is then prime,
  // otherwise it cannot be factored and is shown in parentheses (User's Guide p.50)
  for (let p = 2n; p < 1000n && p * p <= n; p += p === 2n ? 1n : 2n) {
    let e = 0;
    while (n % p === 0n) { n /= p; e++; }
    if (e) fs.push([p, e]);
  }
  let rest = null;
  if (n > 1n) {
    if (n < 1018081n) fs.push([n, 1]);
    else rest = n;
  }
  const out = [];
  fs.forEach(([p, e], i) => {
    if (i) out.push(T('×'));
    out.push(...digitsToks(p.toString()));
    if (e > 1) out.push({ k: 'pow', s: [digitsToks(String(e))] });
  });
  if (rest) {
    if (out.length) out.push(T('×'));
    out.push(T('('), ...sepInt(rest.toString(), { digitSep: true }), T(')'));
  }
  return out;
}

// recurring decimal: from an exact rational
export function recurringSeq(r) {
  const rr = r.ex ? r : recognize(r);
  const q = rr.rational();
  if (!q || q.d === 1n) return null;
  if (!fracFits(q.n, q.d)) return null;
  const neg = q.n < 0n;
  let n = babs(q.n);
  const d = q.d;
  const ip = n / d;
  let rem = n % d;
  const digits = [];
  const seen = new Map();
  let start = -1;
  while (rem !== 0n) {
    if (seen.has(rem)) { start = seen.get(rem); break; }
    seen.set(rem, digits.length);
    rem *= 10n;
    digits.push((rem / d).toString());
    rem %= d;
    if (digits.length > 90) return null;
  }
  if (start < 0) return null; // terminating decimals are not recurring
  const bytes = ip.toString().length + digits.length + 1 + 3;
  if (bytes > 99) return null;
  const out = [];
  if (neg) out.push(T('-'));
  out.push(...digitsToks(ip.toString()), T('.'), ...digitsToks(digits.slice(0, start).join('')));
  out.push({ k: 'rec', s: [digitsToks(digits.slice(start).join(''))] });
  return out;
}

export function mixedSeq(r, settings, which) {
  const rr = r.ex ? r : recognize(r);
  const q = rr.rational();
  if (!q || q.d === 1n || !fracFits(q.n, q.d)) return null;
  return fracSeq(q.n, q.d, { ...settings, fraction: which }, settings.io.startsWith('LineI'));
}

// ---------------------------------------------------------------- plain text (tests)
export function seqText(seq) {
  let s = '';
  for (const it of seq) {
    if (it.k === 't') s += it.v === SEP ? ' ' : it.v;
    else if (it.k === 'frac') s += '[' + seqText(it.s[0]) + '/' + seqText(it.s[1]) + ']';
    else if (it.k === 'mixed') s += '[' + seqText(it.s[0]) + ' ' + seqText(it.s[1]) + '/' + seqText(it.s[2]) + ']';
    else if (it.k === 'sqrt') s += '√' + seqText(it.s[0]);
    else if (it.k === 'pow') s += '^' + seqText(it.s[0]);
    else if (it.k === 'exp10') s += '×10^' + seqText(it.s[0]);
    else if (it.k === 'rec') s += '(' + seqText(it.s[0]) + ')';
    else s += '[' + it.k + ':' + it.s.map(seqText).join('|') + ']';
  }
  return s;
}

export { SEP };
