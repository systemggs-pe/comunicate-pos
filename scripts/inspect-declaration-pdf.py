"""Independent PDF parsing for declaration tests; never reads production data."""
import json, sys, os
from pathlib import Path
import pdfplumber
from pypdf import PdfReader

reader=PdfReader(sys.argv[1],strict=True)
assert len(reader.pages)==1 and not reader.is_encrypted
assert not reader.attachments
page=reader.pages[0]
assert len(page.images)==0
with pdfplumber.open(sys.argv[1]) as pdf:
 p=pdf.pages[0]
 text=' '.join(p.extract_text(x_tolerance=1,y_tolerance=2).split())
 assert abs(p.width-210/25.4*72)<.01 and abs(p.height-297/25.4*72)<.01
 assert all(c['non_stroking_color'] in ([0],(0,),0,[0.,0.,0.],(0.,0.,0.)) for c in p.chars)
 # Private reference is supplied locally, never distributed with the project.
 reference=os.environ.get('DECLARATION_REFERENCE_PDF')
 if reference:
  layout=json.loads((Path(__file__).resolve().parent.parent/'shared/declaration-layout.json').read_text(encoding='utf8'))
  with pdfplumber.open(reference) as original:
   for slot in layout['slots']:
    if slot['key'] not in ['applicantName','clientDocument','address','phone','agentName','agentDocument']:
     continue
    chars=[c for c in original.pages[0].chars if abs(842-c['matrix'][5]-slot['y'])<.05 and slot['x']-.05<=c['x0']<slot['x']+slot['width']-.01]
    personal=''.join(c['text'] for c in chars).strip()
    normalized=' '.join(personal.split()).casefold()
    assert normalized and normalized not in text.casefold(), 'Reference personal data leaked'
    assert normalized not in str(reader.metadata).casefold(), 'Reference metadata leaked'
 print(json.dumps({'text':text,'pages':len(reader.pages),'width':p.width,'height':p.height,'fonts':sorted(set(c['fontname'] for c in p.chars))}))
