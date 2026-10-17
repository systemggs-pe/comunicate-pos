# Replicación de DISEÑO.pdf

## Auditoría previa

Inicio real: `816a032`, rama `master`. Referencia encontrada en `C:/Users/ASUS/Downloads/DISEÑO.pdf`. Se renderizaron e inspeccionaron las diez páginas; la 9 está vacía. Las imágenes originales y renders se conservan únicamente en `.test-results/design-reference/` (ignorados por Git), porque contienen información de la referencia que no se usa como fixture.

| Pantalla | Páginas | Inventario observado |
|---|---|---|
| Inicio | 1 | Panel ancho, saludo/fecha/usuario a la izquierda, dos acciones a la derecha, tres métricas en una fila, cuatro accesos de trabajo diario separados por líneas |
| Cliente | 2–3 | Panel blanco central; cabecera y X, stepper sobre fondo gris azulado; documento/número y nombre; celular/referencia; dirección/departamento; correo ancho; equipos vinculados sobre superficie azul gris |
| Equipo | 4–5 | Título con Escanear a la derecha; equipos vinculados; IMEIs, tarjetas de selección, nombre ancho; serie/marca, modelo/color, memoria/RAM |
| Precio | 6 | Operador/estado del equipo, estado de solicitud/tipo, precio, caja Sí/No horizontal, fecha/hora |
| Evidencias | 7–8 | Dos columnas de tarjetas: frontal/reverso, caja/boleta, lógico; rectángulo de preview, icono vacío y dos botones; caja no aplicable deshabilitada; guardar a la derecha |
| Sin contenido | 9 | Página en blanco, excluida de comparación |
| Listado | 10 | Cabecera con icono, contador, buscador y acciones; filtros; tabla de cinco columnas; badges y acciones por fila |

Elementos globales: cabecera compacta CM/módulo/buscador y cápsula inferior de cinco destinos, azul seleccionado. Las barras de Brave y pestañas no pertenecen al producto.

### Muestreo y tipografía

Las capturas son rasterizadas; no se afirma conocer su CSS original ni su fuente. Colores dominantes muestreados: fondo `#f3f6fa`, superficie `#fbfdfe`, agrupaciones `#ecf1f6`, iconos azules claros `#dcedff`. Se utilizará Segoe UI/Inter como alternativa local próxima, con pesos compactos y caja tipográfica equivalente, sin descargar fuentes externas. Los valores medidos son aproximaciones de captura.

### Diferencias respecto al estado inicial

Se debe retirar la composición de sidebar y el resumen lateral del wizard; conservarlos supondría desviarse de la referencia. Se conserva el resumen dentro del paso 4. Se adapta la navegación compartida a barra flotante, preservando los módulos adicionales bajo Más y todos sus permisos. No se sustituyen los flujos de ventas ni de clientes.

Extensiones conservadas: dos IMEIs con teléfonos/precios por solicitud, escaneo Gemini automático, consulta CODART y expediente autorizado, fotos compartidas explícitas y PDF privado por RECO. Declaración jurada inalterable. Caja no aplicable bloquea nuevas capturas y conserva cualquier archivo previamente adjuntado hasta su retirada explícita.

La navegación tendrá compensación inferior y scroll-padding para evitar el defecto de superposición de las páginas 2 y 4–8. UI/UX Pro Max: búsquedas `focus not obscured` y `bottom navigation fixed` en dominio UX, aplicadas sin cambiar la composición aprobada.

## Implementación y mapeo

| Referencia | Implementación | Función conservada |
|---|---|---|
| Cabecera + cápsula, páginas 2–8 y 10 | `src/app/App.tsx`, `src/app/BottomNavigation.tsx`, `src/design.css` | Búsqueda IMEI real; módulos autorizados bajo Más; cierre de sesión; guardia de cambios |
| Inicio, página 1 | `src/pages/Home.tsx`, GET `/api/home-summary` | Usuario autenticado, hora Perú desde servidor, cantidades PostgreSQL según permisos |
| Cliente, páginas 2–3 | `OperationalRegistrationFlow.tsx`, paso 1 | DNI local primero, CODART, nombre corregible, contacto de atención y referencia independiente |
| Equipo, páginas 4–5 | `EquipmentFields registration`, `BoxScanner`, paso 2 | Selección de equipo; Gemini automático; descarte de respuestas tardías; dos IMEIs / mismo equipo |
| Condiciones, página 6 | Paso 3, `Segmented`, GET `/api/server-time` | BITEL inicial; estados existentes; importe decimal; origen; teléfono/precio por RECO; fecha operativa editable |
| Fotos, páginas 7–8 | Paso 4, `EvidenceDrafts`, `ClientDocumentPicker` | Almacenamiento privado, ampliación, sustitución, fotos comunes compartidas explícitamente y lógicas separadas |
| Finalización, página 8 | `RegistrationSuccess`, `EvidencePdfAction` existentes | Operación idempotente, uno o dos RECO, PDF de evidencias por RECO y reintento sin volver a guardar |
| Listado, página 10 | `src/pages/RegistrationRequests.tsx` + GET `/api/registration-requests/summary` | Buscar, paginar, filtrar, consultar, editar, documentos, compartir enlace privado, eliminar con confirmación |
| Foto DNI, acceso de página 1 | `src/pages/PhotoDni.tsx` | Reutiliza el flujo documental y autorización ya existentes; no inventa un proveedor nuevo |

No cambian modelos Prisma, migraciones, reglas de negocio ni los archivos de declaración jurada A4. Los endpoints nuevos son lecturas autenticadas sin caché; los contadores no entregan cantidades de módulos sin permiso. El buscador de registros ahora incluye `fullName`, además de los campos anteriores, y comparte predicados con su contador.

## Diferencias justificadas

- Zona de trabajo desplazable separada físicamente de la cápsula inferior, con área segura reservada. La compensación de padding por sí sola no evitaba que el navegador llevara un botón detrás de la barra; se corrigió y se comprueban sus rectángulos en seis anchos.
- Navegación adicional bajo Más, con diálogo accesible, para conservar todos los módulos y permisos. Salida de sesión discreta en cabecera.
- Búsqueda global rotulada por IMEI: mantiene la capacidad real existente, sin fingir una búsqueda de todo el sistema.
- El selector Estado de solicitud es derivado y de solo lectura en creación. No bloqueado crea PENDING; bloqueado crea BLOCKED. La transición posterior conserva su confirmación real.
- Dos IMEIs añaden selector Sí/No y teléfonos/precios independientes; conservan una sola entidad física y dos solicitudes.
- Marca sigue siendo un campo de texto validado: no se inventa un catálogo cerrado que excluya equipos anteriores. Modelo sigue sujeto a la validación existente.
- Documentación privada autorizada y resumen compacto en el paso 4 agregan contenido a la referencia; no hay resumen lateral ni quinto paso. Los archivos ya subidos no se borran al declarar que no hay caja.
- Aviso de almacenamiento privado sustituye la referencia antigua de Firebase. Cámara del sistema, toma física e impresión real necesitan dispositivos para su comprobación final.
- En móviles, campos y fotografías se apilan; el listado conserva sus cinco campos en filas adaptadas. Fuente aproximada local Inter/Segoe UI; no se dispone de tipografía/CSS originales del PDF.

## Comparación visual real

Se abrieron las capturas originales y las capturas de Playwright en el visor, comparando composición, proporciones, alineación, color, jerarquía y acciones. Es una evaluación visual manual: **no se afirma igualdad píxel a píxel ni una puntuación inventada**. La referencia tiene barras de navegador y otra resolución, además de datos distintos; la implementación usa exclusivamente fixtures sintéticos en una base de prueba aislada.

| Comparación | Referencia | Capturas actuales ignoradas por Git | Comprobación / corrección |
|---|---|---|---|
| Inicio | p.1 | `.test-results/design-implementation/home-{ancho}.png` y `home-bottom-{ancho}.png` | Panel, saludo real, tres métricas, cuatro filas de acceso; azul y divisores |
| Cliente | p.2–3 | `.test-results/registration-redesign/step-1-{ancho}.png`, `step-1-bottom-{ancho}.png` | Documento/nombre, contacto/referencia, dirección/departamento, correo ancho y vínculo; corregida proporción 3:1 de dirección |
| Equipo | p.4–5 | `step-2-{ancho}.png`, `step-2-bottom-{ancho}.png` en la misma carpeta | Escáner a la derecha, panel relacionado, radios, técnicos en el orden del PDF; añadida selección dual requerida |
| Precio | p.6 | `step-3-{ancho}.png`, `step-3-bottom-{ancho}.png` | Dos columnas, caja horizontal, fecha accesible, teléfono adicional por IMEI; estados reales |
| Fotografías | p.7–8 | `step-4-{ancho}.png`, `step-4-bottom-{ancho}.png` | Cinco categorías y orden, dos columnas / una móvil, preview e icono, dos botones; finalización a la derecha |
| Listado | p.10 | `.test-results/design-implementation/list-{ancho}.png` y `list-bottom-{ancho}.png` | Cinco columnas, filtro segmentado, estados e iconos enlazados a operaciones reales |
| Cápsula y móvil | p.2–8,10 | Todas las anteriores | Área de trabajo termina antes del rectángulo de navegación; sin controles detrás; estilos de búsqueda móvil corregidos |

Anchos de las series: 375, 390, 430, 768, 1280 y 1440 px, altura 900 px. Las capturas superiores e inferiores permiten revisar formularios extensos. Se corrigieron durante la comparación el texto del stepper en mayúsculas heredadas, la orientación de los botones fotográficos, el tamaño del buscador móvil y el posicionamiento del área activa de los segmentos Sí/No.

## Verificación funcional

Las suites existentes se adaptan únicamente a rótulos, navegación Más y resumen plegable del diseño aprobado. No se eliminan escenarios ni aserciones comerciales para hacer pasar el cambio. Se amplía la cobertura con contadores reales, filtros/paginación, permisos de lecturas nuevas, navegación, separación geométrica de la barra, caja no aplicable que conserva foto existente y salida X con cambios sin guardar.

Pruebas de CODART/Gemini con proveedores **simulados explícitos y aislados**. Las variables de credenciales reales permanecen vacías en los procesos de pruebas; no se modifica `.env`. Pruebas de PostgreSQL, MinIO y PDF sí utilizan implementaciones reales locales. Los fixtures de fotos son imágenes uniformes sintéticas; no usan datos de las capturas del PDF.

Resultados finales cerrados a continuación. No hay push ni deploy.

Ajuste de accesibilidad respecto al gris de captura: texto secundario `#637086` sobre `#fbfdfe` (4,91:1), descripción de evidencia `#65758b` sobre blanco (4,70:1), texto vacío `#5d6c80` sobre `#ecf1f6` (4,71:1), navegación `#657184` sobre `#f4f7fb` (4,60:1) y azul principal `#096acb` sobre `#fbfdfe` (5,23:1). Cálculo sRGB de estos pares, sin afirmar certificación global de accesibilidad. Los estados se acompañan de texto y el foco es visible.

Compatibilidad de nombres: se centraliza exclusivamente la presentación mediante `displayClientName`. Las vistas heredadas de clientes, equipos, solicitudes y ventas, los selectores y la búsqueda IMEI muestran `fullName` cuando existe y conservan nombres/apellidos para la base anterior. No se migra ni se reescribe identidad. El escenario de cliente nuevo con CODART simulado verifica corrección manual, guardado, detalle RECO, cliente, búsqueda IMEI, equipo, selección de comprador, revisión/guardado de venta y sus listados con ese mismo nombre.

## Inventario de esta entrega

45 archivos versionados, agrupados en implementación y validación/documentación.

- `docs/design-replication.md`
- `server/app.ts`
- `server/services/registration-requests.service.ts`
- `src/app/App.tsx`
- `src/app/BottomNavigation.tsx`
- `src/components/PermanentDelete.tsx`
- `src/design.css`
- `src/features/clients/ClientPicker.tsx`
- `src/features/clients/DniClientFields.tsx`
- `src/features/clients/displayName.ts`
- `src/features/equipment/BoxScanner.tsx`
- `src/features/equipment/EquipmentForm.tsx`
- `src/features/evidence/EvidenceDrafts.tsx`
- `src/features/registrations/GlobalImeiSearch.tsx`
- `src/features/registrations/OperationalRegistrationFlow.tsx`
- `src/features/registrations/RegistrationFlow.tsx`
- `src/features/registrations/RegistrationUI.tsx`
- `src/features/registrations/registration.css`
- `src/features/sales/RelatedSales.tsx`
- `src/features/sales/common.tsx`
- `src/pages/Clients.tsx`
- `src/pages/Equipment.tsx`
- `src/pages/Home.tsx`
- `src/pages/PhotoDni.tsx`
- `src/pages/RegistrationRequests.tsx`
- `src/pages/Sales.tsx`
- `tests/e2e/auth.spec.ts`
- `tests/e2e/declaration.spec.ts`
- `tests/e2e/dni.spec.ts`
- `tests/e2e/dual-imei.spec.ts`
- `tests/e2e/evidence.spec.ts`
- `tests/e2e/mvp-design-reference.spec.ts`
- `tests/e2e/mvp-form-speed.spec.ts`
- `tests/e2e/mvp-registration-redesign.spec.ts`
- `tests/e2e/mvp-scanner.spec.ts`
- `tests/e2e/mvp-vault.spec.ts`
- `tests/e2e/receipts.spec.ts`
- `tests/e2e/refinement.spec.ts`
- `tests/e2e/registration.spec.ts`
- `tests/e2e/reports.spec.ts`
- `tests/e2e/sales.spec.ts`
- `tests/e2e/workflow.spec.ts`
- `tests/helpers/mvp-browser.ts`
- `tests/helpers/navigation.ts`
- `tests/integration/workflow.test.ts`

## Resultados finales — 17/10/2026

**PASS de implementación y verificación local.**

| Verificación | Resultado |
|---|---|
| Unitarias | 297/297, 19 archivos |
| Integración | 373/373, 20 archivos; PostgreSQL y MinIO reales locales |
| E2E generales | 44/44 escenarios únicos, verificados por grupos y respetando dependencias de fixtures seriales |
| E2E MVP/diseño | 25/25; recorrido de nombre completo ampliado y repetido tras la corrección |
| Total | 739 escenarios únicos; las repeticiones selectivas no se suman |
| Responsive | 375, 390, 430, 768, 1280, 1440 px; sin overflow horizontal del documento/área de trabajo |
| Geometría de navegación | El área de trabajo termina antes de la cápsula; campos y acciones permanecen alcanzables mediante scroll |
| Evidencia visual | 72 capturas sintéticas actuales: 48 wizard + 24 inicio/listado; comparación manual con originales |
| TypeScript / ESLint | PASS / PASS, cero errores y cero advertencias ESLint |
| Frontend / backend | PASS / PASS; Prisma Client generado correctamente |
| Prisma | Validate PASS; generate PASS; 16 migraciones existentes aplicadas, esquema actualizado; cero migraciones nuevas |
| npm audit | Cero vulnerabilidades reportadas, árbol completo y producción |
| Integridad | Hashes de filas, cantidades, permisos y configuración idénticos al snapshot anterior a la tarea |
| Servicio local al cierre | Web 5173, API 3001 y MinIO: HTTP 200 |

Integridad preservada: 603 clientes, 641 equipos, 643 IMEIs, 576 ventas, 118 solicitudes y 117 operaciones; también historiales, usuarios, roles, permisos y configuración. El reinicio breve del proceso API para liberar el motor Prisma durante la compilación terminó correctamente y se verificó el servicio nuevamente.

Medición de bundle: JavaScript inicial 341.842 bytes, 104.743 bytes gzip; rutas y módulos separados. Es tamaño de archivos, no una medición de velocidad de red o latencia de uso. Registro en `.test-results/phase9/bundle-design-replication.json`.

La compilación frontend emitió dos avisos no bloqueantes de anotaciones PURE en Zod; Rollup retira esos comentarios y produce el build. No hay errores funcionales locales pendientes identificados por estas pruebas.

### Límites de la verificación

- CODART real: **NOT VERIFIED**. Gemini real: **NOT VERIFIED**. Sus escenarios automatizados usan proveedores simulados explícitos, sin credenciales reales.
- Cámara física de celular, impresora térmica e impresión A4 física: pendientes. Se verificaron selección de imágenes, almacenamiento privado, generación/descarga/render de PDFs y llamadas de impresión en el navegador de prueba.
- La fuente exacta del PDF no es verificable; se usa alternativa local. La fidelidad se evaluó visualmente y con geometría responsive, no por igualdad píxel a píxel.
- Credenciales, `.env`, declaración jurada aprobada, esquema de datos y migraciones no se modificaron. Carpetas preexistentes `.impeccable/`, `output/` y `tmp/` se dejaron intactas.
- Dos commits locales organizados para implementación y pruebas/documentación. **Push: NO. Deploy: NO.**

Estado Git: rama `master`, baseline real `816a032`, implementación en `3f7caaa`; este documento y las pruebas se incluyen en el commit local de cierre. El inventario anterior comprende ambos commits.

## Corrección posterior — desbloqueo en listado y cámara predeterminada

Sobre el baseline `5dbe88a`:

- Las filas BLOCKED muestran un botón rojo **Desbloquear**, con permiso `registration.update`, y una sola insignia de bloqueo. Abre un diálogo centrado con RECO e IMEI, motivo obligatorio, confirmación explícita y cancelación. Reutiliza la transición existente UNBLOCK, conserva auditoría e historial y marca únicamente ese IMEI como REGISTERED. No realiza trámites externos ante el operador.
- El escáner compartido por Registros y Ventas presenta **Escanear con cámara** como acción principal, primera y con `capture="environment"`; **Galería** es una alternativa separada sin captura forzada. Ambos inician el análisis al recibir la foto y conservan las correcciones manuales, cancelación de respuestas tardías y deduplicación existentes. En escritorio se conserva la selección nativa de archivos. La elección de cámara física depende del soporte del navegador móvil.
- Adaptación a 375, 390, 430, 768, 1280 y 1440 px; los mensajes de análisis reservan su espacio sobre el recuadro de equipos vinculados.
- Validación del alcance: 11 E2E únicos superados (9 de diseño/escáner y 2 de regresión operativa), sin sumar repeticiones; TypeScript, ESLint y build frontend correctos. Capturas sintéticas en `.test-results/camera-unblock/`; incluye diálogo, controles y estado de análisis.
- Prueba de permisos con usuario lector real en la base de pruebas: botón oculto, API 403 y estado BLOCKED conservado. La política existente de SUPERADMIN no se modifica.
- Integridad de la base comercial, historiales, usuarios, permisos y configuración verificada contra snapshot propio de esta corrección. Sin migraciones, cambios de credenciales, push ni deploy.
- Cámara de un teléfono físico y Gemini real: pendientes de verificación; la automatización usa imágenes sintéticas y proveedor explícitamente simulado.
