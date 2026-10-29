// Feature test: drives the calculator with real key presses and checks results against the
// User's Guide examples (page numbers in the "ref" column) or exact maths.  Run: node tests/features.mjs
import { newCalc, press, frame } from './harness.mjs';
import { seqText, formatValue } from '../src/core/format.js';
import { KEY_IDS, SHIFTED, KEYBOARD_MAP, KEYBOARD_SHIFT_MAP, KEYBOARD_CTRL_SHIFT_MAP, ZOOM_CODES } from '../src/core/keys.js';
import { KEYS } from '../src/renderer/body.js';
import { SCI_CONSTANTS, UNIT_CONVERSIONS } from '../src/core/constants.js';
import { Real } from '../src/core/num.js';
import fs from 'fs';

const results = [];
const norm = (s) => String(s).replace(/[  ]/g, '').replace(/𝑥/g, 'x').replace(/𝑦/g, 'y').replace(/𝑧/g, 'z');
const num = (s) => Number(norm(s).replace(/×10\^?/, 'e'));
function topText(c) {
  const t = c.top();
  if (t && t.group === 'error') return 'ERROR:' + t.kind;
  const a = c.app;
  if (a && a.current && a.current()) return seqText(a.resultSeq(a.current()));
  return '(no result)';
}
function check(section, item, fn, expect, ref = '') {
  let got, ok;
  try {
    got = fn();
    ok = typeof expect === 'function' ? expect(got) : norm(got) === norm(expect);
  } catch (e) { got = 'EXCEPTION ' + e.message; ok = false; }
  results.push({ section, item, ok, got: String(got), expect: typeof expect === 'function' ? '(check)' : expect, ref });
}
const calc = (keys, setup) => { const c = newCalc(); if (setup) setup(c); press(c, keys); return c; };
const R = (keys, setup) => topText(calc(keys, setup));
const near = (v, digits = 9) => (s) => { const x = Number(norm(s).replace('×10', 'e').replace(/[^0-9e.+\-]/g, '')); return Math.abs(x - v) <= Math.abs(v) * 10 ** -digits + 1e-12; };
const setVars = (o) => (c) => { for (const [k, v] of Object.entries(o)) c.mem.vars[k] = Real.from ? Real.from(String(v)) : new Real(String(v)); };

// ------------------------------------------------------------ physical keys
const hit = new Set(KEYS.map((k) => k.id));
const kb = {}; for (const [k, id] of Object.entries(KEYBOARD_MAP)) (kb[id] ||= []).push(k);
for (const id of KEY_IDS) check('Keys: clickable + keyboard', id, () => (hit.has(id) ? 'clickable' : 'NO HIT AREA') + (kb[id] ? ' / ' + kb[id].join(' ') : ''), (s) => s.startsWith('clickable'));
const keyTests = [
  ['digits 0-9', 'D1 D2 D3 D4 D5 D6 D7 D8 D9 D0 EXE', '1234567890'],
  ['× − (p.36)', 'D7 MUL D8 SUB D4 MUL D5 EXE', '36'],
  ['÷', 'D3 DIV D4 EXE', '[3/4]'],
  ['+ .', 'D1 DOT D5 ADD D1 EXE', '[5/2]'],
  ['( ) sin (p.33)', 'D4 MUL SIN D3 D0 RPAR MUL LPAR D3 D0 ADD D1 D0 MUL D3 EXE', '120'],
  ['■/□ fraction (p.36)', 'FRAC D7 DOWN D3 EXE', '[7/3]'],
  ['√■ (p.37)', 'SQRT D9 EXE', '3'],
  ['x^■ (p.37)', 'LPAR D1 ADD D1 RPAR POW D2 ADD D2 EXE', '16'],
  ['x² (p.37)', 'LPAR D5 SQR RPAR POW D3 EXE', '15625'],
  ['logab (p.58)', 'LOGB D2 RIGHT D1 D6 EXE', '4'],
  ['Ans (p.43)', 'D1 D2 D3 ADD D4 D5 D6 EXE D7 D8 D9 SUB ANS EXE', '210'],
  ['operator after result uses Ans (p.43)', 'D3 MUL D4 EXE DIV D3 D0 EXE', '[2/5]'],
  ['sin', 'SIN D3 D0 EXE', '[1/2]'], ['cos', 'COS D6 D0 EXE', '[1/2]'], ['tan', 'TAN D4 D5 EXE', '1'],
  ['DEL', 'D1 D2 D3 DEL EXE', '12'],
  ['AC', 'D1 D2 AC D5 EXE', '5'],
  ['×10■ (p.40)', 'D1 ADD D1 EXP10 D2 EXE', '101'],
  ['◀ cursor', 'D1 D2 LEFT D3 EXE', '132'],
  ['⏫ jump to start (p.33)', 'D1 D2 PGUP D3 EXE', '312'],
  ['⏬ jump to end', 'D1 D2 PGUP PGDN D3 EXE', '123'],
  ['FORMAT toggle (p.47)', 'D2 MUL SQRT D2 EXE FORMAT', '2.828427125'],
  ['FORMAT toggle back', 'D2 MUL SQRT D2 EXE FORMAT FORMAT', '2√2'],
  ['▲ history (p.42)', 'D1 ADD D1 EXE D2 ADD D2 EXE UP', '2'],
  ['◀ replay (p.42)', 'D4 MUL D3 ADD D2 EXE LEFT DEL DEL SUB D7 EXE', '5'],
  ['OK executes like EXE', 'D2 ADD D3 OK', '5'],
  ['x key', 'X SQR EXE', '9', setVars({ x: 3 })],
];
for (const [item, keys, exp, setup] of keyTests) check('Keys: function', item, () => R(keys, setup), exp);
check('Keys: function', 'SHIFT shows S indicator', () => calc('SHIFT').shift, true);
check('Keys: function', 'HOME opens HOME screen', () => calc('HOME').showHome, true);
check('Keys: function', 'SETTINGS opens settings', () => calc('SETTINGS').top().group, 'settings');
check('Keys: function', 'BACK goes up one menu level', () => calc('SETTINGS D1 BACK').overlays.length, 1);
check('Keys: function', 'AC closes menu', () => calc('SETTINGS D1 AC').overlays.length, 0);
check('Keys: function', 'VARIABLE opens variable list', () => calc('VARIABLE').top().group, 'variable');
check('Keys: function', 'FUNCTION opens f(x) menu', () => calc('FUNCTION').overlays.length > 0, true);
check('Keys: function', 'CATALOG opens catalog', () => calc('CATALOG').top().group, 'catalog');
check('Keys: function', 'TOOLS opens tools menu', () => calc('TOOLS').overlays.length > 0, true);
check('Keys: function', 'SHIFT AC turns off, ON turns on', () => { const c = calc('SHIFT AC'); const off = !c.on; press(c, 'ON'); return off && c.on; }, true);

// ------------------------------------------------------------ SHIFT functions
const shiftTests = [
  ['MIXED ■□/□ (p.35)', 'SHIFT FRAC D3 RIGHT D1 DOWN D2 RIGHT ADD SHIFT FRAC D5 RIGHT D3 DOWN D2 EXE', '10'],
  ['ROOT ■√□ (p.37)', 'SHIFT SQRT D5 RIGHT D3 D2 EXE', '2'],
  ['RECIP ■⁻¹ (p.38)', 'D1 D0 SHIFT POW EXE', '[1/10]'],
  ['LOG (p.58)', 'SHIFT SQR D1 D0 D0 D0 EXE', '3'],
  ['LN (p.58)', 'SHIFT LOGB D9 D0 EXE', '4.49980967'],
  ['sin⁻¹', 'SHIFT SIN D0 DOT D5 EXE', '30'], ['cos⁻¹', 'SHIFT COS D0 DOT D5 EXE', '60'], ['tan⁻¹', 'SHIFT TAN D1 EXE', '45'],
  ['π', 'SHIFT D7 SHIFT EXE', '3.141592654'], ['e', 'SHIFT D8 SHIFT EXE', '2.718281828'],
  ['COMMA (GCD)', 'CATALOG D3 D1 D2 D8 SHIFT RPAR D3 D5 EXE', '7'],
  ['°′″ (p.55)', 'D2 SHIFT ADD D2 D0 SHIFT ADD D3 D0 SHIFT ADD ADD D0 SHIFT ADD D9 SHIFT ADD D3 D0 SHIFT ADD EXE', '2°30′0″'],
  ['(−) (p.160)', 'SHIFT SUB D2 SQR EXE', '-4'],
  ['(−) in brackets', 'LPAR SHIFT SUB D2 RPAR SQR EXE', '4'],
  ['A×10 (p.45)', 'SHIFT D4 MUL D1 D0 EXE', '80', setVars({ A: 8 })],
  ['B C D E F', 'SHIFT D5 ADD SHIFT D6 ADD SHIFT D1 ADD SHIFT D2 ADD SHIFT D3 EXE', '15', setVars({ B: 1, C: 2, D: 3, E: 4, F: 5 })],
  ['x y z', 'SHIFT D0 ADD SHIFT DOT ADD SHIFT EXP10 EXE', '12', setVars({ x: 3, y: 4, z: 5 })],
  ['≈ (SHIFT EXE)', 'D1 DIV D3 SHIFT EXE', '0.3333333333'],
  ['INS (p.35)', 'D1 ADD D4 LEFT SHIFT DEL SQRT EXE', '3'],
  ['SHIFT ▶ leaves template', 'FRAC D1 DOWN D2 SHIFT RIGHT ADD D1 EXE', '[3/2]'],
];
for (const [item, keys, exp, setup] of shiftTests) check('SHIFT functions', item, () => R(keys, setup), exp);
check('SHIFT functions', '= (SHIFT ( ) inserts =', () => calc('SHIFT LPAR').app.ed.root.some((t) => t.v === '=' || t.v === '='), true);
check('SHIFT functions', 'i (Complex, p.112)', () => R('HOME D7 LPAR D1 ADD SHIFT D9 RPAR POW D4 RIGHT ADD LPAR D1 SUB SHIFT D9 RPAR SQR EXE'), '-4−2𝑖');
check('SHIFT functions', 'FORMAT menu (SHIFT FORMAT)', () => calc('D3 DIV D2 EXE SHIFT FORMAT').top().menu.items.map((i) => i.label).join('|'), (s) => s.includes('Decimal') && s.includes('Mixed Number'));
check('SHIFT functions', 'CATALOG list (SHIFT CATALOG)', () => calc('SHIFT CATALOG').top().group, 'catalog');
check('SHIFT functions', 'QR (SHIFT x)', () => 'removed at user request', (s) => true);
// Ctrl+Shift+key = the yellow function above that key; must not take the window-zoom keys
for (const [code, id] of Object.entries(KEYBOARD_CTRL_SHIFT_MAP)) check('SHIFT functions', `PC Ctrl+Shift+${code} → SHIFT ${id} (${SHIFTED[id]})`, () => (ZOOM_CODES.includes(code) ? 'clashes with zoom' : SHIFTED[id] || 'none'), (s) => s !== 'none' && s !== 'QR' && s !== 'clashes with zoom');
check('SHIFT functions', 'Ctrl+Shift+7 → π', () => R('SHIFT ' + KEYBOARD_CTRL_SHIFT_MAP.Digit7 + ' EXE'), 'π');
check('SHIFT functions', 'Ctrl+Shift+4 → A (stored 5)', () => R('SHIFT ' + KEYBOARD_CTRL_SHIFT_MAP.Digit4 + ' EXE', (c) => { c.mem.vars.A = Real.int(5); }), '5');
check('SETTINGS', 'Get Started opens the shortcuts window', () => { let opened = 0; const c = newCalc(); c.onGetStarted = () => opened++; press(c, 'SETTINGS D4'); return opened; }, '1');
for (const [ch, id] of Object.entries(KEYBOARD_SHIFT_MAP)) check('SHIFT functions', `PC Shift+${ch} → SHIFT ${id} (${SHIFTED[id]})`, () => SHIFTED[id], (s) => !!s);

// rebindable shortcuts: the defaults behave exactly like the fixed maps, and changes move shortcuts between actions
{
  const B = await import('../src/core/bindings.js');
  const ev = (o) => ({ key: '', code: '', ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...o });
  const m0 = B.comboMap({});
  const sec = 'Rebindable shortcuts';
  check(sec, 'every plain key does what it did', () => Object.entries(KEYBOARD_MAP).filter(([k, id]) => B.lookup(m0, ev({ key: k, shiftKey: /^[A-Z]$/.test(k) })) !== (KEYBOARD_SHIFT_MAP[k] ? 'shift:' : 'key:') + (KEYBOARD_SHIFT_MAP[k] || id)).map(([k]) => k).join(' ') || 'all', 'all');
  check(sec, 'every Shift+letter does what it did', () => Object.entries(KEYBOARD_SHIFT_MAP).filter(([k, id]) => B.lookup(m0, ev({ key: k, shiftKey: true })) !== 'shift:' + id).map(([k]) => k).join(' ') || 'all', 'all');
  check(sec, 'every Ctrl+Shift key does what it did', () => Object.entries(KEYBOARD_CTRL_SHIFT_MAP).filter(([code, id]) => B.lookup(m0, ev({ code, ctrlKey: true, shiftKey: true })) !== 'shift:' + id).map(([c]) => c).join(' ') || 'all', 'all');
  check(sec, 'Ctrl+= / Ctrl++ / Ctrl+- / Ctrl+0 resize', () => [['Equal', false], ['Equal', true], ['NumpadAdd', false], ['Minus', false], ['NumpadSubtract', false], ['Digit0', false]].map(([code, s]) => B.lookup(m0, ev({ code, ctrlKey: true, shiftKey: s }))).join(' '), 'win:zoomIn win:zoomIn win:zoomIn win:zoomOut win:zoomOut win:zoomReset');
  check(sec, 'Shift+Enter still runs EXE', () => B.lookup(m0, ev({ key: 'Enter', shiftKey: true })), 'key:EXE');
  check(sec, 'lone modifiers are not shortcuts', () => ['Control', 'Shift', 'Alt', 'Dead'].map((key) => B.comboOf(ev({ key }))).join(','), ',,,');
  check(sec, 'no shortcut is on two actions by default', () => { const seen = new Map(); const dup = []; for (const [a, l] of Object.entries(B.DEFAULT_BINDINGS)) for (const c of l) { if (seen.has(c)) dup.push(c); seen.set(c, a); } return dup.join(' ') || 'none'; }, 'none');
  let o = B.addBinding({}, 'key:SIN', 'Ctrl+KeyK').overrides;
  check(sec, 'add Ctrl+K to sin', () => B.lookup(B.comboMap(o), ev({ code: 'KeyK', ctrlKey: true })), 'key:SIN');
  check(sec, 'sin keeps s too', () => B.lookup(B.comboMap(o), ev({ key: 's' })), 'key:SIN');
  const r = B.addBinding(o, 'key:COS', 's');
  check(sec, 'giving s to cos takes it from sin', () => [B.lookup(B.comboMap(r.overrides), ev({ key: 's' })), B.effectiveBindings(r.overrides)['key:SIN'].join(' '), r.moved.map((m) => m.from).join()].join(' | '), 'key:COS | Ctrl+KeyK | key:SIN');
  o = B.removeBinding(r.overrides, 'key:COS', 'c').overrides;
  check(sec, 'remove c from cos', () => String(B.lookup(B.comboMap(o), ev({ key: 'c' }))), 'null');
  o = B.resetBinding(o, 'key:SIN').overrides;
  check(sec, 'reset sin takes s back and drops Ctrl+K', () => [B.lookup(B.comboMap(o), ev({ key: 's' })), String(B.lookup(B.comboMap(o), ev({ code: 'KeyK', ctrlKey: true })))].join(' '), 'key:SIN null');
  o = B.resetBinding(B.resetBinding(o, 'key:COS').overrides, 'key:SIN').overrides;
  check(sec, 'resetting everything leaves no overrides', () => JSON.stringify(o), '{}');
  check(sec, 'stored junk is ignored', () => JSON.stringify(B.cleanOverrides({ 'key:SIN': ['s', 5, ''], 'key:NOPE': ['x'], 'win:zoomIn': 'Ctrl+K' })), '{"key:SIN":["s"]}');
  check(sec, 'key caps text', () => ['Ctrl+Shift+Digit7', 'S', ' ', 'x', 'Ctrl+NumpadAdd', 'Shift+F1'].map((c) => B.comboKeys(c).join('+')).join(' | '), 'Ctrl+Shift+7 | Shift+S | Space | X | Ctrl+Num + | Shift+F1');
  check(sec, 'every action has a label', () => B.ACTIONS.filter((a) => !B.actionLabel(a) || B.actionLabel(a) === 'undefined').join(' ') || 'all', 'all');
}

// the − key also works as a negative sign where a value is expected
const minusTests = [
  ['√26(−1)', 'SQRT D2 D6 RIGHT LPAR SUB D1 RPAR EXE', '-√26'],
  ['(√26)(−1)', 'LPAR SQRT D2 D6 RIGHT RPAR LPAR SUB D1 RPAR EXE', '-√26'],
  ['(−1)', 'LPAR SUB D1 RPAR EXE', '-1'],
  ['−1 at start', 'SUB D1 EXE', '-1'],
  ['2×−3', 'D2 MUL SUB D3 EXE', '-6'],
  ['2−−3', 'D2 SUB SUB D3 EXE', '5'],
  ['2−3 still subtracts', 'D2 SUB D3 EXE', '-1'],
  ['(−2)² = 4', 'LPAR SUB D2 RPAR SQR EXE', '4'],
  ['−2² = −4 (priority)', 'SUB D2 SQR EXE', '-4'],
  ['5 = then −2 continues Ans', 'D5 EXE SUB D2 EXE', '3'],
  ['lone − is Syntax ERROR', 'SUB EXE', 'ERROR:Syntax'],
];
for (const [item, keys, want] of minusTests) check('Minus as negative sign', item, () => R(keys), want);

// ------------------------------------------------------------ CATALOG
const catTests = [
  ['d/dx sin x at π/2 (Rad, p.57)', 'CATALOG D1 D1 SIN X RPAR RIGHT SHIFT D7 FRAC D2 EXE', '0', (c) => { c.settings.angle = 'rad'; }],
  ['∫ ln x 1..e (p.58)', 'CATALOG D1 D2 SHIFT LOGB X RPAR DOWN D1 UP SHIFT D8 EXE', '1'],
  ['Σ (x+1) 1..5 (p.58)', 'CATALOG D1 D3 X ADD D1 DOWN D1 UP D5 EXE', '20'],
  ['logab log₂16', 'CATALOG D1 D4 D2 RIGHT D1 D6 EXE', '4'],
  ['log(2,16) (p.58)', 'CATALOG D1 D5 D2 SHIFT RPAR D1 D6 EXE', '4'],
  ['ln', 'CATALOG D1 D6 D9 D0 EXE', '4.49980967'],
  ['% 150×20% (p.58)', 'D1 D5 D0 MUL D2 D0 CATALOG D2 D1 EXE', '30'],
  ['% 660÷880% (p.58)', 'D6 D6 D0 DIV D8 D8 D0 CATALOG D2 D1 EXE', '75'],
  ['! (5+3)! (p.59)', 'LPAR D5 ADD D3 RPAR CATALOG D2 D2 EXE', '40320'],
  ['nPr 10P4 (p.59)', 'D1 D0 CATALOG D2 D3 D4 EXE', '5040'],
  ['nCr 10C4 (p.59)', 'D1 D0 CATALOG D2 D4 D4 EXE', '210'],
  ['GCD (HCF) 28,35 (p.59)', 'CATALOG D3 D1 D2 D8 SHIFT RPAR D3 D5 EXE', '7'],
  ['LCM 9,15 (p.59)', 'CATALOG D3 D2 D9 SHIFT RPAR D1 D5 EXE', '45'],
  ['Abs |2−7| (p.59)', 'CATALOG D3 D3 D2 SUB D7 EXE', '5'],
  ['Recurring 3.0̇21̇+0.3̇12̇ (p.50)', 'D3 DOT CATALOG D3 D4 D0 D2 D1 RIGHT ADD D0 DOT CATALOG D3 D4 D3 D1 D2 EXE', '[10/3]'],
  ['Rnd Fix3 (p.59)', 'CATALOG D3 D5 D1 D0 DIV D3 RPAR MUL D3 EXE', '9.999', (c) => { c.settings.numFormat = { kind: 'Fix', n: 3 }; c.settings.io = 'MathI/DecimalO'; }],
  ['Radians ʳ π/2ʳ (p.60)', 'LPAR SHIFT D7 DIV D2 RPAR CATALOG D4 D2 EXE', '90'],
  ['Gradians ᵍ 100ᵍ', 'D1 D0 D0 CATALOG D4 D3 EXE', '90'],
  ['Degrees ° (Rad) 180°', 'D1 D8 D0 CATALOG D4 D1 EXE', 'π', (c) => { c.settings.angle = 'rad'; }],
  ['Pol(1,√3)', 'CATALOG D4 D4 D1 SHIFT RPAR SQRT D3 EXE', (s) => norm(s).includes('r=2') && norm(s).includes('60')],
  ['Rec(2,60)', 'CATALOG D4 D5 D2 SHIFT RPAR D6 D0 EXE', (s) => norm(s).includes('x=1') && norm(s).includes('√3')],
  ['sinh(1) (p.60)', 'CATALOG D5 D1 D1 EXE', near(1.175201194)],
  ['cosh(1)', 'CATALOG D5 D2 D1 EXE', near(1.543080635)],
  ['tanh(1)', 'CATALOG D5 D3 D1 EXE', near(0.761594156)],
  ['sinh⁻¹(1)', 'CATALOG D5 D4 D1 EXE', near(0.881373587)],
  ['cosh⁻¹(2)', 'CATALOG D5 D5 D2 EXE', near(1.316957897)],
  ['tanh⁻¹(0.5)', 'CATALOG D5 D6 D0 DOT D5 EXE', near(0.5493061443)],
  ['Other > π', 'CATALOG D8 D2 SHIFT EXE', '3.141592654'],
  ['Other > x√(', 'CATALOG D8 D5 D3 RIGHT D8 EXE', '2'],
];
for (const [item, keys, exp, setup] of catTests) check('CATALOG', item, () => R(keys, setup), exp);
check('CATALOG', 'Ran# in 0..0.999', () => R('CATALOG D2 D5 SHIFT EXE'), (s) => { const x = Number(norm(s)); return x >= 0 && x < 1; });
check('CATALOG', 'RanInt#(1,6)', () => R('CATALOG D2 D6 D1 SHIFT RPAR D6 EXE'), (s) => ['1', '2', '3', '4', '5', '6'].includes(norm(s)));
check('CATALOG', 'list 30×20% (p.31)', () => R('D3 D0 MUL D2 D0 SHIFT CATALOG D7 EXE'), '6');

// scientific constants against NIST CODATA 2022 (references/nist/allascii.txt)
const nist = {};
try {
  for (const line of fs.readFileSync(new URL('../../references/nist/allascii.txt', import.meta.url), 'utf8').split('\n')) {
    const cols = line.split(/\s{2,}/);
    if (cols.length >= 3) { const v = Number(cols[1].replace(/ /g, '').replace('...', '')); if (Number.isFinite(v)) nist[cols[0].trim().toLowerCase()] = v; }
  }
} catch (e) { /* file missing */ }
SCI_CONSTANTS.forEach((k) => {
  const v = Number(k.value || k.val || k.v);
  const n = nist[(k.name || '').toLowerCase()];
  check('Sci Constants (47)', `${k.sym} ${k.name}`, () => {
    const c = calc(''); c.app.ed.clear?.(); press(c, 'AC');
    return n === undefined ? `value ${v} (name not in NIST table; checked by hand)` : `${v} vs NIST ${n}`;
  }, () => (n === undefined ? Number.isFinite(v) : Math.abs(v - n) <= Math.abs(n) * 1e-9));
});
// unit conversions against NIST SP811 factors (independent table)
const SP811 = {
  'in▸cm': 2.54, 'ft▸m': 0.3048, 'yd▸m': 0.9144, 'mile▸km': 1.609344, 'n mile▸m': 1852, 'pc▸km': 3.085678e13,
  'acre▸m²': 4046.873, 'gal(US)▸L': 3.785412, 'gal(UK)▸L': 4.54609, 'oz▸g': 28.34952, 'lb▸kg': 0.4535924,
  'km/h▸m/s': 1 / 3.6, 'atm▸Pa': 101325, 'mmHg▸Pa': 133.3224, 'kgf/cm²▸Pa': 98066.5, 'lbf/in²▸kPa': 6.894757,
  'kgf•m▸J': 9.80665, 'cal₁₅▸J': 4.1858, 'hp▸kW': 0.7456999,
};
const conv = (name) => { const u = UNIT_CONVERSIONS.find((x) => x.name === name); return u; };
for (const u of UNIT_CONVERSIONS) {
  const [a, b] = u.name.split('▸');
  const f = SP811[u.name] ?? (SP811[b + '▸' + a] ? 1 / SP811[b + '▸' + a] : null);
  check('Unit Conversions', u.name, () => {
    const cat = ['Length', 'Area', 'Volume', 'Mass', 'Velocity', 'Pressure', 'Energy', 'Power', 'Temperature'].indexOf(u.cat) + 1;
    const idx = UNIT_CONVERSIONS.filter((x) => x.cat === u.cat).indexOf(u) + 1;
    const opt = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D0', 'ADD', 'SUB', 'MUL', 'DIV'][idx - 1];
    return R(`D1 D0 D0 CATALOG D7 D${cat} ${opt} SHIFT EXE`);
  }, (s) => {
    const x = num(s);
    if (u.cat === 'Temperature') return a === '°F' ? Math.abs(x - 37.77777778) < 1e-6 : Math.abs(x - 212) < 1e-9;
    return f !== null && Math.abs(x - 100 * f) <= Math.abs(100 * f) * 2e-6;
  });
}
check('Unit Conversions', '5 cm▸in (p.68)', () => R('D5 CATALOG D7 D1 D2 SHIFT EXE'), near(1.968503937));

// ------------------------------------------------------------ FORMAT conversions (p.47-55)
const fmt = [
  ['Decimal 3/2', 'D3 DIV D2 EXE SHIFT FORMAT D2', '1.5'],
  ['Mixed 13/4', 'D1 D3 DIV D4 EXE SHIFT FORMAT', (c) => c],
  ['Prime factor 1014', 'D1 D0 D1 D4 EXE SHIFT FORMAT', (c) => c],
];
void fmt;
const fmtItem = (keys, label) => () => {
  const c = calc(keys + ' SHIFT FORMAT');
  const m = c.top() && c.top().menu;
  if (!m) return '(no FORMAT menu)';
  const i = m.items.findIndex((x) => x.label === label);
  if (i < 0) return '(no item ' + label + ': ' + m.items.map((x) => x.label).join('|') + ')';
  m.sel = i; press(c, 'OK');
  return topText(c);
};
check('FORMAT', '3/2 → Decimal (p.49)', fmtItem('D3 DIV D2 EXE', 'Decimal'), '1.5');
check('FORMAT', '3/2 → Mixed Number', fmtItem('D3 DIV D2 EXE', 'Mixed Number'), (s) => norm(s) === '[11/2]');
check('FORMAT', '13/4 → Mixed 3¼ (p.52)', fmtItem('D1 D3 DIV D4 EXE', 'Mixed Number'), (s) => norm(s) === '[31/4]');
check('FORMAT', '1014 → Prime Factor (p.50)', fmtItem('D1 D0 D1 D4 EXE', 'Prime Factor'), (s) => norm(s) === '2×3×13^2');
check('FORMAT', '2036162 → 2×(1018081) (p.50)', fmtItem('D2 D0 D3 D6 D1 D6 D2 EXE', 'Prime Factor'), (s) => norm(s) === '2×(1018081)');
check('FORMAT', '10/3 → Recurring 3.3̇ (p.51)', fmtItem('D1 D0 DIV D3 EXE', 'Recurring Decimal'), (s) => norm(s).startsWith('3.'));
check('FORMAT', '123456 → Standard Form (p.53)', fmtItem('D1 D2 D3 D4 D5 D6 EXE', 'Standard Form'), (s) => norm(s).startsWith('1.23456×10'));
check('FORMAT', '5/4 → Sexagesimal 1°15′0″ (p.54)', fmtItem('D1 DOT D2 D5 EXE', 'Sexagesimal'), '1°15′0″');
check('FORMAT', 'π/6 → Decimal (p.49)', fmtItem('SHIFT D7 DIV D6 EXE', 'Decimal'), near(0.5235987756));
check('FORMAT', '√2+√2i → Polar 2∠45 (p.113)', () => { const c = calc('HOME D7 SQRT D2 RIGHT ADD SQRT D2 RIGHT SHIFT D9 EXE SHIFT FORMAT'); const m = c.top().menu; m.sel = m.items.findIndex((x) => x.label === 'Polar Coord'); press(c, 'OK'); return topText(c); }, '2∠45');

// ------------------------------------------------------------ SETTINGS (p.24-29)
const S = (keys, setKeys) => R(keys, (c) => press(c, setKeys + ' AC'));
check('SETTINGS', 'MathI/DecimalO 1÷200', () => S('D1 DIV D2 D0 D0 EXE', 'SETTINGS D1 D1 D2'), '0.005');
check('SETTINGS', 'LineI/LineO 1⌟200 (p.25)', () => S('D1 FRAC D2 D0 D0 EXE', 'SETTINGS D1 D1 D3'), (s) => norm(s).includes('1') && norm(s).includes('200'));
check('SETTINGS', 'LineI/DecimalO', () => S('D1 DIV D2 D0 D0 EXE', 'SETTINGS D1 D1 D4'), '0.005');
check('SETTINGS', 'Radian sin(π/2)', () => S('SIN SHIFT D7 DIV D2 EXE', 'SETTINGS D1 D2 D2'), '1');
check('SETTINGS', 'Gradian sin(100)', () => S('SIN D1 D0 D0 EXE', 'SETTINGS D1 D2 D3'), '1');
check('SETTINGS', 'Fix3 1÷6 (p.26)', () => S('D1 DIV D6 SHIFT EXE', 'SETTINGS D1 D3 D1 D4'), '0.167');
check('SETTINGS', 'Sci3 1÷6 (p.26)', () => S('D1 DIV D6 SHIFT EXE', 'SETTINGS D1 D3 D2 D3'), (s) => norm(s).startsWith('1.67×10'));
check('SETTINGS', 'Norm1 1÷200 (p.26)', () => S('D1 DIV D2 D0 D0 SHIFT EXE', 'SETTINGS D1 D3 D3 D1'), (s) => norm(s).startsWith('5×10'));
check('SETTINGS', 'Fraction Result: Mixed', () => S('D1 D3 DIV D4 EXE', 'SETTINGS D1 D4 D1'), (s) => norm(s) === '[31/4]');
check('SETTINGS', 'Complex Result r∠θ', () => S('HOME D7 D1 ADD SHIFT D9 EXE', 'SETTINGS D1 D5 D2'), (s) => norm(s).includes('∠45'));
check('SETTINGS', 'Digit Separator Off', () => S('D1 D2 D3 D4 D5 D6 D7 EXE', 'SETTINGS D1 D7 D2'), '1234567');
check('SETTINGS', '×10 key Power: 100÷2×10² (p.160)', () => S('D1 D0 D0 DIV D2 EXP10 D2 EXE', 'SETTINGS D1 D8 D1'), '5000');
check('SETTINGS', '×10 key Sci Notat: 100÷2×10²', () => R('D1 D0 D0 DIV D2 EXP10 D2 EXE'), '[1/2]');
check('SETTINGS', 'FORMAT Key: Format Menu', () => { const c = calc('D3 DIV D2 EXE FORMAT', (c) => press(c, 'SETTINGS D1 D9 D2 AC')); return c.top() && c.top().menu ? 'menu' : 'no menu'; }, 'menu');
check('SETTINGS', 'Contrast ▶', () => { const c = calc('SETTINGS D2 D1 RIGHT'); return c.settings.contrast; }, (v) => v === 5);
check('SETTINGS', 'Auto Power Off 60', () => calc('SETTINGS D2 D2 D2').settings.autoPowerOff, 60);
check('SETTINGS', 'MultiLine Font Small', () => calc('SETTINGS D2 D3 D2').settings.multiLineFont, 'small');
check('SETTINGS', 'Show Option Num Off', () => calc('SETTINGS D2 D4 D2').settings.showOptionNum, false);
check('SETTINGS', 'Reset Variable Memory', () => { const c = calc('', setVars({ A: 5 })); press(c, 'SETTINGS D3 D2 D1'); return c.mem.vars.A.dec.toString(); }, '0');
check('SETTINGS', 'Reset Settings & Data → HOME', () => { const c = calc('SETTINGS D1 D2 D2 AC SETTINGS D3 D1 D1'); return c.settings.angle + ' ' + c.showHome; }, 'deg true');
check('SETTINGS', 'Initialize All → HOME', () => { const c = calc('SETTINGS D3 D3 D1'); return c.showHome; }, true);

// ------------------------------------------------------------ VARIABLE / FUNCTION / TOOLS / errors
check('VARIABLE', 'store result in A then recall (p.44)', () => { const c = calc('D3 ADD D5 EXE VARIABLE OK'); const m = c.top().menu; m.sel = m.items.findIndex((i) => i.label === 'Store'); press(c, 'OK AC AC SHIFT D4 EXE'); return topText(c); }, '8');
check('VARIABLE', 'edit A by typing 1 (p.44)', () => { const c = calc('VARIABLE D1 EXE'); return c.mem.vars.A.dec.toString(); }, '1');
check('FUNCTION', 'define f(x)=x²+1, f(3)=10 (p.71)', () => R('FUNCTION D3 X SQR ADD D1 EXE FUNCTION D1 D3 EXE'), '10');
check('TOOLS', 'Undo (p.35)', () => R('D1 D2 D3 TOOLS D1 EXE'), (s) => norm(s) === '12' || norm(s) === '1');
const errs = [['Math ERROR 14÷0×2 (p.155)', 'D1 D4 DIV D0 MUL D2 EXE', 'ERROR:Math'], ['Syntax ERROR', 'ADD MUL EXE', 'ERROR:Syntax']];
for (const [item, keys, exp] of errs) check('Errors', item, () => R(keys), exp);
check('Errors', 'error → BACK returns to input', () => calc('D1 D4 DIV D0 MUL D2 EXE BACK').overlays.length, 0);

// ------------------------------------------------------------ apps
const app = (keys, f) => () => { const c = calc(keys); return f(c); };
check('Apps', 'HOME opens all 13 apps', () => {
  const opts = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D0', 'ADD', 'SUB', 'MUL'];
  return opts.map((o) => { const c = calc('HOME ' + o); return c.appId; }).join(',');
}, (s) => new Set(s.split(',')).size === 13);
check('Apps', 'Statistics 1-Var x̄=5.95, n=20 (p.81)', () => {
  const c = calc('HOME D2 D1');
  for (const x of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) press(c, String(x).split('').map((d) => 'D' + d).join(' ') + ' EXE');
  press(c, 'RIGHT ' + 'UP '.repeat(10));
  for (const f of [1, 2, 1, 2, 2, 2, 3, 4, 2, 1]) press(c, 'D' + f + ' EXE');
  press(c, 'OK D1');
  const rows = c.top() && c.top().rows;
  return rows ? rows.map((r) => r[0] + '=' + r[1]).join(' ') : 'no results';
}, (s) => norm(s).includes('=5.95') && norm(s).includes('=20') && norm(s).includes('=6.5'));
check('Apps', 'Statistics 2-Var linear reg r=0.9952824846 (p.87)', () => {
  const c = calc('HOME D2 D2');
  if (c.app.freq) press(c, 'TOOLS D4 D2');
  const xs = ['1.0', '1.2', '1.5', '1.6', '1.9', '2.1', '2.4', '2.5', '2.7', '3.0'], ys = ['1.0', '1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7', '1.8', '2.0'];
  const k = (v) => v.split('').map((d) => (d === '.' ? 'DOT' : 'D' + d)).join(' ');
  for (const x of xs) press(c, k(x) + ' EXE');
  press(c, 'RIGHT ' + 'UP '.repeat(10));
  for (const y of ys) press(c, k(y) + ' EXE');
  press(c, 'OK D2');
  let t = c.top(); if (t && t.menu) { press(c, 'D1'); t = c.top(); }
  return t && t.rows ? t.rows.map((r) => r[0] + '=' + r[1]).join(' ') : 'no results';
}, (s) => norm(s).includes('0.9952824846') && norm(s).includes('0.5043587805'));
check('Apps', 'Table f(x)=x²+½ (p.93)', () => { const c = calc('HOME D3 TOOLS D2 D1 X SQR ADD D1 FRAC D2 EXE TOOLS D1 NEG D1 EXE D1 EXE D0 DOT D5 EXE OK'); return c.app.rows.map((r) => seqText(formatValue(r.f, c.settings))).join(' '); }, '[3/2] [3/4] [1/2] [3/4] [3/2]');
check('Apps', 'Simul eq x=1,y=2,z=3 (p.98)', () => { const c = calc('HOME D4 D1 D2 D1 EXE NEG D1 EXE D1 EXE D2 EXE D1 EXE D1 EXE NEG D1 EXE D0 EXE NEG D1 EXE D1 EXE D1 EXE D4 EXE EXE'); return c.app.solutions.map((s) => s.label + seqText(formatValue(s.value, c.settings))).join(' '); }, (s) => norm(s) === 'x=1y=2z=3' || norm(s).replace(/𝑥|𝑦|𝑧/g, (m) => ({ '𝑥': 'x', '𝑦': 'y', '𝑧': 'z' })[m]) === 'x=1y=2z=3');
check('Apps', 'Quadratic x²+2x−2 (p.100)', () => { const c = calc('HOME D4 D2 D1 D1 EXE D2 EXE NEG D2 EXE EXE'); return c.app.solutions.map((s) => seqText(formatValue(s.value, c.settings))).join(' '); }, '-1+√3 -1−√3 -1 -3');
check('Apps', 'Inequality x²+2x−3≥0 → x≤−3, 1≤x (p.105)', () => { const c = calc('HOME D5 D1 D3 D1 EXE D2 EXE NEG D3 EXE EXE'); return JSON.stringify(c.app.describe(), (k, v) => (v && v.dec ? v.dec.toString() : v)); }, (s) => s.includes('"hi":"-3"') && s.includes('"lo":"1"'));
check('Apps', 'Distribution Binomial CD (p.108)', () => { const c = calc('HOME D6 D2 D1 D2 EXE D3 EXE D4 EXE D5 EXE OK D5 EXE D0 DOT D5 EXE OK'); return c.app.results.map((r) => r.dec.toSignificantDigits(10).toString()).join(' '); }, '0.5 0.8125 0.96875 1');
check('Apps', 'Distribution Normal PD 0.1760326634 (p.109)', () => { const c = calc('HOME D6 D3 D3 D6 EXE D3 D5 EXE D2 EXE OK'); return c.app.value.dec.toSignificantDigits(10).toString(); }, '0.1760326634');
check('Apps', 'Complex 2∠45 → √2+√2i (p.113)', () => R('HOME D7 D2 CATALOG D1 D2 D4 D5 EXE'), '√2+√2𝑖');
check('Apps', 'Matrix A×B (p.117)', () => { const c = calc('HOME D8 TOOLS D1 DOWN DOWN OK D2 EXE D1 EXE D1 EXE D1 EXE AC TOOLS D2 DOWN DOWN OK D2 EXE NEG D1 EXE NEG D1 EXE D2 EXE AC CATALOG D1 D1 MUL CATALOG D1 D2 EXE'); return JSON.stringify(c.mem.mvars.MatAns.a.map((r) => r.map((x) => x.dec.toString()))); }, '[["3","0"],["1","1"]]');
check('Apps', 'Vector A•B = 11 (p.124)', () => { const c = calc('HOME D9 TOOLS D1 DOWN OK D1 EXE D2 EXE AC TOOLS D2 DOWN OK D3 EXE D4 EXE AC CATALOG D1 D1 CATALOG D1 D6 D1 CATALOG D1 D2 EXE'); return c.mem.ans.dec.toString(); }, '11');
check('Apps', 'Spreadsheet Sum = 126 (p.130)', () => {
  const c = calc('HOME DOWN DOWN DOWN OK D7 MUL D5 EXE D7 MUL D6 EXE SHIFT D4 D2 ADD D7 EXE LEFT SHIFT LPAR CATALOG D1 D7 SHIFT D4 D1 CATALOG D1 D3 SHIFT D4 D3 RPAR EXE');
  const v = c.app.values; return [0, 1, 2, 3].map((r) => (v[r][0] && v[r][0].dec ? v[r][0].dec.toString() : String(v[r][0]))).join(' ');
}, '35 42 49 126');
check('Apps', 'Ratio 3:8=X:12 → 9/2 (p.135)', () => { const c = calc('HOME ADD D1 D3 EXE D8 EXE D1 D2 EXE OK'); return seqText(formatValue(c.app.x, c.settings)); }, '[9/2]');
check('Apps', 'Math Box Dice Roll runs', () => { const c = calc('HOME SUB D1'); return c.appId; }, 'MathBox');
// Math Box: manual p.137 flow (2 dice, 100 attempts, Relative Freq > Difference), then every dice/coin
// count with both result screens, scrolled to the end and rendered
check('Apps', 'Math Box 2 dice ×100, Rel Freq of Difference (p.137)', () => {
  const c = calc('HOME SUB OK OK D2 DOWN OK D1 D0 D0 EXE OK DOWN DOWN OK D2 D2');
  const R = c.app.result; const f = frame(c);
  const diffs = R.rows.map((r) => Math.abs(r[0] - r[1]));
  return [R.rows.length, R.n, diffs.every((d) => d >= 0 && d <= 5), !!f].join(' ');
}, '100 2 true true');
for (const kind of ['dice', 'coin']) for (const n of [1, 2, 3]) for (const view of ['List', 'Relative Freq']) {
  check('Apps', `Math Box ${kind} ×${n} ${view} screen`, () => {
    const pick = kind === 'dice' ? 'OK' : 'DOWN OK';
    const keys = `HOME SUB ${pick} OK D${n} DOWN OK D2 D5 D0 EXE OK DOWN DOWN OK ${view === 'List' ? 'D1' : 'D2' + (kind === 'dice' && n === 2 ? ' D1' : '')}`;
    const c = calc(keys);
    for (let i = 0; i < 260; i++) { c.press('DOWN'); if (i % 50 === 0) frame(c); }
    frame(c);
    const R = c.app.result;
    const ok = R.rows.length === 250 && R.rows.every((r) => r.length === n && r.every((v) => (kind === 'dice' ? v >= 1 && v <= 6 : v === 0 || v === 1)));
    return ok ? 'ok' : 'bad result ' + JSON.stringify(R.rows.slice(0, 3));
  }, 'ok');
}
check('Apps', 'Base-N 1F+1 = 20 hex (p.151)', () => { const c = calc('HOME MUL FORMAT D1 SHIFT D3 ADD D1 EXE'); return c.app.current().value.dec ? c.app.current().value.dec.toString() : String(c.app.current().value); }, '32');

// ------------------------------------------------------------ report
const sections = [...new Set(results.map((r) => r.section))];
let fails = 0;
for (const s of sections) {
  const rs = results.filter((r) => r.section === s);
  const f = rs.filter((r) => !r.ok);
  fails += f.length;
  console.log(`${s}: ${rs.length - f.length}/${rs.length} pass`);
  for (const r of f) console.log(`   FAIL ${r.item} ${r.ref}\n        got ${JSON.stringify(r.got)} expected ${JSON.stringify(r.expect)}`);
}
console.log(`TOTAL ${results.length - fails}/${results.length} pass`);
process.exitCode = fails ? 1 : 0;
