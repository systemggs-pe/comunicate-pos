/* global window, document */

import {penToClp, penToUsd} from './receipt-currency.js';
import {getPdf417Generator, getPdfTools} from './receipt-pdf-libraries.js';

const lineas = value => String(value || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
const rutVendedor = value => String(value || '').replace(/\./g, '').replace(/\s+/g, '');

function nombreCortoEmisor(nombre) {
  const words = String(nombre || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  return {
    linea1: words[0] || '',
    linea2: words.slice(1, 3).join(' ') || words[0] || '',
  };
}

function entregarPdf(docFinal, nombre, output = 'download') {
  for (let page = 1; page <= docFinal.getNumberOfPages(); page++) {
    docFinal.setPage(page);
    const {width, height} = docFinal.internal.pageSize;
    docFinal.setFont('helvetica', 'normal');
    docFinal.setFontSize(Math.min(8, width * 0.12));
    docFinal.setTextColor(55);
    docFinal.text('CONSTANCIA COMUNIC@TE', width / 2, height - 7 / docFinal.internal.scaleFactor, {align: 'center'});
  }
  if (output === 'bytes') return docFinal.output('arraybuffer');
  const blob = docFinal.output('blob');
  const url = URL.createObjectURL(blob);

  if (output === 'bloburl') {
    return {blob, url, nombre};
  }

  window.open(url, '_blank');
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
  return {blob, url, nombre};
}

export function formatearNumeroOrdenFormato5(value, dateValue = new Date()) {
  const parsedDate = new Date(dateValue);
  const fecha = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  const month = String(fecha.getUTCMonth() + 1).padStart(2, '0');
  const day = String(fecha.getUTCDate()).padStart(2, '0');
  const year = String(fecha.getUTCFullYear()).padStart(4, '0');
  const source = String(value ?? '').replace(/\D/g, '');
  const fallback = String(fecha.getTime()).slice(-4);
  const suffix = source.length >= 4 ? source.slice(-4) : fallback;
  const digits = `${month}${day}${year}${suffix}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function crearReferenciaFormato6(value, dateValue = new Date(), page = 0) {
  const parsedDate = new Date(dateValue);
  const fecha = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  const pad = number => String(number).padStart(2, '0');
  const dateDigits = `${fecha.getUTCFullYear()}${pad(fecha.getUTCMonth() + 1)}${pad(fecha.getUTCDate())}`;
  const source = `${String(value ?? '').replace(/\D/g, '')}${page || ''}`;
  const referenceDigits = `${dateDigits}${source || String(fecha.getTime())}`.slice(-10);
  return {barcode: `${dateDigits}R${referenceDigits}`, reference: `R${referenceDigits}`};
}

function getBoletaVerificationUrl() {
  return `${window.location.origin.replace(/\/$/, '')}/boleta`;
}

export function calcularTotalesEnterosThermer(totalClp, impuestoPorcentaje = 8) {
  const totalNumero = Number(totalClp);
  const porcentajeNumero = Number(impuestoPorcentaje);
  const total = Math.round(Number.isFinite(totalNumero) ? totalNumero : 0);
  const porcentajeIva = Number.isFinite(porcentajeNumero) ? Math.max(0, porcentajeNumero) : 8;
  const subtotal = porcentajeIva > 0 ? Math.round(total / (1 + porcentajeIva / 100)) : total;
  return {total, subtotal, iva: total - subtotal};
}

export function formatearMontoEnteroThermer(value) {
  return Math.round(Number(value) || 0).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    useGrouping: true,
  });
}

export async function generarBoletaExtranjera7({cliente, ventas, equiposMap, totalClp, fechaHora, nBoleta: numeroBoleta, emisor, output = 'download', runtime}) {
  const {jsPDF, JsBarcode} = getPdfTools();
  const emisorInfo = {...(emisor || {})};
  const verificationUrl = runtime?.verificationUrl ?? getBoletaVerificationUrl();
  const mmW = 48;
  const FONT = 'courier';
  const ventasBoleta = Array.isArray(ventas) && ventas.length ? ventas : [{}];
  const mapaEquipos = equiposMap && typeof equiposMap === 'object' ? equiposMap : {};

  // El ticket de referencia imprime el S/N bajo un CODE128; el IMEI es el respaldo.
  const primeraVenta = ventasBoleta[0] || {};
  const primerEq = mapaEquipos[primeraVenta.imeiEquipo] || {};
  const codigoBarras = primerEq.sn || primeraVenta.sn || primeraVenta.imeiEquipo || '';
  const barcodeW = 30;
  let barcodeImg = null, barcodeH = 0;
  if (codigoBarras) {
    try {
      const c = runtime?.canvas() ?? document.createElement('canvas');
      JsBarcode(c, codigoBarras, {format: 'CODE128', width: 2, height: 58, displayValue: true, fontSize: 16, margin: 5, background: '#ffffff', lineColor: '#000000'});
      barcodeImg = c.toDataURL('image/png');
      barcodeH = Math.min(12, Math.max(9, barcodeW * (c.height / c.width)));
    } catch { /* Sin código si la serie no se puede codificar. */ }
  }

  const nBoleta = numeroBoleta ? String(numeroBoleta) : String(Date.now()).slice(-5).padStart(5, '0');
  const ivaConfigurado = Number(emisorInfo.impuestoPorcentaje || 8);
  const porcentajeIva = Number.isFinite(ivaConfigurado) ? Math.max(0, ivaConfigurado) : 8;
  const {total, subtotal, iva} = calcularTotalesEnterosThermer(totalClp, porcentajeIva);
  const monto = formatearMontoEnteroThermer;

  const renderPDF = (doc, dibujar) => {
    let y = 4;
    const cx  = mmW / 2;
    const M   = 2;
    const F   = 1;
    const lh  = (sz) => sz * F * 0.42 + 1.0;

    const sep = () => {
      if (dibujar) {
        doc.setLineDash([0.5, 0.5]);
        doc.setDrawColor(130);
        doc.line(M, y, mmW - M, y);
        doc.setLineDash([]);
        doc.setDrawColor(0);
      }
      y += 2.5;
    };

    const tc = (text, sz, bold = false) => {
      doc.setFontSize(sz * F); doc.setFont(FONT, bold ? 'bold' : 'normal');
      const lines = doc.splitTextToSize(String(text ?? ''), mmW - M * 2);
      if (dibujar) lines.forEach((l, i) => doc.text(l, cx, y + i * lh(sz), { align: 'center' }));
      y += lh(sz) * lines.length;
    };

    const tl = (text, sz, bold = false) => {
      doc.setFontSize(sz * F); doc.setFont(FONT, bold ? 'bold' : 'normal');
      const lines = doc.splitTextToSize(String(text ?? ''), mmW - M * 2);
      if (dibujar) {
        lines.forEach((l, i) => doc.text(l, i === 0 ? M : M + 3, y + i * lh(sz)));
      }
      y += lh(sz) * lines.length;
    };

    const fila = (label, valor, sz = 6.5, boldValue = false) => {
      doc.setFontSize(sz * F); doc.setFont(FONT, 'normal');
      const labelTxt = label + ': ';
      const lw    = doc.getTextWidth(labelTxt);
      const lines = doc.splitTextToSize(String(valor ?? ''), mmW - M - lw - M);
      if (dibujar) {
        doc.text(labelTxt, M, y);
        doc.setFont(FONT, boldValue ? 'bold' : 'normal');
        lines.forEach((l, i) => doc.text(l, M + lw, y + i * lh(sz)));
      }
      y += lh(sz) * Math.max(lines.length, 1);
    };

    const fecha = fechaHora ? new Date(fechaHora + 'Z') : new Date();
    const pad = n => String(n).padStart(2, '0');
    const fechaStr = `${pad(fecha.getUTCDate())}/${pad(fecha.getUTCMonth()+1)}/${fecha.getUTCFullYear()}`;
    const horaStr  = `${pad(fecha.getUTCHours())}:${pad(fecha.getUTCMinutes())}:${pad(fecha.getUTCSeconds())}`;

    y += 1;
    tc(`R.U.T.  ${rutVendedor(emisorInfo.rut)}`, 7, true);
    tc(`CONSTANCIA DE COMPRA N  ${nBoleta}`, 7, true);
    tc(`${String(emisorInfo.ciudad || '').toUpperCase()}`, 7, true);
    y += 1;
    sep();
    y += 1;

    lineas(emisorInfo.apellido).forEach(linea => tl(linea.toUpperCase(), 6.5));
    if (emisorInfo.local) tl(String(emisorInfo.local).toUpperCase(), 6.5);
    lineas(emisorInfo.nombre).forEach(linea => tl(linea.toUpperCase(), 6.5));
    tl(String(emisorInfo.giro1 || 'VENTA CELULARES ACCESORIOS').toUpperCase(), 6.5);
    lineas(emisorInfo.direccion).forEach(linea => tl(linea, 6.5));
    y += 1;
    sep();
    y += 2;

    if (cliente?.nombre) fila('CLIENTE', cliente.nombre.toUpperCase(), 6.5);
    if (cliente?.dni) fila('RUT ', cliente.dni, 6.5);
    y += 1;

    ventasBoleta.forEach(v => {
      const eq  = mapaEquipos[v.imeiEquipo] || {};
      const mem = eq.memoria || v.memoria || '';
      const nom = eq.nombreComercial || v.nombreComercial || v.modeloEquipo || '';
      const memTexto = mem && /\b(?:GB|TB|MB)\b/i.test(String(mem)) ? String(mem) : mem ? `${mem}GB` : '';
      if (nom || memTexto) {
        tl(`${nom}${memTexto ? ' ' + memTexto : ''}`.trim().toUpperCase(), 6.5, true);
      }
      const color = eq.color || v.color || '';
      if (color) fila('COLOR', color, 6.5);
      fila('IMEI', v.imeiEquipo || '', 6.5);
      const imei2 = eq.imei2 || v.imei2Equipo || '';
      if (imei2) fila('IMEI', imei2, 6.5);
    });

    y += 1;
    fila('SUB TOTAL', monto(subtotal), 6.5);
    fila('IVA', monto(iva), 6.5);
    y += 2;

    if (dibujar) {
      doc.setFontSize(8 * F); doc.setFont(FONT, 'normal');
      doc.text(`TOTAL: $ ${monto(total)}`, mmW - M, y, {align: 'right'});
    }
    y += lh(8) + 1;
    sep();
    y += 2;

    if (barcodeImg) {
      if (dibujar) doc.addImage(barcodeImg, 'PNG', (mmW - barcodeW) / 2, y, barcodeW, barcodeH);
      y += barcodeH + 2;
    }
    sep();
    y += 1;

    if (dibujar) {
      doc.setFontSize(6.5 * F); doc.setFont(FONT, 'normal');
      doc.text('FECHA', M, y);
      doc.text('HORA', mmW - M, y, { align: 'right' });
    }
    y += lh(6.5);
    if (dibujar) {
      doc.setFontSize(6.5 * F); doc.setFont(FONT, 'normal');
      doc.text(fechaStr, M, y);
      doc.text(horaStr, mmW - M, y, { align: 'right' });
    }
    y += lh(6.5) + 2;

    tc('********************************', 5.5);
    tc('Esta boleta es indispensable', 6.5);
    tc('para', 6.5, true);
    tc('cambios y devoluciones.', 6.5);
    tc('********************************', 5.5);
    y += 1;
    tc('Verifique esta boleta en:', 5.8, true);
    tc(verificationUrl, 5.2);
    y += 4;

    return y;
  };

  const docMedida = new jsPDF({ unit: 'mm', format: [mmW, 300], orientation: 'portrait' });
  const altoTotal = renderPDF(docMedida, false);
  const docFinal  = new jsPDF({ unit: 'mm', format: [mmW, altoTotal], orientation: 'portrait' });
  renderPDF(docFinal, true);

  const nombre = `BOLETA7-${nBoleta}.pdf`;
  return entregarPdf(docFinal, nombre, output);
}

export async function generarBoletaExtranjera({cliente, ventas, equiposMap, totalClp, fechaHora, nBoleta: numeroBoleta, emisor, output = 'download', runtime}) {
  const {jsPDF} = getPdfTools();
  const gen417 = runtime?.barcode417 ?? await getPdf417Generator();
  const emisorInfo = {...(emisor || {})};
  const verificationUrl = runtime?.verificationUrl ?? getBoletaVerificationUrl();
  const mmW = 80;
  const margin = 6;
  const centerX = mmW / 2;
  const font = 'helvetica';
  const ventasBoleta = Array.isArray(ventas) && ventas.length ? ventas : [{}];
  const nBoleta = numeroBoleta ? String(numeroBoleta) : String(Date.now()).slice(-7).padStart(7, '0');
  const totalNum = Number.isFinite(Number(totalClp)) ? Number(totalClp) : 0;
  const fecha = fechaHora ? new Date(fechaHora + 'Z') : new Date();
  const fechaValida = Number.isNaN(fecha.getTime()) ? new Date() : fecha;
  const fechaTexto = new Intl.DateTimeFormat('es-CL', { timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(fechaValida).replace(/ de (\d{4})$/, ' del $1');
  const money = value => Number(value || 0).toLocaleString('es-CL');
  const ciudadEmisor = String(emisorInfo.ciudad || emisorInfo.comuna || '').toUpperCase();
  const giro = [emisorInfo.giro1, emisorInfo.giro2].filter(Boolean);
  if (!giro.length) giro.push('Venta de celulares, accesorios y equipos electrónicos');

  const totalPenItems = ventasBoleta.reduce((sum, venta) => sum + Number(venta.precio || 0), 0);
  let totalAsignado = 0;
  const detalles = ventasBoleta.map((venta, index) => {
    const equipo = equiposMap?.[venta.imeiEquipo] || {};
    const modelo = equipo.nombreComercial || venta.nombreComercial || venta.modeloEquipo || equipo.modelo || 'Venta';
    const memoria = equipo.memoria || venta.memoria || '';
    const color = equipo.color || venta.color || '';
    const memoriaTexto = memoria && /\b(?:GB|TB|MB)\b/i.test(String(memoria)) ? String(memoria).toUpperCase() : memoria ? `${memoria}GB` : '-';
    const itemTotal = index === ventasBoleta.length - 1
      ? totalNum - totalAsignado
      : Math.round(totalNum * Number(venta.precio || 0) / (totalPenItems || 1));
    totalAsignado += itemTotal;
    return {
      modelo: [modelo, memoriaTexto !== '-' ? memoriaTexto : '', color].filter(Boolean).join(' '),
      nombreEquipo: modelo,
      memoria: memoriaTexto,
      color: color || '-',
      imei1: venta.imeiEquipo || '',
      imei2: equipo.imei2 || venta.imei2Equipo || '',
      total: itemTotal,
    };
  });

  const fechaIso = `${fechaValida.getUTCFullYear()}-${String(fechaValida.getUTCMonth() + 1).padStart(2, '0')}-${String(fechaValida.getUTCDate()).padStart(2, '0')}`;
  const texto417 = [
    nBoleta,
    emisorInfo.rut,
    cliente?.dni || '',
    cliente?.nombre || '',
    detalles.map(item => [item.modelo, item.imei1, item.imei2, item.total].filter(Boolean).join('|')).join(';'),
    totalNum,
    fechaIso,
    'COMUNIC@TE',
  ].join('|');
  const pdf417Img = gen417(texto417, 2, 4);
  const pdf417W = 62;
  const pdf417H = 39;

  const renderPDF = (doc, dibujar) => {
    let y = 6;
    const lineHeight = size => size * 0.36 + 1.05;
    const setType = (size, bold = false) => {
      doc.setFont(font, bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      doc.setTextColor(20, 20, 20);
    };
    const centered = (value, size, bold = false, maxWidth = mmW - margin * 2) => {
      setType(size, bold);
      const lines = doc.splitTextToSize(String(value ?? ''), maxWidth);
      if (dibujar) lines.forEach((line, index) => doc.text(line, centerX, y + index * lineHeight(size), {align: 'center'}));
      y += lines.length * lineHeight(size);
    };
    const left = (value, size, bold = false, x = margin, maxWidth = mmW - margin - x) => {
      setType(size, bold);
      const lines = doc.splitTextToSize(String(value ?? ''), maxWidth);
      if (dibujar) lines.forEach((line, index) => doc.text(line, x, y + index * lineHeight(size)));
      y += lines.length * lineHeight(size);
    };
    const rule = (atY = y, width = 0.22) => {
      if (dibujar) {
        doc.setDrawColor(25, 25, 25);
        doc.setLineWidth(width);
        doc.line(margin, atY, mmW - margin, atY);
      }
    };
    const detailField = (label, value, options = {}) => {
      const size = options.imei ? 7.4 : 7;
      const labelText = `${label}:`;
      setType(size, true);
      const labelWidth = doc.getTextWidth(labelText);
      if (dibujar) doc.text(labelText, 11, y);
      setType(size, options.imei);
      const valueX = 11 + labelWidth + 1.4;
      const lines = doc.splitTextToSize(String(value || '-'), mmW - margin - valueX);
      if (dibujar) lines.forEach((line, index) => doc.text(line, valueX, y + index * lineHeight(size)));
      y += Math.max(lines.length, 1) * lineHeight(size);
    };

    if (dibujar) {
      doc.setDrawColor(25, 25, 25);
      doc.setLineWidth(0.45);
      doc.rect(13, y, 54, 24);
    }
    y += 6.1;
    centered(`R.U.T.: ${emisorInfo.rut}`, 9, true, 50);
    centered('CONSTANCIA DE COMPRA', 9.2, true, 50);
    centered(`Nº ${nBoleta}`, 9.5, true, 50);
    y = 34;
    centered(`${ciudadEmisor}`, 8.8, true);
    y += 4;

    lineas(emisorInfo.nombre).forEach(linea => left(linea, 8.8, true, 9, 62));
    giro.forEach(linea => left(linea, 7.8, false, 9, 62));
    lineas(emisorInfo.direccion).forEach(linea => left(linea, 7.8, false, 9, 62));
    y += 5;

    setType(7.8, true);
    if (dibujar) doc.text('Emisión', 9, y);
    setType(7.8);
    if (dibujar) doc.text(`: ${fechaTexto}`, 25, y);
    y += 6;

    rule(y);
    y += 4.5;
    left('DATOS DEL CLIENTE', 7.1, true, 9, 62);
    detailField('NOMBRE', cliente?.nombre ? String(cliente.nombre).toUpperCase() : '-');
    detailField('RUT', cliente?.dni || '-');
    y += 3;

    const itemX = 9;
    const unitX = 47;
    const qtyX = 57;
    const totalX = 71;
    rule(y);
    y += 4.4;
    setType(6.6);
    if (dibujar) {
      doc.text('Item', itemX, y);
      doc.text('P. unitario', unitX, y, {align: 'right'});
      doc.text('Cant.', qtyX, y, {align: 'center'});
      doc.text('Total item', totalX, y, {align: 'right'});
    }
    y += 2.1;
    rule(y);
    y += 5;

    detalles.forEach(item => {
      setType(7.4);
      if (dibujar) {
        doc.text('Venta', itemX, y);
        doc.text(money(item.total), unitX, y, {align: 'right'});
        doc.text('1', qtyX, y, {align: 'center'});
        doc.text(money(item.total), totalX, y, {align: 'right'});
      }
      y += 5.6;
      detailField('EQUIPO', item.nombreEquipo);
      detailField('COLOR', item.color);
      detailField('MEMORIA', item.memoria);
      detailField('IMEI', item.imei1 || '-', {imei: true});
      if (item.imei2) detailField('IMEI 2', item.imei2, {imei: true});
      y += 2.5;
    });
    rule(y);
    y += 5;
    setType(7.8, true);
    if (dibujar) {
      doc.text('Total $:', 57, y, {align: 'right'});
      doc.text(money(totalNum), totalX, y, {align: 'right'});
    }
    y += 11;

    if (dibujar) doc.addImage(pdf417Img, 'PNG', (mmW - pdf417W) / 2, y, pdf417W, pdf417H);
    y += pdf417H + 4.2;
    centered('Código PDF417', 7.5, true);
    centered('Referencia interna', 7.1);
    centered('Consulta en COMUNIC@TE', 7.1);
    y += 2;
    centered('Consulta del historial:', 6.7, true);
    centered(verificationUrl, 6.1, false, 68);
    y += 6;

    return Math.max(y, 168);
  };

  const docMedida = new jsPDF({unit: 'mm', format: [mmW, 260], orientation: 'portrait'});
  const altoTotal = renderPDF(docMedida, false);
  const docFinal = new jsPDF({unit: 'mm', format: [mmW, altoTotal], orientation: 'portrait'});
  renderPDF(docFinal, true);

  return entregarPdf(docFinal, `BOLETA-${nBoleta}.pdf`, output);
}

export async function generarBoletaExtranjera2({ cliente, ventas, equiposMap, totalClp, fechaHora, nBoleta: numeroBoleta, emisor, output = 'download', runtime }) {
  const {jsPDF} = getPdfTools();
  const gen417 = runtime?.barcode417 ?? await getPdf417Generator();
  const emisorInfo = emisor || {};
  const verificationUrl = runtime?.verificationUrl ?? getBoletaVerificationUrl();
  const mmW  = 80;
  const M    = 5;
  const FONT = 'courier';
  const FS   = 9; // Tamaño base de la boleta 2.
  const nBoleta = numeroBoleta ? String(numeroBoleta) : String(Date.now()).slice(-4).padStart(4, '0');

  // Totales
  const totalNum = typeof totalClp === 'number' ? totalClp
    : parseInt(String(totalClp).replace(/\D/g, ''), 10) || 0;
  const iva = Math.round(totalNum - totalNum / 1.19);

  // Fecha aaaa-mm-dd
  const fecha    = fechaHora ? new Date(fechaHora + 'Z') : new Date();
  const pad      = n => String(n).padStart(2, '0');
  const fechaStr = `${fecha.getUTCFullYear()}-${pad(fecha.getUTCMonth()+1)}-${pad(fecha.getUTCDate())}`;

  // Equipo
  const pV  = ventas[0] || {};
  const pEq = equiposMap[pV.imeiEquipo] || {};
  const nombreComercial = pEq.nombreComercial || pV.nombreComercial || pV.modeloEquipo || '';
  const memoria = pEq.memoria || pV.memoria || '';
  const color   = pEq.color   || pV.color   || '';
  const imei1   = pV.imeiEquipo || '';
  const imei2   = pEq.imei2 || pV.imei2Equipo || '';

  // PDF417 real obligatorio.
  const pdf417W = mmW - M * 2;
  const texto417 = [
    nBoleta, cliente.dni || '', cliente.nombre || '',
    imei1, imei2,
    `${nombreComercial}${memoria ? ' ' + memoria + 'GB' : ''}`,
    color, totalNum, iva, fechaStr, emisorInfo.rut, 'COMUNIC@TE'
  ].join('|');
  const dataUrl417 = gen417(texto417, 2, 1);
  const barcodeSize = new jsPDF().getImageProperties(dataUrl417);
  const pdf417Img = dataUrl417;
  const pdf417H = barcodeSize.height > 0
    ? pdf417W * (barcodeSize.height / barcodeSize.width)
    : 24;

  const renderPDF = (doc, dibujar) => {
    let y = 0;
    const lh = sz => sz * 0.37 + 1.2;

    const nl = (n = 1) => { y += n; };
    const tl = (txt, sz, bold = false) => {
      doc.setFontSize(sz); doc.setFont(FONT, bold ? 'bold' : 'normal');
      const lines = doc.splitTextToSize(String(txt ?? ''), mmW - M * 2);
      if (dibujar) lines.forEach((l, i) => doc.text(l, M, y + i * lh(sz)));
      y += lh(sz) * lines.length;
    };
    const tr = (txt, sz) => {
      doc.setFontSize(sz); doc.setFont(FONT, 'normal');
      if (dibujar) doc.text(String(txt ?? ''), mmW - M, y, { align: 'right' });
      y += lh(sz);
    };

    nl(5);
    tl('                               ', FS);
    tl('                               ', FS);
    lineas(emisorInfo.nombre).forEach(linea => tl(linea, FS));
    tl(emisorInfo.rut, FS);
    tl('Giro: VTA.CELULARES,TARJETA', FS);
    tl('PREPAGO,', FS);
    tl('CHIPS,ACCESORIOS,ELECTROD.ELECTRONI', FS);
    tl('COS.', FS);
    lineas(emisorInfo.direccion).forEach(linea => tl(linea, FS));
    nl(2);
    tl(`CONSTANCIA DE COMPRA NUMERO: ${nBoleta}`, FS);
    tl(`REF. VENDEDOR: ${rutVendedor(emisorInfo.rut)}`, FS);
    tl(`Fecha: ${fechaStr}`, FS);
    nl(2);
    tl('Ciudad: ' + (emisorInfo.ciudad || emisorInfo.comuna || '—'), FS);
    nl(3);
    tl('Venta', FS);
    nl(2);
    if (cliente.nombre) tl(`NOMBRE: ${cliente.nombre.toUpperCase()}`, FS);
    if (cliente.dni) tl(`RUT: ${cliente.dni}`, FS);
    nl(1);
    const prodStr = `${nombreComercial}${memoria ? ' ' + memoria + 'GB' : ''}`.trim();
    if (prodStr) tl(prodStr, FS);
    if (color)   tl(`COLOR: ${color.toUpperCase()}`, FS);
    if (imei1)   tl(`IMEI: ${imei1}`, FS);
    if (imei2)   tl(`IMEI: ${imei2}`, FS);
    nl(2);
    tr(`$ ${totalNum.toLocaleString('es-CL')}`, FS);
    nl(2);
    tl('El IVA incluido en esta boleta es', FS);
    tl(`de: $ ${iva.toLocaleString('es-CL')}`, FS);
    nl(5);
    if (pdf417Img) {
      if (dibujar) doc.addImage(pdf417Img, 'PNG', M, y, pdf417W, pdf417H);
      y += pdf417H;
    }
    nl(3);
    tl('Código PDF417', FS);
    tl('Referencia interna', FS);
    tl('Consulta en COMUNIC@TE', FS);
    nl(2);
    tl('Consulta del historial:', 7);
    tl(verificationUrl, 7);
    tl('                               ', FS);
    tl('                               ', FS);
    nl(6);
    return y;
  };

  const docMedida = new jsPDF({ unit: 'mm', format: [mmW, 500], orientation: 'portrait' });
  const altoTotal = renderPDF(docMedida, false);
  const docFinal  = new jsPDF({ unit: 'mm', format: [mmW, altoTotal], orientation: 'portrait' });
  renderPDF(docFinal, true);

  const nombre2 = `BOLETA2-${nBoleta}.pdf`;
  return entregarPdf(docFinal, nombre2, output);
}

export async function generarBoletaExtranjera3({ cliente, ventas, equiposMap, totalClp, fechaHora, nBoleta: numeroBoleta, emisor: emisorConfig, output = 'download', runtime }) {
  const {jsPDF} = getPdfTools();
  const gen417 = runtime?.barcode417 ?? await getPdf417Generator();
  const verificationUrl = runtime?.verificationUrl ?? getBoletaVerificationUrl();
  const mmW = 80;
  const M = 5;
  const FONT = 'helvetica';
  const FS = 9; // mismo tamano base que el formato 2
  const nBoleta = numeroBoleta ? String(numeroBoleta) : String(Date.now()).slice(-4).padStart(4, '0');
  const emisor = {giro1: '', giro2: '', ...(emisorConfig || {})};
  emisor.vendedor = rutVendedor(emisor.rut) || emisor.vendedor;

  const ventasBoleta = Array.isArray(ventas) ? ventas : [];
  const totalNum = typeof totalClp === 'number'
    ? totalClp
    : parseInt(String(totalClp).replace(/\D/g, ''), 10) || 0;
  const iva = Math.round(totalNum - totalNum / 1.19);
  const totalSinIva = totalNum - iva;
  const fecha = fechaHora ? new Date(fechaHora + 'Z') : new Date();
  const pad = n => String(n).padStart(2, '0');
  const fechaStr = `${pad(fecha.getUTCDate())}/${pad(fecha.getUTCMonth() + 1)}/${fecha.getUTCFullYear()}`;
  const hora12 = fecha.getUTCHours() % 12 || 12;
  const horaStr = `${hora12}.${pad(fecha.getUTCMinutes())}${fecha.getUTCHours() >= 12 ? 'pm' : 'am'}`;
  const fechaIso = `${fecha.getUTCFullYear()}-${pad(fecha.getUTCMonth() + 1)}-${pad(fecha.getUTCDate())}`;
  const money = value => `$ ${Number(value || 0).toLocaleString('es-CL')}`;

  const obtenerEquipo = venta => equiposMap?.[venta.imeiEquipo] || {};
  const nombreItem = venta => {
    const eq = obtenerEquipo(venta);
    const marca = venta.marcaEquipo || eq.marca || '';
    const nombre = eq.nombreComercial || venta.nombreComercial || venta.modeloEquipo || eq.modelo || 'EQUIPO';
    return `${marca} ${nombre}`.replace(/\s+/g, ' ').trim();
  };
  const nombreComercialItem = venta => {
    const eq = obtenerEquipo(venta);
    return eq.nombreComercial || venta.nombreComercial || venta.modeloEquipo || eq.modelo || nombreItem(venta);
  };
  const memoriaItem = venta => {
    const eq = obtenerEquipo(venta);
    const memoria = eq.memoria || venta.memoria || '';
    const texto = String(memoria || '').trim();
    if (!texto) return '';
    return /\b(GB|TB|MB)\b/i.test(texto) ? texto.toUpperCase() : `${texto}GB`;
  };

  const texto417 = [
    nBoleta,
    emisor.rut,
    emisor.nombre,
    cliente?.dni || '',
    cliente?.nombre || '',
    ventasBoleta.map(v => [nombreItem(v), v.imeiEquipo, obtenerEquipo(v).imei2 || v.imei2Equipo].filter(Boolean).join(' ')).join('; '),
    totalSinIva,
    iva,
    totalNum,
    fechaIso,
    'COMUNIC@TE',
  ].join('|');
  const dataUrl417 = gen417(texto417, 2, 1);
  const barcodeSize = new jsPDF().getImageProperties(dataUrl417);
  const pdf417W = mmW - M * 2;
  const pdf417H = barcodeSize.height > 0
    ? pdf417W * (barcodeSize.height / barcodeSize.width) * 1.28
    : 38;

  const renderPDF = (doc, dibujar) => {
    let y = 5;
    const cx = mmW / 2;
    const lh = size => size * 0.38 + 1.15;
    const ink = 18;
    const muted = 88;
    const ruleColor = 170;

    const drawText = (txt, x, yy, size, opts = {}) => {
      doc.setFont(FONT, opts.bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      doc.setTextColor(opts.muted ? muted : ink);
      if (!dibujar) return;
      if (opts.align) doc.text(String(txt ?? ''), x, yy, {align: opts.align});
      else doc.text(String(txt ?? ''), x, yy);
    };
    const center = (txt, size, bold = false) => {
      doc.setFont(FONT, bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      doc.setTextColor(ink);
      const lines = doc.splitTextToSize(String(txt ?? ''), mmW - M * 2);
      if (dibujar) lines.forEach((line, i) => doc.text(line, cx, y + i * lh(size), {align: 'center'}));
      y += lh(size) * lines.length;
    };
    const row = (label, value, size = FS) => {
      drawText(label, M, y, size, {bold: true, muted: true});
      doc.setFont(FONT, 'normal');
      doc.setFontSize(size);
      doc.setTextColor(ink);
      const xValue = M + 18;
      const lines = doc.splitTextToSize(String(value ?? ''), mmW - M - xValue);
      if (dibujar) lines.forEach((line, i) => doc.text(line, xValue, y + i * lh(size)));
      y += lh(size) * Math.max(lines.length, 1);
    };
    const section = title => {
      if (dibujar) {
        doc.setDrawColor(ruleColor);
        doc.setLineWidth(0.18);
        doc.line(M, y, mmW - M, y);
      }
      y += 3.4;
      drawText(title, M, y, 7.6, {bold: true, muted: true});
      y += 4.5;
    };
    const totalRow = (label, value, options = {}) => {
      const {bold = false, fill = false} = options;
      const rowX = M;
      const rowW = mmW - M * 2;
      const rowH = bold ? 8.2 : 6.1;
      const labelX = M + 2;
      const valueX = mmW - M - 2;

      if (dibujar && fill) {
        doc.setFillColor(238);
        doc.rect(rowX, y - 4.8, rowW, rowH, 'F');
      }

      drawText(label, labelX, y, bold ? 9.1 : 8.5, {bold, muted: !bold});
      drawText(value, valueX, y, bold ? 9.4 : 8.5, {align: 'right', bold});
      y += bold ? 8.2 : 5.8;
    };
    const table = {
      qtyX: M + 3.8,
      itemX: M + 9.5,
      itemW: 22.5,
      valueX: 52,
      discountX: 58.6,
      subtotalX: mmW - M,
      headerSize: 6.5,
      itemSize: 8.5,
      moneySize: 7.1,
      metaSize: 7.8,
      imeiSize: 8.5,
    };
    const infoLine = (label, value, options = {}) => {
      const text = String(value ?? '').trim();
      if (!text) return;
      const {imei = false} = options;
      const size = imei ? table.imeiSize : table.metaSize;
      const labelText = `${label}:`;

      doc.setFont(FONT, 'bold');
      doc.setFontSize(size);
      const valueX = table.itemX + doc.getTextWidth(labelText) + 1.8;

      drawText(labelText, table.itemX, y, size, {bold: true, muted: !imei});
      doc.setFont(FONT, imei ? 'bold' : 'normal');
      doc.setFontSize(size);
      doc.setTextColor(imei ? ink : muted);
      const lines = doc.splitTextToSize(text, mmW - M - valueX);
      if (dibujar) lines.forEach((txt, i) => doc.text(txt, valueX, y + i * lh(size)));
      y += lh(size) * Math.max(lines.length, 1);
    };

    if (dibujar) {
      doc.setDrawColor(ink);
      doc.setLineWidth(0.28);
      doc.roundedRect(41, 4, 34, 24, 1, 1);
      doc.setFillColor(245);
      doc.rect(M, 4, 31, 24, 'F');
    }

    const nombreCorto = nombreCortoEmisor(emisor.nombre);
    drawText(nombreCorto.linea1, M + 2, 10.2, 10.8, {bold: true});
    drawText(nombreCorto.linea2, M + 2, 16, 10.8, {bold: true});
    drawText('VENTA CELULARES', M + 2, 21.5, 7.4, {muted: true});
    drawText([emisor.ciudad, emisor.pais].filter(Boolean).join(', '), M + 2, 25.5, 7.4, {muted: true});

    drawText('RUT', 58, 9.2, 7.8, {align: 'center', bold: true, muted: true});
    drawText(emisor.rut, 58, 13.8, 8.7, {align: 'center', bold: true});
    drawText('CONSTANCIA DE COMPRA', 58, 19.2, 7.9, {align: 'center', bold: true});
    drawText(`Nro ${nBoleta}`, 58, 24, 8.5, {align: 'center', bold: true});
    y = 34;

    center(emisor.nombre, 8.9, true);
    center(`${emisor.giro1} ${emisor.giro2}`, 8.1);
    row('Direccion:', emisor.direccion);
    row('Comuna:', emisor.comuna);
    row('Ciudad:', emisor.ciudad);
    row('Vendedor:', emisor.vendedor);
    row('Fecha:', `${fechaStr} ${horaStr}`);
    row('Pago:', emisor.metodoPago || '—');
    y += 2;

    section('CLIENTE');
    row('Sr@:', cliente?.nombre ? cliente.nombre.toUpperCase() : '');
    row('RUT:', cliente?.dni || '');
    y += 3;

    section('DETALLE');
    if (dibujar) {
      doc.setFillColor(244);
      doc.rect(M, y - 3.3, mmW - M * 2, 5.8, 'F');
    }
    drawText('CANT.', table.qtyX, y, table.headerSize, {align: 'center', bold: true, muted: true});
    drawText('NOMBRE COM.', table.itemX, y, table.headerSize, {bold: true, muted: true});
    drawText('VALOR U.', table.valueX, y, table.headerSize, {align: 'right', bold: true, muted: true});
    drawText('DESC.', table.discountX, y, table.headerSize, {align: 'center', bold: true, muted: true});
    drawText('SUBTOTAL', table.subtotalX, y, table.headerSize, {align: 'right', bold: true, muted: true});
    y += 6.5;

    ventasBoleta.forEach((venta, index) => {
      const eq = obtenerEquipo(venta);
      const itemTotal = penToClp(parseFloat(venta.precio || 0));
      doc.setFont(FONT, 'bold');
      doc.setFontSize(table.itemSize);
      const itemLines = doc.splitTextToSize(nombreComercialItem(venta).toUpperCase(), table.itemW);

      if (dibujar) {
        doc.setDrawColor(215);
        doc.setLineWidth(0.14);
        doc.line(M, y - 1.8, mmW - M, y - 1.8);
      }
      drawText('1', table.qtyX, y, 8.7, {align: 'center', bold: true});
      if (dibujar) itemLines.forEach((line, i) => drawText(line, table.itemX, y + i * lh(table.itemSize), table.itemSize, {bold: true}));
      drawText(money(itemTotal), table.valueX, y, table.moneySize, {align: 'right'});
      drawText('$ 0', table.discountX, y, table.moneySize, {align: 'center'});
      drawText(money(itemTotal), table.subtotalX, y, table.moneySize, {align: 'right', bold: true});
      y += lh(table.itemSize) * Math.max(itemLines.length, 1) + 1.3;

      const memoria = memoriaItem(venta);
      const imei2 = eq.imei2 || venta.imei2Equipo || '';
      infoLine('MEMORIA', memoria);
      infoLine('IMEI', venta.imeiEquipo, {imei: true});
      infoLine('IMEI 2', imei2, {imei: true});
      y += 1.4;

      if (dibujar && index < ventasBoleta.length - 1) {
        doc.setDrawColor(210);
        doc.setLineWidth(0.12);
        doc.line(M, y + 0.8, mmW - M, y + 0.8);
      }
      if (index < ventasBoleta.length - 1) y += 3.2;
    });

    y += 3;
    if (dibujar) {
      doc.setDrawColor(ruleColor);
      doc.setLineWidth(0.2);
      doc.line(M, y, mmW - M, y);
    }
    y += 4.2;
    drawText('RESUMEN', M + 2, y, 7.8, {bold: true, muted: true});
    y += 4.8;
    totalRow('TOTAL SIN IVA', money(totalSinIva));
    totalRow('IVA 19%', money(iva));
    if (dibujar) {
      doc.setDrawColor(ink);
      doc.setLineWidth(0.35);
      doc.line(M, y - 1.3, mmW - M, y - 1.3);
    }
    y += 1.3;
    totalRow('TOTAL CON IVA', money(totalNum), {bold: true, fill: true});

    y = Math.max(y + 5, 132);
    if (dibujar) doc.addImage(dataUrl417, 'PNG', M, y, pdf417W, pdf417H);
    y += pdf417H + 4.5;
    center('Código PDF417', 8.2, true);
    center('Referencia interna', 7.8);
    center('Consulta en COMUNIC@TE', 7.8);
    y += 1.5;
    center('Consulta del historial:', 7.4, true);
    center(verificationUrl, 7);
    y += 4;

    return Math.max(y, 188);
  };

  const docMedida = new jsPDF({ unit: 'mm', format: [mmW, 260], orientation: 'portrait' });
  const altoTotal = renderPDF(docMedida, false);
  const docFinal = new jsPDF({ unit: 'mm', format: [mmW, altoTotal], orientation: 'portrait' });
  renderPDF(docFinal, true);

  const nombre3 = `BOLETA3-${nBoleta}.pdf`;
  return entregarPdf(docFinal, nombre3, output);
}

export async function generarBoletaExtranjera4({ventas, equiposMap, totalClp, totalUsd: totalUsdGuardado, fechaHora, nBoleta: numeroBoleta, emisor: emisorConfig, output = 'download', runtime}) {
  const {jsPDF} = getPdfTools();
  const emisor = {...(emisorConfig || {})};
  const doc = new jsPDF({unit: 'mm', format: 'letter', orientation: 'portrait'});
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;
  const right = pageW - margin;
  const contentW = pageW - margin * 2;
  const nBoleta = numeroBoleta ? String(numeroBoleta) : String(Date.now()).slice(-7).padStart(7, '0');
  const fecha = fechaHora ? new Date(fechaHora + 'Z') : new Date();
  const fechaTexto = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(fecha);
  const taxPercent = Math.min(100, Math.max(0, Number(emisor.impuestoPorcentaje || 0)));
  const ventasBoleta = Array.isArray(ventas) ? ventas : [];
  const sourceTotalPen = ventasBoleta.reduce((sum, venta) => sum + Number(venta.precio || 0), 0);
  const total = totalUsdGuardado ?? (sourceTotalPen > 0
    ? penToUsd(sourceTotalPen, emisor.tipoCambioPenUsd)
    : penToUsd(Math.max(0, Number(totalClp || 0)) / 266.67, emisor.tipoCambioPenUsd));
  const roundUsd = value => Math.round(Number(value || 0) * 100) / 100;
  const subtotal = taxPercent > 0 ? roundUsd(total / (1 + taxPercent / 100)) : total;
  const tax = roundUsd(total - subtotal);
  const money = value => `$${Number(value || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
  const companyLines = [emisor.nombre, emisor.direccion, emisor.ciudad, emisor.pais, emisor.email, emisor.telefono, emisor.sitioWeb].filter(Boolean);

  const text = (value, x, y, size = 8, options = {}) => {
    doc.setFont('helvetica', options.bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(options.color ?? 48);
    doc.text(String(value ?? ''), x, y, options.align ? {align: options.align} : undefined);
  };

  if (emisor.logoDataUrl) {
    try {
      const imageProperties = doc.getImageProperties(emisor.logoDataUrl);
      const maxW = 46;
      const maxH = 20;
      const scale = Math.min(maxW / imageProperties.width, maxH / imageProperties.height);
      const width = imageProperties.width * scale;
      const height = imageProperties.height * scale;
      const format = /^data:image\/png/i.test(emisor.logoDataUrl) ? 'PNG' : 'JPEG';
      doc.addImage(emisor.logoDataUrl, format, margin, 14, width, height);
    } catch (error) {
      console.warn('No se pudo insertar el logo en la boleta 4:', error);
    }
  }

  let companyY = emisor.logoDataUrl ? 38 : 23;
  companyLines.forEach((line, index) => {
    text(line, margin, companyY, index === 0 ? 8.4 : 7.2, {bold: index === 0, color: index === 0 ? 40 : 82});
    companyY += index === 0 ? 4.2 : 3.3;
  });

  text(`INVOICE # :   ${nBoleta}`, right, 25, 11.5, {bold: true, align: 'right'});
  const meta = [
    ['Date', fechaTexto],
    ['Payment Terms', emisor.metodoPago || '—'],
    ['Due Date', fechaTexto],
    ['Balance due', money(0)],
  ];
  meta.forEach(([label, value], index) => {
    const y = 34 + index * 4.2;
    text(`${label}:`, right - 34, y, 7.2, {bold: true, align: 'right', color: 70});
    text(value, right, y, 7.2, {align: 'right', color: 70});
  });

  let y = Math.max(companyY + 6, 62);
  const drawTableHeader = () => {
    doc.setFillColor(62, 62, 62);
    doc.rect(margin, y, contentW, 8, 'F');
    text('DESCRIPTION', margin + 4, y + 5.3, 7.5, {bold: true, color: 248});
    text('QTY', right - 50, y + 5.3, 7.5, {bold: true, align: 'center', color: 248});
    text('AMOUNT', right - 3, y + 5.3, 7.5, {bold: true, align: 'right', color: 248});
    y += 13;
  };
  drawTableHeader();

  ventasBoleta.forEach((venta, index) => {
    if (y > pageH - 82) {
      doc.addPage('letter', 'portrait');
      y = 18;
      drawTableHeader();
    }
    const equipo = equiposMap?.[venta.imeiEquipo] || {};
    const product = [
      venta.marcaEquipo || equipo.marca,
      equipo.nombreComercial || venta.nombreComercial || venta.modeloEquipo || equipo.modelo,
      venta.memoria || equipo.memoria,
      venta.color || equipo.color,
    ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim() || 'EQUIPO';
    const previousItemsTotal = ventasBoleta.slice(0, index).reduce((sum, item) => (
      sum + roundUsd(subtotal * Number(item.precio || 0) / (sourceTotalPen || 1))
    ), 0);
    const itemAmount = index === ventasBoleta.length - 1
      ? roundUsd(subtotal - previousItemsTotal)
      : roundUsd(subtotal * Number(venta.precio || 0) / (sourceTotalPen || 1));
    const details = [
      ['Model Number', venta.modeloEquipo || equipo.modelo],
      ['Serial Number', venta.sn || equipo.sn],
      ['IMEI1', venta.imeiEquipo],
      ['IMEI2', equipo.imei2 || venta.imei2Equipo],
    ].filter(([, value]) => value);
    text(product, margin + 2, y, 8.5, {bold: true});
    text('1', right - 50, y, 8.5, {align: 'center'});
    text(money(itemAmount), right - 2, y, 8.5, {align: 'right'});
    y += 5;
    details.forEach(([label, value]) => {
      text(`${label}:`, margin + 2, y, 7.2, {bold: true, color: 78});
      text(value, margin + 30, y, 7.2, {color: 78});
      y += 4;
    });
    y += 4;
    doc.setDrawColor(225);
    doc.setLineWidth(0.2);
    doc.line(margin, y, right, y);
    y += 5;
  });

  y = Math.max(y + 15, 190);
  if (y > pageH - 66) {
    doc.addPage('letter', 'portrait');
    y = 32;
  }
  doc.setDrawColor(70);
  doc.setLineWidth(0.35);
  doc.line(margin, y, right, y);
  y += 9;
  const totalsX = right - 46;
  const valueX = right;
  [['Subtotal', subtotal], [`Tax ${taxPercent}%`, tax]].forEach(([label, value]) => {
    text(`${label}:`, totalsX, y, 8, {align: 'right', color: 75});
    text(money(value), valueX, y, 8, {align: 'right'});
    y += 6;
  });
  text('Total:', totalsX, y, 8.5, {bold: true, align: 'right'});
  text(money(total), valueX, y, 8.5, {bold: true, align: 'right'});
  y += 12;
  text('Amount Paid:', totalsX, y, 8.5, {align: 'right', color: 70});
  text(money(total), valueX, y, 8.5, {align: 'right'});
  y += 9;
  doc.line(margin, y, right, y);
  y += 9;
  text('Notes:', margin, y, 7.8, {color: 70});
  y += 4.3;
  const noteLines = doc.splitTextToSize(emisor.notas || 'Please include your reference number.', contentW * 0.72);
  noteLines.forEach(line => {
    text(line, margin, y, 7.4, {color: 75});
    y += 3.7;
  });
  text(`Reference: ${nBoleta}`, margin, y + 1, 7.5, {bold: true});
  y += 7;
  doc.line(margin, y, right, y);
  y += 9;
  text(`Terms: ${fecha.getUTCFullYear()} ${emisor.nombre || 'Company'}. ${emisor.terminos || ''}`, margin, y, 7.2, {color: 82});

  const verificationUrl = runtime?.verificationUrl ?? getBoletaVerificationUrl();
  text(emisor.sitioWeb || verificationUrl, margin, pageH - 13, 7, {color: 68});
  text('Documento generado por COMUNIC@TE', right, pageH - 13, 6.8, {align: 'right', color: 110});

  return entregarPdf(doc, `BOLETA4-${nBoleta}.pdf`, output);
}

export async function generarBoletaExtranjera5({cliente, ventas, equiposMap, totalClp, totalUsd: totalUsdGuardado, fechaHora, nBoleta: numeroBoleta, emisor: emisorConfig, output = 'download'}) {
  const {jsPDF} = getPdfTools();
  const emisor = {...(emisorConfig || {})};
  const doc = new jsPDF({unit: 'mm', format: 'a4', orientation: 'portrait'});
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const nBoleta = numeroBoleta ? String(numeroBoleta) : String(Date.now());
  const fecha = fechaHora ? new Date(fechaHora + 'Z') : new Date();
  const numeroOrden = formatearNumeroOrdenFormato5(nBoleta, fecha);
  const fechaTexto = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(fecha);
  const ventasBoleta = Array.isArray(ventas) ? ventas : [];
  const sourceTotalPen = ventasBoleta.reduce((sum, venta) => sum + Number(venta.precio || 0), 0);
  const total = totalUsdGuardado ?? (sourceTotalPen > 0
    ? penToUsd(sourceTotalPen, emisor.tipoCambioPenUsd)
    : penToUsd(Math.max(0, Number(totalClp || 0)) / 266.67, emisor.tipoCambioPenUsd));
  const roundUsd = value => Math.round(Number(value || 0) * 100) / 100;
  const taxPercent = Math.min(100, Math.max(0, Number(emisor.impuestoPorcentaje || 0)));
  const subtotal = taxPercent > 0 ? roundUsd(total / (1 + taxPercent / 100)) : total;
  const tax = roundUsd(total - subtotal);
  const money = value => `$ ${Number(value || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
  let allocatedTotal = 0;
  const itemAmountsUsd = ventasBoleta.map((venta, index) => {
    if (index === ventasBoleta.length - 1) return roundUsd(total - allocatedTotal);
    const amount = roundUsd(total * Number(venta.precio || 0) / (sourceTotalPen || 1));
    allocatedTotal = roundUsd(allocatedTotal + amount);
    return amount;
  });
  const ink = [16, 24, 32];
  const bodyInk = [20, 28, 36];
  const blue = [0, 56, 164];
  const green = [80, 124, 84];
  const grid = [232, 234, 236];
  const headerFill = [249, 249, 249];
  const seller = String(emisor.nombre || 'Seller').trim();
  const itemsSeller = String(emisor.vendedor || seller).trim();
  const itemCount = ventasBoleta.length;
  const itemCountLabel = `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`;

  const text = (value, x, y, size = 8.5, options = {}) => {
    doc.setFont('helvetica', options.bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    const color = options.color || ink;
    doc.setTextColor(...color);
    doc.text(String(value ?? ''), x, y, options.align ? {align: options.align} : undefined);
  };

  const labelValue = (label, value, y, options = {}) => {
    text(label, 5.3, y, 8.5);
    const lines = doc.splitTextToSize(String(value || ''), 31.5).slice(0, options.maxLines || 2);
    lines.forEach((line, index) => text(line, 33.1, y + index * 3.4, 8.5, {color: bodyInk}));
  };

  if (emisor.logoDataUrl) {
    try {
      const imageProperties = doc.getImageProperties(emisor.logoDataUrl);
      const maxW = 31.16;
      const maxH = 12.53;
      const scale = Math.min(maxW / imageProperties.width, maxH / imageProperties.height);
      const width = imageProperties.width * scale;
      const height = imageProperties.height * scale;
      const format = /^data:image\/png/i.test(emisor.logoDataUrl) ? 'PNG' : 'JPEG';
      doc.addImage(emisor.logoDataUrl, format, 5.08, 2.71, width, height);
    } catch (error) {
      console.warn('No se pudo insertar el logo en la boleta 5:', error);
    }
  }

  text('Order information', 5.3, 27.3, 16, {bold: true});
  text('Shipping address', 65.5, 27.3, 16, {bold: true});
  text('Order total', 125.3, 27.3, 16, {bold: true});

  labelValue('Buyer', String(cliente?.nombre || '').toUpperCase(), 34.2);
  labelValue('Seller', seller, 42, {maxLines: 1});
  labelValue('Placed on', fechaTexto, 48, {maxLines: 1});
  labelValue('Payment method', emisor.metodoPago || '—', 54.4, {maxLines: 1});
  labelValue('Paid on', fechaTexto, 60.7, {maxLines: 1});

  const shippingLines = [
    cliente?.direccion || emisor.direccion,
    [cliente?.ciudad, cliente?.provincia, cliente?.codigoPostal].filter(Boolean).join(', ') || emisor.ciudad,
    cliente?.pais || emisor.pais,
  ].filter(Boolean);
  shippingLines.slice(0, 3).forEach((line, index) => text(line, 65.3, 35.9 + index * 4.2, 8.5, {color: bodyInk}));

  text(itemCountLabel, 125.3, 34.2, 8.5);
  text(money(subtotal), 164.5, 34.2, 8.5, {color: bodyInk});
  text('Shipping', 125.3, 40.5, 8.5);
  text('Free', 164.5, 40.5, 8.5, {color: green});
  text('Tax*', 125.3, 46.8, 8.5);
  text(money(tax), 164.5, 46.8, 8.5, {color: bodyInk});
  doc.setDrawColor(...ink);
  doc.setLineWidth(0.35);
  doc.line(125.3, 49.7, 197.6, 49.7);
  text('Order total', 125.3, 55.6, 8.5, {bold: true});
  text(money(total), 164, 55.6, 8.5, {bold: true, color: bodyInk});

  const legalNote = emisor.notas || '';
  const legalLines = doc.splitTextToSize(legalNote, 57).slice(0, 3);
  legalLines.forEach((line, index) => text(line, 125.3, 63.2 + index * 5.3, 11));
  text('Learn more', 125.3, 79.2, 11, {color: blue});
  doc.setDrawColor(...blue);
  doc.setLineWidth(0.2);
  doc.line(125.3, 79.8, 145.2, 79.8);

  text(`Items bought from ${itemsSeller}`, 5.3, 98.4, 16, {bold: true});
  text(`Order number: ${numeroOrden}`, 5.3, 105.5, 12.5);

  const columns = [5.3, 25.1, 125.7, 160.8, 197.6];
  let tableY = 108.4;
  const headerH = 7.7;
  const drawTableHeader = () => {
    doc.setFillColor(...headerFill);
    doc.rect(columns[0], tableY, columns.at(-1) - columns[0], headerH, 'F');
    doc.setDrawColor(...grid);
    doc.setLineWidth(0.35);
    doc.rect(columns[0], tableY, columns.at(-1) - columns[0], headerH);
    columns.slice(1, -1).forEach(x => doc.line(x, tableY, x, tableY + headerH));
    text('Quantity', 7.3, tableY + 5.1, 8.5, {bold: true});
    text('Item name', 27, tableY + 5.1, 8.5, {bold: true});
    text('Shipping service', 127.5, tableY + 5.1, 8.5, {bold: true});
    text('Item price', 163.3, tableY + 5.1, 8.5, {bold: true});
    tableY += headerH;
  };
  drawTableHeader();

  ventasBoleta.forEach((venta, index) => {
    const equipo = equiposMap?.[venta.imeiEquipo] || {};
    const product = [
      venta.marcaEquipo || equipo.marca,
      equipo.nombreComercial || venta.nombreComercial || venta.modeloEquipo || equipo.modelo,
      venta.memoria || equipo.memoria,
      venta.color || equipo.color,
    ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim() || 'EQUIPO';
    const itemAmount = itemAmountsUsd[index] || 0;
    const productLines = doc.splitTextToSize(product, 36).slice(0, 2);
    const imeiLines = [
      venta.imeiEquipo ? `IMEI1: ${venta.imeiEquipo}` : '',
      (equipo.imei2 || venta.imei2Equipo) ? `IMEI2: ${equipo.imei2 || venta.imei2Equipo}` : '',
    ].filter(Boolean);
    const rowH = Math.max(16, 6 + Math.max(productLines.length, imeiLines.length) * 3.5);
    if (tableY + rowH > pageH - 12) {
      doc.addPage('a4', 'portrait');
      tableY = 12;
      drawTableHeader();
    }
    doc.setDrawColor(...grid);
    doc.rect(columns[0], tableY, columns.at(-1) - columns[0], rowH);
    columns.slice(1, -1).forEach(x => doc.line(x, tableY, x, tableY + rowH));
    text('1', 7.4, tableY + 5, 8.5);
    productLines.forEach((line, lineIndex) => text(line, 27.4, tableY + 5 + lineIndex * 3.5, 8.5));
    imeiLines.forEach((line, lineIndex) => text(line, 62.6, tableY + 5 + lineIndex * 3.5, 8.3));
    text(money(itemAmount), 163.5, tableY + 5, 8.5);
    tableY += rowH;
  });

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    text(`${page}/${pageCount}`, pageW - 7.2, pageH - 4.6, 8.5, {align: 'right', color: [0, 0, 0]});
  }
  return entregarPdf(doc, `BOLETA5-${numeroOrden}.pdf`, output);
}

export async function generarBoletaExtranjera6({ventas, equiposMap, totalClp, totalUsd: totalUsdGuardado, fechaHora, nBoleta: numeroBoleta, emisor: emisorConfig, output = 'download'}) {
  const {jsPDF, JsBarcode} = getPdfTools();
  const emisor = {...(emisorConfig || {})};
  const doc = new jsPDF({unit: 'pt', format: 'letter', orientation: 'portrait'});
  const pageW = doc.internal.pageSize.getWidth();
  const nBoleta = numeroBoleta ? String(numeroBoleta) : String(Date.now());
  const fecha = fechaHora ? new Date(fechaHora + 'Z') : new Date();
  const ventasBoleta = Array.isArray(ventas) && ventas.length ? ventas : [{}];
  const sourceTotalPen = ventasBoleta.reduce((sum, venta) => sum + Number(venta.precio || 0), 0);
  const totalUsd = totalUsdGuardado ?? (sourceTotalPen > 0
    ? penToUsd(sourceTotalPen, emisor.tipoCambioPenUsd)
    : penToUsd(Math.max(0, Number(totalClp || 0)) / 266.67, emisor.tipoCambioPenUsd));
  const taxPercent = Math.min(100, Math.max(0, Number(emisor.impuestoPorcentaje || 0)));
  const roundUsd = value => Math.round(Number(value || 0) * 100) / 100;
  const money = value => `$ ${Number(value || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
  let allocatedTotal = 0;
  const itemTotals = ventasBoleta.map((venta, index) => {
    if (index === ventasBoleta.length - 1) return roundUsd(totalUsd - allocatedTotal);
    const value = roundUsd(totalUsd * Number(venta.precio || 0) / (sourceTotalPen || 1));
    allocatedTotal = roundUsd(allocatedTotal + value);
    return value;
  });

  const pad = value => String(value).padStart(2, '0');
  const headerDate = `${new Intl.DateTimeFormat('en-US', { timeZone: 'UTC',month: 'long', day: 'numeric', year: 'numeric'}).format(fecha)} ${new Intl.DateTimeFormat('en-US', { timeZone: 'UTC',hour: '2-digit', minute: '2-digit', hour12: true}).format(fecha)}`;
  const transactionDate = `${fecha.getUTCFullYear()}/${pad(fecha.getUTCMonth() + 1)}/${pad(fecha.getUTCDate())} ${pad(fecha.getUTCHours())}:${pad(fecha.getUTCMinutes())}:${pad(fecha.getUTCSeconds())}`;
  const returnDate = new Date(fecha);
  returnDate.setUTCDate(returnDate.getUTCDate() + Math.max(0, Number(emisor.diasDevolucion || 16)));
  const returnMonths = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May.', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'];
  const returnDateText = `${returnMonths[returnDate.getUTCMonth()]} ${pad(returnDate.getUTCDate())}, ${returnDate.getUTCFullYear()}`;
  const cardLast4 = String(emisor.tarjetaUltimos4 || '').replace(/\D/g, '').slice(-4);

  const renderReceiptPage = (venta, pageIndex) => {
    if (pageIndex > 0) doc.addPage('letter', 'portrait');
    const equipo = equiposMap?.[venta.imeiEquipo] || {};
    const itemTotal = itemTotals[pageIndex] || 0;
    const subtotal = taxPercent > 0 ? roundUsd(itemTotal / (1 + taxPercent / 100)) : itemTotal;
    const tax = roundUsd(itemTotal - subtotal);
    const model = String(equipo.nombreComercial || venta.nombreComercial || venta.modeloEquipo || equipo.modelo || 'IPHONE').trim();
    const color = String(venta.color || equipo.color || '').trim();
    const memory = String(venta.memoria || equipo.memoria || '').trim();
    const productName = [model.toUpperCase(), color, memory ? `${memory.toUpperCase()}-USA` : 'USA'].filter(Boolean).join(' ').replace(/\s+/g, ' ');
    const serial = venta.sn || equipo.sn || '-';
    const imei1 = venta.imeiEquipo || equipo.imei || '-';
    const imei2 = equipo.imei2 || venta.imei2Equipo || '-';
    const partNumber = venta.partNumber || equipo.partNumber || emisor.partNumber || '';
    const reference = crearReferenciaFormato6(nBoleta, fecha, pageIndex);

    const text = (value, x, y, options = {}) => {
      doc.setFont('helvetica', options.bold ? 'bold' : 'normal');
      doc.setFontSize(options.size || 8);
      doc.setTextColor(0, 0, 0);
      doc.text(String(value ?? ''), x, y, options.align ? {align: options.align} : undefined);
    };
    const rule = (y, width = 1) => {
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(width);
      doc.line(144, y, 468, y);
    };

    if (emisor.logoDataUrl) {
      const type = /^data:image\/png/i.test(emisor.logoDataUrl) ? 'PNG' : 'JPEG';
      doc.addImage(emisor.logoDataUrl, type, 140, 76, 24, 24);
    }
    text(emisor.nombre || '', 144, 109);
    text(emisor.direccion, 144, 120);
    text(emisor.ciudad, 144, 131);
    text(emisor.email, 144, 141);
    text(emisor.telefono, 144, 150);
    text(emisor.sitioWeb, 144, 160);

    rule(178.54);
    text(headerDate, 144, 192);
    rule(213.84);

    text(productName, 144, 227, {bold: true});
    text(money(subtotal), 468, 227, {bold: true, align: 'right'});
    text(`Part Number: ${partNumber}`, 144, 241);
    text(`Serial Number: ${serial}`, 144, 252);
    text(`IMEI: ${imei1}`, 144, 263);
    text(`IMEI2: ${imei2}`, 144, 274);
    text(`Return Date: ${returnDateText}`, 144, 284);
    text(emisor.sitioWeb || '', 144, 296);

    rule(323.27);
    text('Sub-Total', 354.6, 345, {align: 'right'});
    text(money(subtotal), 468, 345, {align: 'right'});
    text('Tax', 354.6, 360, {align: 'right'});
    text(money(tax), 468, 360, {align: 'right'});
    text('Total', 354.6, 375, {bold: true, align: 'right'});
    text(money(itemTotal), 468, 375, {bold: true, align: 'right'});
    text('Payment Method', 354.6, 394, {bold: true, align: 'right'});
    text(`Amount Paid Via ${emisor.metodoPago || '—'}`, 354.6, 414, {align: 'right'});
    text(money(itemTotal), 468, 414, {align: 'right'});
    text(`•••• ${cardLast4}`, 354.6, 425, {align: 'right'});
    text(emisor.codigoTerminal || '', 354.6, 436, {align: 'right'});

    rule(482.78, 2);
    try {
      const barcodeTarget = {};
      JsBarcode(barcodeTarget, reference.barcode, {format: 'CODE39', displayValue: false, margin: 0});
      const bits = barcodeTarget.encodings?.map(encoding => encoding.data).join('') || '';
      const moduleWidth = 0.5;
      const barcodeWidth = bits.length * moduleWidth;
      const barcodeX = (pageW - barcodeWidth) / 2;
      doc.setFillColor(0, 0, 0);
      let runStart = -1;
      for (let index = 0; index <= bits.length; index += 1) {
        if (bits[index] === '1' && runStart < 0) runStart = index;
        if (bits[index] !== '1' && runStart >= 0) {
          doc.rect(barcodeX + runStart * moduleWidth, 498.6, (index - runStart) * moduleWidth, 18, 'F');
          runStart = -1;
        }
      }
    } catch (error) {
      console.warn('No se pudo generar el código de barras de la boleta 6:', error);
    }
    text(`* ${reference.barcode.split('').join(' ')} *`, pageW / 2, 525, {size: 6, align: 'center'});

    rule(560.76, 2);
    text(`Please debit my account •••• ${cardLast4} by ${money(itemTotal)} (Sale)`, 144, 587);
    text(`Card Number: •••• ${cardLast4}`, 144, 598);
    text(`Date/Time: ${transactionDate}`, 144, 609);
    text(`Application ID: ${emisor.applicationId || ''}`, 144, 620);
    text(`Application PAN Sequence Number: ${emisor.applicationPanSequence || ''}`, 144, 631);
    text(`Device Id: ${emisor.deviceId || ''}`, 144, 643);
    text(`Card Type: ${emisor.cardType || ''}`, 144, 654);
    text(`TVR: ${emisor.tvr || ''}`, 144, 665);
    text(`TSI: ${emisor.tsi || ''}`, 144, 676);
    text('No CVM', 144, 687);

    rule(709.66);
    text(emisor.policyUrl || '', pageW / 2, 731, {align: 'center'});
    text(emisor.supportMessage || '', pageW / 2, 742, {align: 'center'});
    rule(751.66);
  };

  ventasBoleta.forEach(renderReceiptPage);
  return entregarPdf(doc, `BOLETA6-${nBoleta}.pdf`, output);
}
