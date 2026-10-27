# Convert 400x158 manual screenshots to native 196x75 LCD frames (4 gray levels) and montage them.
import sys, glob, os
from PIL import Image, ImageDraw
src, out = sys.argv[1], sys.argv[2]
os.makedirs(out + '/native', exist_ok=True)
files = sorted(glob.glob(src + '/*_400x158.png'))
natives = []
for f in files:
    im = Image.open(f).convert('L')
    nat = Image.new('L', (196, 75))
    px = im.load(); npx = nat.load()
    for y in range(75):
        for x in range(196):
            npx[x, y] = px[4 + 2 * x, 4 + 2 * y]
    name = os.path.basename(f).replace('_400x158.png', '')
    nat.save(f'{out}/native/{name}.png')
    natives.append((name, nat))
per = 24; cols = 4; sc = 2
for p in range(0, len(natives), per):
    chunk = natives[p:p + per]
    rows = (len(chunk) + cols - 1) // cols
    sheet = Image.new('L', (cols * (196 * sc + 10), rows * (75 * sc + 22)), 255)
    d = ImageDraw.Draw(sheet)
    for i, (name, nat) in enumerate(chunk):
        x = (i % cols) * (196 * sc + 10); y = (i // cols) * (75 * sc + 22)
        d.text((x, y), name, fill=0)
        sheet.paste(nat.resize((196 * sc, 75 * sc), Image.NEAREST), (x, y + 12))
        d.rectangle((x - 1, y + 11, x + 196 * sc, y + 12 + 75 * sc), outline=128)
    sheet.save(f'{out}/montage_{p // per:02d}.png')
print(len(natives))
