import pymupdf, collections, io, json, sys
from PIL import Image, ImageDraw
d=pymupdf.open(sys.argv[1]); out=sys.argv[2]
cnt=collections.Counter(); first={}
for pn in range(d.page_count):
  for info in d[pn].get_image_info(xrefs=True):
    bb=pymupdf.Rect(info['bbox'])
    if bb.height<=20:
      dg=(info['xref'], d.xref_get_key(info['xref'],'SMask')[1]) if info['xref'] else info['digest']; cnt[dg]+=1; first.setdefault(dg,(pn,bb))
cols=12; cw,ch=110,70
items=cnt.most_common()
sheet=Image.new('RGB',(cols*cw,((len(items)+9)//10)*ch),'white'); dr=ImageDraw.Draw(sheet)
keymap=[]
for i,(dg,c) in enumerate(items):
  pn,bb=first[dg]
  pix=d[pn].get_pixmap(matrix=pymupdf.Matrix(5,5),clip=bb)
  im=Image.open(io.BytesIO(pix.tobytes('png'))).convert('RGB'); im.thumbnail((100,50))
  x=(i%cols)*cw; y=(i//cols)*ch
  sheet.paste(im,(x+5,y+2)); dr.text((x+5,y+56),f'k{i:03d} n{c}',fill='red')
  keymap.append((i,str(dg),pn+1,c))
sheet.save(out+'/keysheet.png')
json.dump(keymap,open(out+'/keyicons.json','w'))
