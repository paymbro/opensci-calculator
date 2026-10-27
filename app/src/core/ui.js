// Shared LCD user-interface pieces: status bar, menus (option numbers, radio buttons, ▶ submenu
// marks, scroll bar), simple message/dialog screens.  Geometry from the User's Guide screenshots:
// menu lines are 16 px apart starting at y=11, the highlight bar spans x=2…189 and 15 rows,
// option-number icons sit at x=4…12, radio buttons at x=13, text at x=14 (or 24 after a radio).
import { BIG } from './fonts.js';
import { LCD } from './lcd.js';

export const LINE_TOP = (i) => 11 + 16 * i;

// 5×7 white digits drawn inside the 9×9 black option circles
const OPT_DIGIT = {
  1: ['  #  ', ' ##  ', '  #  ', '  #  ', '  #  ', '  #  ', '  #  '],
  2: [' ### ', '#   #', '    #', '   # ', '  #  ', ' #   ', '#####'],
  3: [' ### ', '#   #', '    #', '  ## ', '    #', '#   #', ' ### '],
  4: ['   # ', '  ## ', ' # # ', ' # # ', '#  # ', '#####', '   # '],
  5: ['#####', '#    ', '#### ', '    #', '    #', '#   #', ' ### '],
  6: [' ### ', '#    ', '#### ', '#   #', '#   #', '#   #', ' ### '],
  7: ['#####', '    #', '   # ', '   # ', '  #  ', '  #  ', '  #  '],
  8: [' ### ', '#   #', '#   #', ' ### ', '#   #', '#   #', ' ### '],
  9: [' ### ', '#   #', '#   #', ' ####', '    #', '   # ', ' ##  '],
  0: [' ### ', '#   #', '#   #', '#   #', '#   #', '#   #', ' ### '],
  '+': ['     ', '  #  ', '  #  ', '#####', '  #  ', '  #  ', '     '],
  '−': ['     ', '     ', '     ', '#####', '     ', '     ', '     '],
  '×': ['     ', '#   #', ' # # ', '  #  ', ' # # ', '#   #', '     '],
  '÷': ['     ', '  #  ', '     ', '#####', '     ', '  #  ', '     '],
  '▶': ['     ', ' #   ', ' ##  ', ' ### ', ' ##  ', ' #   ', '     '],
  '?': ['     ', '     ', '     ', '     ', '     ', '     ', '     '],
};
const CIRCLE = ['  #####  ', ' ####### ', '#########', '#########', '#########', '#########', '#########', ' ####### ', '  #####  '];

export function drawOptionIcon(lcd, key, x, y, level = 3) {
  lcd.bitmap(CIRCLE, x, y, { level });
  const d = OPT_DIGIT[key] || OPT_DIGIT['?'];
  d.forEach((row, r) => { for (let c = 0; c < 5; c++) if (row[c] === '#') lcd.set(x + 2 + c, y + 1 + r, 0); });
}

export const OPTION_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '+', '−', '×', '÷'];
const KEY_FOR_OPTION = { D1: '1', D2: '2', D3: '3', D4: '4', D5: '5', D6: '6', D7: '7', D8: '8', D9: '9', D0: '0', ADD: '+', SUB: '−', MUL: '×', DIV: '÷' };
export function optionIndexForKey(k) {
  const o = KEY_FOR_OPTION[k];
  return o === undefined ? -1 : OPTION_KEYS.indexOf(o);
}

// submenu mark: grey triangle 8×7 at x=180 (measured from the manual's menu screenshots)
export const ARROW = ['##      ', '####    ', '######  ', '########', '######  ', '####    ', '##      '];

// ---------------------------------------------------------------- status bar
// state: { shift, mathI, angle, fix, sci, cplx ('i'|'∠'|null), up, down }
// Every indicator is drawn; the ones not currently active go to the ghost layer so they appear
// faintly greyed out (requested look), active ones are drawn normally.
export function drawStatus(lcd, s) {
  const ind = (on, draw) => { if (on) draw(); else lcd.ghostly(draw); };
  ind(s.shift, () => {
    lcd.fill(3, 2, 6, 7, 3);
    if (!lcd.ghostMode) lcd.bitmap(['    ', ' ## ', '#   ', ' ## ', '   #', '##  '].map((r) => r.padEnd(4)), 4, 2, { inv: true });
  });
  ind(s.mathI, () => lcd.icon('mathI', 25, 2));
  ind(s.angle === 'deg', () => lcd.icon('angleD', 43, 2));
  ind(s.angle === 'rad', () => lcd.icon('angleR', 51, 2));
  ind(s.angle === 'grad', () => {
    lcd.rect(59, 2, 6, 7, 3);
    lcd.bitmap(['    ', ' ## ', '#   ', '# ##', '#  #', ' ## '].map((r) => ' ' + r), 59, 2);
  });
  ind(s.fix, () => lcd.icon('FIX', 69, 2));
  ind(s.sci, () => lcd.icon('SCI', 83, 2));
  ind(s.cplx === 'i', () => lcd.icon('cplxI', 107, 2));
  ind(s.cplx === '∠', () => lcd.icon('cplxPolar', 113, 2));
  ind(s.down, () => lcd.icon('down', 150, 2));
  ind(s.up, () => lcd.icon('up', 158, 2));
}

// ---------------------------------------------------------------- menu
// item: { label, sub?:true, radio?:bool(selected), disabled?, opt? (explicit option key), lock? }
export class Menu {
  constructor({ title = null, items, onSelect, onBack, rows = 4, showOptions = true, sel = 0, twoColumn = false }) {
    this.title = title;
    this.items = items;
    this.onSelect = onSelect;
    this.onBack = onBack;
    this.rows = title ? rows - 1 : rows;
    this.sel = Math.min(sel, items.length - 1);
    this.top = 0;
    this.showOptions = showOptions;
    this.twoColumn = twoColumn;
    if (twoColumn) this.rows = 5;
    this.ensureVisible();
  }

  ensureVisible() {
    if (this.twoColumn) {
      const r = Math.floor(this.sel / 2);
      if (r < this.top) this.top = r;
      if (r >= this.top + this.rows) this.top = r - this.rows + 1;
      return;
    }
    if (this.sel < this.top) this.top = this.sel;
    if (this.sel >= this.top + this.rows) this.top = this.sel - this.rows + 1;
  }

  // returns true if handled
  key(k) {
    const n = this.items.length;
    if (this.twoColumn) {
      const s = this.sel;
      if (k === 'UP') { this.sel = s >= 2 ? s - 2 : s; this.ensureVisible(); return true; }
      if (k === 'DOWN') { if (s + 2 < n) this.sel = s + 2; else if (s % 2 === 0 && s + 1 < n) this.sel = s + 1; this.ensureVisible(); return true; }
      if (k === 'RIGHT') { if (s % 2 === 0 && s + 1 < n) this.sel = s + 1; return true; }
      if (k === 'LEFT') { if (s % 2 === 1) { this.sel = s - 1; return true; } if (this.onBack) this.onBack(); return true; }
      if (k === 'PGUP') { this.sel = Math.max(s % 2, s - 2 * this.rows); this.top = Math.max(0, this.top - this.rows); this.ensureVisible(); return true; }
      if (k === 'PGDN') { const last = Math.ceil(n / 2) - 1; this.sel = Math.min(n - 1, s + 2 * this.rows); this.top = Math.min(Math.max(0, last - this.rows + 1), this.top + this.rows); this.ensureVisible(); return true; }
    }
    switch (k) {
      case 'UP': this.sel = (this.sel - 1 + n) % n; this.ensureVisible(); return true;
      case 'DOWN': this.sel = (this.sel + 1) % n; this.ensureVisible(); return true;
      case 'PGUP': this.sel = Math.max(0, this.sel - this.rows); this.top = Math.max(0, this.top - this.rows); this.ensureVisible(); return true;
      case 'PGDN': this.sel = Math.min(n - 1, this.sel + this.rows); this.top = Math.min(Math.max(0, n - this.rows), this.top + this.rows); this.ensureVisible(); return true;
      case 'OK': case 'EXE': this.onSelect(this.items[this.sel], this.sel); return true;
      case 'RIGHT':
        if (this.items[this.sel].sub) { this.onSelect(this.items[this.sel], this.sel); return true; }
        return true;
      case 'BACK': case 'LEFT': if (this.onBack) { this.onBack(); return true; } return k === 'LEFT';
      default: {
        const idx = optionIndexForKey(k);
        if (idx >= 0 && idx < n) { this.sel = idx; this.ensureVisible(); this.onSelect(this.items[idx], idx); return true; }
      }
    }
    return false;
  }

  // Sci Constants / Unit Conversions: two columns of small-font items, 5 rows 12 px apart
  // (User's Guide p.68-69: icon at x=3 / 99, text at x=14 / 110, highlight 91×11 from y=13)
  renderTwoColumn(lcd) {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < 2; c++) {
        const idx = (this.top + r) * 2 + c;
        if (idx >= this.items.length) break;
        const it = this.items[idx];
        const x = 3 + 96 * c, y = 14 + 12 * r;
        let tx = x + 11;
        if (this.showOptions && idx < OPTION_KEYS.length) drawOptionIcon(lcd, OPTION_KEYS[idx], x, y);
        else tx = x;
        lcd.smallText(it.label, tx, y);
        if (idx === this.sel) lcd.invert(x - 1, y - 1, 91, 11);
      }
    }
    const lines = Math.ceil(this.items.length / 2);
    if (lines > this.rows) drawScrollBar(lcd, this.top, this.rows, lines, 11);
  }

  render(lcd) {
    if (this.twoColumn) { this.renderTwoColumn(lcd); return; }
    let line = 0;
    if (this.title) {
      lcd.bigText(this.title, 3, LINE_TOP(0));
      line = 1;
    }
    for (let r = 0; r < this.rows; r++) {
      const idx = this.top + r;
      if (idx >= this.items.length) break;
      const it = this.items[idx];
      const top = LINE_TOP(line + r);
      const hl = idx === this.sel;
      let x = 3;
      if (this.showOptions && !it.noOpt) {
        drawOptionIcon(lcd, it.opt || OPTION_KEYS[idx], 4, top + 3);
        x = 13;
      }
      if (it.radio !== undefined) {
        lcd.bitmap(BIG[it.radio ? '◉' : '○'], x + 1, top);
        x += 12;
      } else if (x === 13) x = 14;
      const maxChars = Math.floor(((it.sub ? 182 : 190) - x) / 11);
      let label = it.label;
      if (Array.from(label).length > maxChars) label = Array.from(label).slice(0, maxChars - 1).join('') + '…';
      lcd.bigText(label, x, top, { level: it.disabled ? 2 : 3 });
      if (it.value !== undefined) {
        const v = String(it.value);
        lcd.bigText(v, 190 - LCD.bigWidth(v), top);
      }
      if (it.sub) lcd.bitmap(ARROW, 180, top + 4, { level: 2 });
      if (hl) lcd.invert(2, top, 188, 15);
      if (it.lock) lcd.fill(182, top + 3, 6, 8, hl ? 0 : 3);
    }
    if (this.items.length > this.rows) drawScrollBar(lcd, this.top, this.rows, this.items.length, this.title ? LINE_TOP(1) : 11);
  }
}

export function drawScrollBar(lcd, top, visible, total, y0 = 11, y1 = 74) {
  const h = y1 - y0 + 1;
  const len = Math.max(4, Math.round((h * visible) / total));
  const pos = total > visible ? Math.round(((h - len) * top) / (total - visible)) : 0;
  lcd.fill(192, y0 + pos, 2, len, 2);
}

// ---------------------------------------------------------------- simple screens
export class MessageScreen {
  constructor(lines, onKey) { this.lines = lines; this.onKey = onKey; }
  key(k) { return this.onKey ? this.onKey(k) : false; }
  render(lcd) { this.lines.forEach((l, i) => lcd.bigText(l, 3, LINE_TOP(i))); }
}

// Error screen: "Math ERROR" + grey warning icon (read from p.155) + highlighted [Back]
export const WARNING_ICON = [
  "         ####",
  "        ######",
  "        ##..##",
  "       ##....##",
  "       ##....##",
  "      ##......##",
  "      ##..##..##",
  "     ##...##...##",
  "     ##...##...##",
  "    ##....##....##",
  "    ##....##....##",
  "   ##.....##.....##",
  "   ##.....##.....##",
  "  ##......##......##",
  "  ##..............##",
  " ##.......##.......##",
  " ##.......##.......##",
  "##..................##",
  "###................###",
  " ####################",
  "  ##################",
];
export function drawError(lcd, kind) {
  const title = /ERROR$/.test(kind) || ['Time Out', 'Cannot Solve', 'Not Defined', 'Range ERROR', 'No Solution'].includes(kind) ? kind : kind + ' ERROR';
  lcd.bigText(title, 3, LINE_TOP(0));
  lcd.bitmap(WARNING_ICON, 87, 31);
  lcd.bigText('Back', 3, LINE_TOP(3));
  lcd.invert(2, LINE_TOP(3), 188, 15);
}
