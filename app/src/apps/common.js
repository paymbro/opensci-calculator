// Helpers shared by the calculator apps: drawing input lines and results, evaluating editors,
// error screens, FORMAT handling.
import { LCD, W } from '../core/lcd.js';
import { layoutSeq, drawCursor, MORE_RIGHT_HOLLOW, MORE_LEFT_HOLLOW, MORE_RIGHT, MORE_LEFT, tokenText } from '../core/render.js';
import { parseSeq } from '../core/parser.js';
import { Evaluator } from '../core/eval.js';
import { CalcError, Real } from '../core/num.js';
import { drawError } from '../core/ui.js';
import { formatValue, decimalText, seqText } from '../core/format.js';
import { Calculator, variableScreen, catalogScreen, catalogListScreen, settingsMenuScreen, MenuScreen } from '../core/calc.js';
import { COMMON } from '../core/catalog.js';
import { insertCatalogItem, inputKey } from '../core/input.js';

const scratch = new LCD(1400, 75);

// Draw a natural-display input expression on one (horizontally scrolling) line.
// opts: { x=3, top=9, right=192, blink, showCursor=true, state:{scroll} }
export function drawMathInput(lcd, ed, opts = {}) {
  const x0 = opts.x ?? 3, top = opts.top ?? 9, right = opts.right ?? 193;
  const box = layoutSeq(ed.root, 'big', { noEmptyBox: true });
  let cursor = null;
  const curSeq = ed.seq;
  const inT = ed.inTemplate() && opts.showCursor !== false;
  const st = {
    level: 3, baseLevel: inT ? 2 : 3, slotLevel: 3, curSeq: inT ? curSeq : null,
    cursor: opts.showCursor === false ? null : { seq: curSeq, i: ed.i },
    mark: (x, axis, size) => { cursor = { x, axis, size }; },
  };
  const axis = top + Math.max(box.asc, 7);
  scratch.clear();
  box.draw(scratch, 0, axis, st);
  const vis = right - x0;
  const state = opts.state || {};
  let scroll = state.scroll || 0;
  const cx = cursor ? cursor.x : box.w;
  if (box.w <= vis) scroll = 0;
  else {
    if (cx - scroll > vis - 8) scroll = cx - (vis - 8);
    if (cx - scroll < 0) scroll = cx;
    scroll = Math.max(0, Math.min(scroll, box.w - vis + 8));
  }
  state.scroll = scroll;
  const moreRight = box.w - scroll > vis - (scroll ? 0 : 0) + 0 && box.w > vis;
  const moreLeft = scroll > 0;
  const clipW = moreRight ? vis - 8 : vis;
  const clipX = moreLeft ? 8 : 0;
  lcd.blit(scratch, scroll + clipX, 0, clipW - clipX, 75, x0 + clipX, 0);
  if (moreRight) lcd.bitmap(MORE_RIGHT_HOLLOW, 186, axis - 3);
  if (moreLeft) lcd.bitmap(MORE_LEFT_HOLLOW, 0, axis - 3);
  if (cursor && opts.blink !== false && opts.showCursor !== false) {
    const c = { ...cursor, x: cursor.x - scroll + x0 };
    if (c.x >= x0 - 1 && c.x <= right) drawCursor(lcd, c, ed.overwrite ? 'overwrite' : 'insert', ed.remaining() <= 10);
  }
  return { box, axis };
}

// LineI input: wraps every 17 characters; returns number of lines used
export function lineTokens(seq) {
  const out = [];
  for (const it of seq) {
    if (it.k === 't') out.push({ text: tokenText(it.v), item: it });
    else out.push({ text: '?', item: it });
  }
  return out;
}

export function drawLineInput(lcd, ed, opts = {}) {
  const top = opts.top ?? 9, small = opts.small;
  const perLine = small ? 31 : 17;
  const lineH = small ? 11 : 16;
  const toks = lineTokens(ed.root);
  // flatten to characters with item index mapping for cursor
  const chars = [];
  toks.forEach((t, i) => { for (const ch of Array.from(t.text)) chars.push({ ch, i }); });
  let curChar = chars.findIndex((c) => c.i === ed.i);
  if (curChar < 0) curChar = chars.length;
  const lines = Math.max(1, Math.ceil((chars.length + 1) / perLine));
  const maxLines = opts.maxLines ?? 4;
  const state = opts.state || {};
  let first = state.firstLine || 0;
  const curLine = Math.floor(curChar / perLine);
  if (curLine < first) first = curLine;
  if (curLine >= first + maxLines) first = curLine - maxLines + 1;
  state.firstLine = first;
  for (let l = 0; l < maxLines; l++) {
    const li = first + l;
    const seg = chars.slice(li * perLine, (li + 1) * perLine).map((c) => c.ch).join('');
    if (small) lcd.smallText(seg, 3, top + l * lineH);
    else lcd.bigText(seg, 3, top + l * lineH);
  }
  if (opts.blink !== false && opts.showCursor !== false) {
    const cl = curLine - first;
    const cc = curChar % perLine;
    if (cl >= 0 && cl < maxLines) {
      const x = 3 + cc * (small ? 6 : 11), y = top + cl * lineH;
      if (ed.overwrite) lcd.fill(x + 1, y + 13, 8, 1, 3);
      else if (ed.remaining() <= 10) lcd.fill(x, y + 1, 11, 12, 3);
      else lcd.fill(x, y + 1, 3, 13, 3);
    }
  }
  return { lines: Math.min(lines - first, maxLines), totalLines: lines };
}

// Draw a result sequence right-aligned with its last line bottom at `bottom` (default cell bottom 71).
export function drawResult(lcd, seq, opts = {}) {
  const box = layoutSeq(seq, 'big', { noEmptyBox: true });
  const right = opts.right ?? 195;
  const bottomRow = opts.bottom ?? 71;
  const axis = bottomRow - box.desc;
  const st = { level: 3, baseLevel: 3, slotLevel: 3, curSeq: null, cursor: null, mark() {} };
  const vis = right - (opts.left ?? 3);
  if (box.w <= vis) {
    box.draw(lcd, right - box.w, axis, st);
    return { box, axis, over: false };
  }
  // too wide: show the left part and a "more" marker (◀▶ scroll via state)
  scratch.clear();
  box.draw(scratch, 0, axis, st);
  const state = opts.state || {};
  const off = Math.min(state.scroll || 0, box.w - vis + 9);
  lcd.blit(scratch, off, 0, vis - 9, 75, (opts.left ?? 3) + (off ? 9 : 0), 0);
  if (off + vis - 9 < box.w) lcd.bitmap(MORE_RIGHT, 186, axis - 3);
  if (off > 0) lcd.bitmap(MORE_LEFT, 0, axis - 3);
  return { box, axis, over: true };
}

export function resultWidth(seq) { return layoutSeq(seq, 'big', { noEmptyBox: true }).w; }

// ---------------------------------------------------------------- evaluation
export function evalContext(calc, extra = {}) {
  const S = calc.settings;
  return {
    angle: S.angle, vars: calc.mem.vars, ans: calc.mem.ans, funcs: calc.mem.funcs, mvars: calc.mem.mvars,
    complex: false, parseOpts: {},
    round: (v) => roundToFormat(v, S),
    ...extra,
  };
}

export function roundToFormat(v, S) {
  const nf = S.numFormat;
  if (nf.kind === 'Fix') return new Real(v.dec.toDecimalPlaces(nf.n));
  if (nf.kind === 'Sci') return new Real(v.dec.toSignificantDigits(nf.n));
  return new Real(v.dec.toSignificantDigits(10));
}

export function evaluate(calc, ed, extra = {}, parseOpts = {}) {
  const ast = parseSeq(ed.root, parseOpts);
  const ctx = evalContext(calc, extra);
  const ev = new Evaluator(ctx);
  const v = ev.ev(ast);
  return { value: v, flags: ev.flags };
}

// Locate the cursor right after `item` inside the editor tree (used after errors).
export function placeCursorAt(ed, item) {
  if (!item) { ed.end(); return; }
  const find = (seq, path) => {
    for (let i = 0; i < seq.length; i++) {
      const it = seq[i];
      if (it === item) return { path, i: i + 1 };
      if (it.k !== 't') {
        for (let s = 0; s < it.s.length; s++) {
          const r = find(it.s[s], [...path, { node: it, slot: s }]);
          if (r) return r;
        }
      }
    }
    return null;
  };
  const r = find(ed.root, []);
  if (!r) { ed.end(); return; }
  ed.path = r.path;
  ed.i = r.i;
}

// code-point safe string helpers (italic 𝑥 etc. are outside the BMP)
export const cut = (s, a, b) => Array.from(s).slice(a, b).join('');
export const ulen = (s) => Array.from(s).length;

export function errorScreen(calc, err, onBack) {
  const kind = err instanceof CalcError ? err.kind : 'Math';
  return {
    group: 'error', kind,
    key(k) {
      if (k === 'OK' || k === 'BACK' || k === 'AC' || k === 'EXE') { calc.pop(); onBack(k); return true; }
      return true;
    },
    render(lcd) { drawError(lcd, kind); },
    status() { return calc.app && calc.app.status ? calc.app.status() : null; },
  };
}

// Global menu keys available in expression-input screens.
export function globalMenus(calc, k, target, opts = {}) {
  switch (k) {
    case 'SETTINGS': calc.push(settingsMenuScreen(calc)); return true;
    case 'CATALOG': calc.push(catalogScreen(calc, opts.catalog || COMMON, (spec) => target.insertSpec(spec))); return true;
    case 'CATLIST': calc.push(catalogListScreen(calc, opts.catalog || COMMON, (spec) => target.insertSpec(spec))); return true;
    case 'VARIABLE':
      calc.push(variableScreen(calc, {
        onRecall: (name) => target.insertSpec({ tokens: [name] }),
        storeValue: opts.storeValue || null,
        locked: !!opts.varLocked,
      }));
      return true;
    case 'FUNCTION': calc.push(functionMenu(calc, target)); return true;
    default: return false;
  }
}

export function functionMenu(calc, target, opts = {}) {
  const g = 'function';
  const define = (name) => {
    const ed = calc.newEditor();
    ed.setFrom(calc.mem.funcs[name] || []);
    const scr = {
      group: g, editor: ed,
      key(k) {
        if (k === 'EXE') {
          calc.mem.funcs[name] = JSON.parse(JSON.stringify(ed.root));
          calc.closeGroup(g);
          if (target && target.onFuncDefined) target.onFuncDefined(name);
          return true;
        }
        if (k === 'AC') { ed.clear(); return true; }
        if (k === 'BACK') { calc.pop(); return true; }
        if (k === 'FUNCTION') {
          // composite: inside g(x) only f(x) can be inserted (and vice versa)
          const other = name === 'f' ? 'g' : 'f';
          calc.push(new MenuScreen(calc, { group: g, items: [{ label: other + '(𝑥)' }], onSelect: () => { calc.pop(); ed.insertToken(other + '('); } }));
          return true;
        }
        if (k === 'CATALOG' || k === 'CATLIST' || k === 'VARIABLE') {
          return globalMenus(calc, k, { insertSpec: (spec) => specInsert(ed, spec, calc) });
        }
        return inputKey(ed, k, { settings: calc.settings });
      },
      render(lcd, blink) {
        lcd.bigText(name + '(𝑥)=', 3, 9);
        if (calc.math) drawMathInput(lcd, ed, { x: 69, top: 9, blink, state: scr });
        else drawLineInput(lcd, { ...ed, root: ed.root, i: ed.i, overwrite: ed.overwrite, remaining: () => ed.remaining() }, { top: 25, blink });
      },
      status() { return { mathI: calc.math, angle: calc.settings.angle }; },
    };
    return scr;
  };
  const items = opts.defineOnly
    ? [{ label: 'Define f(𝑥)' }, { label: 'Define g(𝑥)' }]
    : [{ label: 'f(𝑥)' }, { label: 'g(𝑥)' }, { label: 'Define f(𝑥)' }, { label: 'Define g(𝑥)' }];
  return new MenuScreen(calc, {
    group: g, items,
    onSelect: (it) => {
      if (it.label === 'f(𝑥)' || it.label === 'g(𝑥)') { calc.closeGroup(g); target.insertSpec({ tokens: [it.label[0] + '('] }); return; }
      calc.push(define(it.label.includes('f') ? 'f' : 'g'));
    },
  });
}

export function specInsert(ed, spec, calc) {
  if (spec.key) return inputKey(ed, spec.key, { settings: calc.settings, allowI: true, allowEq: true });
  return insertCatalogItem(ed, spec);
}

export function fmtVarValue(calc, v) {
  // variable list always uses Norm 1 with digit separators
  const S = { ...calc.settings, numFormat: { kind: 'Norm', n: 1 } };
  if (!(v instanceof Real)) return v && v.re ? seqText(formatValue(v, { ...S, io: 'LineI/DecimalO' })) : '0';
  return decimalText(v.dec, S, S.numFormat);
}

Calculator.prototype.formatVarValue = function (v) { return fmtVarValue(this, v); };

export { seqText, Calculator };

// Calculator-level helpers used by the core variable/function screens
Calculator.prototype.drawInputLine = function (lcd, ed, { x = 3, top = 9, blink } = {}) {
  if (ed.math) drawMathInput(lcd, ed, { x, top, blink, state: ed._state || (ed._state = {}) });
  else drawLineInput(lcd, ed, { top, blink, maxLines: 1, state: ed._state || (ed._state = {}) });
};
Calculator.prototype.evaluateEditor = function (ed) {
  const r = evaluate(this, ed, {});
  return r.value;
};
Calculator.prototype.showError = function (e, onBack) {
  this.push(errorScreen(this, e instanceof CalcError ? e : new CalcError('Math'), onBack || (() => {})));
};
