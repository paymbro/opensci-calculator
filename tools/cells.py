# Extract 11x16 big-font cells on the fixed grid (x = 3 + 11k) at several line tops; cluster.
import sys, glob, os, json
import numpy as np
from PIL import Image, ImageDraw
src, out = sys.argv[1], sys.argv[2]
tops = [int(t) for t in sys.argv[3].split(',')]
grid = int(sys.argv[5]); menuonly = sys.argv[6] == 'menu'; tag = sys.argv[7]
clusters = {}
for f in sorted(glob.glob(src + '/p*.png')):
    a = np.array(Image.open(f).convert('L'))
    name = os.path.basename(f)[:-4]
    ism = any((a[t] <= 85).sum() > 150 for t in [11, 27, 43, 59])
    if ism != menuonly: continue
    for top in tops:
        band = a[top:top + 14, :].copy()
        if band.shape[0] < 14: continue
        # inverted bar? (row top fully dark across >150 px)
        inv = (band[0] <= 85).sum() > 150
        lvl = np.where(band <= 42, 3, np.where(band <= 127, 2, np.where(band <= 212, 1, 0)))
        if inv: lvl = 3 - lvl
        for k in range(17):
            x = grid + 11 * k
            cell = lvl[:, x:x + 11]
            if cell.shape[1] < 11 or cell.max() < 2: continue
            # require blank borders (cell isolated): columns at x-1 and x+11 not ink in band
            key = cell.tobytes()
            c = clusters.setdefault(key, {'n': 0, 'ex': [], 'cell': cell, 'inv': inv})
            c['n'] += 1
            if len(c['ex']) < 4: c['ex'].append([name, top, k])
items = sorted(clusters.items(), key=lambda kv: -kv[1]['n'])
items = [it for it in items if it[1]['n'] >= int(sys.argv[4])]
cols = 20; cw, ch = 40, 70
sheet = Image.new('L', (cols * cw, ((len(items) + cols - 1) // cols) * ch), 255)
d = ImageDraw.Draw(sheet)
meta = []
for i, (k, c) in enumerate(items):
    cell = c['cell']
    im = Image.fromarray((255 - cell * 85).astype('uint8')).resize((33, 42), Image.NEAREST)
    x = (i % cols) * cw; y = (i // cols) * ch
    d.rectangle((x + 1, y + 1, x + 35, y + 50), outline=200)
    sheet.paste(im, (x + 2, y + 2)); d.text((x + 2, y + 54), f'{i}', fill=0)
    meta.append({'id': i, 'n': c['n'], 'ex': c['ex'], 'rows': [''.join(' .+#'[v] for v in r) for r in cell]})
sheet.save(out + '/cellsheet_' + tag + '.png')
json.dump(meta, open(out + '/cells_' + tag + '.json', 'w'), indent=0)
print(len(items), sheet.size)
