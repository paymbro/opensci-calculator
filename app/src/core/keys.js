// Physical keys of the fx-991CW+ UK (User's Guide "Key Markings" p.15 and the official front photo)
// and the function each key performs after SHIFT.
export const KEY_IDS = [
  'ON', 'HOME', 'UP', 'PGUP', 'PGDN', 'SETTINGS', 'BACK', 'LEFT', 'OK', 'RIGHT', 'DOWN',
  'SHIFT', 'VARIABLE', 'FUNCTION', 'CATALOG', 'TOOLS',
  'X', 'FRAC', 'SQRT', 'POW', 'SQR', 'LOGB',
  'ANS', 'SIN', 'COS', 'TAN', 'LPAR', 'RPAR',
  'D7', 'D8', 'D9', 'DEL', 'AC',
  'D4', 'D5', 'D6', 'MUL', 'DIV',
  'D1', 'D2', 'D3', 'ADD', 'SUB',
  'D0', 'DOT', 'EXP10', 'FORMAT', 'EXE',
];

export const SHIFTED = {
  X: 'QR', FRAC: 'MIXED', SQRT: 'ROOT', POW: 'RECIP', SQR: 'LOG', LOGB: 'LN',
  SIN: 'ASIN', COS: 'ACOS', TAN: 'ATAN', LPAR: 'EQ', RPAR: 'COMMA',
  D7: 'PI', D8: 'E', D9: 'I', DEL: 'INS', AC: 'OFF',
  D4: 'VA', D5: 'VB', D6: 'VC', D1: 'VD', D2: 'VE', D3: 'VF',
  ADD: 'DMS', SUB: 'NEG', D0: 'VX', DOT: 'VY', EXP10: 'VZ', FORMAT: 'FMT2', EXE: 'APPROX',
  CATALOG: 'CATLIST', LEFT: 'SLEFT', RIGHT: 'SRIGHT',
};

// Legends printed on/above the keys (used by the body renderer and the checklist)
export const KEY_LEGENDS = {
  ON: { main: '', above: 'ON' }, HOME: { main: '⌂', above: 'HOME' }, SETTINGS: { main: '☰', above: 'SETTINGS' },
  BACK: { main: '↩' }, UP: { main: '^' }, DOWN: { main: 'v' }, LEFT: { main: '<' }, RIGHT: { main: '>' }, OK: { main: 'OK' },
  PGUP: { main: '⏫' }, PGDN: { main: '⏬' },
  SHIFT: { main: '⇧', above: 'SHIFT' }, VARIABLE: { main: '⇄𝑥', above: 'VARIABLE' }, FUNCTION: { main: 'f(𝑥)', above: 'FUNCTION' },
  CATALOG: { main: '📖', above: 'CATALOG', shift: '☰' }, TOOLS: { main: '○○○', above: 'TOOLS' },
  X: { main: '𝑥', shift: 'QR' }, FRAC: { main: '■/□', shift: '■□/□' }, SQRT: { main: '√■', shift: '■√□' },
  POW: { main: '■^□', shift: '■⁻¹' }, SQR: { main: '■²', shift: 'log' }, LOGB: { main: 'log■□', shift: 'ln' },
  ANS: { main: 'Ans' }, SIN: { main: 'sin', shift: 'sin⁻¹' }, COS: { main: 'cos', shift: 'cos⁻¹' }, TAN: { main: 'tan', shift: 'tan⁻¹' },
  LPAR: { main: '(', shift: '=' }, RPAR: { main: ')', shift: ',' },
  D7: { main: '7', shift: 'π' }, D8: { main: '8', shift: 'e' }, D9: { main: '9', shift: 'i' }, DEL: { main: '⌫', shift: 'INS' },
  AC: { main: 'AC', shift: 'OFF' }, D4: { main: '4', shift: 'A' }, D5: { main: '5', shift: 'B' }, D6: { main: '6', shift: 'C' },
  MUL: { main: '×' }, DIV: { main: '÷' }, D1: { main: '1', shift: 'D' }, D2: { main: '2', shift: 'E' }, D3: { main: '3', shift: 'F' },
  ADD: { main: '+', shift: '°′″' }, SUB: { main: '−', shift: '(−)' }, D0: { main: '0', shift: '𝑥' }, DOT: { main: '.', shift: '𝑦' },
  EXP10: { main: '×10■', shift: '𝑧' }, FORMAT: { main: 'FORMAT', shift: '⟳' }, EXE: { main: 'EXE', shift: '≈' },
};

// PC keyboard → calculator key (documented in README / checklist)
export const KEYBOARD_MAP = {
  '0': 'D0', '1': 'D1', '2': 'D2', '3': 'D3', '4': 'D4', '5': 'D5', '6': 'D6', '7': 'D7', '8': 'D8', '9': 'D9',
  '.': 'DOT', ',': 'DOT', '+': 'ADD', '-': 'SUB', '*': 'MUL', '/': 'DIV', '(': 'LPAR', ')': 'RPAR', '^': 'POW',
  'Enter': 'EXE', '=': 'EXE', 'Backspace': 'DEL', 'Delete': 'AC', 'Escape': 'BACK',
  'ArrowUp': 'UP', 'ArrowDown': 'DOWN', 'ArrowLeft': 'LEFT', 'ArrowRight': 'RIGHT',
  'PageUp': 'PGUP', 'PageDown': 'PGDN', 'Home': 'HOME', ' ': 'OK', 'Tab': 'SHIFT',
  'F1': 'SHIFT', 'F2': 'VARIABLE', 'F3': 'FUNCTION', 'F4': 'CATALOG', 'F5': 'TOOLS', 'F6': 'SETTINGS',
  'F7': 'FORMAT', 'F8': 'ON', 'x': 'X', 'X': 'X', 's': 'SIN', 'c': 'COS', 't': 'TAN', 'a': 'ANS', 'r': 'SQRT',
  'q': 'SQR', 'l': 'LOGB', 'e': 'EXP10', 'f': 'FRAC',
};

// Holding the PC Shift key on a letter performs that calculator key's SHIFT function
// (e.g. Shift+S = sin⁻¹, Shift+C = cos⁻¹, Shift+T = tan⁻¹, Shift+Q = log, Shift+L = ln,
// Shift+R = x-th root, Shift+F = mixed fraction).  X keeps typing x (its SHIFT function, QR, was removed).
export const KEYBOARD_SHIFT_MAP = Object.fromEntries(
  Object.entries(KEYBOARD_MAP)
    .filter(([k, id]) => /^[a-z]$/.test(k) && SHIFTED[id] && id !== 'X')
    .map(([k, id]) => [k.toUpperCase(), id]),
);

// Ctrl+Shift+key performs the yellow SHIFT function printed above that key (Ctrl+Shift+7 = π,
// Ctrl+Shift+4 = A, Ctrl+Shift+Enter = ≈ ...).  Matched by physical key (KeyboardEvent.code) so it
// works on any layout.  Equal, NumpadAdd and NumpadSubtract are left out: Ctrl+(Shift+)= / + / −
// already resize the window.
export const ZOOM_CODES = ['Equal', 'NumpadAdd', 'NumpadSubtract'];
export const KEYBOARD_CTRL_SHIFT_MAP = {
  ...Object.fromEntries(Array.from({ length: 10 }, (_, d) => [['Digit' + d, 'D' + d], ['Numpad' + d, 'D' + d]]).flat()),
  Period: 'DOT', NumpadDecimal: 'DOT', Comma: 'DOT', Minus: 'SUB',
  Enter: 'EXE', NumpadEnter: 'EXE', Backspace: 'DEL', Delete: 'AC',
  ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', F4: 'CATALOG', F7: 'FORMAT',
  ...Object.fromEntries(Object.entries(KEYBOARD_SHIFT_MAP).map(([k, id]) => ['Key' + k, id])),
};
