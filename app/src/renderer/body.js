// Calculator body drawn as SVG in the coordinate system of the official front photo crop
// (909 × 1913 px, 11.8 px per mm).  Key centres/sizes were measured from that photo.
export const BODY_W = 909, BODY_H = 1913;
export const LCD_RECT = { x: 101.4, y: 313, sx: 3.55, sy: 3.36 }; // LCD pixel (0,0) and pitch

const S = 43;   // small key radius
const B = 55.5; // big key radius

export const KEYS = [
  { id: 'ON', cx: 119, cy: 743, rx: 34, ry: 32, kind: 'on' },
  { id: 'HOME', cx: 252, cy: 750, r: S },
  { id: 'UP', cx: 519, cy: 752, r: S },
  { id: 'PGUP', kind: 'rockerTop', x: 743, y: 711, w: 86, h: 99 },
  { id: 'PGDN', kind: 'rockerBottom', x: 743, y: 810, w: 86, h: 99 },
  { id: 'SETTINGS', cx: 119, cy: 867, r: S },
  { id: 'BACK', cx: 252, cy: 866, r: S },
  { id: 'LEFT', cx: 385, cy: 869, r: S },
  { id: 'OK', cx: 519, cy: 869, r: S },
  { id: 'RIGHT', cx: 653, cy: 869, r: S },
  { id: 'DOWN', cx: 519, cy: 986, r: S },
  { id: 'SHIFT', cx: 120, cy: 1008, r: S, kind: 'shift' },
  { id: 'VARIABLE', cx: 253, cy: 1010, r: S },
  { id: 'FUNCTION', cx: 386, cy: 1009, r: S },
  { id: 'CATALOG', cx: 652, cy: 1009, r: S },
  { id: 'TOOLS', cx: 786, cy: 1008, r: S },
  ...['X', 'FRAC', 'SQRT', 'POW', 'SQR', 'LOGB'].map((id, i) => ({ id, cx: [120, 253, 386, 519, 653, 786][i], cy: 1126, r: S })),
  ...['ANS', 'SIN', 'COS', 'TAN', 'LPAR', 'RPAR'].map((id, i) => ({ id, cx: [120, 253, 386, 520, 653, 786][i], cy: 1243, r: S })),
  ...[['D7', 'D8', 'D9', 'DEL', 'AC'], ['D4', 'D5', 'D6', 'MUL', 'DIV'], ['D1', 'D2', 'D3', 'ADD', 'SUB'], ['D0', 'DOT', 'EXP10', 'FORMAT', 'EXE']]
    .flatMap((row, r) => row.map((id, c) => ({ id, cx: [126, 290, 453, 616, 779][c], cy: [1372, 1509, 1645, 1782][r], r: B }))),
];

const SECTION_LABELS = [
  ['ON', 119, 688, '#e6e6e6'], ['HOME', 252, 688, '#e6e6e6'], ['SETTINGS', 120, 804, '#e6e6e6'],
  ['SHIFT', 120, 945, '#d9bf86'], ['VARIABLE', 253, 945, '#e6e6e6'], ['FUNCTION', 386, 945, '#e6e6e6'],
  ['CATALOG', 652, 945, '#e6e6e6'], ['TOOLS', 786, 945, '#e6e6e6'],
];

const GOLD = '#d8b971';
const WHITE = '#e9e9ea';
const FONT = "font-family:'Bahnschrift','DIN Alternate','Arial Narrow',Arial,sans-serif;font-stretch:condensed";

// ---------------------------------------------------------------- key faces
function text(x, y, s, size, fill = WHITE, extra = '') {
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="middle" dominant-baseline="central" style="${FONT};font-weight:600;font-variation-settings:'wdth' 75,'wght' 600" ${extra}>${s}</text>`;
}
function italic(x, y, s, size, fill = WHITE) {
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="middle" dominant-baseline="central" style="font-family:'Times New Roman',serif;font-style:italic;font-weight:600">${s}</text>`;
}
const sq = (x, y, w, h, fill = WHITE) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
const sqo = (x, y, w, h, sw = 2.5) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${WHITE}" stroke-width="${sw}"/>`;

function face(k) {
  const { cx, cy } = k;
  switch (k.id) {
    case 'HOME': return `<path d="M${cx - 15} ${cy + 13} V${cy - 3} L${cx} ${cy - 16} L${cx + 15} ${cy - 3} V${cy + 13} Z" fill="none" stroke="${WHITE}" stroke-width="4.5" stroke-linejoin="round"/>`;
    case 'SETTINGS': return [-11, 0, 11].map((dy, i) => `<line x1="${cx - 19}" y1="${cy + dy}" x2="${cx + 19}" y2="${cy + dy}" stroke="${WHITE}" stroke-width="4"/>` +
      `<rect x="${cx + [-10, 4, -4][i] - 4}" y="${cy + dy - 5}" width="8" height="10" rx="1.5" fill="${WHITE}"/>`).join('');
    case 'BACK': return `<path d="M${cx - 10} ${cy - 12} L${cx - 18} ${cy - 4} L${cx - 10} ${cy + 4} M${cx - 17} ${cy - 4} H${cx + 6} A11 11 0 0 1 ${cx + 6} ${cy + 18} H${cx - 6}" fill="none" stroke="${WHITE}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'UP': return chevron(cx, cy, 'up');
    case 'DOWN': return chevron(cx, cy, 'down');
    case 'LEFT': return chevron(cx, cy, 'left');
    case 'RIGHT': return chevron(cx, cy, 'right');
    case 'OK': return text(cx, cy + 1, 'OK', 40);
    case 'SHIFT': return `<path d="M${cx} ${cy - 22} L${cx + 18} ${cy - 2} H${cx + 8} V${cy + 20} H${cx - 8} V${cy - 2} H${cx - 18} Z" fill="none" stroke="#4b3b1c" stroke-width="3.5" stroke-linejoin="round"/>`;
    case 'VARIABLE': return `<rect x="${cx - 24}" y="${cy - 17}" width="48" height="34" fill="none" stroke="${WHITE}" stroke-width="2.6"/>` +
      `<path d="M${cx - 19} ${cy - 6} H${cx - 4} M${cx - 8} ${cy - 10} L${cx - 4} ${cy - 6} L${cx - 8} ${cy - 2} M${cx - 4} ${cy + 5} H${cx - 19} M${cx - 15} ${cy + 1} L${cx - 19} ${cy + 5} L${cx - 15} ${cy + 9}" stroke="${WHITE}" stroke-width="2.6" fill="none"/>` +
      italic(cx + 10, cy, '𝑥', 32);
    case 'FUNCTION': return text(cx - 12, cy + 1, 'f', 40) + italic(cx + 10, cy + 3, '(𝑥)', 26);
    case 'CATALOG': return `<path d="M${cx} ${cy - 9} C${cx - 8} ${cy - 15} ${cx - 18} ${cy - 15} ${cx - 23} ${cy - 12} V${cy + 13} C${cx - 18} ${cy + 10} ${cx - 8} ${cy + 10} ${cx} ${cy + 15} C${cx + 8} ${cy + 10} ${cx + 18} ${cy + 10} ${cx + 23} ${cy + 13} V${cy - 12} C${cx + 18} ${cy - 15} ${cx + 8} ${cy - 15} ${cx} ${cy - 9} V${cy + 15}" fill="none" stroke="${WHITE}" stroke-width="3.5" stroke-linejoin="round"/>`;
    case 'TOOLS': return [-15, 0, 15].map((dx) => `<circle cx="${cx + dx}" cy="${cy}" r="5.5" fill="none" stroke="${WHITE}" stroke-width="3"/>`).join('');
    case 'X': return italic(cx, cy, '𝑥', 52);
    case 'FRAC': return sqo(cx - 11, cy - 17, 22, 11) + sq(cx - 16, cy - 2, 32, 4) + sqo(cx - 11, cy + 6, 22, 11);
    case 'SQRT': return `<path d="M${cx - 22} ${cy + 1} L${cx - 17} ${cy - 2} L${cx - 10} ${cy + 16} L${cx - 1} ${cy - 18}" stroke="${WHITE}" stroke-width="4.5" fill="none" stroke-linejoin="round"/>` + sq(cx + 3, cy - 6, 16, 18);
    case 'POW': return sq(cx - 16, cy - 7, 24, 24) + sqo(cx + 11, cy - 17, 9, 9, 2.6);
    case 'SQR': return sq(cx - 16, cy - 7, 24, 24) + text(cx + 15, cy - 14, '2', 24);
    case 'LOGB': return text(cx - 10, cy + 1, 'log', 32) + sq(cx + 13, cy + 1, 9, 9) + sqo(cx + 23, cy - 11, 7, 16, 2.4);
    case 'ANS': return text(cx, cy + 1, 'Ans', 38);
    case 'SIN': return text(cx, cy + 1, 'sin', 40);
    case 'COS': return text(cx, cy + 1, 'cos', 40);
    case 'TAN': return text(cx, cy + 1, 'tan', 40);
    case 'LPAR': return text(cx, cy + 1, '(', 42);
    case 'RPAR': return text(cx, cy + 1, ')', 42);
    case 'DEL': return `<path d="M${cx - 28} ${cy} L${cx - 14} ${cy - 15} H${cx + 26} V${cy + 15} H${cx - 14} Z" fill="${WHITE}"/>` +
      `<path d="M${cx - 2} ${cy - 7} L${cx + 12} ${cy + 7} M${cx + 12} ${cy - 7} L${cx - 2} ${cy + 7}" stroke="#3d3d3f" stroke-width="5" stroke-linecap="round"/>`;
    case 'AC': return text(cx, cy + 2, 'AC', 50);
    case 'MUL': return `<path d="M${cx - 12} ${cy - 12} L${cx + 12} ${cy + 12} M${cx + 12} ${cy - 12} L${cx - 12} ${cy + 12}" stroke="${WHITE}" stroke-width="6" stroke-linecap="round"/>`;
    case 'DIV': return sq(cx - 18, cy - 2.5, 36, 5) + `<circle cx="${cx}" cy="${cy - 13}" r="4" fill="${WHITE}"/><circle cx="${cx}" cy="${cy + 13}" r="4" fill="${WHITE}"/>`;
    case 'ADD': return sq(cx - 19, cy - 3, 38, 6) + sq(cx - 3, cy - 19, 6, 38);
    case 'SUB': return sq(cx - 20, cy - 3, 40, 6);
    case 'DOT': return `<circle cx="${cx}" cy="${cy + 20}" r="5" fill="${WHITE}"/>`;
    case 'EXP10': return text(cx - 4, cy + 4, '×10', 46) + sq(cx + 26, cy - 22, 10, 10);
    case 'FORMAT': return text(cx, cy + 1, 'FORMAT', 31) +
      `<path d="M${cx - 26} ${cy - 18} A32 26 0 0 1 ${cx + 24} ${cy - 22} M${cx + 26} ${cy + 18} A32 26 0 0 1 ${cx - 24} ${cy + 22}" stroke="${WHITE}" stroke-width="3.5" fill="none"/>` +
      `<path d="M${cx + 16} ${cy - 29} L${cx + 27} ${cy - 21} L${cx + 15} ${cy - 15} M${cx - 16} ${cy + 29} L${cx - 27} ${cy + 21} L${cx - 15} ${cy + 15}" stroke="${WHITE}" stroke-width="3.5" fill="none" stroke-linejoin="round"/>`;
    case 'EXE': return text(cx, cy + 2, 'EXE', 46);
    default: {
      if (/^D\d$/.test(k.id)) return text(cx, cy + 2, k.id[1], 58, WHITE, 'font-weight="500"');
      return '';
    }
  }
}

function chevron(cx, cy, dir) {
  const d = { up: `M${cx - 15} ${cy + 8} L${cx} ${cy - 9} L${cx + 15} ${cy + 8}`, down: `M${cx - 15} ${cy - 8} L${cx} ${cy + 9} L${cx + 15} ${cy - 8}`,
    left: `M${cx + 8} ${cy - 15} L${cx - 9} ${cy} L${cx + 8} ${cy + 15}`, right: `M${cx - 8} ${cy - 15} L${cx + 9} ${cy} L${cx - 8} ${cy + 15}` }[dir];
  return `<path d="${d}" stroke="${WHITE}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
}

// SHIFT legends (gold) with the "└" bracket pointing at the key, measured from the photo
const SHIFT_LEGEND = {
  X: 'QR', FRAC: 'mixed', SQRT: 'root', POW: 'recip', SQR: 'log', LOGB: 'ln', SIN: 'sin⁻¹', COS: 'cos⁻¹', TAN: 'tan⁻¹',
  LPAR: '=', RPAR: ',', D7: 'π', D8: 'e', D9: 'i', DEL: 'INS', D4: 'A', D5: 'B', D6: 'C', D1: 'D', D2: 'E', D3: 'F',
  ADD: '°′″', SUB: '(−)', D0: 'x', DOT: 'y', EXP10: 'z', FORMAT: 'cycle', EXE: '≈', CATALOG: 'list',
};
function shiftLegend(k) {
  const lg = SHIFT_LEGEND[k.id];
  if (!lg) return '';
  const big = k.r > 50;
  const lx = k.cx - (big ? 70 : 69), ly = k.cy - (big ? 38 : 53);   // legend centre-left / centre-y
  const bx = k.cx - (big ? 63 : 61), by0 = ly + (big ? 12 : 13), by1 = k.cy - (big ? 10 : 22), bx1 = bx + 13;
  let g = `<path d="M${bx} ${by0} V${by1} H${bx1}" stroke="${GOLD}" stroke-width="3" fill="none"/>`;
  const t = (s, size, x = lx, style = '') => `<text x="${x}" y="${ly}" font-size="${size}" fill="${GOLD}" dominant-baseline="central" style="${style || FONT + ';font-weight:600;font-variation-settings:\'wdth\' 75,\'wght\' 600'}">${s}</text>`;
  const ital = "font-family:'Times New Roman',serif;font-style:italic;font-weight:600";
  switch (lg) {
    case 'mixed': g += sq(lx, ly - 4, 9, 9, GOLD) + `<rect x="${lx + 14}" y="${ly - 12}" width="13" height="7" fill="none" stroke="${GOLD}" stroke-width="2.4"/>` + sq(lx + 12, ly - 2, 17, 3, GOLD) + `<rect x="${lx + 14}" y="${ly + 4}" width="13" height="7" fill="none" stroke="${GOLD}" stroke-width="2.4"/>`; break;
    case 'root': g += sq(lx, ly - 12, 8, 8, GOLD) + `<path d="M${lx + 4} ${ly + 1} L${lx + 8} ${ly - 1} L${lx + 13} ${ly + 11} L${lx + 19} ${ly - 11}" stroke="${GOLD}" stroke-width="3" fill="none"/><rect x="${lx + 21}" y="${ly - 2}" width="9" height="11" fill="none" stroke="${GOLD}" stroke-width="2.4"/>`; break;
    case 'recip': g += sq(lx, ly - 4, 12, 12, GOLD) + t('-1', 22, lx + 13); break;
    case 'cycle': g += `<path d="M${lx + 3} ${ly - 3} A10 10 0 0 1 ${lx + 21} ${ly - 7} M${lx + 22} ${ly + 3} A10 10 0 0 1 ${lx + 4} ${ly + 7}" stroke="${GOLD}" stroke-width="2.6" fill="none"/><path d="M${lx + 17} ${ly - 11} L${lx + 22} ${ly - 6} L${lx + 16} ${ly - 3} M${lx + 8} ${ly + 11} L${lx + 3} ${ly + 6} L${lx + 9} ${ly + 3}" stroke="${GOLD}" stroke-width="2.4" fill="none"/>`; break;
    case 'list': g = `<path d="M${k.cx - 85} ${k.cy - 52} H${k.cx - 74} M${k.cx - 85} ${k.cy - 44} H${k.cx - 74} M${k.cx - 85} ${k.cy - 36} H${k.cx - 74}" stroke="${GOLD}" stroke-width="3.5"/>` +
      [-52, -44, -36].map((dy) => `<rect x="${k.cx - 92}" y="${k.cy + dy - 2}" width="4" height="4" fill="${GOLD}"/>`).join('') +
      `<path d="M${k.cx - 80} ${k.cy - 30} V${k.cy - 21} H${k.cx - 68}" stroke="${GOLD}" stroke-width="3" fill="none"/>`; break;
    case 'π': case 'e': case 'i': case 'x': case 'y': case 'z': g += t(lg === 'π' ? 'π' : lg, 30, lx, ital); break;
    case '≈': g += t('≈', 30); break;
    case 'INS': g += t('INS', 25); break;
    default: g += t(lg, big ? 26 : 25);
  }
  return g;
}

// ---------------------------------------------------------------- body
export function buildBodySVG() {
  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BODY_W} ${BODY_H}" width="100%" height="100%">`);
  parts.push(`<defs>
    <linearGradient id="bodyG" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="#1c1c1d"/><stop offset="0.035" stop-color="#2e2e2f"/><stop offset="0.5" stop-color="#2a2a2b"/>
      <stop offset="0.965" stop-color="#2e2e2f"/><stop offset="1" stop-color="#1a1a1b"/></linearGradient>
    <radialGradient id="keyG" cx="0.5" cy="0.38" r="0.62"><stop offset="0" stop-color="#4c4c4f"/><stop offset="0.82" stop-color="#3f3f42"/><stop offset="1" stop-color="#2f2f31"/></radialGradient>
    <radialGradient id="bigKeyG" cx="0.5" cy="0.35" r="0.65"><stop offset="0" stop-color="#4f4f52"/><stop offset="0.85" stop-color="#424245"/><stop offset="1" stop-color="#333335"/></radialGradient>
    <radialGradient id="shiftG" cx="0.42" cy="0.32" r="0.75"><stop offset="0" stop-color="#e9dcb8"/><stop offset="0.55" stop-color="#c5ae7c"/><stop offset="1" stop-color="#8d774a"/></radialGradient>
    <linearGradient id="solarG" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#3a2421"/><stop offset="1" stop-color="#2a1a18"/></linearGradient>
    <linearGradient id="lcdG" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#b9c4c0"/><stop offset="0.12" stop-color="#c4cfcb"/><stop offset="1" stop-color="#c0cbc7"/></linearGradient>
    <filter id="keyShadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="#000" flood-opacity="0.75"/></filter>
  </defs>`);
  // body shell
  parts.push(`<path d="M70 0 H839 Q909 0 909 70 V1843 Q909 1913 839 1913 H70 Q0 1913 0 1843 V70 Q0 0 70 0 Z" fill="#141415"/>`);
  parts.push(`<path d="M74 8 H835 Q901 8 901 74 V1839 Q901 1905 835 1905 H74 Q8 1905 8 1839 V74 Q8 8 74 8 Z" fill="url(#bodyG)"/>`);
  parts.push(`<rect x="327" y="0" width="16" height="6" rx="2" fill="#3a3a3a"/><rect x="556" y="0" width="16" height="6" rx="2" fill="#3a3a3a"/>`);
  parts.push(`<rect x="318" y="1907" width="14" height="6" rx="2" fill="#3a3a3a"/><rect x="547" y="1907" width="14" height="6" rx="2" fill="#3a3a3a"/>`);
  // branding
  parts.push(`<text x="98" y="131" font-size="47" fill="#d0d0d2" style="font-family:Arial Black,Arial,sans-serif;font-weight:900;letter-spacing:1px" dominant-baseline="central">OPENSCI</text>`);
  parts.push(`<text x="103" y="190" font-size="29" fill="#e8e8e8" style="font-family:Arial,sans-serif;font-weight:700" dominant-baseline="central">SCIENTIFIC</text>`);
  parts.push(`<text x="104" y="225" font-size="23" fill="#e8e8e8" style="font-family:Arial,sans-serif;font-weight:700" dominant-baseline="central">CALCULATOR</text>`);
  // solar panel
  parts.push(`<rect x="408" y="68" width="394" height="170" rx="24" fill="url(#solarG)" stroke="#1c1210" stroke-width="2"/>`);
  // LCD bezel and glass
  parts.push(`<rect x="66" y="272" width="773" height="380" rx="26" fill="#2f2f30" stroke="#1d1d1e" stroke-width="3"/>`);
  parts.push(`<rect x="92" y="291" width="722" height="291" rx="14" fill="url(#lcdG)" stroke="#8f9895" stroke-width="2"/>`);
  // navigation cross well
  parts.push(`<path d="M465 700 H573 Q593 700 593 720 V815 H690 Q712 815 712 837 V901 Q712 923 690 923 H593 V1028 Q593 1048 573 1048 H465 Q445 1048 445 1028 V923 H348 Q326 923 326 901 V837 Q326 815 348 815 H445 V720 Q445 700 465 700 Z" fill="#111112"/>`);
  // section labels
  for (const [t, x, y, c] of SECTION_LABELS) {
    parts.push(`<text x="${x}" y="${y}" font-size="26" fill="${c}" text-anchor="middle" dominant-baseline="central" style="${FONT};font-weight:700;font-variation-settings:'wdth' 75,'wght' 700">${t}</text>`);
  }
  // OFF badge (SHIFT AC)
  parts.push(`<rect x="676" y="1290" width="84" height="35" rx="10" fill="${GOLD}"/>` + text(718, 1308, 'OFF', 29, '#1c1c1c'));
  // keys
  for (const k of KEYS) {
    parts.push(`<g class="key" data-key="${k.id}">`);
    if (k.kind === 'on') {
      parts.push(`<ellipse cx="${k.cx}" cy="${k.cy + 2}" rx="${k.rx}" ry="${k.ry}" fill="#121213"/>`);
      parts.push(`<g class="cap"><ellipse cx="${k.cx}" cy="${k.cy}" rx="${k.rx - 2}" ry="${k.ry - 2}" fill="url(#keyG)" filter="url(#keyShadow)"/>`);
      parts.push(`<rect x="${k.cx - 3}" y="${k.cy - 22}" width="6" height="16" rx="3" fill="#0b0b0b"/></g>`);
    } else if (k.kind === 'rockerTop' || k.kind === 'rockerBottom') {
      if (k.kind === 'rockerTop') parts.push(`<rect x="743" y="711" width="86" height="198" rx="43" fill="#121213"/>`);
      const top = k.kind === 'rockerTop';
      const d = top ? `M743 754 Q743 711 786 711 Q829 711 829 754 V810 H743 Z` : `M743 810 H829 V866 Q829 909 786 909 Q743 909 743 866 Z`;
      parts.push(`<g class="cap"><path d="${d}" fill="url(#keyG)" filter="url(#keyShadow)"/>`);
      const cx = 786, cy = top ? 772 : 848;
      const ch = (y, up) => `<path d="M${cx - 15} ${y + (up ? 8 : -8)} L${cx} ${y + (up ? -8 : 8)} L${cx + 15} ${y + (up ? 8 : -8)}" stroke="${WHITE}" stroke-width="4.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
      parts.push(top ? ch(cy - 7, true) + ch(cy + 9, true) : ch(cy - 9, false) + ch(cy + 7, false));
      if (top) parts.push(`<line x1="${cx - 15}" y1="${cy - 22}" x2="${cx + 15}" y2="${cy - 22}" stroke="${WHITE}" stroke-width="0" />`);
      parts.push('</g>');
    } else {
      const fill = k.kind === 'shift' ? 'url(#shiftG)' : k.r > 50 ? 'url(#bigKeyG)' : 'url(#keyG)';
      parts.push(`<circle cx="${k.cx}" cy="${k.cy + 2}" r="${k.r + 3}" fill="#121213"/>`);
      parts.push(`<g class="cap"><circle cx="${k.cx}" cy="${k.cy}" r="${k.r}" fill="${fill}" filter="url(#keyShadow)"/>`);
      parts.push(face(k));
      parts.push('</g>');
    }
    parts.push(shiftLegend(k));
    parts.push('</g>');
  }
  parts.push('</svg>');
  return parts.join('\n');
}
