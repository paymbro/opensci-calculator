// Expression-input key handling shared by every screen that accepts a calculation expression.
import { tok } from './expr.js';

const SIMPLE = {
  D0: '0', D1: '1', D2: '2', D3: '3', D4: '4', D5: '5', D6: '6', D7: '7', D8: '8', D9: '9', DOT: '.',
  ADD: '+', SUB: '−', MUL: '×', DIV: '÷', LPAR: '(', RPAR: ')', ANS: 'Ans',
  SIN: 'sin(', COS: 'cos(', TAN: 'tan(', ASIN: 'sin⁻¹(', ACOS: 'cos⁻¹(', ATAN: 'tan⁻¹(',
  LOG: 'log(', LN: 'ln(', RECIP: '⁻¹', SQR: '²', EQ: '=', COMMA: ',', PI: 'π', E: '𝑒', I: '𝑖',
  VA: 'A', VB: 'B', VC: 'C', VD: 'D', VE: 'E', VF: 'F', VX: 'x', X: 'x', VY: 'y', VZ: 'z', DMS: '▫', NEG: '(-)',
};
// keys that, when pressed right after a result, continue the calculation with "Ans"
export const ANS_CONTINUE = new Set(['ADD', 'SUB', 'MUL', 'DIV', 'SQR', 'RECIP', 'POW', 'FRAC_POST']);

// opts: { settings, allowI (complex), allowEq, hex (Base-N letters) }
export function inputKey(ed, k, opts) {
  const s = opts.settings;
  const math = ed.math;
  if (k === 'I' && !opts.allowI) return true;          // i is only available in the Complex app
  if (k === 'EQ' && !opts.allowEq && opts.strictEq) return true;
  if (k in SIMPLE) {
    if (opts.hex && ['VA', 'VB', 'VC', 'VD', 'VE', 'VF'].includes(k)) { ed.insertToken(SIMPLE[k]); return true; }
    ed.insertToken(SIMPLE[k]);
    return true;
  }
  switch (k) {
    case 'FRAC': if (math) ed.insertTemplate('frac', { grab: true }); else ed.insertToken('⌟'); return true;
    case 'MIXED': if (math) ed.insertTemplate('mixed'); else ed.insertToken('⌟'); return true;
    case 'SQRT': if (math) ed.insertTemplate('sqrt'); else ed.insertToken('√('); return true;
    case 'ROOT': if (math) ed.insertTemplate('root'); else ed.insertToken('ˣ√('); return true;
    case 'POW': if (math) ed.insertTemplate('pow'); else ed.insertToken('^('); return true;
    case 'LOGB': if (math) ed.insertTemplate('logb'); else ed.insertToken('log('); return true;
    case 'EXP10':
      if (s.x10Key === 'power') {
        ed.insertTokens(['×', '1', '0']);
        if (math) ed.insertTemplate('pow'); else ed.insertToken('^(');
      } else if (math) ed.insertTemplate('sci'); else ed.insertToken('⏨');
      return true;
    case 'DEL': ed.del(); return true;
    case 'INS': if (math) ed.markIns(); else ed.overwrite = !ed.overwrite; return true;
    case 'LEFT': ed.left(); return true;
    case 'RIGHT': ed.right(); return true;
    case 'SLEFT': if (!ed.jumpOutLeft()) ed.left(); return true;
    case 'SRIGHT': if (!ed.jumpOutRight()) ed.right(); return true;
    case 'PGUP': ed.home(); return true;
    case 'PGDN': ed.end(); return true;
    default: return false;
  }
}

// Insert a CATALOG item into an editor.  spec: {tokens:[...]} | {tmpl:'ddx', lineTokens:[...]} | {post:'%'}
export function insertCatalogItem(ed, spec) {
  if (spec.tmpl && ed.math) { ed.insertTemplate(spec.tmpl, { grab: spec.grab }); return; }
  const list = (!ed.math && spec.lineTokens) ? spec.lineTokens : spec.tokens;
  for (const t of list || []) ed.insertToken(t);
}

export { tok };
