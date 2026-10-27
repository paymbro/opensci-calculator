import sys
from PIL import Image
src, out, a, b = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
pages = list(range(a, b + 1))
for i in range(0, len(pages), 2):
    grp = pages[i:i + 2]
    ims = [Image.open(f'{src}/p{p:03d}.png').crop((140, 50, 810, 1310)) for p in grp]
    w = sum(im.width for im in ims) + 10 * (len(ims) - 1)
    sheet = Image.new('RGB', (w, ims[0].height), 'white')
    x = 0
    for im in ims:
        sheet.paste(im, (x, 0)); x += im.width + 10
    sheet.save(f'{out}/pp{grp[0]:03d}.png')
