# PHASE 6A — THERMAL RECEIPTS & COMPANY SETTINGS

## CONFIGURACIÓN DE UNA EMPRESA

`/configuracion` y `/configuracion/empresa` muestran DATOS DE LA EMPRESA. PostgreSQL conserva un único registro `CompanySettings` con id 1. Su clave primaria y CHECK impiden una segunda configuración. No hay organizaciones ni tenants.

SUPERADMIN dispone de `settings.read` y `settings.update`. ADMIN puede leer por su matriz actual; SELLER no puede abrir configuración. Los permisos se comprueban también en backend. Usuarios con `sales.read` pueden generar tickets usando la configuración empresarial aunque no tengan `settings.read`; no pueden editarla.

El formulario permite nombre comercial, descripción, dirección, ciudad, teléfono, correo, mensaje final, formato predeterminado, márgenes independientes y visibilidad de contacto, serie y vendedor. Texto comercial se normaliza a mayúsculas; correo a minúsculas; serie técnica conserva su contenido. Se valida en cliente y servidor. Cada guardado incluye usuario autenticado, fecha y AuditLog atómicamente. No requiere reinicio ni localStorage.

Los datos iniciales son COMUNIC@TE, VENTA DE CELULARES Y ACCESORIOS y GRACIAS POR SU COMPRA. Dirección, ciudad y teléfono están vacíos hasta que se configure información real; los ejemplos del requerimiento no se consideran datos verificados.

## DATOS Y REIMPRESIONES

`GET /api/sales/:id/receipt` entrega la venta y la configuración actual. Usa las relaciones existentes de comprador, líneas, equipos, IMEIs, accesorios y pago, sin crear otra venta ni copiar cliente/equipo. Importes Decimal se conservan como cadenas exactas.

Los tickets son documentos internos, no comprobantes tributarios. No se integran SUNAT, NubeFact ni facturación electrónica. Las reimpresiones utilizan la configuración empresarial vigente en el momento de generación; no representan un documento fiscal inmutable y no crean snapshots comerciales. La vista ya abierta mantiene los datos que cargó; volver a abrir obtiene los cambios.

## ANCHOS Y PRESENTACIÓN

Se ofrecen exactamente 48 y 80 mm. El compacto usa monoespaciada pequeña, composición vertical, características por línea, precios alineados y texto que se envuelve sin tablas. El estándar utiliza encabezado centrado, características agrupadas, tipografía más amplia y total destacado. Ambos incluyen múltiples equipos, IMEIs completos, accesorios, pago, código, fecha/hora de Lima y footer configurable.

El ancho de papel no equivale al imprimible. Una impresora vendida como 58 mm puede imprimir aproximadamente 48 mm; verificar su ficha y controlador. El POS no presume que todas tengan la misma área útil. Los márgenes interiores de cada formato pueden ajustarse: 48 mm admite 0–5 mm por lado; 80 mm, 0–10 mm. El ajuste reduce el contenido dentro de la plantilla seleccionada, sin cambiar el formato.

CODE128 se genera mediante JsBarcode con identificador completo, módulos de al menos 0.25 mm y zonas libres de diez módulos por lado. Si el ancho disponible no alcanza o el código no es representable, se muestra identificador en texto y aviso, sin reducir barras para forzar su tamaño. El barcode se dibuja como SVG y vectores PDF, sin rasterizarlo.

## SELECTOR Y APERTURA

En listado y detalle de ventas están VER TICKET, IMPRIMIR y DESCARGAR PDF. Abren SELECCIONAR FORMATO DE IMPRESIÓN con 48 MM — TICKET COMPACTO / 80 MM — TICKET ESTÁNDAR, CANCELAR y ABRIR TICKET. Una preferencia expresa se preselecciona y siempre puede cambiarse.

ABRIR TICKET abre directamente la ruta de previsualización en una nueva pestaña dentro del gesto del usuario. No abre una pestaña vacía durante peticiones ni descarga archivos invisiblemente. Si el navegador devuelve bloqueo de pestaña, el POS abre la misma vista en la pestaña actual. La vista permite cambiar formato, volver a venta, imprimir y descargar PDF.

## PDF E IMPRESIÓN

El PDF se genera con jsPDF, texto y barras vectoriales, ancho físico 48 u 80 mm, márgenes configurados y altura según contenido. Ventas excepcionalmente largas continúan en páginas de hasta 1000 mm. La descarga se inicia por botón visible y tiene nombre `CODIGO-48mm.pdf` o `CODIGO-80mm.pdf`.

La impresión usa `window.print()` y CSS independiente: página del ancho elegido y altura medida, sin navegación, botones, fondos ni controles. Las secciones de texto y barcode evitan cortes de página. El controlador o navegador puede imponer límites diferentes de papel personalizado. Seleccionar tamaño de papel y escala 100%, revisar márgenes, desactivar encabezados/pies del navegador y comprobar en la vista previa que no se recorta contenido.

La aplicación no selecciona impresoras físicas ni evita controles del navegador. No muestra impresión completada por invocar el diálogo. El usuario confirma el trabajo y verifica el papel.

## PRUEBA CON HARDWARE

1. Configurar datos reales y márgenes interiores en el POS.
2. Consultar ancho útil, resolución y papel aceptado por la impresora/controlador.
3. Generar venta de prueba con dos equipos, doble IMEI, serie alfanumérica, accesorios, descuento y textos largos.
4. Abrir 48 mm; imprimir a 100% con papel compatible. Verificar alineación, cortes, IMEIs, precios y legibilidad.
5. Repetir para 80 mm en hardware compatible.
6. Escanear el barcode y comparar el valor con el código de venta. Si el formato solo muestra texto, comprobar que el identificador está completo.
7. Repetir desde PDF y con mensajes/márgenes distintos. Documentar modelo, controlador, navegador y resultado.

Physical 48mm test: NOT VERIFIED. Physical 80mm test: NOT VERIFIED. No se dispone de hardware físico en esta sesión.

## MIGRACIÓN Y PRUEBAS

Nueva migración: `20261010000100_company_settings`. Hay siete migraciones en total después de esta ampliación; las seis históricas no se editan.

Las pruebas cubren singleton y concurrencia, lectura, edición, 403/401, normalización, auditoría, cambios empresariales en tickets, varios equipos/IMEIs/accesorios/importes, selección de ambos formatos, pestaña automática, fallback por bloqueo, PDFs con dimensiones verificadas, impresión sin navegación/controles y vista móvil a 375, 390 y 430 px. Capturas y PDFs de prueba se guardan privadamente en `.test-results/phase6a`.

## REPORTE FINAL

PHASE 6A — THERMAL RECEIPTS & COMPANY SETTINGS

STATUS: PASS (software). Fecha: 2026-10-10.

THERMAL RECEIPTS:
- 48mm: PASS, composición vertical independiente.
- 80mm: PASS, encabezado centrado y características agrupadas.
- Format selector: PASS, opciones exactas 48/80, preferencia editable.
- Automatic preview: PASS, nueva pestaña y fallback visible en pestaña actual.
- Print: PASS para invocación del navegador y CSS sin controles; no confirma salida física.
- Download PDF: PASS, ambos anchos medidos, altura adaptable y footer en la misma página para venta habitual de dos equipos.
- Barcode: PASS, CODE128 vectorial, zona libre y ancho mínimo; fallback textual cuando no cabe.

COMPANY SETTINGS:
- Singleton: PASS, servicio concurrente y CHECK/PRIMARY KEY PostgreSQL.
- Business name / Address / Phone / Email / Footer: PASS, editables y persistentes.
- Permissions: PASS, backend 403 sin autorización y 401 sin sesión.
- Audit: PASS, usuario y fecha reales, guardado atómico.

DATABASE:
- Migration: PASS, `20261010000100_company_settings`, históricas intactas.
- Prisma: PASS, validate/generate.
- Persistence: PASS en PostgreSQL de pruebas y migración en la base local principal.
- Los conteos principales antes/después son idénticos: 1 cliente, 2 equipos, 4 IMEIs, 0 ventas y 2 solicitudes. Se conserva la solicitud BLOQUEADA y no se crean ventas ficticias en la base principal.
- Backup privado antes de migrar: `.local/phase6a-before.dump`; SHA256 `b5dba6d3fe8321c219c2f4b900c08070a580fb34bcd063922b9041d56f695d73`.

TESTS:
- Unit: 139 PASS (9 archivos).
- Integration: 257 PASS (8 archivos, PostgreSQL real).
- E2E: 31 casos únicos PASS (8 archivos, Edge). Se ejecutó la suite completa y se repitieron los casos afectados después de corregir concurrencia, aislamiento de permisos, accesibilidad, altura PDF y estilos.
- Total: 427 casos únicos PASS; repeticiones no sumadas.
- Lint: PASS.
- TypeScript: PASS.
- Build: PASS.
- Prisma validate/generate: PASS.
- npm audit: PASS, 0 vulnerabilidades.
- Visual: PDF 48/80 renderizados e inspeccionados; vistas, selector y formulario revisados a 375, 390 y 430 px. No hay recortes ni controles impresos.

HARDWARE:
- Physical 48mm test: NOT VERIFIED.
- Physical 80mm test: NOT VERIFIED.

FILES:
- Modificados: `README.md`, `docs/database-architecture.md`, `package.json`, `package-lock.json`, `prisma/schema.prisma`, `server/app.ts`, `src/app/App.tsx`, `src/pages/Sales.tsx`.
- Nuevos: `docs/phase-6a-thermal-printing.md`, `prisma/migrations/20261010000100_company_settings/migration.sql`, `server/services/company.service.ts`, `shared/company.ts`, `shared/receipt.ts`, `src/pages/CompanySettings.tsx`, `src/features/receipts/Receipt.tsx`, `src/features/receipts/receipt.css`, `src/features/receipts/pdf.ts`, `tests/unit/receipts.test.ts`, `tests/integration/receipts.test.ts`, `tests/e2e/receipts.spec.ts`.

COMMITS: commit local `feat: add thermal receipts and company settings`; hash entregado en el mensaje final. Baseline `c59d7d49b309e17fc7f194ac2940083da2729a66`.

GIT STATUS: entrega con cambios guardados en commit local y árbol limpio. Phase 6A sin push ni deploy; la subida previa autorizada de baseline no forma parte de esta fase.

KNOWN LIMITATIONS:
- Impresoras físicas y escaneo con hardware no disponibles; requieren el procedimiento descrito arriba.
- Navegador/controlador puede ignorar papel personalizado o imponer márgenes. El POS no selecciona impresoras ni confirma trabajos físicos.
- Reimpresiones usan datos empresariales actuales, sin snapshot fiscal.
- PDF utiliza fuentes estándar Courier; cobertura de símbolos ajenos al alfabeto latino no verificada.
- Build informa un aviso de chunk principal mayor de 500 kB. PDF se carga bajo demanda; el aviso no impide compilar ni ejecutar.
