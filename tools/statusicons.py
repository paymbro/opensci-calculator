# Cluster status-bar (rows 0-9) connected objects across native screenshots.
import sys, glob, os, json
import numpy as np
from PIL import Image
src = sys.argv[1]
found = {}
for f in sorted(glob.glob(src + '/p*.png')):
    a = np.array(Image.open(f))
    band = a[0:10]
    lvl = np.where(band <= 42, 3, np.where(band <= 127, 2, np.where(band <= 212, 1, 0)))
    cols = (lvl > 0).any(0)
    x = 0
    while x < 196:
        if cols[x]:
            s = x
            while x < 196 and (cols[x] or (x + 1 < 196 and cols[x + 1] and x - s < 14)): x += 1
            seg = lvl[:, s:x]
            key = seg.tobytes() + bytes([s])
            k2 = (s, seg.shape[1], seg.tobytes())
            if k2 not in found:
                found[k2] = (os.path.basename(f), s, [''.join(' .+#'[v] for v in r) for r in seg])
        else:
            x += 1
items = sorted(found.values(), key=lambda t: (t[1], t[0]))
seen = set()
for name, s, rows in items:
    k = (s, tuple(rows))
    if k in seen: continue
    seen.add(k)
    print(name, 'x=', s)
    for r in rows: print('   |' + r + '|')
