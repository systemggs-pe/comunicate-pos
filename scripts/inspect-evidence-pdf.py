"""Inspect evidence PDFs independently: page bounds, embedded images and aspect ratios."""
import json,sys
import pdfplumber
from pypdf import PdfReader
r=PdfReader(sys.argv[1],strict=True)
assert not r.is_encrypted and not r.attachments
pages=[]
with pdfplumber.open(sys.argv[1]) as pdf:
 for p in pdf.pages:
  assert abs(p.width-210/25.4*72)<.02 and abs(p.height-297/25.4*72)<.02
  images=[]
  for image in p.images:
   assert image['x0']>=0 and image['x1']<=p.width and image['top']>=0 and image['bottom']<=p.height
   w,h=image['srcsize'];draw=(image['x1']-image['x0'])/(image['bottom']-image['top'])
   assert abs(draw/(w/h)-1)<.001,'Distorted image'
   images.append({'width':w,'height':h})
  assert all(0<=c['x0']<=c['x1']<=p.width+.1 and c['top']>=0 and c['bottom']<=p.height for c in p.chars)
  pages.append({'text':' '.join((p.extract_text() or '').split()),'images':images})
print(json.dumps({'text':' '.join(p['text'] for p in pages),'pages':pages}))
