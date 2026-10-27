// Editable input expression (Natural Textbook templates or linear tokens) with a cursor.
//
// An expression is an array ("sequence") of items:
//   { k: 't', v: 'sin(' }              a token (digits, operators, functions, variables …)
//   { k: 'frac', s: [num, den] }       templates, each slot is itself a sequence
//   { k: 'mixed', s: [int, num, den] }
//   { k: 'sqrt', s: [arg] }   { k: 'root', s: [n, arg] }   { k: 'pow', s: [exp] }
//   { k: 'logb', s: [base, arg] }       { k: 'abs', s: [arg] }
//   { k: 'ddx', s: [f, a] }   { k: 'int', s: [f, a, b] }  { k: 'sum', s: [f, a, b] }
//   { k: 'sci', s: [exp] }   ( ×10^□ in "Sci Notat" mode)   { k: 'rec', s: [period] }
// The cursor is a path of (template, slot) pairs plus an index into the innermost sequence.

export const TEMPLATE_SLOTS = {
  frac: 2, mixed: 3, sqrt: 1, root: 2, pow: 1, logb: 2, abs: 1, ddx: 2, int: 3, sum: 3, sci: 1, rec: 1,
};

// slot navigation: order for ◀/▶ and vertical moves
const RIGHT_ORDER = {
  frac: [0, 1], mixed: [0, 1, 2], sqrt: [0], root: [0, 1], pow: [0], logb: [0, 1], abs: [0],
  ddx: [0, 1], int: [1, 2, 0], sum: [1, 2, 0], sci: [0], rec: [0],
};
// vertical neighbours: {slot: {up, down}}
const VERT = {
  frac: { 0: { down: 1 }, 1: { up: 0 } },
  mixed: { 0: { up: 1, down: 2 }, 1: { down: 2 }, 2: { up: 1 } },
  int: { 0: { up: 2, down: 1 }, 1: { up: 2 }, 2: { down: 1 } },
  sum: { 0: { up: 2, down: 1 }, 1: { up: 2 }, 2: { down: 1 } },
  logb: {}, root: {},
};

export const isTemplate = (it) => it && it.k !== 't';
export const tok = (v) => ({ k: 't', v });

export function cloneSeq(seq) {
  return seq.map((it) => (it.k === 't' ? { k: 't', v: it.v } : { k: it.k, s: it.s.map(cloneSeq) }));
}

let uid = 1;

export class Editor {
  constructor({ math = true } = {}) {
    this.math = math;          // natural (MathI) or linear (LineI) input
    this.root = [];
    this.path = [];            // [{node, slot}]
    this.i = 0;
    this.overwrite = false;    // LineI overwrite mode
    this.insPending = null;    // INS: item range to become the next function's argument
    this.capacity = 199;
    this.undo = [];
    this.redo = [];
    this.id = uid++;
  }

  get seq() {
    if (!this.path.length) return this.root;
    const p = this.path[this.path.length - 1];
    return p.node.s[p.slot];
  }

  isEmpty() { return this.root.length === 0; }

  clear() {
    this.root = []; this.path = []; this.i = 0; this.insPending = null;
  }

  setFrom(seq) {
    this.root = cloneSeq(seq); this.path = []; this.i = this.root.length;
  }

  snapshot() {
    return { root: cloneSeq(this.root), pathIdx: this.pathIndices(), i: this.i };
  }

  pathIndices() {
    // convert node path to index path for snapshots
    const out = [];
    let seq = this.root;
    for (const p of this.path) {
      const idx = seq.indexOf(p.node);
      out.push([idx, p.slot]);
      seq = p.node.s[p.slot];
    }
    return out;
  }

  restore(snap) {
    this.root = cloneSeq(snap.root);
    this.path = [];
    let seq = this.root;
    for (const [idx, slot] of snap.pathIdx) {
      const node = seq[idx];
      if (!node || !node.s) break;
      this.path.push({ node, slot });
      seq = node.s[slot];
    }
    this.i = Math.min(snap.i, seq.length);
  }

  pushUndo() {
    this.undo.push(this.snapshot());
    if (this.undo.length > 50) this.undo.shift();
    this.redo = [];
  }

  doUndo() {
    if (!this.undo.length) {
      if (this.redo.length) { const r = this.redo.pop(); this.undo.push(this.snapshot()); this.restore(r); }
      return;
    }
    this.redo.push(this.snapshot());
    this.restore(this.undo.pop());
  }

  size(seq = this.root) {
    let n = 0;
    for (const it of seq) {
      if (it.k === 't') n += 1;
      else n += 1 + it.s.reduce((a, s) => a + this.size(s), 0);
    }
    return n;
  }

  remaining() { return this.capacity - this.size(); }

  // ------------------------------------------------------------- insertion
  insertToken(v) {
    if (this.remaining() <= 0) return false;
    this.pushUndo();
    const seq = this.seq;
    if (!this.math && this.overwrite && this.i < seq.length) seq[this.i] = tok(v);
    else seq.splice(this.i, 0, tok(v));
    this.i++;
    // INS pending: a function token that opens a parenthesis takes the remembered argument
    if (this.insPending && /\($/.test(v)) this.applyInsParen();
    return true;
  }

  insertTokens(list) { for (const v of list) this.insertToken(v); }

  // Start of the operand that ends just before index i in seq (for templates that grab it).
  operandStart(seq, i) {
    if (i <= 0) return i;
    let j = i;
    const prev = seq[j - 1];
    const isDigit = (it) => it && it.k === 't' && /^[0-9.]$/.test(it.v);
    const postfix = (it) => it && it.k === 't' && ['²', '⁻¹', '!', '%', '°', 'ʳ', 'ᵍ'].includes(it.v);
    while (j > 0 && (postfix(seq[j - 1]) || (seq[j - 1].k === 'pow'))) j--;
    if (j > 0 && isDigit(seq[j - 1])) {
      while (j > 0 && isDigit(seq[j - 1])) j--;
      return j;
    }
    if (j > 0 && seq[j - 1].k === 't' && seq[j - 1].v === ')') {
      let depth = 0;
      for (let k = j - 1; k >= 0; k--) {
        const it = seq[k];
        if (it.k !== 't') continue;
        if (it.v === ')') depth++;
        else if (/\($/.test(it.v)) { depth--; if (depth === 0) return k; }
      }
      return 0;
    }
    if (j > 0 && (isTemplate(seq[j - 1]) || /^[A-Fxyzπ𝑒𝑖]$|^Ans$|^Ran#$/.test(seq[j - 1].v))) {
      j--;
      if (seq[j].k === 'sci') { while (j > 0 && isDigit(seq[j - 1])) j--; }
      return j;
    }
    return i;
  }

  insertTemplate(kind, opts = {}) {
    if (this.remaining() <= 2) return false;
    this.pushUndo();
    const n = TEMPLATE_SLOTS[kind];
    const node = { k: kind, s: Array.from({ length: n }, () => []) };
    const seq = this.seq;
    let startSlot = 0;
    if (this.insPending && this.math && ['sqrt', 'abs', 'frac', 'root', 'logb'].includes(kind)) {
      // INS: the remembered value becomes the argument (last slot) of this function
      const { start, end } = this.insPending;
      const taken = seq.splice(start, end - start);
      const argSlot = kind === 'frac' ? 0 : n - 1;
      node.s[argSlot] = taken;
      seq.splice(start, 0, node);
      this.insPending = null;
      this.path.push({ node, slot: kind === 'frac' ? 1 : 0 });
      this.i = node.s[kind === 'frac' ? 1 : 0].length;
      if (kind === 'sqrt' || kind === 'abs') { this.path.pop(); this.i = start + 1; }
      return true;
    }
    if (opts.grab) {
      const st = this.operandStart(seq, this.i);
      if (st < this.i) {
        let taken = seq.splice(st, this.i - st);
        if (kind === 'frac' && taken.some((it) => it.k === 'sci')) taken = [tok('('), ...taken, tok(')')];
        node.s[0] = taken;
        startSlot = 1;
        this.i = st;
      }
    }
    seq.splice(this.i, 0, node);
    this.path.push({ node, slot: startSlot });
    this.i = 0;
    return true;
  }

  // INS (SHIFT DEL): mark the value right after the cursor as the argument for the next function.
  markIns() {
    const seq = this.seq;
    if (this.i >= seq.length) return;
    // value = run of digits / single template / parenthesis group after cursor
    let j = this.i;
    const isDigit = (it) => it && it.k === 't' && /^[0-9.]$/.test(it.v);
    if (isDigit(seq[j])) { while (j < seq.length && isDigit(seq[j])) j++; }
    else if (seq[j].k === 't' && /\($/.test(seq[j].v)) {
      let depth = 0;
      for (; j < seq.length; j++) {
        const it = seq[j];
        if (it.k === 't' && /\($/.test(it.v)) depth++;
        if (it.k === 't' && it.v === ')') { depth--; if (depth === 0) { j++; break; } }
      }
    } else j++;
    this.insPending = { start: this.i, end: j };
  }

  applyInsParen() {
    // linear-style function: wrap remembered value inside the just-inserted "f(" ... ")"
    const seq = this.seq;
    const { start, end } = this.insPending;
    this.insPending = null;
    const fnIdx = this.i - 1;
    if (start !== fnIdx) return;
    const taken = seq.splice(fnIdx + 1, end - start);
    seq.splice(fnIdx + 1, 0, ...taken, tok(')'));
  }

  // ------------------------------------------------------------- deletion
  del() {
    const seq = this.seq;
    this.pushUndo();
    if (!this.math && this.overwrite) {
      if (this.i < seq.length) seq.splice(this.i, 1);
      else if (this.i > 0) { seq.splice(this.i - 1, 1); this.i--; }
      return;
    }
    if (this.i > 0) {
      const prev = seq[this.i - 1];
      if (isTemplate(prev)) {
        if (prev.s.every((s) => s.length === 0)) { seq.splice(this.i - 1, 1); this.i--; return; }
        // move into the template's last slot
        const order = RIGHT_ORDER[prev.k];
        const slot = order[order.length - 1];
        this.path.push({ node: prev, slot });
        this.i = prev.s[slot].length;
        this.undo.pop();
        return;
      }
      seq.splice(this.i - 1, 1);
      this.i--;
      return;
    }
    // at start of a slot: dissolve the template, keeping the contents
    if (this.path.length) {
      const { node } = this.path.pop();
      const parent = this.seq;
      const idx = parent.indexOf(node);
      const order = RIGHT_ORDER[node.k];
      const contents = [];
      for (const sl of [...order].sort((a, b) => a - b)) contents.push(...node.s[sl]);
      parent.splice(idx, 1, ...contents);
      this.i = idx;
    }
  }

  // ------------------------------------------------------------- movement
  enter(node, slot, atEnd) {
    this.path.push({ node, slot });
    this.i = atEnd ? node.s[slot].length : 0;
  }

  right() {
    const seq = this.seq;
    if (this.i < seq.length) {
      const it = seq[this.i];
      if (this.math && isTemplate(it)) { this.enter(it, RIGHT_ORDER[it.k][0], false); return true; }
      this.i++;
      return true;
    }
    if (!this.path.length) return false;
    const { node, slot } = this.path[this.path.length - 1];
    const order = RIGHT_ORDER[node.k];
    const pos = order.indexOf(slot);
    if (pos < order.length - 1) {
      this.path.pop();
      this.enter(node, order[pos + 1], false);
      return true;
    }
    this.exitRight();
    return true;
  }

  exitRight() {
    const { node } = this.path.pop();
    this.i = this.seq.indexOf(node) + 1;
  }

  exitLeft() {
    const { node } = this.path.pop();
    this.i = this.seq.indexOf(node);
  }

  left() {
    const seq = this.seq;
    if (this.i > 0) {
      const it = seq[this.i - 1];
      if (this.math && isTemplate(it)) {
        const order = RIGHT_ORDER[it.k];
        this.enter(it, order[order.length - 1], true);
        return true;
      }
      this.i--;
      return true;
    }
    if (!this.path.length) return false;
    const { node, slot } = this.path[this.path.length - 1];
    const order = RIGHT_ORDER[node.k];
    const pos = order.indexOf(slot);
    if (pos > 0) {
      this.path.pop();
      this.enter(node, order[pos - 1], true);
      return true;
    }
    this.exitLeft();
    return true;
  }

  vertical(dir) {
    for (let d = this.path.length - 1; d >= 0; d--) {
      const { node, slot } = this.path[d];
      const v = VERT[node.k] && VERT[node.k][slot] && VERT[node.k][slot][dir];
      if (v !== undefined) {
        this.path.length = d;
        this.enter(node, v, false);
        return true;
      }
    }
    return false;
  }

  up() { return this.vertical('up'); }
  down() { return this.vertical('down'); }

  // SHIFT ▶ / SHIFT ◀ inside a template: jump out of it
  jumpOutRight() { if (this.path.length) { this.exitRight(); return true; } return false; }
  jumpOutLeft() { if (this.path.length) { this.exitLeft(); return true; } return false; }

  home() { this.path = []; this.i = 0; }
  end() { this.path = []; this.i = this.root.length; }

  inTemplate() { return this.path.length > 0; }

  // flat list of all tokens (for LineI convert / tests)
  static flatten(seq) {
    const out = [];
    for (const it of seq) {
      if (it.k === 't') out.push(it.v);
      else out.push('[' + it.k + ':' + it.s.map((s) => Editor.flatten(s).join('')).join('|') + ']');
    }
    return out;
  }
  toString() { return Editor.flatten(this.root).join(''); }
}
