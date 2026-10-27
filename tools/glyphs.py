# Extract glyph candidates from native LCD frames: connected components merged into glyphs, clustered.
import sys, glob, os, json
import numpy as np
from PIL import Image, ImageDraw
src, out = sys.argv[1], sys.argv[2]

def load(f):
    a = np.array(Image.open(f).convert('L'))
    ink = a <= 100
    # invert highlight bars: rows where >= 140 px black
    rows = ink.sum(1) >= 140
    for y in range(a.shape[0]):
        if rows[y]:
            xs = np.where(ink[y])[0]
            x0, x1 = xs.min(), xs.max()
            ink[y, x0:x1 + 1] = ~ink[y, x0:x1 + 1]
            ink[y, x0:x0 + 0] = False
    return a, ink, rows

def components(ink):
    h, w = ink.shape
    lab = np.zeros((h, w), int); n = 0; boxes = []
    for y in range(h):
        for x in range(w):
            if ink[y, x] and not lab[y, x]:
                n += 1; st = [(y, x)]; lab[y, x] = n; pts = []
                while st:
                    cy, cx = st.pop(); pts.append((cy, cx))
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            ny, nx = cy + dy, cx + dx
                            if 0 <= ny < h and 0 <= nx < w and ink[ny, nx] and not lab[ny, nx]:
                                lab[ny, nx] = n; st.append((ny, nx))
                ys = [p[0] for p in pts]; xs = [p[1] for p in pts]
                boxes.append([min(xs), min(ys), max(xs), max(ys)])
    return boxes

def merge(boxes):
    # merge components whose x-ranges overlap (stacked parts like i, ÷, =, :) and vertically close
    changed = True
    while changed:
        changed = False
        for i in range(len(boxes)):
            for j in range(i + 1, len(boxes)):
                a, b = boxes[i], boxes[j]
                xo = min(a[2], b[2]) - max(a[0], b[0])
                gap = max(a[1], b[1]) - min(a[3], b[3])
                if xo >= 0 and gap <= 4 and max(a[3], b[3]) - min(a[1], b[1]) <= 15:
                    boxes[i] = [min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3])]
                    del boxes[j]; changed = True; break
            if changed: break
    return boxes

clusters = {}
for f in sorted(glob.glob(src + '/p*.png')):
    a, ink, rows = load(f)
    name = os.path.basename(f)[:-4]
    for (x0, y0, x1, y1) in merge(components(ink)):
        w, h = x1 - x0 + 1, y1 - y0 + 1
        if w > 14 or h > 16: continue
        bm = ink[y0:y1 + 1, x0:x1 + 1]
        key = (w, h, bm.tobytes())
        c = clusters.setdefault(key, {'n': 0, 'ex': [], 'bm': bm})
        c['n'] += 1
        if len(c['ex']) < 5: c['ex'].append([name, int(x0), int(y0)])
items = sorted(clusters.items(), key=lambda kv: (-kv[1]['bm'].shape[0], -kv[1]['n']))
cols = 16; cw, ch = 60, 56
sheet = Image.new('L', (cols * cw, ((len(items) + cols - 1) // cols) * ch), 255)
d = ImageDraw.Draw(sheet)
meta = []
for i, (k, c) in enumerate(items):
    bm = c['bm']; im = Image.fromarray(np.where(bm, 0, 255).astype('uint8')).resize((bm.shape[1] * 3, bm.shape[0] * 3), Image.NEAREST)
    x = (i % cols) * cw; y = (i // cols) * ch
    sheet.paste(im, (x + 2, y + 2)); d.text((x + 2, y + 46), f'{i}', fill=0)
    meta.append({'id': i, 'w': int(bm.shape[1]), 'h': int(bm.shape[0]), 'n': c['n'], 'ex': c['ex'],
                 'rows': [''.join('#' if v else '.' for v in r) for r in bm]})
sheet.save(out + '/glyphsheet.png')
json.dump(meta, open(out + '/glyphs.json', 'w'))
print(len(items))
