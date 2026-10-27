# Combine labelled clusters into one glyph per char (most frequent bitmap), write JSON + review sheet.
import json, sys, collections
from PIL import Image, ImageDraw, ImageFont
base = sys.argv[1]
data = {t: json.load(open(f'{base}/cells_{t}.json', encoding='utf-8')) for t in ('menu', 'input', 'result')}
cands = collections.defaultdict(list)
for line in open(sys.argv[2], encoding='utf-8'):
    line = line.rstrip('\n')
    if not line or line.startswith('#'): continue
    t, i, ch = line.split(' ', 2)
    m = data[t][int(i)]
    rows = [r.replace('+', '#').replace('.', ' ') for r in m['rows']]  # treat gray as ink for shape
    if t == 'result':  # result grid sits one column left of the menu/input grid
        rows = [' ' + r[:-1] for r in rows]
    cands[ch].append((m['n'], rows, t, int(i)))
font = {}
for ch, lst in cands.items():
    # merge identical bitmaps across sheets, pick most frequent
    agg = collections.Counter(); src = {}
    for n, rows, t, i in lst:
        k = '\n'.join(rows); agg[k] += n; src.setdefault(k, (t, i))
    best = agg.most_common(1)[0][0]
    font[ch] = {'rows': best.split('\n'), 'variants': len(agg), 'src': src[best]}
json.dump(font, open(sys.argv[3], 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
chars = sorted(font)
cols = 16; cw, ch_ = 50, 66
sheet = Image.new('L', (cols * cw, ((len(chars) + cols - 1) // cols) * ch_), 255)
d = ImageDraw.Draw(sheet)
f = ImageFont.truetype('seguisym.ttf', 14)
for k, c in enumerate(chars):
    x = (k % cols) * cw; y = (k // cols) * ch_
    rows = font[c]['rows']
    for r, row in enumerate(rows):
        for q, v in enumerate(row):
            if v == '#': d.rectangle((x + 2 + q * 3, y + 2 + r * 3, x + 4 + q * 3, y + 4 + r * 3), fill=0)
    d.rectangle((x + 1, y + 1, x + 2 + 33, y + 2 + 42), outline=190)
    d.text((x + 38, y + 4), c, fill=0, font=f)
    d.text((x + 38, y + 24), str(font[c]['variants']), fill=120)
sheet.save(sys.argv[4])
print(len(font))
