"""Compare a dynamically generated PDF with the privacy-clean original baseline.

Only variable slots are masked. Fixed words, signature lines and whitespace
remain in the comparison. Font substitution tolerance is one point of ink.
"""
import argparse, json, subprocess, tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import pdfplumber

parser=argparse.ArgumentParser()
parser.add_argument('pdf')
parser.add_argument('--renderer',default='pdftoppm')
parser.add_argument('--output',default='.test-results/phase6b')
parser.add_argument('--reference',help='Private original PDF; rasterized and masked only in memory')
args=parser.parse_args()
root=Path(__file__).resolve().parent.parent
out=root/args.output;out.mkdir(parents=True,exist_ok=True)
layout=json.loads((root/'shared/declaration-layout.json').read_text(encoding='utf-8'))
with tempfile.TemporaryDirectory() as tmp:
 prefix=Path(tmp)/'generated'
 subprocess.run([args.renderer,'-scale-to','1600','-png','-singlefile',str(Path(args.pdf).resolve()),str(prefix)],check=True)
 generated=Image.open(str(prefix)+'.png').convert('L')
 reference=Image.open(root/'tests/fixtures/declaration-fixed-reference.png').convert('L')
 if args.reference:
  with pdfplumber.open(args.reference) as source:
   p=source.pages[0]
   assert len(source.pages)==1 and p.width==595 and p.height==842
   for word in layout['words']:
    chars=[c for c in p.chars if abs(p.height-c['matrix'][5]-word['y'])<.05 and word['x']-.05<=c['x0']<word['x']+word['width']-.01]
    assert ''.join(c['text'] for c in chars)==word['text'], 'Original fixed text does not match'
    assert all(abs(c['size']-word['size'])<.05 and ('ClanPro-Bold' if word['bold'] else 'ClanPro-Regular') in c['fontname'] for c in chars)
  source_prefix=Path(tmp)/'reference'
  subprocess.run([args.renderer,'-scale-to','1600','-png','-singlefile',str(Path(args.reference).resolve()),str(source_prefix)],check=True)
  reference=Image.open(str(source_prefix)+'.png').convert('L')
  source_draw=ImageDraw.Draw(reference)
  for slot in layout['slots']:
   scale=reference.width/595
   source_draw.rectangle([slot['x']*scale,(slot['top']-2)*scale,(slot['x']+slot['width'])*scale,(slot['top']+slot['size']+3)*scale],fill=255)
  assert ImageChops.difference(reference,Image.open(root/'tests/fixtures/declaration-fixed-reference.png').convert('L')).getbbox() is None, 'Baseline does not match the masked original'
 generated=generated.crop((0,0,reference.width,reference.height))
 scale=reference.width/595
 draw=ImageDraw.Draw(generated)
 for slot in layout['slots']:
  draw.rectangle([slot['x']*scale,(slot['top']-2)*scale,(slot['x']+slot['width'])*scale,(slot['top']+slot['size']+3)*scale],fill=255)
 ref=reference.point(lambda p:255 if p<180 else 0)
 gen=generated.point(lambda p:255 if p<180 else 0)
 # One point at this resolution; no masks over fixed font shapes.
 ref_near=ref.filter(ImageFilter.MaxFilter(5));gen_near=gen.filter(ImageFilter.MaxFilter(5))
 def coverage(a,b):
  total=sum(a.histogram()[1:]);overlap=sum(ImageChops.multiply(a,b).histogram()[1:])
  return overlap/max(1,total)
 metrics={'referenceInkMatched':coverage(ref,gen_near),'generatedInkMatched':coverage(gen,ref_near),'rawReferenceInkMatched':coverage(ref,gen),'rawGeneratedInkMatched':coverage(gen,ref),'tolerancePixels':2,'requiredCoverage':.98}
 assert metrics['referenceInkMatched']>=.98,metrics
 assert metrics['generatedInkMatched']>=.98,metrics
 generated.save(out/'generated-fixed.png');ImageChops.difference(reference,generated).save(out/'visual-difference.png')
 with pdfplumber.open(args.pdf) as pdf:
  assert len(pdf.pages)==1
  p=pdf.pages[0];assert abs(p.width-210/25.4*72)<.01 and abs(p.height-297/25.4*72)<.01
  # Fixed anchors, sizes, line breaks and typography checked independently.
  for word in layout['words']:
   chars=[c for c in p.chars if abs(p.height-c['matrix'][5]-word['y'])<.05 and c['x0']>=word['x']-.05 and c['x0']<word['x']+word['width']-.01]
   assert ''.join(c['text'] for c in chars)==word['text'],word
   assert all(abs(c['size']-word['size'])<.05 for c in chars),word
  lines=[l for l in p.lines if abs(l['top']-421.5)<.05]
  assert len(lines)==2 and sorted(round(l['width'],2) for l in lines)==[260,260]
 metrics.update({'fixedWords':len(layout['words']),'singlePage':True,'a4':True,'signatureLines':True})
 (out/'visual-report.json').write_text(json.dumps(metrics,indent=2)+'\n',encoding='utf-8')
 print(json.dumps(metrics))
