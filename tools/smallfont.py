# Extract small-font glyphs from known text strings in native screenshots (column-run segmentation).
import sys, json
import numpy as np
from PIL import Image
base = sys.argv[1]
# (image, top row, x0, x1, text, inverted)
specs = [
 ('p045_0', 12, 3, 95, 'A=36', True),
 ('p045_0', 12, 99, 195, 'B=123456', False),
 ('p045_0', 25, 3, 95, 'C=1234567', False),
 ('p045_0', 25, 99, 195, 'D=12345678', False),
 ('p045_0', 38, 3, 95, 'E=123456789', False),
 ('p045_0', 38, 99, 195, 'F=1234567890', False),
 ('p045_0', 51, 3, 60, 'x=1.2345', False),
 ('p045_0', 51, 99, 195, 'y=0', False),
 ('p045_0', 64, 3, 95, 'z=0', False),
]
glyphs = {}
for img, top, x0, x1, text, inv in specs:
    a = np.array(Image.open(f'{base}/{img}.png'))
    band = a[top:top + 10, x0:x1 + 1] <= 85
    if inv: band = ~band
    cols = band.any(0)
    runs = []; x = 0
    while x < len(cols):
        if cols[x]:
            s = x
            while x < len(cols) and cols[x]: x += 1
            runs.append((s, x))
        else: x += 1
    if len(runs) != len(text):
        print('MISMATCH', img, top, text, len(runs)); continue
    for (s, e), ch in zip(runs, text):
        bm = band[:, s:e]
        rows = [''.join('#' if v else '.' for v in r) for r in bm]
        glyphs.setdefault(ch, rows)
json.dump(glyphs, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
for k, v in sorted(glyphs.items()):
    print(k); print('\n'.join(v))
