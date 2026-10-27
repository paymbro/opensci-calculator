// Math Box app (User's Guide p.136-150): Dice Roll, Coin Toss, Number Line, Circle.
import { Decimal, Real, CalcError, PI } from '../core/num.js';
import { MenuScreen } from '../core/calc.js';
import { LCD } from '../core/lcd.js';
import { BIG } from '../core/fonts.js';
import { LINE_TOP, drawScrollBar } from '../core/ui.js';
import { formatValue, seqText, decimalText } from '../core/format.js';
import { toDegrees, fromDegrees, trigDeg } from '../core/eval.js';
import { ParamForm, ValueInput, GridView, fmtSmall } from './widgets.js';
import { errorScreen, drawResult, cut } from './common.js';
import { storeOnly } from './equation.js';

const D = (x) => new Decimal(x);
const ATT_X = 108, ATT_Y = 9;

// deterministic generator for "Same Result" #1-#3 (xorshift32)
function rng(seed) {
  let s = seed >>> 0 || 0x9e3779b9;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

// ================================================================== app shell
export class MathBoxApp {
  constructor(calc) {
    this.calc = calc;
    this.sim = { dice: 1, coins: 1, attempts: 5, same: 'Off' };
    this.lines = [null, null, null];
    this.view = null;
    this.circle = { type: 'unit', t1: null, t2: null };
    this.mode = 'menu';
  }
  start() { this.mode = 'menu'; this.lines = [null, null, null]; this.showMenu(); }
  powerOn() { this.start(); }
  status() { return { mathI: this.calc.math, angle: this.calc.settings.angle }; }
  onAngleChange() { this.lines = [null, null, null]; }

  showMenu() {
    const calc = this.calc;
    calc.push(new MenuScreen(calc, {
      group: 'mbox', acCloses: false,
      items: [{ label: '⚀Dice Roll' }, { label: '◍Coin Toss' }, { label: '⊸Number Line' }, { label: '⊕Circle' }],
      onSelect: (it, i) => {
        calc.closeGroup('mbox');
        if (i === 0) this.openSim('dice');
        if (i === 1) this.openSim('coin');
        if (i === 2) this.openNumberLine();
        if (i === 3) this.openCircle();
      },
      onBack: () => { calc.pop(); if (this.mode === 'menu') calc.showHome = true; },
      status: () => this.status(),
    }));
  }

  key(k) { if (this.screen && this.screen.key) this.screen.key(k); }
  render(lcd, blink) { if (this.screen && this.screen.render) this.screen.render(lcd, blink); }

  // ================================================================ Dice Roll / Coin Toss
  openSim(kind) {
    const calc = this.calc;
    this.mode = kind;
    const S = this.sim;
    const isDice = kind === 'dice';
    const fieldN = {
      label: isDice ? 'Dice' : 'Coins', kind: 'menu',
      options: [1, 2, 3].map((n) => [n + (isDice ? (n === 1 ? ' Die' : ' Dice') : (n === 1 ? ' Coin' : ' Coins')), n]),
      get: () => (isDice ? S.dice : S.coins), set: (v) => { if (isDice) S.dice = v; else S.coins = v; },
      display: () => String(isDice ? S.dice : S.coins),
    };
    const fieldA = {
      label: 'Attempts', kind: 'custom', get: () => S.attempts, display: () => String(S.attempts),
    };
    const fieldS = {
      label: 'Same Result', kind: 'menu', options: [['Off', 'Off'], ['#1', '#1'], ['#2', '#2'], ['#3', '#3']],
      get: () => S.same, set: (v) => { S.same = v; }, display: () => S.same,
    };
    const form = new ParamForm(calc, {
      fields: [fieldN, fieldA, fieldS], labelWidth: 11,
      action: { label: 'Execute', run: () => this.runSim(kind) },
      onBack: () => { this.screen = null; this.start(); },
      statusFn: () => this.status(),
    });
    // Attempts uses its own input screen (value 1-250, Confirm)
    const origKey = form.key.bind(form);
    form.key = (k) => {
      if (form.sel === 1 && (k === 'OK' || k === 'EXE' || k === 'RIGHT')) { this.attemptsScreen(); return true; }
      return origKey(k);
    };
    fieldA.kind = 'menu';
    this.screen = form;
  }

  attemptsScreen() {
    const calc = this.calc;
    const S = this.sim;
    let val = Real.int(S.attempts);
    const sub = new ParamForm(calc, {
      fields: [{ label: 'Attempts', kind: 'value', get: () => val, display: () => fmtSmall(calc, val, 8), set: (v) => { val = v; } }],
      action: { label: 'Confirm', run: () => {
        const n = val.dec;
        if (!n.isInteger() || n.lt(1) || n.gt(250)) { calc.push(errorScreen(calc, new CalcError('Range ERROR'), () => {})); return; }
        S.attempts = n.toNumber();
        calc.pop();
      } },
      onBack: () => calc.pop(), statusFn: () => this.status(),
    });
    sub.group = 'mboxsub';
    calc.push(sub);
  }

  runSim(kind) {
    const S = this.sim;
    const n = kind === 'dice' ? S.dice : S.coins;
    const seed = { Off: (Date.now() ^ (Math.random() * 1e9)) >>> 0, '#1': 0x1234567, '#2': 0x2468ace, '#3': 0x369bdf1 }[S.same];
    const rand = rng(seed + n * 977 + S.attempts * 131 + (kind === 'dice' ? 7 : 3));
    const rows = [];
    for (let i = 0; i < S.attempts; i++) {
      const r = [];
      for (let j = 0; j < n; j++) r.push(kind === 'dice' ? 1 + Math.floor(rand() * 6) : (rand() < 0.5 ? 1 : 0));
      rows.push(r);
    }
    this.result = { kind, n, rows };
    this.resultTypeMenu();
  }

  resultTypeMenu() {
    const calc = this.calc;
    const R = this.result;
    const sumDiff = R.kind === 'dice' && R.n === 2;
    const prev = this.screen;
    const menu = new MenuScreen(calc, {
      group: 'mboxres', title: 'Result Type', acCloses: false,
      items: [{ label: 'List' }, { label: 'Relative Freq', sub: sumDiff }],
      onSelect: (it, i) => {
        if (i === 0) { calc.pop(); this.screen = this.listScreen(prev); return; }
        if (sumDiff) {
          calc.push(new MenuScreen(calc, {
            group: 'mboxres', acCloses: false, items: [{ label: 'Sum' }, { label: 'Difference' }],
            onSelect: (x, j) => { calc.closeGroup('mboxres'); this.screen = this.freqScreen(prev, j === 0 ? 'sum' : 'diff'); },
          }));
          return;
        }
        calc.pop();
        this.screen = this.freqScreen(prev, R.kind === 'dice' && R.n === 3 ? 'sum' : R.kind === 'dice' ? 'face' : 'heads');
      },
      onBack: () => { calc.pop(); this.result = null; this.screen = prev; },
      status: () => this.status(),
    });
    calc.push(menu);
  }

  listScreen(prev) {
    const R = this.result;
    let top = 0;
    const cols = R.kind === 'dice'
      ? (R.n === 1 ? ['A'] : R.n === 2 ? ['A', 'B', 'Sum', 'Diff'] : ['A', 'B', 'C', 'Sum'])
      : (R.n === 1 ? ['A'] : R.n === 2 ? ['A', 'B', '●'] : ['A', 'B', 'C', '●']);
    const cellText = (row, c) => {
      const r = R.rows[row];
      const name = cols[c];
      if (name === 'Sum') return String(r.reduce((a, b) => a + b, 0));
      if (name === 'Diff') return String(Math.abs(r[0] - r[1]));
      if (name === '●') return String(r.reduce((a, b) => a + b, 0));
      const v = r['ABC'.indexOf(name)];
      return R.kind === 'dice' ? String(v) : (v ? '●' : '○');
    };
    // a column is centred as one field as wide as its longest entry, so units line up
    // (p.136: " 9" under "13"; p.137: one-digit sums centred)
    const widths = cols.map((_, c) => Math.max(...R.rows.map((r, i) => cellText(i, c).length)));
    const cell = (row, c) => cellText(row, c).padStart(widths[c], ' ');
    // same 4-row grid as Statistics/Table, all columns centred (User's Guide p.136-137, 141)
    const grid = new GridView({ cols: cols.length, align: 'center', top: 10, headerTop: 10 });
    return {
      key: (k) => {
        if (k === 'UP') top = Math.max(0, top - 1);
        if (k === 'DOWN') top = Math.min(Math.max(0, R.rows.length - 4), top + 1);
        if (k === 'PGUP') top = Math.max(0, top - 4);
        if (k === 'PGDN') top = Math.min(Math.max(0, R.rows.length - 4), top + 4);
        if (k === 'BACK') { this.screen = prev; this.resultTypeMenu(); }
      },
      render: (lcd) => {
        grid.top = top;
        grid.draw(lcd, { rowCount: R.rows.length, getCell: cell, headers: cols, selVisible: false });
      },
    };
  }

  freqScreen(prev, what) {
    const calc = this.calc;
    const R = this.result;
    const outcomes = [];
    let label;
    if (R.kind === 'dice') {
      if (what === 'face') { label = 'Sum'; for (let v = 1; v <= 6; v++) outcomes.push(v); }
      else if (what === 'diff') { label = 'Diff'; for (let v = 0; v <= 5; v++) outcomes.push(v); }
      else { label = 'Sum'; for (let v = R.n; v <= 6 * R.n; v++) outcomes.push(v); }
    } else {
      label = 'Side';
      if (R.n === 1) outcomes.push(1, 0); else for (let v = 0; v <= R.n; v++) outcomes.push(v);
    }
    const valueOf = (r) => (what === 'diff' ? Math.abs(r[0] - r[1]) : r.reduce((a, b) => a + b, 0));
    const freq = outcomes.map((o) => R.rows.filter((r) => valueOf(r) === o).length);
    const N = R.rows.length;
    const rel = freq.map((f) => new Real(D(f).div(N)));
    let sel = 0, top = 0;
    const outText = (o) => (R.kind === 'dice' ? String(o) : o ? '●' : '○');
    return {
      key: (k) => {
        if (k === 'UP') { if (sel > 0) sel--; if (sel < top) top = sel; }
        if (k === 'DOWN') { if (sel < outcomes.length - 1) sel++; if (sel > top + 3) top = sel - 3; }
        if (k === 'BACK') { this.screen = prev; this.resultTypeMenu(); }
        if (k === 'VARIABLE') calc.push(storeOnly(calc, rel[sel]));
      },
      render: (lcd) => {
        // three narrow columns with rules at x = 29, 59, 101 (User's Guide p.136, 139)
        const rules = [29, 59, 101];
        const right = (t, rule, y) => { const x = rule - 3 - LCD.tinyWidth(t); lcd.tinyText(t, x, y); return x; };
        lcd.tinyText(label, rules[0] - 3 - LCD.tinyWidth(label), 10);
        lcd.tinyText('Freq', 34, 10);
        lcd.tinyText('Rel Fr', 64, 10);
        rules.forEach((x) => lcd.vline(x, 10, 48, 2));
        for (let i = 0; i < 4; i++) {
          const idx = top + i;
          if (idx >= outcomes.length) break;
          const y = 20 + i * 10;
          const o = outcomes[idx];
          if (R.kind === 'coin' && R.n > 1) {
            // "●ₓn": n heads
            const x = right(String(o), rules[0], y);
            lcd.tinyText('●', x - 13, y);
            lcd.bitmap(['# #', ' # ', '# #'], x - 6, y + 4);
          } else right(outText(o), rules[0], y);
          right(String(freq[idx]), rules[1], y);
          right(fmtSmall(calc, rel[idx], 6), rules[2], y);
          if (idx === sel) lcd.invert(rules[1] + 3, y, rules[2] - rules[1] - 6, 8);
        }
        lcd.bigText('Attempts', ATT_X, ATT_Y);
        lcd.bigText(String(N), ATT_X, ATT_Y + 16);
        drawResult(lcd, formatValue(rel[sel], { ...calc.settings, io: 'LineI/DecimalO' }, 'dec'), { right: 196 });
      },
    };
  }

  // ================================================================ Number Line
  openNumberLine() {
    this.mode = 'nline';
    this.view = null;
    this.screen = this.nlRegScreen();
  }

  nlTypes() { return ['𝑥<a', '𝑥≤a', '𝑥=a', '𝑥>a', '𝑥≥a', 'a<𝑥<b', 'a≤𝑥<b', 'a<𝑥≤b', 'a≤𝑥≤b']; }

  nlText(L) {
    if (!L) return '';
    const f = (v) => fmtSmall(this.calc, v, 10);
    const t = L.type;
    return t.replace('a', f(L.a)).replace('b', L.b ? f(L.b) : 'b');
  }

  nlRegScreen() {
    const calc = this.calc;
    let sel = 0;
    const scr = {
      key: (k) => {
        if (k === 'UP') sel = (sel + 3) % 4;
        if (k === 'DOWN') sel = (sel + 1) % 4;
        const idx = { D1: 0, D2: 1, D3: 2, D4: 3 }[k];
        if (idx !== undefined) sel = idx;
        if (k === 'BACK') { this.lines = [null, null, null]; this.screen = null; this.start(); return; }
        if (k === 'DEL' && sel < 3) { this.lines[sel] = null; return; }
        if (k === 'OK' || k === 'EXE' || k === 'RIGHT' || idx !== undefined) {
          if (sel === 3) { if (this.lines.some(Boolean)) { this.view = null; this.screen = this.nlGraph(); } return; }
          if (this.lines[sel]) {
            calc.push(new MenuScreen(calc, {
              group: 'nl', items: [{ label: 'Edit' }, { label: 'Define New' }],
              onSelect: (x, j) => { calc.pop(); if (j === 0) this.nlInput(sel, this.lines[sel].type, scr); else this.nlTypeMenu(sel, scr); },
            }));
          } else this.nlTypeMenu(sel, scr);
        }
      },
      render: (lcd) => {
        ['A', 'B', 'C'].forEach((L, i) => {
          const top = LINE_TOP(i);
          lcd.bigText(L + ':' + cut(this.nlText(this.lines[i]), 0, 14), 3, top);
          if (sel === i) lcd.invert(2, top, 188, 15);
          lcd.bitmap(['#   ', '##  ', '### ', '####', '### ', '##  ', '#   '], 183, top + 4, { level: 2 });
        });
        const en = this.lines.some(Boolean);
        lcd.bitmap(BIG['◐'], 3, LINE_TOP(3), { level: en ? 3 : 2 });
        lcd.bigText('Execute', 14, LINE_TOP(3), { level: en ? 3 : 2 });
        if (sel === 3) lcd.invert(2, LINE_TOP(3), 188, 15);
      },
    };
    return scr;
  }

  nlTypeMenu(line, back) {
    const calc = this.calc;
    calc.push(new MenuScreen(calc, {
      group: 'nl', items: this.nlTypes().map((t) => ({ label: t })),
      onSelect: (it, i) => { calc.pop(); this.nlInput(line, this.nlTypes()[i], back); },
    }));
  }

  nlInput(line, type, back) {
    const calc = this.calc;
    const two = type.startsWith('a');
    const cur = this.lines[line] && this.lines[line].type === type ? this.lines[line] : null;
    let a = cur ? cur.a : null, b = cur ? cur.b : null;
    const fields = [{ label: 'a', kind: 'value', get: () => a, display: () => (a ? fmtSmall(calc, a, 12) : ''), set: (v) => { a = v; } }];
    if (two) fields.push({ label: 'b', kind: 'value', get: () => b, display: () => (b ? fmtSmall(calc, b, 12) : ''), set: (v) => { b = v; } });
    const lim = D('1e10');
    const form = new ParamForm(calc, {
      title: type, fields, labelWidth: 1,
      action: {
        label: 'Confirm',
        enabled: () => a && (!two || b),
        run: () => {
          const bad = (v) => v.dec.abs().gt(lim);
          if (bad(a) || (two && (bad(b) || a.dec.gt(b.dec) || (a.dec.eq(b.dec) && type !== 'a≤𝑥≤b')))) { calc.push(errorScreen(calc, new CalcError('Range ERROR'), () => {})); return; }
          this.lines[line] = { type, a, b: two ? b : null };
          this.view = null;
          this.screen = back;
        },
      },
      onBack: () => { this.screen = back; },
      statusFn: () => this.status(),
    });
    this.screen = form;
  }

  autoView() {
    const vals = [];
    for (const L of this.lines) if (L) { vals.push(L.a.dec); if (L.b) vals.push(L.b.dec); }
    const min = Decimal.min(...vals), max = Decimal.max(...vals);
    let span = max.minus(min);
    let need = span.div(8);
    if (need.isZero()) need = Decimal.max(min.abs().div(8), D('0.1'));
    // nice scale 1/2/5 × 10^k not smaller than the requirement
    const e = Math.floor(Math.log10(need.toNumber()));
    let scale = null;
    for (const m of [1, 2, 5, 10]) { const s = D(m).times(D(10).pow(e)); if (s.gte(need)) { scale = s; break; } }
    const center = min.plus(max).div(2).div(scale).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).times(scale);
    return { scale, center };
  }

  nlGraph() {
    const calc = this.calc;
    if (!this.view) this.view = this.autoView();
    let sel = this.lines.findIndex(Boolean);
    const scr = {
      key: (k) => {
        const lines = [0, 1, 2].filter((i) => this.lines[i]);
        if (k === 'UP') { const p = lines.indexOf(sel); if (p > 0) sel = lines[p - 1]; }
        if (k === 'DOWN') { const p = lines.indexOf(sel); if (p < lines.length - 1) sel = lines[p + 1]; }
        if (k === 'LEFT') this.view.center = this.view.center.minus(this.view.scale);
        if (k === 'RIGHT') this.view.center = this.view.center.plus(this.view.scale);
        if (k === 'BACK') this.screen = this.nlRegScreen();
        if (k === 'TOOLS') {
          calc.push(new MenuScreen(calc, {
            group: 'nltools', items: [{ label: 'View-Window' }, { label: 'View-Reset' }],
            onSelect: (x, j) => {
              if (j === 1) { this.view = this.autoView(); calc.closeGroup('nltools'); return; }
              let sc = new Real(this.view.scale), ce = new Real(this.view.center);
              const f = new ParamForm(calc, {
                fields: [
                  { label: 'Scale', kind: 'value', get: () => sc, display: () => fmtSmall(calc, sc, 10), set: (v) => { sc = v; } },
                  { label: 'Center', kind: 'value', get: () => ce, display: () => fmtSmall(calc, ce, 10), set: (v) => { ce = v; } },
                ], labelWidth: 6, colon: ':',
                action: { label: 'Execute', run: () => {
                  if (sc.dec.lt('1e-10') || sc.dec.gt('1e10') || ce.dec.abs().gt('1e10')) { calc.push(errorScreen(calc, new CalcError('Range ERROR'), () => {})); return; }
                  this.view = { scale: sc.dec, center: ce.dec }; calc.closeGroup('nltools');
                } },
                onBack: () => calc.pop(), statusFn: () => this.status(),
              });
              f.group = 'nltools';
              calc.push(f);
            },
            status: () => this.status(),
          }));
        }
      },
      render: (lcd) => {
        const { scale, center } = this.view;
        const xmin = center.minus(scale.times(8));
        const X0 = 9, X1 = 183; // axis pixel range
        const px = (v) => X0 + v.minus(xmin).div(scale.times(16)).times(X1 - X0).toNumber();
        // number lines
        [0, 1, 2].forEach((i) => {
          const L = this.lines[i];
          if (!L) return;
          const y = 12 + i * 10;
          const thick = i === sel;
          const t = L.type;
          const filled = (s) => s.includes('≤') || s.includes('=');
          const draw = (xa, xb, arrowL, arrowR) => {
            const a = Math.max(2, Math.min(193, Math.round(xa))), b = Math.max(2, Math.min(193, Math.round(xb)));
            lcd.hline(Math.min(a, b), y, Math.abs(b - a) + 1, 3);
            if (thick) lcd.hline(Math.min(a, b), y + 1, Math.abs(b - a) + 1, 3);
            if (arrowL) { lcd.set(a + 1, y - 1, 3); lcd.set(a + 1, y + 1 + (thick ? 1 : 0), 3); lcd.set(a + 2, y - 2, 3); lcd.set(a + 2, y + 2 + (thick ? 1 : 0), 3); }
            if (arrowR) { lcd.set(b - 1, y - 1, 3); lcd.set(b - 1, y + 1 + (thick ? 1 : 0), 3); lcd.set(b - 2, y - 2, 3); lcd.set(b - 2, y + 2 + (thick ? 1 : 0), 3); }
          };
          const circle = (x, fill) => {
            const cx = Math.round(x);
            const pts = [[-1, -2], [0, -2], [1, -2], [-2, -1], [2, -1], [-2, 0], [2, 0], [-2, 1], [2, 1], [-1, 2], [0, 2], [1, 2]];
            for (const [dx, dy] of pts) lcd.set(cx + dx, y + dy, 3);
            for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) lcd.set(cx + dx, y + dy, fill ? 3 : 0);
          };
          const xa = px(L.a.dec);
          if (t === '𝑥<a' || t === '𝑥≤a') { draw(2, xa, true, false); circle(xa, filled(t)); }
          else if (t === '𝑥>a' || t === '𝑥≥a') { draw(xa, 193, false, true); circle(xa, filled(t)); }
          else if (t === '𝑥=a') circle(xa, true);
          else {
            const xb = px(L.b.dec);
            draw(xa, xb, false, false);
            circle(xa, t.startsWith('a≤')); circle(xb, t.endsWith('≤b'));
          }
        });
        // axis
        const ay = 44;
        lcd.hline(2, ay, 190, 3);
        for (let k = 0; k <= 16; k++) { const x = Math.round(X0 + (k * (X1 - X0)) / 16); lcd.vline(x, ay - 1, 3, 3); }
        lcd.bitmap(['  #', ' ##', '###', ' ##', '  #'], 0, ay - 2);
        lcd.bitmap(['#  ', '## ', '###', '## ', '#  '], 191, ay - 2);
        const lab = (v) => fmtSmall(calc, new Real(v), 6);
        [[xmin, X0], [center, (X0 + X1) / 2], [center.plus(scale.times(8)), X1]].forEach(([v, x]) => {
          const t = lab(v);
          lcd.smallText(t, Math.round(x - LCD.smallWidth(t) / 2), ay + 3);
        });
        lcd.hline(2, ay + 13, 192, 2);
        const L = this.lines[sel];
        if (L) lcd.bigText((['A', 'B', 'C'][sel]) + ':' + this.nlText(L), 3, 59);
      },
    };
    return scr;
  }

  // ================================================================ Circle
  openCircle() {
    const calc = this.calc;
    this.mode = 'circle';
    const C = this.circle;
    const fmtA = (v) => (v ? fmtSmall(calc, v, 10) : '');
    const form = new ParamForm(calc, {
      fields: [
        { label: 'Type', kind: 'menu', options: [['Unit Circle', 'unit'], ['Half Circle', 'half'], ['Clock', 'clock']], get: () => C.type, set: (v) => { C.type = v; }, display: () => ({ unit: 'Unit Circle', half: 'Half Circle', clock: 'Clock' })[C.type] },
        { label: 'θ1', kind: 'value', get: () => C.t1, display: () => fmtA(C.t1), set: (v) => { C.t1 = v; }, skip: () => C.type === 'clock' },
        { label: 'θ2', kind: 'value', get: () => C.t2, display: () => fmtA(C.t2), set: (v) => { C.t2 = v; }, skip: () => C.type === 'clock' },
      ],
      labelWidth: 4, colon: ':',
      action: { label: 'Execute', enabled: () => C.type === 'clock' || C.t1 || C.t2, run: () => this.runCircle() },
      onBack: () => { this.screen = null; this.start(); },
      statusFn: () => this.status(),
    });
    form.labelWidth = 4;
    this.screen = form;
    this.circleForm = form;
  }

  runCircle() {
    const calc = this.calc;
    const C = this.circle;
    const unit = calc.settings.angle;
    if (C.type !== 'clock') {
      for (const t of [C.t1, C.t2]) {
        if (!t) continue;
        const v = t.dec;
        if (C.type === 'unit' && (v.lte(-10000) || v.gte(10000))) { calc.push(errorScreen(calc, new CalcError('Range ERROR'), () => {})); return; }
        const hi = unit === 'deg' ? D(180) : unit === 'grad' ? D(200) : PI;
        if (C.type === 'half' && (v.lt(0) || v.gt(hi))) { calc.push(errorScreen(calc, new CalcError('Range ERROR'), () => {})); return; }
      }
    }
    this.screen = C.type === 'clock' ? this.clockScreen() : this.circleScreen();
  }

  trigText(name, ang) {
    // values shown in LineO style (e.g. √(2)⌟2) when MathI, decimals otherwise
    const S = this.calc.settings;
    const deg = toDegrees(ang, S.angle);
    let v;
    try { v = trigDeg(name, deg); } catch (e) { return name + 'θ=ERROR'; }
    const io = S.io.startsWith('MathI') && !S.io.endsWith('DecimalO') ? 'MathI/MathO' : 'LineI/DecimalO';
    const seq = formatValue(v, { ...S, io: 'LineI/LineO' }, 'std');
    let t = seqText(seq);
    if (io === 'MathI/MathO' && v.ex && v.ex.length === 1 && v.ex[0].r !== 1n) {
      const tt = v.ex[0];
      const sign = tt.n < 0n ? '-' : '';
      const n = tt.n < 0n ? -tt.n : tt.n;
      t = sign + (n !== 1n ? n.toString() : '') + '√(' + tt.r + ')' + (tt.d !== 1n ? '⌟' + tt.d : '');
    } else if (io !== 'MathI/MathO') t = decimalText(v.dec, { ...S, digitSep: false }, { kind: 'Norm', n: 2 });
    return t.replace(/\[([^/]+)\/([^\]]+)\]/g, '$1⌟$2');
  }

  circleScreen() {
    const calc = this.calc;
    const C = this.circle;
    const angles = [C.t1, C.t2].map((t, i) => (t ? { t, name: 'θ' + (i + 1) } : null)).filter(Boolean);
    let sel = 0;
    return {
      key: (k) => {
        if (k === 'UP' && sel > 0) sel--;
        if (k === 'DOWN' && sel < angles.length - 1) sel++;
        if (k === 'BACK') this.screen = this.circleForm;
      },
      render: (lcd) => {
        const half = C.type === 'half';
        const cx = 22, cy = half ? 44 : 34, R = 17;
        // circle outline
        for (let a = 0; a < 360; a += 1) {
          if (half && a > 180) break;
          const r = (a * Math.PI) / 180;
          lcd.set(Math.round(cx + R * Math.cos(r)), Math.round(cy - R * Math.sin(r)), 3);
        }
        // dotted axes with arrows
        for (let x = cx - R - 4; x <= cx + R + 4; x += 2) lcd.set(x, cy, 3);
        for (let y = cy - R - 4; y <= cy + (half ? 0 : R + 4); y += 2) lcd.set(cx, y, 3);
        lcd.bitmap(['#  ', ' # ', '  #', ' # ', '#  '], cx + R + 4, cy - 2);
        lcd.bitmap(['  #  ', ' # # ', '#   #'], cx - 2, cy - R - 5);
        angles.forEach((A, i) => {
          const deg = toDegrees(A.t, calc.settings.angle).dec.toNumber();
          const r = (deg * Math.PI) / 180;
          const ex = cx + R * Math.cos(r), ey = cy - R * Math.sin(r);
          const steps = 40;
          for (let s = 0; s <= steps; s++) {
            const x = cx + ((ex - cx) * s) / steps, y = cy + ((ey - cy) * s) / steps;
            lcd.set(Math.round(x), Math.round(y), 3);
            if (i === sel) { lcd.set(Math.round(x) + 1, Math.round(y), 3); lcd.set(Math.round(x), Math.round(y) + 1, 3); }
          }
        });
        const A = angles[sel];
        lcd.smallText(A.name, 46, 14);
        lcd.smallText('sin' + A.name + '=' + this.trigText('sin', A.t), 67, 13);
        lcd.smallText('cos' + A.name + '=' + this.trigText('cos', A.t), 67, 25);
        lcd.smallText('tan' + A.name + '=' + this.trigText('tan', A.t), 67, 37);
        lcd.bigText(A.name + ':' + fmtSmall(calc, A.t, 9), 67, 55);
        if (angles.length > 1) drawScrollBar(lcd, sel, 1, angles.length, 13, 40);
      },
    };
  }

  clockScreen() {
    const calc = this.calc;
    let hour = 12;
    return {
      key: (k) => {
        if (k === 'UP') hour = hour % 12 + 1;
        if (k === 'DOWN') hour = (hour + 10) % 12 + 1;
        if (k === 'BACK') this.screen = this.circleForm;
      },
      render: (lcd) => {
        const cx = 27, cy = 42, R = 24;
        for (let a = 0; a < 360; a++) { const r = (a * Math.PI) / 180; lcd.set(Math.round(cx + R * Math.cos(r)), Math.round(cy + R * Math.sin(r)), 3); }
        for (let h = 0; h < 12; h++) { const r = (h * 30 * Math.PI) / 180; for (let d = 0; d < 3; d++) lcd.set(Math.round(cx + (R - 1 - d) * Math.sin(r)), Math.round(cy - (R - 1 - d) * Math.cos(r)), 3); }
        // minute hand fixed at 12, hour hand thick
        for (let d = 0; d < R - 4; d++) lcd.set(cx, cy - d, 3);
        const hr = ((hour % 12) * 30 * Math.PI) / 180;
        for (let d = 0; d < R - 10; d++) { const x = Math.round(cx + d * Math.sin(hr)), y = Math.round(cy - d * Math.cos(hr)); lcd.fill(x, y, 2, 2, 3); }
        const small = (hour % 12) * 30;
        const a1 = Math.min(small, 360 - small), a2 = 360 - a1;
        const conv = (deg) => fmtSmall(calc, fromDegrees(Real.int(deg), calc.settings.angle), 7);
        lcd.bitmap(['   #   ', '  ###  ', ' ##### ', '       ', ' ##### ', '  ###  ', '   #   '], 66, 14);
        lcd.bigText(hour + ':00', 98, 10);
        lcd.bigText('θ1:' + conv(a1), 76, 26);
        lcd.bigText('θ2:' + conv(a2), 76, 42);
        lcd.bigText(a1 === a2 ? 'θ1=θ2' : 'θ1≤θ2', 76, 58);
      },
    };
  }
}

export const makeMathBox = (calc) => new MathBoxApp(calc);
void ValueInput;
