// Math layout for the LCD: lays out editor/result sequences (tokens + templates) as boxes and draws
// them.  Geometry measured from the official User's Guide screenshots (196×75 frames):
//  big cell 11×14, axis (fraction bar / minus sign row) = cell top + 7,
//  fraction: numerator box bottom = bar−2, denominator top = bar+2, bar = max width + 3,
//  superscript: small font, bottom of digits 4 rows below the base's cap top.
import { BIG, SMALL } from './fonts.js';
import { LCD, CELL } from './lcd.js';

// Display strings for tokens (big font)
export const TOKEN_TEXT = {
  '(-)': '-', 'x': '𝑥', 'y': '𝑦', 'z': '𝑧', '𝑒': '𝑒', 'nPr': 'P', 'nCr': 'C', 'Ran#': 'Ran#',
  '▫': '▫', '⁻¹': '⁻¹', '²': '²', '³': '³', 'ʳ': 'ʳ', 'ᵍ': 'ᵍ', ' ': '',
};
const SUPER_TOKENS = { '²': '2', '³': '3', '⁻¹': '-1', 'ʳ': 'r', 'ᵍ': 'g' };

export function tokenText(v) {
  if (v.startsWith('stat:')) return v.slice(5);
  if (v.startsWith('const:')) return v.slice(6);
  if (v in TOKEN_TEXT) return TOKEN_TEXT[v];
  return v;
}

// exponent font (bold 6×7, used after "×10" in results) — '1','2','3','-' measured, rest drawn
const EXPD = {
  '0': [' #### ', '######', '##  ##', '##  ##', '##  ##', '######', ' #### '],
  '1': ['  ##', '####', '####', '  ##', '  ##', '  ##', '  ##'],
  '2': ['##### ', '######', '    ##', '  ### ', ' ##   ', '######', '######'],
  '3': ['##### ', '######', '    ##', ' #### ', '    ##', '######', '##### '],
  '4': ['   ## ', '  ### ', ' #### ', '## ## ', '######', '   ## ', '   ## '],
  '5': ['######', '##    ', '##### ', '    ##', '    ##', '######', '##### '],
  '6': [' #### ', '##    ', '##### ', '######', '##  ##', '######', ' #### '],
  '7': ['######', '######', '    ##', '   ## ', '  ##  ', '  ##  ', '  ##  '],
  '8': [' #### ', '##  ##', ' #### ', '######', '##  ##', '######', ' #### '],
  '9': [' #### ', '######', '##  ##', '######', ' #####', '    ##', ' #### '],
  '-': ['#####', '#####'],
};
const X10_OUT = [
  '#    #            ',
  '##  ##   ##  ###  ',
  ' ####    ## ##### ',
  '  ##     ## ## ## ',
  ' ####    ## ## ## ',
  '##  ##   ## ##### ',
  '#    #   ##  ###  ',
];
const X10_IN = [
  '        ##  #### ',
  '       ### ######',
  '       ### ##  ##',
  '        ## ##  ##',
  '##  ##  ## ##  ##',
  ' ####   ## ##  ##',
  '  ##    ## ##  ##',
  ' ####   ## ######',
  '##  ##  ##  #### ',
];
const RADICAL = [ // 6 wide, top row = vinculum row; stretches in the vertical part (rows 1-6)
  '     #', '     #', '     #', '     #', '    # ', '    # ', '    # ', ' #  # ', '##  # ', '# # # ',
  '  # # ', '  ##  ', '  ##  ', '   #  ', '   #  ', '   #  ',
];
export const MORE_RIGHT_HOLLOW = ['##      ', '# ##    ', '#   ##  ', '#     ##', '#   ##  ', '# ##    ', '##      '];
export const MORE_LEFT_HOLLOW = ['      ##', '    ## #', '  ##   #', '##     #', '  ##   #', '    ## #', '      ##'];
export const MORE_RIGHT = ['##      ', '####    ', '######  ', '########', '######  ', '####    ', '##      '];
export const MORE_LEFT = ['      ##', '    ####', '  ######', '########', '  ######', '    ####', '      ##'];

const SMALL_H = 10;

function textW(s, size) {
  if (size === 'big') return Array.from(s).length * CELL;
  return LCD.smallWidth(s);
}

// ---------------------------------------------------------------- layout
// box: { w, asc, desc, draw(lcd, x, axis, st) }   asc/desc measured from the axis row
// st: { level, cursor:{seq,i}, curSeq, mark(seq,i,x,axis,size) }

function tokenBox(v, size) {
  const txt = tokenText(v);
  if (v === ' ') return { w: 4, asc: size === 'big' ? 7 : 4, desc: size === 'big' ? 6 : 5, draw() {} };
  if (size === 'big' && v in SUPER_TOKENS) {
    // postfix superscripts are drawn by the sequence layout (attached to the previous box)
    return null;
  }
  if (size === 'big') {
    return {
      w: LCD.bigWidth(txt), asc: 7, desc: 6,
      draw(lcd, x, axis, st) { lcd.bigText(txt, x, axis - 7, { level: st.level }); },
    };
  }
  const t = txt === '−' ? '−' : txt;
  return {
    w: LCD.smallWidth(t), asc: 4, desc: 5,
    draw(lcd, x, axis, st) { lcd.smallText(t, x, axis - 4, { level: st.level }); },
  };
}

function emptySlot(size) {
  if (size === 'big') {
    return {
      w: 11, asc: 7, desc: 6, empty: true,
      draw(lcd, x, axis, st) { lcd.rect(x + 1, axis - 5, 8, 11, st.slotLevel); },
    };
  }
  return { w: 6, asc: 4, desc: 5, empty: true, draw(lcd, x, axis, st) { lcd.rect(x, axis - 3, 5, 8, st.slotLevel); } };
}

// Lay out a sequence. Returns box; records cursor x positions via st during draw.
export function layoutSeq(seq, size, env) {
  const parts = []; // {box, idx}
  for (let i = 0; i < seq.length; i++) {
    const it = seq[i];
    let box;
    if (it.k === 't') {
      if (size === 'big' && it.v in SUPER_TOKENS) {
        box = supBox(SUPER_TOKENS[it.v], parts.length ? parts[parts.length - 1].box : null);
      } else box = tokenBox(it.v, size);
    } else if (it.k === 'pow') {
      box = powBox(it, parts.length ? parts[parts.length - 1].box : null, size, env);
    } else {
      box = templateBox(it, size, env);
    }
    parts.push({ box, item: it, idx: i });
  }
  // stretchy parentheses around content that is taller than one text line (natural display)
  if (size === 'big') {
    const stack = [];
    let changed = false;
    parts.forEach((p, k) => {
      if (p.item.k !== 't') return;
      if (p.item.v === '(') stack.push(k);
      else if (p.item.v === ')' && stack.length) {
        const o = stack.pop();
        let asc = 7, desc = 6;
        for (let q = o + 1; q < k; q++) { asc = Math.max(asc, parts[q].box.asc); desc = Math.max(desc, parts[q].box.desc); }
        if (asc > 7 || desc > 6) {
          const content = { asc: asc + 1, desc: desc + 1 };
          parts[o].box = parenBox('(', content, size);
          parts[k].box = parenBox(')', content, size);
          changed = true;
        }
      }
    });
    if (changed) {
      parts.forEach((p, k) => {
        if (k && p.item.k === 'pow') p.box = powBox(p.item, parts[k - 1].box, size, env);
        if (k && p.item.k === 't' && p.item.v in SUPER_TOKENS) p.box = supBox(SUPER_TOKENS[p.item.v], parts[k - 1].box);
      });
    }
  }
  if (!parts.length) {
    const e = env && env.noEmptyBox ? { w: 0, asc: size === 'big' ? 7 : 4, desc: size === 'big' ? 6 : 5, draw() {} } : emptySlot(size);
    return {
      ...e, seq,
      draw(lcd, x, axis, st) {
        const lv = st.curSeq === seq ? 3 : st.baseLevel;
        e.draw(lcd, x, axis, { ...st, slotLevel: lv, level: lv });
        if (st.cursor && st.cursor.seq === seq) st.mark(x + (e.w ? 1 : 0), axis, size, true);
      },
    };
  }
  let w = 0, asc = 0, desc = 0;
  for (const p of parts) { w += p.box.w; asc = Math.max(asc, p.box.asc); desc = Math.max(desc, p.box.desc); }
  return {
    w, asc, desc, seq,
    draw(lcd, x, axis, st) {
      const level = st.curSeq === seq || !st.curSeq ? 3 : st.baseLevel;
      let cx = x;
      parts.forEach((p, k) => {
        if (st.cursor && st.cursor.seq === seq && st.cursor.i === k) st.mark(cx, axis, size, false, k);
        p.box.draw(lcd, cx, axis, { ...st, level });
        cx += p.box.w;
      });
      if (st.cursor && st.cursor.seq === seq && st.cursor.i === parts.length) st.mark(cx, axis, size, false, parts.length);
    },
  };
}

function supBox(text, base) {
  // superscript text drawn small; exponent digits' bottom 4 rows below base cap top
  const baseAsc = base ? base.asc : 7;
  const w = LCD.smallWidth(text);
  const top = -baseAsc + 1 - 4; // relative to axis: small cell top (= ink top)
  return {
    w, asc: Math.max(-top + 1, 7), desc: 6,
    draw(lcd, x, axis, st) { lcd.smallText(text, x, axis + top, { level: st.level }); },
  };
}

function powBox(it, base, size, env) {
  const e = layoutSeq(it.s[0], 'small', env);
  const baseAsc = base ? base.asc : (size === 'big' ? 7 : 4);
  const capTop = -baseAsc + 1;              // relative to axis
  const eAxis = capTop + 5 - e.desc;         // exponent bottom at capTop+5
  return {
    w: e.w + 1, asc: Math.max(size === 'big' ? 7 : 4, -(eAxis - e.asc) + 1), desc: size === 'big' ? 6 : 5,
    draw(lcd, x, axis, st) { e.draw(lcd, x, axis + eAxis, st); },
  };
}

function hcenter(w, inner) { return Math.ceil((w - inner) / 2); }

function templateBox(it, size, env) {
  const s = it.s;
  const big = size === 'big';
  switch (it.k) {
    case 'frac': {
      const n = layoutSeq(s[0], size, env), d = layoutSeq(s[1], size, env);
      const bw = Math.max(n.w, d.w) + 3;
      return {
        w: bw + 1, asc: 2 + n.asc + n.desc, desc: 2 + d.asc + d.desc,
        draw(lcd, x, axis, st) {
          lcd.hline(x, axis, bw, st.level);
          n.draw(lcd, x + hcenter(bw, n.w), axis - 2 - n.desc, st);
          d.draw(lcd, x + hcenter(bw, d.w), axis + 2 + d.asc, st);
        },
      };
    }
    case 'mixed': {
      const ip = layoutSeq(s[0], size, env);
      const f = templateBox({ k: 'frac', s: [s[1], s[2]] }, size, env);
      const lead = big ? 2 : 0;
      return {
        w: lead + ip.w + f.w, asc: Math.max(ip.asc, f.asc), desc: Math.max(ip.desc, f.desc),
        draw(lcd, x, axis, st) { ip.draw(lcd, x + lead, axis, st); f.draw(lcd, x + lead + ip.w, axis, st); },
      };
    }
    case 'sqrt': return sqrtBox(layoutSeq(s[0], size, env), null, size);
    case 'root': return sqrtBox(layoutSeq(s[1], size, env), layoutSeq(s[0], 'small', env), size);
    case 'abs': {
      const a = layoutSeq(s[0], size, env);
      return {
        w: a.w + 8, asc: a.asc + 1, desc: a.desc + 1,
        draw(lcd, x, axis, st) {
          lcd.fill(x + 2, axis - a.asc, 2, a.asc + a.desc + 1, st.level);
          a.draw(lcd, x + 4, axis, st);
          lcd.fill(x + 4 + a.w + 1, axis - a.asc, 2, a.asc + a.desc + 1, st.level);
        },
      };
    }
    case 'logb': {
      const b = layoutSeq(s[0], 'small', env), a = layoutSeq(s[1], size, env);
      const lw = big ? 33 : textW('log', 'small');
      const parenL = parenBox('(', a, size), parenR = parenBox(')', a, size);
      const subTop = 3; // subscript top relative to axis
      return {
        w: lw + b.w + parenL.w + a.w + parenR.w, asc: Math.max(a.asc, 7), desc: Math.max(a.desc, subTop + b.asc + b.desc),
        draw(lcd, x, axis, st) {
          if (big) lcd.bigText('log', x, axis - 7, { level: st.level }); else lcd.smallText('log', x, axis - 4, { level: st.level });
          b.draw(lcd, x + lw, axis + subTop + b.asc, st);
          let cx = x + lw + b.w;
          parenL.draw(lcd, cx, axis, st); cx += parenL.w;
          a.draw(lcd, cx, axis, st); cx += a.w;
          parenR.draw(lcd, cx, axis, st);
        },
      };
    }
    case 'sci': case 'exp10': {
      const e = layoutSeq(s[0], 'small', env);
      if (it.k === 'exp10') return exp10Box(s[0]);
      // input template: small "×10" then superscript exponent
      return {
        w: 17 + e.w + 1, asc: 7 + 4, desc: 6,
        draw(lcd, x, axis, st) {
          lcd.bitmap(X10_IN, x, axis - 2, { level: st.level });
          e.draw(lcd, x + 17, axis - 6 + 5 - e.desc, st);
        },
      };
    }
    case 'rec': {
      const a = layoutSeq(s[0], size, env);
      return {
        w: a.w, asc: Math.max(a.asc, 9), desc: a.desc,
        draw(lcd, x, axis, st) {
          a.draw(lcd, x, axis, st);
          const n = s[0].length;
          if (n) {
            const dot = (cx) => lcd.fill(cx, axis - 9, 2, 2, st.level);
            dot(x + 4);
            if (n > 1) dot(x + (n - 1) * CELL + 4);
          } else lcd.rect(x + 1, axis - 5, 8, 11, st.level);
        },
      };
    }
    case 'ddx': {
      const f = layoutSeq(s[0], size, env), a = layoutSeq(s[1], 'small', env);
      const pl = parenBox('(', f, size), pr = parenBox(')', f, size);
      const dw = 22;
      return {
        w: dw + pl.w + f.w + pr.w + 3 + 12 + a.w, asc: Math.max(15, f.asc), desc: Math.max(15, f.desc + 2, a.desc + 9),
        draw(lcd, x, axis, st) {
          lcd.bigText('d', x + 5, axis - 15, { level: st.level });
          lcd.hline(x, axis, dw - 1, st.level);
          lcd.bigText('d𝑥', x, axis + 2, { level: st.level });
          let cx = x + dw;
          pl.draw(lcd, cx, axis, st); cx += pl.w;
          f.draw(lcd, cx, axis, st); cx += f.w;
          pr.draw(lcd, cx, axis, st); cx += pr.w;
          lcd.vline(cx + 1, axis - f.asc, f.asc + f.desc + 3, st.level);
          lcd.smallText('𝑥=', cx + 3, axis + 4, { level: st.level });
          a.draw(lcd, cx + 3 + 12, axis + 4 + a.asc, st);
        },
      };
    }
    case 'int': case 'sum': {
      const f = layoutSeq(s[0], size, env), lo = layoutSeq(s[1], 'small', env), hi = layoutSeq(s[2], 'small', env);
      const isInt = it.k === 'int';
      const loW = isInt ? lo.w : lo.w + 12;
      const symW = Math.max(isInt ? 8 : 11, loW, hi.w) + 1;
      const pl = isInt ? null : parenBox('(', f, size), pr = isInt ? null : parenBox(')', f, size);
      const tail = isInt ? 23 : 0;
      return {
        w: symW + (pl ? pl.w : 0) + f.w + (pr ? pr.w : 0) + tail,
        asc: Math.max(f.asc, 9 + hi.asc + hi.desc), desc: Math.max(f.desc, 8 + lo.asc + lo.desc),
        draw(lcd, x, axis, st) {
          if (isInt) {
            lcd.bitmap(BIG['∫'], x - 1, axis - 7, { level: st.level });
          } else lcd.bitmap(BIG['Σ'], x, axis - 7, { level: st.level });
          hi.draw(lcd, x + (isInt ? 7 : hcenter(symW, hi.w)), axis - 8 - hi.desc, st);
          if (!isInt) lcd.smallText('𝑥=', x + hcenter(symW, loW), axis + 7, { level: st.level });
          lo.draw(lcd, x + (isInt ? 2 : hcenter(symW, loW) + 12), axis + 7 + lo.asc, st);
          let cx = x + symW;
          if (pl) { pl.draw(lcd, cx, axis, st); cx += pl.w; }
          f.draw(lcd, cx, axis, st); cx += f.w;
          if (pr) { pr.draw(lcd, cx, axis, st); cx += pr.w; }
          if (isInt) lcd.bigText('d𝑥', cx + 1, axis - 7, { level: st.level });
        },
      };
    }
    default:
      return tokenBox('?', size);
  }
}

function sqrtBox(a, idx, size) {
  const big = size === 'big';
  // big: [2 px margin][6 px radical][2 px gap][argument][4 px]; vinculum from the radical top to arg end+1
  const iw = idx ? idx.w : 0;
  const lead = big ? 2 : 0, rw = big ? 6 : 4, gap = big ? 2 : 1, trail = big ? 4 : 1;
  // the index (small font) is centred vertically on the vinculum row
  return {
    w: iw + lead + rw + gap + a.w + trail,
    asc: a.asc + 3 + (idx ? idx.asc : 0), desc: a.desc,
    draw(lcd, x, axis, st) {
      const top = axis - a.asc - 2;          // vinculum row
      const bottom = axis + a.desc;          // last radical row
      const rx = x + lead + iw;
      if (big) {
        const fixed = RADICAL.slice(4);      // lower 12 rows keep their shape
        const upper = bottom - top + 1 - fixed.length;
        for (let r = 0; r < upper; r++) lcd.set(rx + 5, top + r, st.level);
        lcd.bitmap(fixed, rx, top + upper, { level: st.level });
        lcd.hline(rx + 5, top, rw - 5 + gap + a.w + 1, st.level);
      } else {
        lcd.vline(rx + 3, top, bottom - top - 1, st.level);
        lcd.set(rx + 2, bottom - 1, st.level); lcd.set(rx + 2, bottom, st.level);
        lcd.set(rx, bottom - 3, st.level); lcd.set(rx + 1, bottom - 2, st.level);
        lcd.hline(rx + 3, top, gap + a.w + 1, st.level);
      }
      if (idx) idx.draw(lcd, x + lead, top, st);
      a.draw(lcd, rx + rw + gap, axis, st);
    },
  };
}

// Parenthesis sized to the content box (stretchy when content is taller than one line)
export function parenBox(ch, content, size) {
  const big = size === 'big';
  if (!big || (content.asc <= 7 && content.desc <= 6)) {
    return big
      ? { w: CELL, asc: 7, desc: 6, draw(lcd, x, axis, st) { lcd.bigText(ch, x, axis - 7, { level: st.level }); } }
      : { w: 4, asc: 4, desc: 5, draw(lcd, x, axis, st) { lcd.smallText(ch, x, axis - 4, { level: st.level }); } };
  }
  const top = -content.asc + 1, bot = content.desc - 1;
  return {
    w: CELL, asc: content.asc, desc: content.desc,
    draw(lcd, x, axis, st) {
      const y0 = axis + top, y1 = axis + bot, H = y1 - y0 + 1;
      for (let r = 0; r < H; r++) {
        const fromEdge = Math.min(r, H - 1 - r);
        const off = fromEdge === 0 ? 3 : fromEdge === 1 ? 2 : fromEdge <= 3 ? 1 : 0;
        const xx = ch === '(' ? x + 3 + off : x + 6 - off;
        lcd.fill(xx, y0 + r, 2, 1, st.level);
      }
    },
  };
}

function exp10Box(expSeq) {
  const s = expSeq.map((t) => t.v).join('');
  let w = 18;
  for (const ch of s) w += ch === '-' ? 8 : (EXPD[ch][0].length + 1);
  return {
    w: w - 1, asc: 7, desc: 6,
    draw(lcd, x, axis, st) {
      lcd.bitmap(X10_OUT, x, axis - 1, { level: st.level });
      let cx = x + 15;
      for (const ch of s) {
        if (ch === '-') { lcd.bitmap(EXPD['-'], cx, axis - 4, { level: st.level }); cx += 8; }
        else { lcd.bitmap(EXPD[ch], cx, axis - 6, { level: st.level }); cx += EXPD[ch][0].length + 1; }
      }
    },
  };
}

// ---------------------------------------------------------------- top-level helpers
// Re-flow a sequence so that a parenthesised group that contains tall content gets stretchy parens.
// (layoutSeq draws plain parens; for natural display we group '(' … ')' into a pseudo template.)
export function groupParens(seq) {
  const out = [];
  const stack = [];
  let cur = out;
  for (const it of seq) {
    if (it.k === 't' && it.v === '(' ) {
      const g = { k: 'pgroup', open: it, s: [[]] };
      cur.push(g);
      stack.push(cur);
      cur = g.s[0];
    } else if (it.k === 't' && it.v === ')' && stack.length) {
      const parent = stack.pop();
      parent[parent.length - 1].close = it;
      cur = parent;
    } else cur.push(it);
  }
  return out;
}

// Draw an input editor. Returns {w, asc, desc, cursorX}.
// opts: { x, axis, editor, cursorVisible, scrollX, clipX0, clipX1 }
export function drawEditor(lcd, editor, opts) {
  const size = 'big';
  const box = layoutSeq(editor.root, size, { noEmptyBox: true });
  const curSeq = editor.seq;
  let cursorPos = null;
  const st = {
    level: 3, baseLevel: editor.inTemplate() ? 2 : 3, slotLevel: 3,
    curSeq: editor.inTemplate() ? curSeq : null,
    cursor: { seq: curSeq, i: editor.i },
    mark: (x, axis, sz) => { cursorPos = { x, axis, size: sz }; },
  };
  return { box, st, getCursor: () => cursorPos };
}

export function drawCursor(lcd, pos, mode = 'insert', limit = false) {
  if (!pos) return;
  if (pos.size === 'big') {
    if (limit) { lcd.fill(pos.x, pos.axis - 6, 11, 11, 3); return; }
    if (mode === 'overwrite') { lcd.fill(pos.x + 1, pos.axis + 6, 8, 1, 3); return; }
    lcd.fill(pos.x, pos.axis - 6, 3, 13, 3);
  } else {
    lcd.fill(pos.x, pos.axis - 4, 1, 9, 3);
  }
}

export { EXPD, X10_OUT, X10_IN };
