// Renderer glue: draws the body, maps mouse/keyboard input to calculator keys, paints the LCD.
import { buildBodySVG, KEYS, BODY_W, BODY_H, LCD_RECT } from './body.js';
import { Calculator } from '../core/calc.js';
import { APP_FACTORIES } from '../apps/index.js';
import { KEYBOARD_MAP, KEYBOARD_SHIFT_MAP, KEYBOARD_CTRL_SHIFT_MAP } from '../core/keys.js';
import { W, H } from '../core/lcd.js';

const storage = {
  get(k) { try { const v = localStorage.getItem('opensci:' + k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem('opensci:' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
};

const calc = new Calculator({ apps: APP_FACTORIES, storage });
window.calc = calc;
// SETTINGS > Get Started opens the keyboard shortcuts window
if (window.shell) calc.onGetStarted = () => window.shell.openShortcuts();

const root = document.getElementById('calc');
document.getElementById('body').innerHTML = buildBodySVG();
const svg = document.querySelector('#body svg');
const canvas = document.getElementById('lcd');
const ctx = canvas.getContext('2d');
const keysLayer = document.getElementById('keys');

// ------------------------------------------------------------------ layout
let scale = 1;
function layout() {
  const w = window.innerWidth, h = window.innerHeight;
  scale = Math.min(w / BODY_W, h / BODY_H);
  const ox = (w - BODY_W * scale) / 2, oy = (h - BODY_H * scale) / 2;
  const svgEl = svg;
  svgEl.style.position = 'absolute';
  svgEl.style.left = ox + 'px'; svgEl.style.top = oy + 'px';
  svgEl.style.width = BODY_W * scale + 'px'; svgEl.style.height = BODY_H * scale + 'px';
  const lw = W * LCD_RECT.sx * scale, lh = H * LCD_RECT.sy * scale;
  canvas.style.left = ox + LCD_RECT.x * scale + 'px';
  canvas.style.top = oy + LCD_RECT.y * scale + 'px';
  canvas.style.width = lw + 'px'; canvas.style.height = lh + 'px';
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(lw * dpr); canvas.height = Math.round(lh * dpr);
  // hit areas
  keysLayer.innerHTML = '';
  for (const k of KEYS) {
    const d = document.createElement('div');
    d.className = 'hit';
    let x, y, ww, hh;
    if (k.w) { x = k.x; y = k.y; ww = k.w; hh = k.h; d.classList.add('rect'); }
    else { const rx = k.rx || k.r, ry = k.ry || k.r; x = k.cx - rx; y = k.cy - ry; ww = rx * 2; hh = ry * 2; }
    Object.assign(d.style, { left: ox + x * scale + 'px', top: oy + y * scale + 'px', width: ww * scale + 'px', height: hh * scale + 'px' });
    d.dataset.key = k.id;
    keysLayer.appendChild(d);
  }
  paint();
}

// ------------------------------------------------------------------ LCD painting
// four gray levels on the greenish-gray glass; contrast setting darkens/lightens the ink
const BG = [194, 205, 201];
// level 0 = glass, 1/2 = light/dark grey, 3 = black, 4 = ghost (unlit indicator)
function inkColor(level, contrast) {
  const k = Math.min(1, 0.7 + contrast * 0.075); // contrast 0..8, default 4 = full black
  const target = [8, 10, 12];
  const f = [0, 0.38, 0.68, 1, 0.13][level] * (level === 4 ? 1 : k);
  return BG.map((b, i) => Math.round(b + (target[i] - b) * f));
}
let lastBlink = true;
function paint() {
  const lcd = calc.render();
  const cw = canvas.width, ch = canvas.height;
  ctx.clearRect(0, 0, cw, ch);
  if (!calc.on) { ctx.fillStyle = `rgb(${BG})`; ctx.fillRect(0, 0, cw, ch); return; }
  ctx.fillStyle = `rgb(${BG})`;
  ctx.fillRect(0, 0, cw, ch);
  const px = cw / W, py = ch / H;
  const gap = Math.max(0, Math.min(px, py) * 0.05);
  const colors = [null, 1, 2, 3, 4].map((l) => (l ? `rgb(${inkColor(l, calc.settings.contrast)})` : null));
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let v = lcd.get(x, y);
      if (!v && lcd.ghost[y * W + x]) v = 4;
      if (!v) continue;
      ctx.fillStyle = colors[v];
      ctx.fillRect(x * px, y * py, px - gap, py - gap);
    }
  }
}

// cursor blink (0.5 s) and redraw
setInterval(() => { calc.blink = !calc.blink; paint(); }, 500);

function press(id) {
  calc.blink = true;
  calc.press(id);
  paint();
}

// ------------------------------------------------------------------ mouse
let downEl = null;
keysLayer.addEventListener('pointerdown', (e) => {
  const t = e.target.closest('.hit');
  if (!t) return;
  e.preventDefault();
  downEl = t;
  const g = svg.querySelector(`.key[data-key="${t.dataset.key}"]`);
  if (g) g.classList.add('down');
  press(t.dataset.key);
});
window.addEventListener('pointerup', () => {
  if (!downEl) return;
  const g = svg.querySelector(`.key[data-key="${downEl.dataset.key}"]`);
  if (g) g.classList.remove('down');
  downEl = null;
});

// ------------------------------------------------------------------ keyboard
function flash(id) {
  const g = svg.querySelector(`.key[data-key="${id}"]`);
  if (!g) return;
  g.classList.add('down');
  setTimeout(() => g.classList.remove('down'), 110);
}
const SHIFTED_TYPING = { '!': ['CATALOG'], '%': null };
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey) {
    const yid = KEYBOARD_CTRL_SHIFT_MAP[e.code];
    if (yid) {
      e.preventDefault();
      if (!calc.shift) { flash('SHIFT'); calc.press('SHIFT'); }
      flash(yid);
      press(yid);
      return;
    }
  }
  if (e.ctrlKey && (e.key === '=' || e.key === '+')) { e.preventDefault(); resizeBy(1.1); return; }
  if (e.ctrlKey && e.key === '-') { e.preventDefault(); resizeBy(1 / 1.1); return; }
  if (e.ctrlKey && e.key === '0') { e.preventDefault(); window.shell && window.shell.scale(860, 'center'); return; }
  if (e.ctrlKey || e.altKey || e.metaKey) return;
  const sid = KEYBOARD_SHIFT_MAP[e.key];
  if (sid) {
    e.preventDefault();
    if (!calc.shift) { flash('SHIFT'); calc.press('SHIFT'); }
    flash(sid);
    press(sid);
    return;
  }
  const id = KEYBOARD_MAP[e.key];
  if (!id) return;
  e.preventDefault();
  void SHIFTED_TYPING;
  flash(id);
  press(id);
});

// ------------------------------------------------------------------ window scaling (aspect locked)
async function resizeBy(f) {
  if (!window.shell) return;
  const h = await window.shell.height();
  window.shell.scale(Math.round(h * f), 'center');
}
window.addEventListener('wheel', (e) => {
  if (!e.ctrlKey) return;
  e.preventDefault();
  resizeBy(e.deltaY < 0 ? 1.06 : 1 / 1.06);
}, { passive: false });
const grip = document.getElementById('grip');
grip.addEventListener('pointerdown', async (e) => {
  e.preventDefault();
  grip.setPointerCapture(e.pointerId);
  const startY = e.screenY, startX = e.screenX;
  const startH = window.shell ? await window.shell.height() : window.innerHeight;
  const move = (ev) => {
    const dy = ev.screenY - startY, dx = ev.screenX - startX;
    const dh = Math.max(dy, (dx * BODY_H) / BODY_W);
    if (window.shell) window.shell.scale(Math.round(startH + dh), 'topleft');
  };
  const up = () => { grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up); };
  grip.addEventListener('pointermove', move);
  grip.addEventListener('pointerup', up);
});

window.addEventListener('resize', layout);
layout();
void root;

// automated screenshot mode (used by the test scripts): --test-screens <json file>
if (window.shell) {
  window.shell.testMode().then(async (spec) => {
    if (spec === null || spec === undefined) return;
    const res = await fetch('file:///' + spec.replace(/\\/g, '/'));
    const jobs = await res.json();
    await new Promise((r) => setTimeout(r, 1000));
    for (const job of jobs) {
      calc.initializeAll(); calc.showHome = !!job.home;
      for (const k of job.keys.split(/\s+/).filter(Boolean)) calc.press(k);
      // optional PC-keyboard input, e.g. ["S", "0", ".", "5", "Enter"] (Shift is implied by upper-case letters)
      // "Ctrl+Shift+Digit7" style entries send that physical key (KeyboardEvent.code) with Ctrl+Shift
      for (const key of job.kbd || []) {
        const cs = /^Ctrl\+Shift\+(.+)$/.exec(key);
        window.dispatchEvent(new KeyboardEvent('keydown', cs
          ? { key: '', code: cs[1], ctrlKey: true, shiftKey: true, cancelable: true }
          : { key, shiftKey: /^[A-Z]$/.test(key), cancelable: true }));
      }
      if (job.shortcuts) await window.shell.captureShortcuts(job.shortcuts);
      calc.blink = false; paint();
      await new Promise((r) => setTimeout(r, 120));
      await window.shell.capture(job.out);
    }
    window.shell.quit();
  });
}
