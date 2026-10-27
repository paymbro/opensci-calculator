// Keyboard shortcuts window (opened from SETTINGS > Get Started).  Built from the same key maps the
// calculator window uses, so the list always matches what the keys actually do.
import { KEYBOARD_MAP, KEYBOARD_SHIFT_MAP, KEYBOARD_CTRL_SHIFT_MAP, SHIFTED } from '../core/keys.js';

const NAMES = {
  D0: '0', D1: '1', D2: '2', D3: '3', D4: '4', D5: '5', D6: '6', D7: '7', D8: '8', D9: '9',
  DOT: 'Decimal point', ADD: '+', SUB: '−', MUL: '×', DIV: '÷', LPAR: '(', RPAR: ')', POW: 'Power ■^□',
  EXE: 'EXE', DEL: 'DEL (backspace)', AC: 'AC (clear)', BACK: 'BACK', OK: 'OK',
  UP: 'Up', DOWN: 'Down', LEFT: 'Left', RIGHT: 'Right', PGUP: 'Page up', PGDN: 'Page down',
  HOME: 'HOME', SHIFT: 'SHIFT', VARIABLE: 'VARIABLE', FUNCTION: 'FUNCTION', CATALOG: 'CATALOG',
  TOOLS: 'TOOLS', SETTINGS: 'SETTINGS', FORMAT: 'FORMAT', ON: 'ON',
  X: '𝑥', SIN: 'sin', COS: 'cos', TAN: 'tan', ANS: 'Ans', SQRT: 'Square root √', SQR: 'Square ■²',
  LOGB: 'log■□', EXP10: '×10■', FRAC: 'Fraction ■/□',
};
const SHIFT_NAMES = {
  ASIN: 'sin⁻¹', ACOS: 'cos⁻¹', ATAN: 'tan⁻¹', LOG: 'log', LN: 'ln', ROOT: '𝑥-th root ■√□',
  MIXED: 'Mixed fraction ■□/□', RECIP: 'Reciprocal ■⁻¹', EQ: '=', COMMA: ',', PI: 'π', E: 'e', I: '𝑖',
  INS: 'INS (insert)', OFF: 'OFF', VA: 'Variable A', VB: 'Variable B', VC: 'Variable C', VD: 'Variable D',
  VE: 'Variable E', VF: 'Variable F', DMS: '°′″', NEG: '(−) negative', VX: 'Variable 𝑥', VY: 'Variable 𝑦', VZ: 'Variable 𝑧', FMT2: 'FORMAT (other mode)',
  APPROX: '≈ (decimal result)', CATLIST: 'CATALOG list', SLEFT: 'Jump to start', SRIGHT: 'Jump to end',
};
const KEY_TEXT = {
  ' ': 'Space', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Escape: 'Esc',
  Delete: 'Del', Backspace: 'Backspace', PageUp: 'PgUp', PageDown: 'PgDn',
};

const el = (tag, html) => { const e = document.createElement(tag); if (html !== undefined) e.innerHTML = html; return e; };
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const kbd = (k) => `<kbd>${esc(KEY_TEXT[k] || k)}</kbd>`;
const combo = (...ks) => ks.map(kbd).join('+');
const alts = (list) => list.join('<span class="or">or</span>');

const main = document.getElementById('list');
function section(title, rows, note) {
  main.appendChild(el('h2', esc(title)));
  const t = el('table');
  for (const [keys, what] of rows) { const tr = el('tr'); tr.append(el('td', keys), el('td', esc(what))); t.appendChild(tr); }
  main.appendChild(t);
  if (note) main.appendChild(el('p', note)).className = 'note';
}

// PC keys grouped by the calculator key they press (upper-case X is the same key as x)
const byId = new Map();
for (const [k, id] of Object.entries(KEYBOARD_MAP)) {
  if (k === 'X') continue;
  if (!byId.has(id)) byId.set(id, []);
  byId.get(id).push(k);
}
const rows = (ids) => ids.filter((id) => byId.has(id)).map((id) => [alts(byId.get(id).map((k) => kbd(k))), NAMES[id] || id]);

section('Numbers and arithmetic', [[[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => kbd(String(d))).join(''), 'Digits (number row or keypad)'], ...rows(['DOT', 'ADD', 'SUB', 'MUL', 'DIV', 'LPAR', 'RPAR', 'POW', 'EXE'])]);
section('Functions', rows(['X', 'SIN', 'COS', 'TAN', 'SQRT', 'SQR', 'LOGB', 'EXP10', 'FRAC', 'ANS']));
section('Editing and moving', rows(['DEL', 'AC', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'PGUP', 'PGDN', 'OK', 'BACK']));
section('Menu keys', rows(['HOME', 'SHIFT', 'VARIABLE', 'FUNCTION', 'CATALOG', 'TOOLS', 'SETTINGS', 'FORMAT', 'ON']));

// Shift+letter runs that key's SHIFT function directly
section('SHIFT functions with the PC Shift key',
  Object.entries(KEYBOARD_SHIFT_MAP).map(([k, id]) => [combo('Shift', k), SHIFT_NAMES[SHIFTED[id]] || SHIFTED[id]]));

// Ctrl+Shift+key: the yellow function above that key (letters repeat the Shift+letter list above)
const CODE_TEXT = (c) => c.replace(/^Digit/, '').replace(/^Key/, '').replace(/^Numpad(\d)$/, 'Num $1')
  .replace('NumpadDecimal', 'Num .').replace('NumpadEnter', 'Num Enter').replace('Period', '.').replace('Comma', ',').replace('Minus', '-');
const csGroups = new Map();
for (const [code, id] of Object.entries(KEYBOARD_CTRL_SHIFT_MAP)) {
  if (code.startsWith('Key') || code.startsWith('Numpad')) continue;   // keypad: see the note
  if (!csGroups.has(id)) csGroups.set(id, []);
  csGroups.get(id).push(CODE_TEXT(code));
}
section('Yellow SHIFT functions with Ctrl+Shift',
  [...csGroups].map(([id, ks]) => [alts(ks.map((k) => combo('Ctrl', 'Shift', k))), SHIFT_NAMES[SHIFTED[id]] || SHIFTED[id]]),
  `The keypad digits, ${kbd('.')} and ${kbd('Enter')} work too. ${combo('Ctrl', 'Shift')} with a letter from the list above does the same as ${kbd('Shift')} with that letter.`);

// the rest: press the calculator's SHIFT (Tab or F1), then the key
const direct = new Set(Object.values(KEYBOARD_CTRL_SHIFT_MAP));
const viaShift = Object.entries(SHIFTED)
  .filter(([id, s]) => s !== 'QR' && !direct.has(id) && byId.has(id))
  .map(([id, s]) => [`${kbd('Tab')} then ${alts(byId.get(id).map((k) => kbd(k)))}`, SHIFT_NAMES[s] || s]);
section('Other SHIFT functions', viaShift, `${kbd('F1')} works the same as ${kbd('Tab')}. Press SHIFT again to cancel it.`);

section('Window', [
  [alts([combo('Ctrl', '+'), combo('Ctrl', 'Mouse wheel up')]), 'Make the calculator bigger'],
  [alts([combo('Ctrl', '-'), combo('Ctrl', 'Mouse wheel down')]), 'Make the calculator smaller'],
  [combo('Ctrl', '0'), 'Reset the size'],
  ['Drag the bottom-right corner', 'Resize'],
  ['Drag the calculator body', 'Move the window'],
  [combo('Alt', 'F4'), 'Close the calculator (or this window)'],
]);
