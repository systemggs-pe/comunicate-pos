from pathlib import Path
from io import BytesIO
from xml.sax.saxutils import escape

from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph

ROOT = Path(__file__).resolve().parents[2]
DEST = ROOT / 'output' / 'pdf' / 'TA2_formato_completado_de_acuerdo.pdf'
DEST.parent.mkdir(parents=True, exist_ok=True)
pdfmetrics.registerFont(TTFont('ArialTask', 'C:/Windows/Fonts/arial.ttf'))
pdfmetrics.registerFont(TTFont('ArialTaskBold', 'C:/Windows/Fonts/arialbd.ttf'))
pdfmetrics.registerFontFamily('ArialTask', normal='ArialTask', bold='ArialTaskBold')
W, H = 595.32, 841.92
buf = BytesIO()
c = canvas.Canvas(buf, pagesize=(W, H))
measurements = []

def para(text, x, top, width, maxheight, size=9.6, leading=None, label=''):
    lead = leading or size * 1.16
    style = ParagraphStyle('task', fontName='ArialTask', fontSize=size,
                           leading=lead, textColor='#111111', spaceAfter=0)
    p = Paragraph(text, style)
    pw, ph = p.wrap(width, maxheight)
    if ph > maxheight + .01:
        raise ValueError(f'{label}: content height {ph:.2f} exceeds {maxheight}')
    p.drawOn(c, x, H - top - ph)
    measurements.append((label, round(ph, 2), maxheight))

def clear(x, top, width, height):
    c.setFillColorRGB(1, 1, 1)
    c.rect(x, H-top-height, width, height, fill=1, stroke=0)

def quote(text):
    return '«' + escape(text) + '»'

# The source template has no interactive fields. Preserve its two-page layout
# and add the completed answers as vector text in the existing spaces.
clear(84, 124, 435, 128)
para('<b>Paso 1: Tema polémico</b>', 85.1, 126, 432, 14, size=10.3)
para('¿Debe integrarse formalmente la medicina tradicional andina en los servicios de salud del MINSA, aunque sus tratamientos no siempre cuenten con validación científica?',
     85.1, 143, 432, 38, size=10.1, leading=12, label='controversia')
para('<b>Paso 2: Postura y tesis</b>', 85.1, 185, 432, 14, size=10.3)
para('Estoy de acuerdo con integrar formalmente la medicina tradicional andina en los servicios de salud del MINSA, aun cuando algunos tratamientos no cuenten con validación científica, porque favorece una atención intercultural que reconoce los saberes comunitarios. Esta integración debe ser complementaria, con uso seguro, coordinación profesional y evaluación de los tratamientos.',
     85.1, 202, 432, 49, size=9.8, leading=11.7, label='tesis')

para(quote('Asimismo, al ser la medicina científica considerada legalmente como el sistema oficial de atención en salud en nuestro país, algunas personas la imparten con cierto paternalismo y prejuicios a las personas relacionadas con la medicina tradicional.'),
     91.5, 648, 199.5, 93, size=9.5, label='fragmento contexto')
para('<b>Pereyra-Elías y Fuentes Delgado (2012)</b> señalan que la medicina científica es el sistema oficial en el Perú y que algunos de sus representantes muestran prejuicios hacia la medicina tradicional. Esta relación desigual permite contextualizar la necesidad de reconocer los saberes comunitarios y promover su articulación con la atención formal.',
     304, 648, 207, 93, size=9.5, label='resumen contexto')
para('Pereyra-Elías, R., y Fuentes Delgado, D. (2012). Medicina Tradicional versus Medicina Científica: ¿En verdad somos tan diferentes en lo esencial? <i>Acta Médica Peruana, 29</i>(2), 62-63.<br/>http://www.scielo.org.pe/pdf/amp/v29n2/a02v29n2.pdf',
     85.1, 764, 432, 48, size=8.7, leading=10.1, label='referencia contexto')
c.showPage()

para(quote('Estos espacios permitieron la gestión de la certificación en el Registro Único de Medicina Tradicional Ancestral Boliviana (RUMETRAB), la integración de los servicios en los establecimientos de salud, la conformación de un consejo de medicina tradicional en cada municipio y la implementación de laboratorios artesanales de medicina tradicional.'),
     91.5, 150, 199.5, 120, size=9.5, label='fragmento caso 1')
para('<b>Organización Panamericana de la Salud (2022).</b> En el pueblo guaraní del Chaco boliviano, el proyecto Chaco Salud promovió encuentros entre médicos tradicionales para gestionar su certificación y articular sus servicios con los establecimientos de salud. La fuente también informa avances de colaboración con el personal sanitario en partos comunitarios. Este caso comparativo muestra posibilidades de coordinación entre saberes tradicionales y atención profesional.',
     304, 150, 207, 120, size=9.4, label='resumen caso 1')
clear(84, 279, 435, 30)
para('<b>Referencia:</b> Organización Panamericana de la Salud. (2022, 25 de octubre). <i>La medicina tradicional parte del sistema de salud comunitario en el Pueblo Guaraní.</i> OPS/OMS.',
     85.1, 280, 432, 28, size=8.3, leading=9.5, label='referencia caso 1')

para(quote('Un caso ilustrativo de esta continuidad es el distrito de Quinua, ubicado aproximadamente a 50 minutos de la ciudad de Ayacucho. Dentro de este contexto, el sistema médico andino sigue cumpliendo un papel clave, ya que sus especialistas atienden a la población local mediante prácticas que reflejan una concepción integral de la salud, en la que lo físico y lo espiritual son dimensiones interdependientes.'),
     91.5, 343, 199.5, 146, size=9.5, label='fragmento caso 2')
para('<b>Ramos et al. (2025).</b> En Quinua, Ayacucho, los especialistas de la medicina andina siguen atendiendo a la población desde una concepción que relaciona lo físico y lo espiritual. Su permanencia muestra la relevancia comunitaria de estos saberes.<br/><br/><b>Generalización:</b> los casos de Quinua y del pueblo guaraní permiten inferir que articular la medicina tradicional con los servicios formales puede favorecer una atención culturalmente pertinente. Estos casos no demuestran la eficacia clínica de todos los tratamientos.',
     304, 343, 207, 146, size=9.5, label='resumen caso 2 e inferencia')
clear(84, 498, 435, 30)
para('<b>Referencia:</b> Ramos, J., Sosa, L., Rojas, F., y Alarcón, P. (2025). Saberes y prácticas de los especialistas del sistema médico andino en contextos interculturales del Perú en el siglo XXI. <i>Desde el Sur, 17</i>(2). DOI: 10.21142/DES-1702-2025-0033.',
     85.1, 499, 432, 28, size=8.2, leading=9.1, label='referencia caso 2')

para('<b>Término clave: medicina tradicional.</b><br/>' + quote('es todo el conjunto de conocimientos, aptitudes y prácticas basados en teorías, creencias y experiencias indígenas de las diferentes culturas, sean o no explicables, usados para el mantenimiento de la salud, así como para la prevención, el diagnóstico, la mejora o el tratamiento de enfermedades físicas o mentales') + '<br/>(OMS, 2000, como se citó en Corell-Doménech, 2019).',
     91.5, 609, 199.5, 114, size=9.1, leading=10.45, label='fragmento definición')
para('La <b>medicina tradicional</b> es un conjunto de saberes y prácticas culturales para cuidar la salud y atender enfermedades (OMS, 2000, como se citó en Corell-Doménech, 2019).<br/><br/><b>Ejemplo:</b> en Quinua, los especialistas atienden vinculando lo físico y lo espiritual (Ramos et al., 2025). Reconocer esta dimensión cultural sustenta una atención intercultural con uso seguro y evaluación de tratamientos.',
     304, 609, 207, 114, size=9.1, leading=10.45, label='resumen definición y ejemplo')
para('Corell-Doménech, M. (2019). Terapeutas alternativos en México y la estrategia de la OMS sobre medicina tradicional 2014-2023: Comunicación, creencias y factores socio-económicos. <i>Perspectivas de la comunicación, 12</i>(1), 59-77.<br/>https://doi.org/10.4067/S0718-48672019000100059',
     85.1, 747, 432, 50, size=8.5, leading=9.8, label='referencia definición')
c.showPage()
c.save()

reader = PdfReader(ROOT / 'tmp' / 'pdfs' / 'formato-original.pdf')
overlay = PdfReader(BytesIO(buf.getvalue()))
writer = PdfWriter()
for i, page in enumerate(reader.pages):
    page.merge_page(overlay.pages[i])
    writer.add_page(page)
writer.add_metadata({'/Title': 'TA2 - Análisis de información: postura de acuerdo',
                     '/Subject': 'Integración formal de la medicina tradicional andina en el MINSA'})
with DEST.open('wb') as out:
    writer.write(out)
check = PdfReader(DEST)
assert len(check.pages) == 2
text = '\n'.join(p.extract_text() for p in check.pages)
for expected in ['Estoy de acuerdo con integrar formalmente', 'RUMETRAB', 'Quinua', 'Corell-Doménech', 'Generalización:']:
    assert expected in text, expected
print(DEST)
for m in measurements:
    print(m)
