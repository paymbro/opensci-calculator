// Minimal QR Code (ISO/IEC 18004) encoder: byte mode, error correction level L, versions 1-11,
// automatic mask selection. Used for the QR key (SHIFT 𝑥) and the Get Started screen.

// [total codewords, ec codewords per block, blocks group1, data cw group1, blocks group2, data cw group2] for level L
const EC_L = {
  1: [26, 7, 1, 19, 0, 0], 2: [44, 10, 1, 34, 0, 0], 3: [70, 15, 1, 55, 0, 0], 4: [100, 20, 1, 80, 0, 0],
  5: [134, 26, 1, 108, 0, 0], 6: [172, 18, 2, 68, 0, 0], 7: [196, 20, 2, 78, 0, 0], 8: [242, 24, 2, 97, 0, 0],
  9: [292, 30, 2, 116, 0, 0], 10: [346, 18, 2, 68, 2, 69], 11: [404, 20, 4, 81, 0, 0],
};
const ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50], 11: [6, 30, 54] };

// GF(256)
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
(() => { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; })();
const gmul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

function rsGenerator(n) {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const ng = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) { ng[j] ^= g[j]; ng[j + 1] ^= gmul(g[j], EXP[i]); }
    g = ng;
  }
  return g;
}
function rsEncode(data, n) {
  const g = rsGenerator(n);
  const res = new Array(n).fill(0);
  for (const d of data) {
    const f = d ^ res[0];
    res.shift(); res.push(0);
    for (let i = 0; i < n; i++) res[i] ^= gmul(g[i + 1], f);
  }
  return res;
}

export function encodeQR(text, minVersion = 1, maxVersion = 11) {
  const bytes = Array.from(new TextEncoder().encode(text));
  let ver = minVersion;
  for (; ver <= maxVersion; ver++) {
    const [, , b1, d1, b2, d2] = EC_L[ver];
    const cap = b1 * d1 + b2 * d2;
    const lenBits = ver < 10 ? 8 : 16;
    if (4 + lenBits + bytes.length * 8 <= cap * 8) break;
  }
  if (ver > maxVersion) { ver = maxVersion; bytes.length = Math.max(0, bytes.length - 20); }
  const [, ecn, b1, d1, b2, d2] = EC_L[ver];
  const dataCap = b1 * d1 + b2 * d2;
  // bit stream
  const bits = [];
  const put = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >> i) & 1); };
  put(0b0100, 4); put(bytes.length, ver < 10 ? 8 : 16);
  for (const b of bytes) put(b, 8);
  put(0, Math.min(4, dataCap * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let pad = 0; data.length < dataCap; pad++) data.push(pad % 2 ? 0x11 : 0xec);
  // blocks
  const blocks = [];
  let p = 0;
  for (let i = 0; i < b1; i++) { blocks.push(data.slice(p, p + d1)); p += d1; }
  for (let i = 0; i < b2; i++) { blocks.push(data.slice(p, p + d2)); p += d2; }
  const ecBlocks = blocks.map((b) => rsEncode(b, ecn));
  const out = [];
  const maxD = Math.max(d1, d2);
  for (let i = 0; i < maxD; i++) for (const b of blocks) if (i < b.length) out.push(b[i]);
  for (let i = 0; i < ecn; i++) for (const b of ecBlocks) out.push(b[i]);
  return buildMatrix(ver, out);
}

function buildMatrix(ver, codewords) {
  const n = 17 + 4 * ver;
  const m = Array.from({ length: n }, () => new Array(n).fill(null));
  const fn = Array.from({ length: n }, () => new Array(n).fill(false));
  const set = (r, c, v) => { m[r][c] = v; fn[r][c] = true; };
  const finder = (r, c) => {
    for (let i = -1; i <= 7; i++) for (let j = -1; j <= 7; j++) {
      const rr = r + i, cc = c + j;
      if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
      const on = i >= 0 && i <= 6 && j >= 0 && j <= 6 && (i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4));
      set(rr, cc, on);
    }
  };
  finder(0, 0); finder(0, n - 7); finder(n - 7, 0);
  for (let i = 8; i < n - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  const al = ALIGN[ver];
  for (const r of al) for (const c of al) {
    const last = al[al.length - 1];
    if ((r === 6 && c === 6) || (r === 6 && c === last) || (r === last && c === 6)) continue; // overlaps a finder
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) set(r + i, c + j, Math.max(Math.abs(i), Math.abs(j)) !== 1);
  }
  set(n - 8, 8, true); // dark module
  // reserve format areas
  for (let i = 0; i < 9; i++) { if (!fn[8][i]) set(8, i, false); if (!fn[i][8]) set(i, 8, false); }
  for (let i = 0; i < 8; i++) { set(8, n - 1 - i, false); set(n - 1 - i, 8, false); }
  // version info (v >= 7)
  if (ver >= 7) {
    let rem = ver;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >> 11) * 0x1f25);
    const bitsV = (ver << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const b = ((bitsV >> i) & 1) === 1;
      const a = n - 11 + (i % 3), c = Math.floor(i / 3);
      set(a, c, b); set(c, a, b);
    }
  }
  // data placement
  const bitsArr = [];
  for (const cw of codewords) for (let i = 7; i >= 0; i--) bitsArr.push((cw >> i) & 1);
  let k = 0, up = true;
  for (let c = n - 1; c >= 1; c -= 2) {
    if (c === 6) c = 5;
    for (let t = 0; t < n; t++) {
      const r = up ? n - 1 - t : t;
      for (const cc of [c, c - 1]) {
        if (fn[r][cc]) continue;
        m[r][cc] = k < bitsArr.length ? bitsArr[k] === 1 : false;
        k++;
      }
    }
    up = !up;
  }
  // masks
  const masks = [
    (r, c) => (r + c) % 2 === 0, (r) => r % 2 === 0, (r, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0, (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0, (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
  ];
  let best = null;
  for (let mi = 0; mi < 8; mi++) {
    const g = m.map((row, r) => row.map((v, c) => (fn[r][c] ? v : v !== masks[mi](r, c))));
    placeFormat(g, n, mi);
    const score = penalty(g, n);
    if (!best || score < best[0]) best = [score, g];
  }
  return best[1];
}

function placeFormat(g, n, mask) {
  const data = (0b01 << 3) | mask; // level L = 01
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  const b = (i) => ((bits >> i) & 1) === 1;
  // g[row][col]; first copy around the top-left finder
  for (let i = 0; i <= 5; i++) g[i][8] = b(i);
  g[7][8] = b(6); g[8][8] = b(7); g[8][7] = b(8);
  for (let i = 9; i < 15; i++) g[8][14 - i] = b(i);
  // second copy split between the top-right and bottom-left finders
  for (let i = 0; i < 8; i++) g[8][n - 1 - i] = b(i);
  for (let i = 8; i < 15; i++) g[n - 15 + i][8] = b(i);
  g[n - 8][8] = true;
}

function penalty(g, n) {
  let s = 0;
  for (let r = 0; r < n; r++) {
    let run = 1;
    for (let c = 1; c < n; c++) { if (g[r][c] === g[r][c - 1]) { run++; if (run === 5) s += 3; else if (run > 5) s++; } else run = 1; }
  }
  for (let c = 0; c < n; c++) {
    let run = 1;
    for (let r = 1; r < n; r++) { if (g[r][c] === g[r - 1][c]) { run++; if (run === 5) s += 3; else if (run > 5) s++; } else run = 1; }
  }
  for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) { const v = g[r][c]; if (v === g[r][c + 1] && v === g[r + 1][c] && v === g[r + 1][c + 1]) s += 3; }
  let dark = 0;
  for (const row of g) for (const v of row) if (v) dark++;
  s += Math.floor(Math.abs((dark * 100) / (n * n) - 50) / 5) * 10;
  return s;
}

// Draw a QR code on the LCD at module size 1 (version 11 = 61 modules) or 2 (version 3 = 29 modules ⇒ 58 px).
export function drawQR(lcd, text, x, y, version) {
  const g = encodeQR(text, version, version);
  const n = g.length;
  const sc = n <= 33 ? 2 : 1;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (g[r][c]) lcd.fill(x + c * sc, y + r * sc, sc, sc, 3);
  return n * sc;
}
