// CATALOG menu contents (User's Guide p.30-31, 56-70 and the app chapters).
// Each item: { label, spec } where spec is passed to insertCatalogItem / inputKey.
import { SCI_CONSTANTS, SCI_CONST_CATEGORIES, UNIT_CONVERSIONS, UNIT_CATEGORIES } from './constants.js';

const T = (label, tokens, extra = {}) => ({ label, spec: { tokens, ...extra } });
const K = (label, key) => ({ label, spec: { key } });

export const FUNC_ANALYSIS = { label: 'Func Analysis', items: [
  T('Derivative(d/d𝑥)', ['d/dx('], { tmpl: 'ddx' }),
  T('Integration(∫)', ['∫('], { tmpl: 'int' }),
  T('Summation(Σ)', ['Σ('], { tmpl: 'sum' }),
  T('Logarithm(logab)', ['log('], { tmpl: 'logb', list: 'logab(' }),
  T('Logarithm(log)', ['log(']),
  T('Natural Logarithm', ['ln(']),
] };
export const PROBABILITY = { label: 'Probability', items: [
  T('%', ['%']), T('Factorial(!)', ['!']), T('Permutation(P)', ['nPr']), T('Combination(C)', ['nCr']),
  T('Random Number', ['Ran#']), T('Random Integer', ['RanInt#(']),
] };
export const NUMERIC = { label: 'Numeric Calc', items: [
  T('GCD', ['GCD(']), T('LCM', ['LCM(']), T('Absolute Value', ['Abs('], { tmpl: 'abs' }),
  T('Recurring Decimal', [], { tmpl: 'rec', mathOnly: true, list: '•' }), T('Round Off', ['Rnd(']),
] };
export const ANGLE = { label: 'Angle/Coord/Sexa', items: [
  T('Degrees', ['°']), T('Radians', ['ʳ']), T('Gradians', ['ᵍ']),
  T('Rect to Polar', ['Pol(']), T('Polar to Rect', ['Rec(']), T('Degs Mins Secs', ['▫']),
] };
export const HYP_TRIG = { label: 'Hyperbolic/Trig', items: [
  T('sinh', ['sinh(']), T('cosh', ['cosh(']), T('tanh', ['tanh(']),
  T('sinh⁻¹', ['sinh⁻¹(']), T('cosh⁻¹', ['cosh⁻¹(']), T('tanh⁻¹', ['tanh⁻¹(']),
  T('sin', ['sin(']), T('cos', ['cos(']), T('tan', ['tan(']),
  T('sin⁻¹', ['sin⁻¹(']), T('cos⁻¹', ['cos⁻¹(']), T('tan⁻¹', ['tan⁻¹(']),
] };
export const SCI_CONST = { label: 'Sci Constants', noList: true, items: SCI_CONST_CATEGORIES.map((cat) => ({
  label: cat, twoCol: true, items: SCI_CONSTANTS.filter((c) => c.cat === cat).map((c) => T(c.sym, ['const:' + c.sym])),
})) };
export const UNIT_CONV = { label: 'Unit Conversions', noList: true, items: UNIT_CATEGORIES.map((cat) => ({
  label: cat, twoCol: true, items: UNIT_CONVERSIONS.filter((u) => u.cat === cat).map((u) => T(u.name, [u.name])),
})) };
export const OTHER = { label: 'Other', items: [
  K('Ans', 'ANS'), K('π', 'PI'), K('𝑒', 'E'), K('√(', 'SQRT'), K('𝑥√(', 'ROOT'), K('⁻¹', 'RECIP'), K('²', 'SQR'),
  K('^(', 'POW'), K('-', 'NEG'), K(',', 'COMMA'), K('(', 'LPAR'), K(')', 'RPAR'),
] };

export const COMMON = [FUNC_ANALYSIS, PROBABILITY, NUMERIC, ANGLE, HYP_TRIG, SCI_CONST, UNIT_CONV, OTHER];

// ------------------------------------------------------------ app specific categories
const S = (label, name) => T(label, ['stat:' + name]);
export function statisticsCategory(twoVar) {
  const items = [];
  const sum = twoVar
    ? ['Σ𝑥', 'Σ𝑥²', 'Σ𝑦', 'Σ𝑦²', 'Σ𝑥𝑦', 'Σ𝑥³', 'Σ𝑥²𝑦', 'Σ𝑥⁴']
    : ['Σ𝑥', 'Σ𝑥²'];
  items.push({ label: 'Summation', items: sum.map((s) => S(s, s)) });
  const mv = twoVar
    ? ['𝑥̄', 'σ²𝑥', 'σ𝑥', 's²𝑥', 's𝑥', 'n', '𝑦̄', 'σ²𝑦', 'σ𝑦', 's²𝑦', 's𝑦']
    : ['𝑥̄', 'σ²𝑥', 'σ𝑥', 's²𝑥', 's𝑥', 'n'];
  items.push({ label: 'Mean/Var/Dev...', items: mv.map((s) => S(s, s)) });
  if (!twoVar) {
    items.push({ label: 'Min/Max/Quartile', items: ['min(𝑥)', 'Q₁', 'Med', 'Q₃', 'max(𝑥)'].map((s) => S(s, s)) });
    items.push({ label: 'Norm Dist', items: [T('P(', ['P(']), T('Q(', ['Q(']), T('R(', ['R(']), T('▸t', ['▸t'])] });
  } else {
    items.push({ label: 'Min/Max', items: ['min(𝑥)', 'max(𝑥)', 'min(𝑦)', 'max(𝑦)'].map((s) => S(s, s)) });
    items.push({ label: 'Regression', items: null }); // filled per regression type
  }
  return { label: 'Statistics', items };
}
export function regressionItems(type) {
  const quad = type === 'quad';
  const base = quad ? ['a', 'b', 'c'] : ['a', 'b', 'r'];
  return [...base.map((s) => S(s, s)), ...(quad ? [T('𝑥̂₁', ['x̂1']), T('𝑥̂₂', ['x̂2'])] : [T('𝑥̂', ['x̂'])]), T('𝑦̂', ['ŷ'])];
}

export const COMPLEX_CAT = { label: 'Complex', items: [
  K('𝑖', 'I'), T('∠', ['∠']), T('Argument', ['Arg(']), T('Conjugate', ['Conjg(']),
  T('Real Part', ['ReP(']), T('Imaginary Part', ['ImP(']),
] };
export const MATRIX_CAT = { label: 'Matrix', items: [
  T('MatA', ['MatA']), T('MatB', ['MatB']), T('MatC', ['MatC']), T('MatD', ['MatD']), T('MatAns', ['MatAns']),
  { label: 'Matrix Calc', items: [
    T('Determinant', ['Det(']), T('Transposition', ['Trn(']), T('Identity', ['Identity(']),
    K('Inverse Matrix', 'RECIP'), K('Matrix Squared', 'SQR'), T('Matrix Cubed', ['³']),
  ] },
] };
export const VECTOR_CAT = { label: 'Vector', items: [
  T('VctA', ['VctA']), T('VctB', ['VctB']), T('VctC', ['VctC']), T('VctD', ['VctD']), T('VctAns', ['VctAns']),
  { label: 'Vector Calc', items: [
    T('Dot Product', ['•']), T('Cross Product', ['×']), T('Angle', ['Angle(']), T('Unit Vector', ['UnitV(']),
  ] },
] };
export const EQUATION_CAT = { label: 'Equation', items: [K('=', 'EQ')] };
export const SPREADSHEET_CAT = { label: 'Spreadsheet', items: [
  { label: 'Grab', spec: { grab: true } }, T('$', ['$']), T(':', [':']),
  T('Min', ['Min(']), T('Max', ['Max(']), T('Mean', ['Mean(']), T('Sum', ['Sum(']),
] };
export const BASEN_CATS = [
  { label: 'Hex Value', items: ['A', 'B', 'C', 'D', 'E', 'F'].map((c) => T(c, ['hex:' + c])) },
  { label: 'Base Prefix', items: [T('Decimal(d)', ['d']), T('Hexadecimal(h)', ['h']), T('Binary(b)', ['b']), T('Octal(o)', ['o'])] },
  { label: 'Logic Operation', items: [T('Neg', ['Neg(']), T('Not', ['Not(']), T('and', ['and']), T('or', ['or']), T('xor', ['xor']), T('xnor', ['xnor'])] },
];

// Flattened CATALOG list (SHIFT + CATALOG): every item except constants/conversions, 15 per screen.
export function catalogList(categories, math) {
  const out = [];
  const walk = (cat) => {
    if (cat.noList) return;
    for (const it of cat.items || []) {
      if (it.items) { walk(it); continue; }
      if (it.spec && it.spec.mathOnly && !math) continue;
      out.push({ label: listLabel(it), spec: it.spec });
    }
  };
  categories.forEach(walk);
  return out;
}

function listLabel(it) {
  const s = it.spec || {};
  if (s.list) return s.list;
  if (s.tokens && s.tokens.length) {
    const t = s.tokens[0];
    if (t === 'nPr') return 'P';
    if (t === 'nCr') return 'C';
    if (t.startsWith('stat:')) return t.slice(5);
    if (t.startsWith('hex:')) return t.slice(4);
    return t;
  }
  return it.label;
}
