# PHASE 6B — EXACT A4 DECLARATION

Implementación sobre `a00b74a`, 10/10/2026. Referencia obligatoria inspeccionada:
`20261010144319_register_device.pdf`, proporcionada localmente por el usuario.
El original contiene información personal y permanece fuera de Git. No es
un recurso de la aplicación ni se inserta como fondo del documento generado.

## Documento y tipografía

PDF vectorial, blanco y negro, una página, A4 vertical de **210 × 297 mm**:
595.27559055 × 841.88976378 pt. La referencia usa 595 × 842 pt;
se mantienen sus coordenadas absolutas y se corrige únicamente el tamaño físico
de la página a ISO A4. No contiene encabezado empresarial, logo, RECO visible,
QR, código de barras ni pie añadido.

La referencia utiliza ClanPro-Bold 13 pt y ClanPro-Regular 10/9 pt.
No hay archivos ClanPro con licencia de distribución disponibles en el entorno.
Se incorpora **Lato Bold / Lato Light**, licencia SIL OFL 1.1, con sus archivos
originales, atribución y licencia en `server/documents/fonts/`.
Es una sustitución tipográfica comprobada por renderizado, **no identidad de
glifos con ClanPro**. Las palabras fijas conservan los anclajes, línea base,
altura y ancho medidos; la escala horizontal reproduce el espaciado original.

Los campos variables usan el mismo tamaño vertical y su espacio original.
Su escala horizontal se limita a 60% como mínimo; la marca, cuyo espacio de
referencia mide solo 28.11 pt, admite 50% para marcas como SAMSUNG. No se
trunca texto, no se oculta información, no se añade otra página ni se desplazan
párrafos o firmas. Un valor que excede ese límite impide emitir el PDF con un
mensaje de revisión de plantilla. No se debe abreviar arbitrariamente una
identidad real para superar esta validación.

## Coordenadas y texto

Origen superior izquierdo, unidades pt. Las 165 palabras fijas y 13 campos
variables medidos están en `shared/declaration-layout.json`. Ese archivo
contiene únicamente texto fijo y geometría; ningún dato personal del ejemplo.

| Elemento | X | Línea base Y | Tamaño |
|---|---:|---:|---:|
| Título, primera línea | 66.87 | 35.84 | 13, negrita |
| Título, segunda línea | 216.60 | 52.32 | 13, negrita |
| Introducción, cuatro líneas | 15 | 97.50 / 110.18 / 122.86 / 135.55 | 10 |
| Primera declaración | 15 | 170.18 / 182.86 | 10 |
| Segunda declaración | 15 | 232.66 / 244.06 | 9 |
| Tercera declaración | 15 | 266.87 / 278.28 / 289.68 | 9 |
| Fecha | 18 | 323.67 | 9 |
| Líneas de firma | 15–275 y 295–555 | 421.50 | Trazo 1 pt |
| Títulos de firma | Según anclaje del original | 433.67 | 9 |
| Etiquetas de nombre | 15 / 295 | 448.67 | 9 |
| Nombres de firmantes | 15 / 295 | 464.52 | 10 |
| Etiquetas de documento | 15 / 295 | 479.67 | 9 |
| Documentos de firmantes | 15 / 295 | 495.52 | 10 |

El título permanece literalmente en dos líneas:

```
DECLARACIÓN JURADA DE INGRESO DE EQUIPO ADQUIRIDO EN
EL EXTRANJERO
```

Texto de introducción y primera declaración, con sustituciones entre llaves:

```
Por el presente documento, yo {NOMBRE} identificado(a) con documento de identidad (DNI,
Carné de Extranjería, Pasaporte, otro especificar) {TIPO}, N° {DOCUMENTO} con domicilio en {DIRECCIÓN},
con número telefónico celular {CELULAR} (Línea a ser vinculada al equipo terminal móvil adquirido en el
extranjero), declaro:

- Que el equipo terminal móvil con marca: {MARCA} modelo: {MODELO} e IMEI: {IMEI} , ha
ingresado legalmente al país para mi uso personal.
```

Segunda y tercera declaraciones, conservadas sin cambios:

```
- Que dicho equipo cuenta con IMEI válido, habiéndose realizado satisfactoriamente la
validación por el Concesionario Móvil que me brinda el servicio público móvil.

- Que tengo pleno conocimiento que solo puedo ingresar y registrar hasta cinco (5) equipos adquiridos en el extranjero a mi
nombre por año. En ese sentido, el sexto equipo ingresado
al país y registrado a mi nombre ante cualquier Concesionario Móvil, será bloqueado.
```

Fecha: `Fecha (dd/mm/aaaa): {DD/MM/AAAA}`. Firmas: `Firma y huella de
Solicitante` y `Firma de Agente`; debajo de cada una, `Nombre y apellidos:`
y `Número de Documento de Identidad:`. Se conserva el espacio blanco inferior.

## Datos y validaciones

`GET /api/registration-requests/:id/declaration-data` consulta PostgreSQL:

| Campo PDF | Fuente |
|---|---|
| Solicitante y DNI | Client propietario actual de Equipment |
| Dirección y celular vinculados | RegistrationRequest, snapshot de atención |
| Marca y modelo | Equipment relacionado |
| IMEI único | Imei referenciado por esa RegistrationRequest |
| Fecha de operación | RegistrationRequest.occurredAt, zona America/Lima |
| Nombre y DNI del agente | User de la sesión autenticada actual |
| Nombre del archivo | RegistrationRequest.code + `.pdf` |

El backend verifica solicitud, IMEI, equipo y propietario relacionados.
PostgreSQL también protege estas relaciones con FK y triggers existentes.
Se requieren `registration.read` **y** `registration.update`, sesión vigente y
origen permitido. No acepta datos del PDF ni un agente enviados por el cliente.
Actualmente Client admite DNI; CE y pasaporte no se inventan ni se habilitan
silenciosamente por el texto genérico de la referencia.

La migración nueva `20261010000200_agent_identity` agrega `User.identityDocument`
nullable, VARCHAR(8), CHECK de ocho dígitos. Los usuarios anteriores conservan
NULL; no se migra el DNI del cliente al agente. En **Usuarios → Administrar**,
un administrador con `users.update` completa el nombre real y el DNI del agente.
La jerarquía existente protege SUPERADMIN. Sin identidad válida, el backend
responde 422 e impide emitir la declaración final.

`POST /api/registration-requests/:id/declaration` exige tres confirmaciones
explícitas: operador autorizado, veracidad confirmada por el solicitante y
revisión de aplicabilidad normativa. No están preseleccionadas. Un fingerprint
SHA-256 enlaza los datos revisados con los datos leídos nuevamente en una
transacción SERIALIZABLE. Si cambian, responde 409 y exige revisar otra vez.

La generación solo añade `DECLARATION_GENERATED` a AuditLog con actor real,
solicitud, IMEI relacionado, versión, fingerprint y confirmaciones. No almacena
una copia de nombres, DNI o domicilio en la auditoría. No crea clientes, equipos,
IMEIs, ventas, operaciones o solicitudes adicionales, ni modifica sus estados.
Cada reimpresión requiere confirmar nuevamente y utiliza datos actuales.

## Revisión normativa, 10/10/2026

La [información oficial de OSIPTEL](https://bloqueodecelulares.osiptel.gob.pe/)
indica que el asesor del operador verifica el IMEI antes de la declaración,
establece el máximo anual de cinco equipos del extranjero para uso personal
y contempla bloqueo por exceder la cantidad permitida. El
[D.S. 007-2019-IN](https://busquedas.elperuano.pe/dispositivo/NL/1757062-7)
publica el reglamento de Renteseg, con el límite correspondiente.
Estas fuentes respaldan el contexto del texto original. El POS no tiene acceso
a la validación del operador ni al total nacional anual del solicitante; no
certifica que el sexto equipo concreto será bloqueado ni ejecuta un bloqueo.
El operador debe revisar la vigencia y aplicabilidad al caso antes de confirmar.
La plantilla conserva íntegra la afirmación del original.

## Uso y salida

En `/registros/:id`, **GENERAR DECLARACIÓN JURADA** obtiene los datos y abre
la revisión con identidad de solicitante/agente, domicilio, equipo, celular,
IMEI y fecha. Tras las tres confirmaciones, genera automáticamente el PDF y
abre su previsualización con PDF.js, renderizando el mismo PDF en canvas. Ofrece **DESCARGAR PDF A4**, **IMPRIMIR A4** y un
enlace alternativo al visor del navegador. No hay selector de formato.

Un equipo con dos IMEIs produce dos PDF separados, desde sus respectivas
solicitudes, con celulares independientes y sin el IMEI de la otra solicitud.
RECO solo aparece en el nombre del archivo. Los Blob URL se liberan al cerrar
o desmontar la previsualización. El servidor usa no-store.

La impresión entrega al visor un PDF cuyo MediaBox ya es A4; el usuario debe
seleccionar papel A4 y escala 100%. El navegador controla el diálogo, la impresora
y sus márgenes físicos. Se verifica la llamada de impresión y el documento A4;
la impresión física y la firma/huella manuscritas no son automatizadas.
Los módulos de tickets térmicos de ventas no se modifican.

## Comparación visual y privacidad

`tests/fixtures/declaration-fixed-reference.png` es un raster del original a
1600 px de alto, con **únicamente** las 13 zonas variables eliminadas.
No es un fondo de generación; solo una referencia de prueba sin texto PDF
recuperable. Se verificó visualmente que no conserva los datos personales.
El original y su extracción privada permanecen en almacenamiento local ignorado.

`scripts/verify-declaration-visual.py` renderiza el PDF controlado, enmascara
las mismas zonas y compara tinta en ambas direcciones. Exige 98% de cobertura
con tolerancia de 2 px, aproximadamente 1.05 pt, para la sustitución tipográfica.
Se comparan título, tres declaraciones, guiones, fecha, firmas y espacio blanco;
se verifican aparte los 165 textos, coordenadas, tamaños 13/10/9 pt y las dos
líneas de 260 pt. Una comparación con `--reference` renderiza otra vez el
original privado y comprueba que coincide con la referencia limpia distribuida.

Resultado medido: **99.8534% / 99.9290%** de cobertura de tinta con tolerancia.
Sin tolerancia: **57.9592% / 68.9973%**. Estos números no son un porcentaje de
identidad tipográfica; la diferencia de glifos y grosor de ClanPro frente a
Lato se registra expresamente. La revisión humana de los dos renderizados
confirmó la distribución, saltos, firmas y espacio inferior conservados.

`scripts/inspect-declaration-pdf.py` usa pypdf y pdfplumber independientes de
jsPDF. Comprueba PDF válido, una página A4, texto negro, ausencia de imágenes
y adjuntos, textos dinámicos, literalidad e IMEI único. Al suministrar
`DECLARATION_REFERENCE_PDF`, extrae privadamente los datos originales de las
zonas de solicitante/agente/documentos/contactos y comprueba que no aparecen
en el texto del PDF generado. No imprime esos datos del original.

## Reproducción de pruebas

Node 22.13 o superior y dependencias del proyecto: `npm ci`. Pruebas PDF: Python con `pypdf`,
`pdfplumber` y `Pillow`; renderizador Poppler `pdftoppm` en PATH. Estas
herramientas son necesarias para verificar, no para ejecutar `npm run dev`.
En Windows puede especificarse el ejecutable Python mediante `PDF_TEST_PYTHON`.
Configurar `TEST_DATABASE_URL` únicamente para `communicate_pos_test` local.

```powershell
$env:PDF_TEST_PYTHON = 'ruta/al/python.exe'
$env:DECLARATION_REFERENCE_PDF = 'ruta/al/20261010144319_register_device.pdf'
npm run db:test:prepare
npm test
npm run test:integration
npm run test:e2e
npm run test:pdf
npm run db:validate
npm run db:generate
npm run lint
npm run typecheck
npm run build
npm audit
```

La prueba visual debe ejecutarse después del E2E, que administra su directorio
de resultados. Evidencias locales en `.test-results/phase6b`, fuera de Git.

## Cobertura y reporte de verificación

| Requisitos | Evidencia |
|---|---|
| 1–6: A4, página, título, párrafos, declaraciones, saltos | Unit PDF, parsing independiente y prueba visual de 165 anclajes |
| 7–14: fecha, solicitante/agente, documentos, marca/modelo, IMEI | Unit PDF y servicio PostgreSQL; fecha cruzando medianoche UTC |
| 15–18: PDF por solicitud, doble IMEI, exclusión y no duplicados | Integration y E2E con dos solicitudes y reimpresión |
| 19: ausencia de datos personales del original | Extracción privada contra PDF generado y referencia raster limpia |
| 20: fuentes y medidas | Fuentes OFL, tamaños/anchos/anclajes y raster contra original |
| 21–22: permisos y confirmaciones | Integration: 401/403, origen, tres booleanos, actor forjado, 409 |
| 23–26: PDF, preview, descarga e impresión | pypdf/pdfplumber y Edge E2E; impresión física no verificada |
| 27: relaciones | FK/triggers, carga de relaciones y prueba de rechazo de propietario/IMEI inválidos |
| 28–30: ventas, registros, autenticación | Suites completas existentes más tests nuevos |

Quality gates completados: **145 unitarias, 262 de integración y 33 E2E**
(440 en total), todos PASS. Prisma validate/generate, TypeScript, lint, build,
parsing PDF, comparación visual contra original y npm audit PASS; cero
vulnerabilidades. Build conserva avisos de anotaciones Zod y tamaño de bundle,
sin errores. La aplicación local responde en 127.0.0.1:5173 y su API en 3001.

Migración local aplicada tras copia privada de seguridad. Los hashes y cantidades
de registros empresariales anteriores y posteriores coinciden: 1 Client,
2 Equipment, 4 Imei, 2 RegistrationRequest, 0 Sale y 1 User. Ningún estado
histórico fue cambiado. El DNI del usuario existente permanece sin inventar.

Archivos: esquema y migración User; contratos shared; servicio y generador PDF;
fuentes OFL; interfaz Usuarios y acción en detalle de solicitudes; pruebas
unitarias/integración/E2E; scripts PDF y referencia raster; README y arquitectura.

Git: trabajo local sobre `a00b74a`. Sin push ni despliegue. Solo se crea el
commit local al superar todos los quality gates.

Limitaciones: alternativa Lato, campos muy extensos bloqueados por la geometría
original, modelo actualmente limitado a DNI, validación y consentimiento externos
declarados por el operador, sin impresión física verificada.


## Reporte final

**PHASE 6B — EXACT A4 DECLARATION**

**STATUS: PASS**, con alternativa tipográfica permitida y límites documentados.

| Área solicitada | Resultado |
|---|---|
| REFERENCE / Original PDF | 20261010144319_register_device.pdf, inspeccionado y renderizado localmente |
| REFERENCE / Visual comparison | PASS contra original, máscaras solo de campos variables, tolerancia 2 px |
| REFERENCE / Text fidelity | PASS, textos fijos literales y 165 anclajes verificados |
| PDF / A4, single page, title | PASS, 210 × 297 mm, una página y título original en dos líneas |
| PDF / Typography | Lato Bold/Light OFL, 13/10/9 pt; diferencia respecto a ClanPro declarada |
| PDF / Coordinates, paragraphs, signatures | PASS, coordenadas originales, saltos y dos líneas de 260 pt |
| PDF / Date | PASS, fecha de operación en America/Lima |
| DYNAMIC DATA / Client, Equipment, IMEI, Registration, Agent | PASS, relaciones PostgreSQL y usuario real de sesión |
| OUTPUT / One PDF per IMEI | PASS, dos solicitudes producen PDF separados |
| OUTPUT / Preview | PASS, canvas PDF.js con contenido renderizado comprobado en Edge |
| OUTPUT / Download | PASS, PDF válido y nombre RECO correspondiente |
| OUTPUT / Print | PASS de llamada de impresión y tamaño A4; impresión física NOT VERIFIED |
| SECURITY / Identity validation | PASS, DNI administrativo requerido, no se inventó identidad local |
| SECURITY / Permissions | PASS, sesión, ambos permisos y protección administrativa |
| SECURITY / Personal data | PASS, original no distribuido, extracción privada y escaneo de cambios |
| SECURITY / Declaration confirmation | PASS, tres confirmaciones explícitas y fingerprint frente a cambios |
| QUALITY / Unit | PASS, 145 |
| QUALITY / Integration | PASS, 262 |
| QUALITY / E2E | PASS, 33 |
| QUALITY / Visual comparison | PASS, 99.8534% y 99.9290% con tolerancia; sin identidad de glifos |
| QUALITY / Lint, Build, TypeScript | PASS |
| QUALITY / Prisma validate, generate | PASS |
| QUALITY / npm audit | PASS, cero vulnerabilidades |
| DOCUMENTATION | Este documento, README, arquitectura y licencia de fuentes |
| MIGRATIONS | 20261010000200_agent_identity, aplicada localmente sin alterar las anteriores |
| GIT STATUS | Commit local con verificaciones completas; sin push ni despliegue |
| COMMIT | feat: implement exact a4 imei declaration template; hash reportado al crear el commit |
| KNOWN LIMITATIONS | Fuente alternativa, extensiones bloqueadas, DNI, confirmaciones externas e impresión física |

FILES:

- `prisma/schema.prisma` y `prisma/migrations/20261010000200_agent_identity/migration.sql`.
- `shared/auth.ts`, `shared/declaration.ts`, `shared/declaration-layout.json`.
- `server/app.ts`, `server/services/auth.service.ts`, `server/services/declaration.service.ts`.
- `server/documents/declaration.pdf.ts` y `server/documents/fonts/` (Lato, licencia y origen).
- `src/pages/Users.tsx`, `src/pages/RegistrationRequests.tsx`.
- `src/features/declarations/Declaration.tsx`, `PdfPreview.tsx`, `declaration.css`.
- `tests/unit/declaration.test.ts`, `tests/integration/declaration.test.ts`, `tests/e2e/declaration.spec.ts`.
- `tests/helpers/declaration.ts`, `tests/helpers/declaration-pdf.ts`, `tests/fixtures/declaration-fixed-reference.png`.
- `scripts/create-declaration-test-pdf.ts`, `scripts/inspect-declaration-pdf.py`, `scripts/verify-declaration-visual.py`, `scripts/verify-declaration.mjs`.
- `package.json`, `package-lock.json`, `scripts/local.mjs` (requisito Node 22.13 de PDF.js).
- `README.md`, `docs/database-architecture.md`, `docs/phase-6b-declaration-template.md`.
