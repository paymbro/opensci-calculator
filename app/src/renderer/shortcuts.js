// Keyboard shortcuts window (opened from SETTINGS > Get Started).  Lists every calculator key, SHIFT
// function and window action with its PC shortcuts, and lets the user add (+), remove (×) and reset
// them.  Changes are saved to localStorage, which the calculator window reloads straight away.
import {
  ACTIONS, actionLabel, shiftKeyLabel, comboOf, comboKeys, loadOverrides, saveOverrides,
  effectiveBindings, addBinding, removeBinding, resetBinding,
} from '../core/bindings.js';

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const kbd = (k) => `<kbd>${esc(k)}</kbd>`;
const comboHTML = (c) => comboKeys(c).map(kbd).join('+');
const comboText = (c) => comboKeys(c).join('+');

const keyActions = (ids) => ids.map((id) => 'key:' + id);
const SECTIONS = [
  ['Numbers and arithmetic', keyActions(['D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'DOT', 'ADD', 'SUB', 'MUL', 'DIV', 'LPAR', 'RPAR', 'POW', 'EXE'])],
  ['Functions', keyActions(['X', 'SIN', 'COS', 'TAN', 'SQRT', 'SQR', 'LOGB', 'EXP10', 'FRAC', 'ANS'])],
  ['Editing and moving', keyActions(['DEL', 'AC', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'PGUP', 'PGDN', 'OK', 'BACK'])],
  ['Menu keys', keyActions(['HOME', 'SHIFT', 'VARIABLE', 'FUNCTION', 'CATALOG', 'TOOLS', 'SETTINGS', 'FORMAT', 'ON'])],
  ['Yellow SHIFT functions', ACTIONS.filter((a) => a.startsWith('shift:'))],
  ['Window', ACTIONS.filter((a) => a.startsWith('win:'))],
];

let overrides = loadOverrides(localStorage);
let capturing = null;   // action waiting for a key press
const main = document.getElementById('list');
const toast = document.getElementById('toast');
let toastTimer = 0;

function say(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 4500);
}

function apply({ overrides: o, moved }, added) {
  overrides = o;
  saveOverrides(localStorage, overrides);
  if (added && moved.length) say(`${comboText(added)} was taken from “${actionLabel(moved[0].from)}”.`);
  render();
}

function render() {
  const y = window.scrollY;
  const b = effectiveBindings(overrides);
  main.innerHTML = '';
  for (const [title, actions] of SECTIONS) {
    main.appendChild(el('h2', '', esc(title)));
    const t = el('table');
    for (const a of actions) {
      const tr = el('tr');
      tr.dataset.action = a;
      const what = el('td', 'what', esc(actionLabel(a)) + (a.startsWith('shift:') ? ` <span class="sub">SHIFT ${esc(shiftKeyLabel(a))}</span>` : ''));
      if (overrides[a]) {
        const r = el('button', 'link', 'Reset');
        r.title = 'Go back to the default shortcuts for this';
        r.onclick = () => apply(resetBinding(overrides, a));
        what.append(' ', r);
      }
      const keys = el('td', 'keys');
      for (const c of b[a]) {
        const chip = el('span', 'chip', comboHTML(c));
        const x = el('button', 'rm', '×');
        x.title = `Remove ${comboText(c)}`;
        x.onclick = () => apply(removeBinding(overrides, a, c));
        chip.appendChild(x);
        keys.appendChild(chip);
      }
      if (capturing === a) {
        keys.appendChild(el('span', 'waiting', 'Press a key or combination… <span class="sub">(Esc to cancel)</span>'));
      } else {
        const add = el('button', 'add', '+');
        add.title = 'Add a shortcut';
        add.onclick = () => { capturing = a; render(); };
        keys.appendChild(add);
      }
      tr.append(what, keys);
      t.appendChild(tr);
    }
    main.appendChild(t);
  }
  main.appendChild(el('p', 'note', `You can also press ${kbd('Tab')} (SHIFT) and then any key for its yellow function.
    ${kbd('Ctrl')}+mouse wheel resizes the calculator, and dragging its body moves it. ${kbd('Alt')}+${kbd('F4')} closes a window.`));
  window.scrollTo(0, y);
}

// while waiting for a shortcut, the next key press (with any modifiers) becomes it
document.addEventListener('keydown', (e) => {
  if (!capturing) return;
  e.preventDefault();
  e.stopPropagation();
  if (e.key === 'Escape' && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) { capturing = null; render(); return; }
  const c = comboOf(e);
  if (!c) return;   // a modifier on its own: keep waiting for the rest of the combination
  const a = capturing;
  capturing = null;
  apply(addBinding(overrides, a, c), c);
}, true);
document.addEventListener('mousedown', (e) => {
  if (capturing && !e.target.closest('.add')) { capturing = null; render(); }
});

document.getElementById('resetAll').onclick = () => {
  if (!Object.keys(overrides).length) { say('All shortcuts are already the defaults.'); return; }
  if (!window.confirm('Reset all keyboard shortcuts to the defaults?')) return;
  overrides = {};
  saveOverrides(localStorage, overrides);
  render();
  say('All shortcuts are back to the defaults.');
};

// another shortcuts window or the calculator changed them
window.addEventListener('storage', () => { overrides = loadOverrides(localStorage); render(); });

render();
