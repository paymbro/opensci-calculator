// Rebindable PC keyboard shortcuts.  A shortcut is a "combo" string made from a KeyboardEvent:
//   - without Ctrl/Alt/Meta: the character typed ('s', 'S', '(', ' ') or the key name, with
//     'Shift+' in front for named keys ('Enter', 'Shift+F1');
//   - with Ctrl/Alt/Meta: the modifiers and the physical key ('Ctrl+Shift+Digit7', 'Ctrl+KeyK'),
//     so it works on any keyboard layout.
// An action is what a shortcut does: 'key:SIN' presses that calculator key, 'shift:SIN' presses
// SHIFT then that key (its yellow function), 'win:zoomIn' etc. resize the window.
// The defaults reproduce the fixed maps in keys.js; the user's changes are stored as overrides
// { action: [combos] } for the actions they changed.
import { KEY_IDS, SHIFTED, KEYBOARD_MAP, KEYBOARD_SHIFT_MAP, KEYBOARD_CTRL_SHIFT_MAP } from './keys.js';

export const STORAGE_KEY = 'opensci:bindings';

const KEY_NAMES = {
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
  VE: 'Variable E', VF: 'Variable F', DMS: '°′″', NEG: '(−) negative', VX: 'Variable 𝑥', VY: 'Variable 𝑦',
  VZ: 'Variable 𝑧', FMT2: 'FORMAT (other mode)', APPROX: '≈ (decimal result)', CATLIST: 'CATALOG list',
  SLEFT: 'Jump to start', SRIGHT: 'Jump to end',
};
const WIN_NAMES = { zoomIn: 'Make the calculator bigger', zoomOut: 'Make the calculator smaller', zoomReset: 'Reset the size' };

// every action that can have shortcuts, in display order
export const ACTIONS = [
  ...KEY_IDS.map((id) => 'key:' + id),
  ...Object.keys(SHIFTED).filter((id) => SHIFTED[id] !== 'QR').map((id) => 'shift:' + id),
  ...Object.keys(WIN_NAMES).map((id) => 'win:' + id),
];
const ACTION_SET = new Set(ACTIONS);

export function actionLabel(action) {
  const [kind, id] = action.split(':');
  if (kind === 'key') return KEY_NAMES[id] || id;
  if (kind === 'shift') return SHIFT_NAMES[SHIFTED[id]] || SHIFTED[id];
  return WIN_NAMES[id] || id;
}
// the calculator key a SHIFT action uses, e.g. 'shift:SIN' → 'sin'
export const shiftKeyLabel = (action) => KEY_NAMES[action.split(':')[1]];

export const DEFAULT_BINDINGS = (() => {
  const d = {};
  const add = (action, combo) => (d[action] ||= []).push(combo);
  for (const [k, id] of Object.entries(KEYBOARD_MAP)) add('key:' + id, k);
  for (const [k, id] of Object.entries(KEYBOARD_SHIFT_MAP)) add('shift:' + id, k);
  for (const [code, id] of Object.entries(KEYBOARD_CTRL_SHIFT_MAP)) add('shift:' + id, 'Ctrl+Shift+' + code);
  d['win:zoomIn'] = ['Ctrl+Equal', 'Ctrl+Shift+Equal', 'Ctrl+NumpadAdd'];
  d['win:zoomOut'] = ['Ctrl+Minus', 'Ctrl+NumpadSubtract'];
  d['win:zoomReset'] = ['Ctrl+Digit0', 'Ctrl+Numpad0'];
  return d;
})();

const NOT_A_KEY = new Set(['Control', 'Shift', 'Alt', 'Meta', 'AltGraph', 'CapsLock', 'NumLock', 'ScrollLock', 'OS', 'Dead', 'Unidentified', 'Process', '']);

export function comboOf(e) {
  if (e.ctrlKey || e.altKey || e.metaKey) {
    if (!e.code || /^(Control|Shift|Alt|Meta|OS)/.test(e.code)) return null;
    return [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Meta'].filter(Boolean).join('+') + '+' + e.code;
  }
  if (NOT_A_KEY.has(e.key)) return null;
  if (e.key.length === 1) return e.key;
  return (e.shiftKey ? 'Shift+' : '') + e.key;
}

// overrides from storage, keeping only known actions and string combos
export function cleanOverrides(o) {
  const out = {};
  if (!o || typeof o !== 'object') return out;
  for (const [action, list] of Object.entries(o)) {
    if (ACTION_SET.has(action) && Array.isArray(list)) out[action] = [...new Set(list.filter((c) => typeof c === 'string' && c))];
  }
  return out;
}
export function loadOverrides(ls) {
  try { return cleanOverrides(JSON.parse(ls.getItem(STORAGE_KEY) || '{}')); } catch (e) { return {}; }
}
export function saveOverrides(ls, o) {
  try { ls.setItem(STORAGE_KEY, JSON.stringify(o)); } catch (e) { /* ignore */ }
}

export function effectiveBindings(overrides) {
  const b = {};
  for (const a of ACTIONS) b[a] = [...(overrides[a] || DEFAULT_BINDINGS[a] || [])];
  return b;
}

// combo → action (a combo the user gave to an action wins over a default that still lists it)
export function comboMap(overrides) {
  const m = new Map();
  const b = effectiveBindings(overrides);
  for (const pass of [false, true]) {
    for (const a of ACTIONS) if (!!overrides[a] === pass) for (const c of b[a]) m.set(c, a);
  }
  return m;
}

export function lookup(map, e) {
  const c = comboOf(e);
  if (!c) return null;
  // Shift with a named key (Shift+Enter) does the same as the key alone unless it has its own shortcut
  return map.get(c) || (c.startsWith('Shift+') ? map.get(c.slice(6)) : null) || null;
}

const sameList = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// Gives `action` exactly these shortcuts, taking any of them away from other actions.
// Returns { overrides, moved: [{ combo, from }] } (a new object; the input is not changed).
export function setBindings(overrides, action, list) {
  const o = { ...overrides };
  const b = effectiveBindings(o);
  const moved = [];
  for (const c of list) {
    for (const other of ACTIONS) {
      if (other === action || !b[other].includes(c)) continue;
      b[other] = b[other].filter((x) => x !== c);
      o[other] = b[other];
      moved.push({ combo: c, from: other });
    }
  }
  o[action] = [...new Set(list)];
  for (const a of Object.keys(o)) if (sameList(o[a], DEFAULT_BINDINGS[a] || [])) delete o[a];
  return { overrides: o, moved };
}
export const addBinding = (o, action, combo) => setBindings(o, action, [...effectiveBindings(o)[action].filter((c) => c !== combo), combo]);
export const removeBinding = (o, action, combo) => setBindings(o, action, effectiveBindings(o)[action].filter((c) => c !== combo));
export const resetBinding = (o, action) => setBindings(o, action, DEFAULT_BINDINGS[action] || []);

// readable key caps for a combo, e.g. 'Ctrl+Shift+Digit7' → ['Ctrl', 'Shift', '7']
const KEY_TEXT = {
  ' ': 'Space', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Escape: 'Esc',
  Delete: 'Del', PageUp: 'PgUp', PageDown: 'PgDn',
};
const CODE_TEXT = {
  Period: '.', Comma: ',', Minus: '-', Equal: '=', Slash: '/', Backslash: '\\', Semicolon: ';', Quote: "'",
  BracketLeft: '[', BracketRight: ']', Backquote: '`', IntlBackslash: '\\', Space: 'Space',
  NumpadAdd: 'Num +', NumpadSubtract: 'Num -', NumpadMultiply: 'Num *', NumpadDivide: 'Num /',
  NumpadDecimal: 'Num .', NumpadEnter: 'Num Enter', NumpadEqual: 'Num =',
};
export function comboKeys(combo) {
  if (combo.length === 1) return /^[A-Z]$/.test(combo) ? ['Shift', combo] : [KEY_TEXT[combo] || combo.toUpperCase()];
  const parts = combo.split('+');
  const last = parts.pop();
  return [...parts, CODE_TEXT[last] || KEY_TEXT[last] || last.replace(/^Digit/, '').replace(/^Key/, '').replace(/^Numpad(\d)$/, 'Num $1')];
}
