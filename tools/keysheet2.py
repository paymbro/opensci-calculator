import pymupdf, io, json, sys, hashlib
from PIL import Image, ImageDraw
d=pymupdf.open(sys.argv[1]); out=sys.argv[2]
clusters={}  # sig -> [count, pn, bbox, img]
occ=[]
for pn in range(d.page_count):
  page=d[pn]
  for info in page.get_image_info(xrefs=True):
    bb=pymupdf.Rect(info['bbox'])
    if bb.height>20 or bb.width>60: continue
    pix=page.get_pixmap(matrix=pymupdf.Matrix(4,4),clip=bb)
    im=Image.open(io.BytesIO(pix.tobytes('png'))).convert('L')
    sm=im.resize((20,16)).point(lambda v:0 if v<140 else 255)
    sig=hashlib.md5(sm.tobytes()).hexdigest()[:10]
    c=clusters.setdefault(sig,[0,pn,tuple(bb),im]); c[0]+=1
    occ.append((pn,tuple(round(x,2) for x in bb),sig))
items=sorted(clusters.items(),key=lambda kv:-kv[1][0])
cols=14; cw,ch=92,62
sheet=Image.new('RGB',(cols*cw,((len(items)+cols-1)//cols)*ch),'white'); dr=ImageDraw.Draw(sheet)
for i,(sig,(c,pn,bb,im)) in enumerate(items):
  im=im.copy(); im.thumbnail((84,44))
  x=(i%cols)*cw; y=(i//cols)*ch
  sheet.paste(im,(x+4,y+2)); dr.text((x+4,y+48),f'{sig[:5]} {c}',fill='red')
sheet.save(out+'/keysheet2.png')
json.dump({'clusters':[(sig,c,pn+1) for sig,(c,pn,bb,im) in items],'occ':occ},open(out+'/keyocc.json','w'))
print(len(items),'clusters',len(occ),'occurrences')
