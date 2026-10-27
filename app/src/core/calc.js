// The calculator machine: power, SHIFT, key routing, global menus (SETTINGS, CATALOG, TOOLS,
// VARIABLE, FUNCTION, FORMAT), HOME screen, memory and settings.
import { LCD } from './lcd.js';
import { SHIFTED } from './keys.js';
import { Menu, LINE_TOP, drawStatus, drawOptionIcon, optionIndexForKey, OPTION_KEYS } from './ui.js';
import { DEFAULT_SETTINGS } from './format.js';
import { Real, Decimal } from './num.js';
import { Cx } from './eval.js';
import { Editor } from './expr.js';
import { inputKey } from './input.js';
import { catalogList } from './catalog.js';
import { ICONS } from './icons.js';
import { BIG } from './fonts.js';

export const APPS = [
  { id: 'Calculate', icon: 'app_Calculate', opt: '1' },
  { id: 'Statistics', icon: 'app_Statistics', opt: '2' },
  { id: 'Table', icon: 'app_Table', opt: '3' },
  { id: 'Equation', icon: 'app_Equation', opt: '4', dy: 1 },
  { id: 'Inequality', icon: 'app_Inequality', opt: '5', dy: 1 },
  { id: 'Distribution', icon: 'app_Distribution', opt: '6' },
  { id: 'Complex', icon: 'app_Complex', opt: '7' },
  { id: 'Matrix', icon: 'app_Matrix', opt: '8' },
  { id: 'Vector', icon: 'app_Vector', opt: '9' },
  { id: 'Spreadsheet', icon: 'app_Spreadsheet', opt: '0' },
  { id: 'Ratio', icon: 'app_Ratio', opt: '+' },
  { id: 'MathBox', icon: 'app_MathBox', opt: '−' },
  { id: 'BaseN', icon: 'app_BaseN', opt: '×' },
];

const VAR_NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'x', 'y', 'z'];

export function freshMemory() {
  const vars = {};
  for (const v of VAR_NAMES) vars[v] = Real.int(0);
  return { ans: Real.int(0), vars, funcs: { f: [], g: [] }, mvars: {}, appState: {} };
}

// ---------------------------------------------------------------- serialization helpers
export function serReal(v) {
  if (v instanceof Cx) return { cx: [serReal(v.re), serReal(v.im)] };
  if (v instanceof Real) return { d: v.dec.toString(), e: v.ex ? v.ex.map((t) => [t.n.toString(), t.d.toString(), t.r.toString(), t.p]) : null };
  if (v && v.type === 'mat') return { mat: v.a.map((r) => r.map(serReal)), r: v.r, c: v.c };
  if (v && v.type === 'vec') return { vec: v.a.map(serReal) };
  return null;
}
export function deserReal(o) {
  if (!o) return Real.int(0);
  if (o.cx) return new Cx(deserReal(o.cx[0]), deserReal(o.cx[1]));
  if (o.mat) return { type: 'mat', r: o.r, c: o.c, a: o.mat.map((r) => r.map(deserReal)) };
  if (o.vec) return { type: 'vec', a: o.vec.map(deserReal) };
  return new Real(new Decimal(o.d), o.e ? o.e.map(([n, d, r, p]) => ({ n: BigInt(n), d: BigInt(d), r: BigInt(r), p })) : null);
}

export class Calculator {
  constructor({ storage = null, apps = {} } = {}) {
    this.lcd = new LCD();
    this.storage = storage;
    this.appFactories = apps;
    this.settings = { ...DEFAULT_SETTINGS, numFormat: { ...DEFAULT_SETTINGS.numFormat } };
    this.mem = freshMemory();
    this.on = true;
    this.shift = false;
    this.overlays = [];
    this.load();
    this.homeSel = 0;
    this.openApp('Calculate');
    this.showHome = false;
    this.blink = true;
  }

  // ------------------------------------------------------------ persistence
  load() {
    if (!this.storage) return;
    try {
      const s = this.storage.get('settings');
      if (s) Object.assign(this.settings, s);
      const m = this.storage.get('memory');
      if (m) {
        this.mem.ans = deserReal(m.ans);
        for (const v of VAR_NAMES) if (m.vars && m.vars[v]) this.mem.vars[v] = deserReal(m.vars[v]);
        if (m.funcs) this.mem.funcs = m.funcs;
        if (m.mvars) for (const k of Object.keys(m.mvars)) this.mem.mvars[k] = deserReal(m.mvars[k]);
        if (m.appState) this.mem.appState = m.appState;
      }
    } catch (e) { /* corrupted storage: start fresh */ }
  }

  save() {
    if (!this.storage) return;
    const vars = {};
    for (const v of VAR_NAMES) vars[v] = serReal(this.mem.vars[v]);
    const mvars = {};
    for (const k of Object.keys(this.mem.mvars)) mvars[k] = serReal(this.mem.mvars[k]);
    this.storage.set('settings', this.settings);
    this.storage.set('memory', { ans: serReal(this.mem.ans), vars, funcs: this.mem.funcs, mvars, appState: this.mem.appState });
  }

  // ------------------------------------------------------------ apps
  openApp(id) {
    const f = this.appFactories[id];
    this.appId = id;
    this.app = f ? f(this) : null;
    this.overlays = [];
    this.showHome = false;
    if (this.app && this.app.start) this.app.start();
  }

  get math() { return this.settings.io.startsWith('MathI'); }

  newEditor() { return new Editor({ math: this.math }); }

  push(screen) { this.overlays.push(screen); }
  pop() { return this.overlays.pop(); }
  closeGroup(g) { while (this.overlays.length && this.overlays[this.overlays.length - 1].group === g) this.overlays.pop(); }
  closeAll() { this.overlays = []; }
  top() { return this.overlays[this.overlays.length - 1]; }

  // ------------------------------------------------------------ keys
  press(k) {
    if (!this.on) {
      if (k === 'ON') { this.on = true; this.powerOn(); }
      return;
    }
    if (k === 'SHIFT') { this.shift = !this.shift; return; }
    let eff = k;
    if (this.shift) { eff = SHIFTED[k] || k; this.shift = false; }
    try {
      this.dispatch(eff);
    } finally {
      this.save();
    }
  }

  powerOn() {
    this.overlays = [];
    if (this.app && this.app.powerOn) this.app.powerOn();
  }

  dispatch(k) {
    if (k === 'OFF') { this.on = false; this.overlays = []; if (this.app && this.app.off) this.app.off(); return; }
    if (k === 'ON') {
      // restarts the current app (clears history, spreadsheet input, f(x)/g(x) definitions)
      this.mem.funcs = { f: [], g: [] };
      this.openApp(this.appId);
      return;
    }
    if (this.showHome) { this.homeKey(k); return; }
    if (k === 'HOME') { this.overlays = []; this.showHome = true; this.homeSel = APPS.findIndex((a) => a.id === this.appId); return; }
    const top = this.top();
    if (top) {
      const handled = top.key(k);
      if (!handled && k === 'AC' && top.acCloses !== false) { this.closeGroup(top.group); }
      return;
    }
    if (!this.app) return;
    this.app.key(k);
  }

  // ------------------------------------------------------------ HOME screen
  homeKey(k) {
    const n = APPS.length;
    const sel = this.homeSel;
    switch (k) {
      case 'LEFT': this.homeSel = (sel - 1 + n) % n; return;
      case 'RIGHT': this.homeSel = (sel + 1) % n; return;
      case 'UP': this.homeSel = sel - 3 >= 0 ? sel - 3 : sel; return;
      case 'DOWN': this.homeSel = sel + 3 < n ? sel + 3 : (Math.floor(sel / 3) < Math.floor((n - 1) / 3) ? n - 1 : sel); return;
      case 'PGUP': this.homeSel = Math.max(0, sel - 6); return;
      case 'PGDN': this.homeSel = Math.min(n - 1, sel + 6); return;
      case 'OK': case 'EXE': this.openApp(APPS[sel].id); return;
      case 'SETTINGS': this.showHome = false; this.push(getStartedScreen(this, () => { this.pop(); this.showHome = true; })); return;
      case 'BACK': case 'HOME': this.showHome = false; return;
      default: {
        const idx = optionIndexForKey(k);
        if (idx >= 0 && idx < n && OPTION_KEYS[idx] === APPS[idx].opt) { this.openApp(APPS[idx].id); }
      }
    }
  }

  renderHome(lcd) {
    const sel = this.homeSel;
    const firstRow = Math.max(0, Math.min(Math.floor(sel / 3), Math.ceil(APPS.length / 3) - 2));
    const top = Math.floor(sel / 3) <= this.homeTopRow ? this.homeTopRow : null;
    let row0 = this.homeTopRow ?? 0;
    const selRow = Math.floor(sel / 3);
    if (selRow < row0) row0 = selRow;
    if (selRow > row0 + 1) row0 = selRow - 1;
    this.homeTopRow = row0;
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        const idx = (row0 + r) * 3 + c;
        if (idx >= APPS.length) continue;
        const app = APPS[idx];
        const x = 5 + 64 * c, y = 10 + 32 * r + (app.dy || 0);
        lcd.icon(app.icon, x, y);
        if (idx === sel) {
          const bx = 2 + 64 * c, by = 11 + 32 * r;
          lcd.invert(bx, by, 60, 31);
          // rounded corners
          for (const [cx, cy] of [[bx, by], [bx + 59, by], [bx, by + 30], [bx + 59, by + 30]]) lcd.set(cx, cy, 0);
        }
      }
    }
    // scroll bar
    const rows = Math.ceil(APPS.length / 3);
    const h = 64, len = Math.floor((h * 2) / rows);
    const pos = Math.round(((h - len) * row0) / (rows - 2));
    lcd.fill(192, 11 + pos, 2, len, 2);
    void firstRow; void top;
  }

  // ------------------------------------------------------------ render
  render() {
    const lcd = this.lcd;
    lcd.clear();
    if (!this.on) return lcd;
    if (this.showHome) { this.renderHome(lcd); drawStatus(lcd, { shift: this.shift }); return lcd; }
    const top = this.top();
    const screen = top && top.full !== false ? top : this.app;
    if (!screen) return lcd;
    const st = screen.status ? screen.status() : null;
    screen.render(lcd, this.blink);
    drawStatus(lcd, { ...(st || {}), shift: this.shift });
    return lcd;
  }

  // ------------------------------------------------------------ common menus
  settingsMenu(onClose) { return settingsMenuScreen(this, onClose); }
}

// ================================================================ menu screens
export class MenuScreen {
  constructor(calc, opts) {
    this.calc = calc;
    this.group = opts.group || 'menu';
    this.menu = new Menu({ ...opts, showOptions: calc.settings.showOptionNum && opts.showOptions !== false, onBack: opts.onBack || (() => calc.pop()) });
    this.statusFn = opts.status;
    this.acCloses = opts.acCloses;
    this.extraKey = opts.extraKey;
  }
  key(k) {
    if (this.extraKey && this.extraKey(k)) return true;
    return this.menu.key(k);
  }
  render(lcd) { this.menu.render(lcd); }
  status() { return this.statusFn ? this.statusFn() : null; }
}

function radioMenu(calc, title, options, current, apply, group) {
  return new MenuScreen(calc, {
    group, title,
    items: options.map(([label, val]) => ({ label, radio: val === current })),
    sel: Math.max(0, options.findIndex(([, v]) => v === current)),
    onSelect: (it, i) => { apply(options[i][1]); calc.pop(); },
  });
}

export function settingsMenuScreen(calc, onClose) {
  const S = calc.settings;
  const g = 'settings';
  const nf = S.numFormat;
  const calcItems = () => [
    { label: 'Input/Output', sub: true }, { label: 'Angle Unit', sub: true }, { label: 'Number Format', sub: true },
    { label: 'Fraction Result', sub: true }, { label: 'Complex Result', sub: true }, { label: 'Decimal Mark', sub: true },
    { label: 'Digit Separator', sub: true }, { label: '×10■ Key', sub: true }, { label: 'FORMAT Key', sub: true },
  ];
  const calcSettings = () => new MenuScreen(calc, {
    group: g, items: calcItems(),
    onSelect: (it, i) => {
      switch (i) {
        case 0: calc.push(radioMenu(calc, null, [['MathI/MathO', 'MathI/MathO'], ['MathI/DecimalO', 'MathI/DecimalO'], ['LineI/LineO', 'LineI/LineO'], ['LineI/DecimalO', 'LineI/DecimalO']], S.io, (v) => {
          if (v !== S.io) { const wasMath = S.io.startsWith('MathI'); S.io = v; calc.onIOChange(wasMath !== v.startsWith('MathI')); }
        }, g)); break;
        case 1: calc.push(radioMenu(calc, null, [['Degree', 'deg'], ['Radian', 'rad'], ['Gradian', 'grad']], S.angle, (v) => { S.angle = v; calc.onAngleChange && calc.onAngleChange(); }, g)); break;
        case 2: calc.push(numberFormatMenu(calc, g)); break;
        case 3: calc.push(radioMenu(calc, null, [['Mixed Number', 'mixed'], ['Improp Fraction', 'improper']], S.fraction, (v) => { S.fraction = v; }, g)); break;
        case 4: calc.push(radioMenu(calc, null, [['𝑎+𝑏𝑖', 'a+bi'], ['𝑟∠θ', 'r∠θ']], S.complex, (v) => { S.complex = v; }, g)); break;
        case 5: calc.push(radioMenu(calc, null, [['Dot', 'dot'], ['Comma', 'comma']], S.decimalMark, (v) => { S.decimalMark = v; }, g)); break;
        case 6: calc.push(radioMenu(calc, null, [['On', true], ['Off', false]], S.digitSep, (v) => { S.digitSep = v; }, g)); break;
        case 7: calc.push(radioMenu(calc, null, [['×10■(Power)', 'power'], ['×10■(Sci Notat)', 'sci']], S.x10Key, (v) => { S.x10Key = v; }, g)); break;
        case 8: calc.push(radioMenu(calc, null, [['■π√↔Decimal', 'toggle'], ['Format Menu', 'menu']], S.formatKey, (v) => { S.formatKey = v; }, g)); break;
        default: break;
      }
    },
  });
  const sysSettings = () => new MenuScreen(calc, {
    group: g,
    items: [{ label: 'Contrast', sub: true }, { label: 'Auto Power Off', sub: true }, { label: 'MultiLine Font', sub: true }, { label: 'Show Option Num', sub: true }],
    onSelect: (it, i) => {
      switch (i) {
        case 0: calc.push(contrastScreen(calc, g)); break;
        case 1: calc.push(radioMenu(calc, 'Auto Power Off', [['10 Min.', 10], ['60 Min.', 60]], S.autoPowerOff, (v) => { S.autoPowerOff = v; }, g)); break;
        case 2: calc.push(radioMenu(calc, 'MultiLine Font', [['Normal Font', 'normal'], ['Small Font', 'small']], S.multiLineFont, (v) => { S.multiLineFont = v; }, g)); break;
        case 3: calc.push(radioMenu(calc, 'Show Option Num?', [['On', true], ['Off', false]], S.showOptionNum, (v) => { S.showOptionNum = v; }, g)); break;
        default: break;
      }
    },
  });
  const confirm = (title, action) => new MenuScreen(calc, {
    group: g, title, items: [{ label: 'Yes' }, { label: 'No' }],
    onSelect: (it, i) => { if (i === 0) action(); else calc.pop(); },
  });
  const reset = () => new MenuScreen(calc, {
    group: g,
    items: [{ label: 'Settings & Data', sub: true }, { label: 'Variable Memory', sub: true }, { label: 'Initialize All', sub: true }],
    onSelect: (it, i) => {
      if (i === 0) calc.push(confirm('Reset Settings?', () => calc.resetSettingsData()));
      if (i === 1) calc.push(confirm('Clear Variables?', () => { calc.clearVariables(); calc.closeAll(); }));
      if (i === 2) calc.push(confirm('Initialize All?', () => calc.initializeAll()));
    },
  });
  return new MenuScreen(calc, {
    group: g,
    items: [{ label: 'Calc Settings', sub: true }, { label: 'System Settings', sub: true }, { label: 'Reset', sub: true }, { label: 'Get Started', sub: true }],
    onSelect: (it, i) => {
      if (i === 0) calc.push(calcSettings());
      if (i === 1) calc.push(sysSettings());
      if (i === 2) calc.push(reset());
      // the desktop app opens its keyboard-shortcuts window here; without one, the ID screen
      if (i === 3) { if (calc.onGetStarted) calc.onGetStarted(); else calc.push(getStartedScreen(calc, () => calc.pop())); }
    },
    onBack: () => { calc.pop(); if (onClose) onClose(); },
  });
}

function numberFormatMenu(calc, g) {
  const S = calc.settings;
  const nf = S.numFormat;
  const fix = () => new MenuScreen(calc, {
    group: g, title: 'Fix',
    items: Array.from({ length: 10 }, (_, d) => ({ label: `Fix${d}:` + (d ? '0.' + '123456789'.slice(0, d) : '0'), radio: nf.kind === 'Fix' && nf.n === d })),
    sel: nf.kind === 'Fix' ? nf.n : 0, showOptions: true,
    onSelect: (it, i) => { S.numFormat = { kind: 'Fix', n: i }; calc.pop(); calc.pop(); },
  });
  const sci = () => new MenuScreen(calc, {
    group: g, title: 'Sci',
    items: Array.from({ length: 10 }, (_, d) => ({ label: `Sci${d + 1}:` + (d ? '1.' + '234567891'.slice(0, d) : '1') + '×10⁻³', radio: nf.kind === 'Sci' && nf.n === d + 1 })),
    sel: nf.kind === 'Sci' ? nf.n - 1 : 0,
    onSelect: (it, i) => { S.numFormat = { kind: 'Sci', n: i + 1 }; calc.pop(); calc.pop(); },
  });
  const norm = () => new MenuScreen(calc, {
    group: g, title: 'Norm',
    items: [{ label: 'Norm1:1.23×10⁻³', radio: nf.kind === 'Norm' && nf.n === 1 }, { label: 'Norm2:0.00123', radio: nf.kind === 'Norm' && nf.n === 2 }],
    sel: nf.kind === 'Norm' ? nf.n - 1 : 1,
    onSelect: (it, i) => { S.numFormat = { kind: 'Norm', n: i + 1 }; calc.pop(); calc.pop(); },
  });
  return new MenuScreen(calc, {
    group: g,
    items: [{ label: 'Fix', radio: nf.kind === 'Fix', sub: true }, { label: 'Sci', radio: nf.kind === 'Sci', sub: true }, { label: 'Norm', radio: nf.kind === 'Norm', sub: true }],
    sel: ['Fix', 'Sci', 'Norm'].indexOf(nf.kind),
    onSelect: (it, i) => calc.push([fix, sci, norm][i]()),
  });
}

function contrastScreen(calc, g) {
  const S = calc.settings;
  return {
    group: g,
    key(k) {
      if (k === 'LEFT') { S.contrast = Math.max(0, S.contrast - 1); return true; }
      if (k === 'RIGHT') { S.contrast = Math.min(8, S.contrast + 1); return true; }
      if (k === 'BACK') { calc.pop(); return true; }
      return false;
    },
    render(lcd) {
      // gradient bar (white, light, dark, black) and labels — measured from the manual (p.15)
      lcd.rect(5, 14, 186, 20, 2);
      lcd.fill(52, 15, 46, 18, 1); lcd.fill(98, 15, 46, 18, 2); lcd.fill(144, 15, 46, 18, 3);
      lcd.bigText('Light', 3, 42, { level: 2 }); lcd.bigText('Dark', 150, 42);
      const brL = ['#####', '#####', '##   ', '##   ', '##   ', '##   ', '##   ', '##   ', '##   ', '##   ', '#####', '#####'];
      const brR = brL.map((r) => r.split('').reverse().join(''));
      const triL = ['      ##', '    ####', '  ######', '########', '  ######', '    ####', '      ##'];
      const triR = triL.map((r) => r.split('').reverse().join(''));
      lcd.bitmap(brL, 5, 59); lcd.bitmap(triL, 15, 62); lcd.bitmap(brR, 28, 59);
      lcd.bitmap(brL, 163, 59); lcd.bitmap(triR, 173, 62); lcd.bitmap(brR, 186, 59);
    },
  };
}

export function getStartedScreen(calc, onBack) {
  return {
    group: 'getstarted',
    key(k) { if (k === 'BACK' || k === 'AC' || k === 'OK') { onBack(); return true; } return true; },
    render(lcd) {
      lcd.smallText('Get Started', 76, 4);
      lcd.smallText('ID:', 76, 20);
      const id = calc.calcId || 'OPENSCI000000000000000E1';
      lcd.smallText(id.slice(0, 12), 76, 32);
      lcd.smallText(id.slice(12), 76, 44);
      lcd.smallText('[BACK]', 76, 62);
    },
  };
}

// ---------------------------------------------------------------- calculator-level operations
Object.assign(Calculator.prototype, {
  onIOChange(mathChanged) {
    // history cleared when Input/Output changes; f(x)/g(x) deleted when MathI<->LineI switches
    if (mathChanged) this.mem.funcs = { f: [], g: [] };
    if (this.app && this.app.onSettingsChange) this.app.onSettingsChange({ io: true });
  },
  resetSettingsData() {
    const contrast = this.settings.contrast, apo = this.settings.autoPowerOff;
    this.settings = { ...DEFAULT_SETTINGS, numFormat: { ...DEFAULT_SETTINGS.numFormat }, contrast, autoPowerOff: apo };
    const vars = this.mem.vars, ans = this.mem.ans;
    this.mem = freshMemory();
    this.mem.vars = vars; this.mem.ans = ans;
    this.overlays = [];
    this.showHome = true; this.homeSel = 0; this.homeTopRow = 0;
    this.openApp('Calculate'); this.showHome = true;
  },
  clearVariables() {
    const m = freshMemory();
    this.mem.vars = m.vars; this.mem.ans = m.ans;
  },
  initializeAll() {
    const contrast = this.settings.contrast, apo = this.settings.autoPowerOff;
    this.settings = { ...DEFAULT_SETTINGS, numFormat: { ...DEFAULT_SETTINGS.numFormat }, contrast, autoPowerOff: apo };
    this.mem = freshMemory();
    this.overlays = [];
    this.homeSel = 0; this.homeTopRow = 0;
    this.openApp('Calculate'); this.showHome = true;
  },
});

// ---------------------------------------------------------------- CATALOG overlay
export function catalogScreen(calc, categories, onInsert, opts = {}) {
  const g = 'catalog';
  const build = (cat, title) => new MenuScreen(calc, {
    group: g, twoColumn: !!cat.twoCol,
    items: cat.items.filter((it) => !(it.spec && it.spec.mathOnly && !calc.math)).map((it) => ({ label: it.label, sub: !!it.items, data: it })),
    onSelect: (it) => {
      const d = it.data;
      if (d.items) { calc.push(build(d)); return; }
      calc.closeGroup(g);
      onInsert(d.spec);
    },
    onBack: () => calc.pop(),
  });
  return build({ items: categories });
}

export function catalogListScreen(calc, categories, onInsert) {
  const items = catalogList(categories, calc.math);
  let page = 0;
  let sel = 0;
  const per = 15;
  return {
    group: 'catalog',
    key(k) {
      const pages = Math.ceil(items.length / per);
      if (k === 'PGDN' || k === 'DOWN') { page = Math.min(pages - 1, page + 1); return true; }
      if (k === 'PGUP' || k === 'UP') { page = Math.max(0, page - 1); return true; }
      if (k === 'BACK') { calc.pop(); return true; }
      const idx = optionIndexForKey(k);
      const DIV_IDX = 13;
      let i = idx;
      if (k === 'DIV') i = DIV_IDX;
      if (i >= 0 && i < per && page * per + i < items.length) {
        calc.pop();
        onInsert(items[page * per + i].spec);
        return true;
      }
      void sel;
      return false;
    },
    render(lcd) {
      const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '+', '−', '×', '÷', '?'];
      for (let i = 0; i < per; i++) {
        const it = items[page * per + i];
        if (!it) break;
        const col = i % 3, row = Math.floor(i / 3);
        const x = 3 + col * 63, y = 14 + row * 12;
        drawOptionIcon(lcd, keys[i] === '?' ? '?' : keys[i], x, y);
        lcd.smallText(it.label, x + 10, y);
      }
      const pages = Math.ceil(items.length / per);
      if (pages > 1) {
        const h = 64, len = Math.round(h / pages);
        lcd.fill(192, 11 + Math.round(((h - len) * page) / (pages - 1)), 2, len, 2);
      }
    },
  };
}

// ---------------------------------------------------------------- VARIABLE list
export function variableScreen(calc, { onRecall, canStore = true, storeValue = null, locked = false, onClose }) {
  let sel = 0;
  const g = 'variable';
  const fmtVar = (v) => calc.formatVarValue ? calc.formatVarValue(calc.mem.vars[v]) : '0';
  const scr = {
    group: g,
    key(k) {
      if (k === 'UP') { sel = sel >= 2 ? sel - 2 : sel; return true; }
      if (k === 'DOWN') { sel = sel + 2 < VAR_NAMES.length ? sel + 2 : sel; return true; }
      if (k === 'LEFT') { if (sel % 2) sel--; return true; }
      if (k === 'RIGHT') { if (sel % 2 === 0 && sel + 1 < VAR_NAMES.length) sel++; return true; }
      if (k === 'BACK' || k === 'VARIABLE') { calc.pop(); if (onClose) onClose(); return true; }
      const name = VAR_NAMES[sel];
      if (k === 'OK' || k === 'EXE') {
        const items = [{ label: 'Recall' }];
        if (canStore && storeValue) items.push({ label: 'Store' });
        if (!locked) items.push({ label: 'Edit' });
        calc.push(new MenuScreen(calc, {
          group: g, title: name + '=', items,
          onSelect: (it) => {
            if (it.label === 'Recall') { calc.closeGroup(g); onRecall(name); }
            if (it.label === 'Store') { calc.mem.vars[name] = storeValue(); calc.pop(); }
            if (it.label === 'Edit') { calc.pop(); calc.push(editVarScreen(calc, name, null)); }
          },
        }));
        return true;
      }
      if (!locked && /^(D[0-9]|DOT|NEG|SUB|LPAR|ANS|PI|E|SQRT|FRAC)$/.test(k)) {
        calc.push(editVarScreen(calc, name, k));
        return true;
      }
      return false;
    },
    render(lcd) {
      VAR_NAMES.forEach((v, i) => {
        const col = i % 2, row = Math.floor(i / 2);
        const x = 3 + col * 96, y = 12 + row * 13;
        const label = (v === 'x' ? '𝑥' : v === 'y' ? '𝑦' : v === 'z' ? '𝑧' : v) + '=' + fmtVar(v);
        lcd.smallText(label, x, y);
        if (i === sel) {
          lcd.invert(x - 1, y - 1, 91, 11);
          if (locked) lcd.fill(x + 84, y, 5, 8, 0);
        }
      });
    },
  };
  return scr;
}

export function editVarScreen(calc, name, firstKey) {
  const ed = calc.newEditor();
  if (firstKey) inputKey(ed, firstKey, { settings: calc.settings });
  const g = 'variable';
  return {
    group: g, editor: ed,
    key(k) {
      if (k === 'EXE' || k === 'OK') {
        try {
          const v = calc.evaluateEditor(ed);
          calc.mem.vars[name] = v;
          calc.pop();
        } catch (e) { calc.showError(e, () => {}); }
        return true;
      }
      if (k === 'AC') { if (ed.isEmpty()) { calc.pop(); return true; } ed.clear(); return true; }
      if (k === 'BACK') { calc.pop(); return true; }
      return inputKey(ed, k, { settings: calc.settings });
    },
    render(lcd, blink) {
      const label = (name === 'x' ? '𝑥' : name === 'y' ? '𝑦' : name === 'z' ? '𝑧' : name) + '=';
      lcd.bigText(label, 3, 11);
      calc.drawInputLine(lcd, ed, { x: 25, top: 11, width: 168, blink });
      lcd.rect(2, 10, 190, 16, 3);
    },
  };
}

export { VAR_NAMES, ICONS, BIG, LINE_TOP };
