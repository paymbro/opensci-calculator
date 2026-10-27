import pymupdf, sys, os
d = pymupdf.open(sys.argv[1]); out = sys.argv[2]
pages = [int(x) for x in sys.argv[3].split(',')]
for pn in pages:
    page = d[pn - 1]
    for k, info in enumerate(page.get_image_info(xrefs=True)):
        bb = pymupdf.Rect(info['bbox'])
        if bb.height <= 20 or not info['xref']:
            continue
        pix = pymupdf.Pixmap(d, info['xref'])
        if pix.n - pix.alpha >= 4:
            pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
        if pix.alpha:
            pix = pymupdf.Pixmap(pix, 0)
        fn = f'{out}/p{pn:03d}_{k}_{pix.width}x{pix.height}.png'
        pix.save(fn)
        print(fn, round(bb.width), round(bb.height))
