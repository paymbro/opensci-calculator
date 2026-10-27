// Static + runtime audit: every character that can reach the LCD must exist in the font used.
import fs from 'node:fs';
import { BIG, SMALL } from '../src/core/fonts.js';
import { normalize, LCD } from '../src/core/lcd.js';
import { tokenText } from '../src/core/render.js';
import { COMMON, COMPLEX_CAT, MATRIX_CAT, VECTOR_CAT, SPREADSHEET_CAT, BASEN_CATS, EQUATION_CAT, statisticsCategory, regressionItems, catalogList } from '../src/core/catalog.js';
const missBig = new Map(), missSmall = new Map();
const chk = (s, where, font, map) => { for (const ch of Array.from(normalize(s))) if (ch !== ' ' && !font[ch]) { if (!map.has(ch)) map.set(ch, new Set()); map.get(ch).add(where + ': ' + s); } };
// runtime hook
const ob = LCD.prototype.bigText, os = LCD.prototype.smallText;
LCD.prototype.bigText = function (s, ...a) { chk(s, 'big', BIG, missBig); return ob.call(this, s, ...a); };
LCD.prototype.smallText = function (s, ...a) { chk(s, 'small', SMALL, missSmall); return os.call(this, s, ...a); };
// catalogs: labels drawn big in menus, list labels small, tokens big in input
const cats = [...COMMON, COMPLEX_CAT, MATRIX_CAT, VECTOR_CAT, SPREADSHEET_CAT, EQUATION_CAT, ...BASEN_CATS, statisticsCategory(false), statisticsCategory(true), { label: 'r', items: regressionItems('lin') }, { label: 'q', items: regressionItems('quad') }];
const walk = (c) => { for (const it of c.items || []) { if (it.items) walk(it); chk(it.label, 'menu', BIG, missBig); chk(it.label, 'smallmenu', SMALL, missSmall); if (it.spec && it.spec.tokens) for (const t of it.spec.tokens) { chk(tokenText(t), 'token', BIG, missBig); chk(tokenText(t), 'tokensmall', SMALL, missSmall); } } };
cats.forEach(walk);
for (const it of catalogList(cats, true)) chk(it.label, 'catlist', SMALL, missSmall);
// string literals in label positions
for (const f of fs.readdirSync('src/apps').concat(fs.readdirSync('src/core').map((x) => '../core/' + x))) {
  if (!f.endsWith('.js')) continue;
  const src = fs.readFileSync('src/apps/' + f, 'utf8');
  for (const m of src.matchAll(/label: ?'([^']+)'/g)) chk(m[1], 'label ' + f, BIG, missBig);
  for (const m of src.matchAll(/bigText\('([^']+)'/g)) chk(m[1], 'bigText ' + f, BIG, missBig);
  for (const m of src.matchAll(/smallText\('([^']+)'/g)) chk(m[1], 'smallText ' + f, SMALL, missSmall);
}
// keys inserted by every input key
import { inputKey } from '../src/core/input.js';
import { Editor } from '../src/core/expr.js';
import { KEY_IDS, SHIFTED } from '../src/core/keys.js';
import { DEFAULT_SETTINGS } from '../src/core/format.js';
for (const math of [true, false]) for (const k of [...KEY_IDS, ...Object.values(SHIFTED)]) {
  const ed = new Editor({ math }); inputKey(ed, k, { settings: DEFAULT_SETTINGS, allowI: true, allowEq: true });
  for (const it of ed.root) if (it.k === 't') { chk(tokenText(it.v), 'key ' + k, BIG, missBig); chk(tokenText(it.v), 'keysmall ' + k, SMALL, missSmall); }
}
// runtime fuzz to exercise screens
const { newCalc, frame } = await import('./harness.mjs');
let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
for (const app of ['D1','D2','D3','D4','D5','D6','D7','D8','D9','D0','ADD','SUB','MUL']) for (let r = 0; r < 40; r++) {
  const c = newCalc(); c.press('HOME'); c.press(app);
  for (let i = 0; i < 100; i++) { let k = KEY_IDS[Math.floor(rnd() * KEY_IDS.length)]; if (k === 'ON' || k === 'HOME') k = 'OK'; try { c.press(k); frame(c); } catch (e) { break; } }
}
const show = (m, name) => { console.log(`== missing in ${name}: ${m.size}`); for (const [ch, w] of m) console.log(JSON.stringify(ch), ch.codePointAt(0).toString(16), [...w].slice(0, 3).join(' | ')); };
show(missBig, 'BIG'); show(missSmall, 'SMALL');
