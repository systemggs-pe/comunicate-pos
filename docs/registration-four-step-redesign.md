# Registros en cuatro pasos y expediente de evidencias A4

## Alcance y referencia

Inicio: `2d85514`, rama `master`. La maqueta interactiva de ChatGPT no estuvo disponible; se implementó la especificación completa suministrada. No se afirma equivalencia visual exacta con una referencia no inspeccionada. No hay migraciones, dependencias nuevas, push ni deploy.

## Flujo operativo

1. **Cliente:** DNI local primero y CODART como proveedor de nombre completo; edición manual con protección frente a respuestas tardías. Contacto, referencia, correo, dirección y selector de los 25 departamentos/regiones, incluido Callao. Se conserva cualquier valor histórico fuera del catálogo. Equipos relacionados consultados únicamente por el ID del cliente.
2. **Equipo:** selección explícita de equipo físico existente o nuevo. Datos persistidos recuperados en solo lectura; Gemini automático para etiqueta de caja y captura/selección de imagen. Correcciones manuales conservadas. IMEI 1, IMEI 2 o ambos, sin borrar el identificador no registrado. No se permite avanzar mientras se consulta la identidad.
3. **Registro:** BITEL predeterminado; TIENDA/EXTERNO para nuevos equipos, procedencia existente protegida. Dos estados iniciales: REGISTRATION crea PENDING y BLOCKED crea BLOCKED. Precio Decimal por solicitud; dos solicitudes tienen precios independientes. Teléfonos por IMEI distintos. Caja sí/no conserva fotos previas.
4. **Evidencias:** expediente del cliente con autorización explícita para consultar fotos, selección de documentos vigentes, cinco categorías de carga privada y revisión final editable en el mismo paso. Fotos comunes compartidas explícitamente, IMEI lógico independiente. Guardado transaccional con clave de idempotencia y bloqueo de doble envío.

La documentación anticipada del cliente se conserva en un desplegable del paso 1 para mantener el acceso al guardado explícito del cliente y consulta autorizada existentes. La misma capacidad está disponible en el paso 4, colapsada para priorizar evidencias y velocidad. Ninguna consulta CODART de fotos se ejecuta automáticamente.

### Referencia y nombre

La referencia efectiva es `referencia escrita || contacto`. El input permanece vacío al utilizar el fallback; un cambio del contacto actualiza el resumen y el valor enviado. Se envía la referencia efectiva a cada solicitud y no se calcula con el teléfono particular del segundo IMEI.

Cambiar un teléfono particular de un IMEI sigue siendo una decisión independiente del contacto general. Una edición posterior del contacto no sobrescribe ese teléfono ya preparado.

El nombre completo local puede corregirse con `clients.update`. El formulario avisa que se guardará la corrección. `clientNameCorrection` incluye el ID y nombre esperado; el backend comprueba DNI, propietario y versión dentro de la misma transacción y registra auditoría sin el texto del nombre. Ante conflicto, revierte toda la operación. Los nombres de clientes ajenos y propietarios de equipos no se sustituyen implícitamente.

El correo canónico se mantiene en minúsculas aunque la convención visual del POS lo muestre en mayúsculas.

## Componentes y decisiones visuales

- `RegistrationStepper`: cuatro tarjetas numeradas con iconos Lucide, estados y navegación hacia atrás. Durante validación/guardado se bloquea su navegación.
- `Segmented`: radios nativos para IMEIs, origen, estado y caja; estado bloqueado con icono y tono de advertencia.
- `RegistrationSummary`: resumen independiente y desplegable, derivado del estado actual, sin consultas extra.
- `OperationalRegistrationFlow`: orquestación de las cuatro etapas, integraciones existentes y guardado.
- `EvidencePdfAction`, `EvidencePreview`, `RegistrationSuccess`: emisión por RECO, vista previa paginada, descarga, impresión y reintento documental.
- `EquipmentFields` admite solo lectura sin cambiar su comportamiento previo en ventas o edición.

UI/UX Pro Max global fue leída y se ejecutaron búsquedas reales: `multi step form validation --domain ux` (progreso, respuesta de envío, labels) y `form state validation performance --stack react` (estado local/inicialización). Se revisaron las reglas de accesibilidad, interacción y rendimiento. Las recomendaciones se aplicaron conservando la identidad verde del POS, React y Lucide existentes.

Tokens locales: `--reg-line`, `--reg-muted`, `--reg-soft`, además de `--color-brand`. Separación de 24 px, superficies de 16 px de radio y controles de al menos 44–48 px; inputs de 16 px evitan zoom por foco en iOS. Desktop usa aproximadamente 68/32; por debajo de 1100 px pasa a una columna. Móvil usa progreso compacto, formulario antes del resumen y margen safe-area. No se añadieron animaciones; se respeta reduced-motion. Los campos y radios tienen nombres accesibles, errores asociados y foco al encabezado al cambiar de paso.

## PDF privado, independiente de la declaración

`POST /api/registration-requests/:id/evidence-pdf` exige sesión, Origin válido, `registration.read` y `registration.evidence.read`. Recibe únicamente el ID de la solicitud en la ruta; los datos y fotografías proceden del servidor. No utiliza URLs públicas permanentes. La respuesta lleva `Cache-Control: no-store`.

`createEvidencePdfService` obtiene un snapshot transaccional del RECO y evidencias, verifica estado READY, categoría y propietario de los activos de identidad. Una imagen CODART originalmente `IDENTITY_IMAGE`, posteriormente identificada, puede utilizarse como frontal/posterior autorizado del mismo cliente. Se verifican checksum, tamaño y dimensiones antes de convertir imágenes mediante sharp. Los bloqueos de lectura de solicitud/activos evitan emitir contenido a la vez que se elimina o reemplaza. El cliente S3 creado por la emisión se cierra al terminar.

El documento A4 vertical incluye negocio de CompanySettings (fallback establecido del sistema), código, fecha de atención en Lima, cliente, DNI, equipo, marca, IMEI exclusivo, operador, estado y creador responsable. Una portada más una página por fotografía preservan la proporción completa. Se permiten expedientes sin fotos, conforme a la regla previa de evidencias opcionales. Nombre: `RECO-XXXXXX-EVIDENCIAS.pdf`.

Después de confirmar la operación se generan los dos documentos si corresponde; únicamente el primero abre vista previa automáticamente. Cada RECO permite escoger su documento. El PDF se descarga como Blob privado temporal y su URL se revoca al desmontar. Si falla MinIO o la emisión, el RECO permanece confirmado; REINTENTAR PDF ejecuta solo el endpoint documental. Un GET/POST documental nunca crea otra operación.

Los generadores, servicios, datos de plantilla, texto, firmas y confirmaciones de la declaración jurada no fueron modificados. El detalle conserva su acción independiente y añade el expediente nuevo.

## Verificación y evidencias

- Unit: contratos existentes y nuevas pruebas A4 sin fotos, proporciones vertical/horizontal/cuadrada, límites de página y ausencia del texto de la declaración.
- Integration: PostgreSQL `communicate_pos_test` y bucket MinIO `communicate-evidence-test`, rutas autenticadas, dos PDF independientes, cinco imágenes reales, fallo/reintento de storage, origen, referencia, idempotencia y corrección de nombre transaccional. Se conservan las pruebas previas de recuperación, scope, eliminación y declaración.
- E2E: pruebas previas adaptadas al cuarto paso integrado; cinco nuevas cubren cada etapa, referencia efectiva/manual, cliente CODART simulado, equipo existente solo IMEI 2, doble IMEI con evidencias compartidas/lógicas independientes y fallo documental sin repetir el POST operativo.
- Visual: `.test-results/registration-redesign/step-{1..4}-{375,390,430,768,1280}.png`; veinte capturas de datos sintéticos. Se comprueba scrollWidth en cada tamaño. PDF inspeccionado con pypdf/pdfplumber y seis páginas renderizadas con PDFium en `.test-results/registration-pdf/rendered/`.
- Declaración: pruebas existentes de texto, geometría, firmas, confirmaciones y render del PDF permanecen; diff de sus archivos vacío.
- Integridad: snapshot privado de hashes por fila en `.local/registration-redesign-before.json` y verificación de solo lectura mediante `.local/registration-integrity.ts --verify`. Base: 603 clientes, 641 equipos, 643 IMEIs, 576 ventas, 118 RECO, 117 operaciones. No se restaura ni migra la base comercial. Durante la sesión, el usuario local muestra una actualización coincidente con un inicio de sesión (17/10/2026 14:12 Lima); no se revierte. La verificación comercial utiliza `--verify --commercial` para señalar esa diferencia de User y exigir hashes idénticos en las demás tablas.

Los resultados finales y recuentos únicos se entregan en el reporte de cierre. Las reejecuciones no incrementan el número de pruebas únicas.

### Aislamiento de proveedores

Una prueba antigua de "Gemini no configurado" heredó la configuración local y procesó una imagen sintética uniforme durante la primera batería. No contenía DNI ni personas. Se corrigieron Vitest y ambos servidores E2E para vaciar claves de proveedores y deshabilitar Gemini en los procesos de prueba; los adaptadores simulados se inyectan explícitamente. No se modificó `.env`. Este incidente no se considera validación funcional de Gemini real.

CODART real (nombre/fotos), calidad OCR con fotos reales, cámara física móvil e impresora térmica/A4 física: **NOT VERIFIED en esta entrega**. Las pruebas de proveedores son simuladas; PostgreSQL, MinIO y los PDF sí son reales. La impresión invoca el visor PDF del navegador y depende del dispositivo y configuración del usuario.

## Archivos

Nuevos: `server/documents/evidence.pdf.ts`, `server/services/evidence-pdf.service.ts`, `src/features/evidence/EvidencePdfAction.tsx`, `src/features/registrations/RegistrationUI.tsx`, `src/features/registrations/registration.css`, `scripts/inspect-evidence-pdf.py`, `tests/helpers/evidence-pdf.ts`, `tests/unit/evidence-pdf.test.ts`, `tests/integration/evidence-pdf.test.ts`, `tests/e2e/mvp-registration-redesign.spec.ts` y este documento.

Modificados: `server/app.ts`, `server/services/registration-requests.service.ts`, `shared/workflow.ts`, `shared/evidence.ts`, `src/features/registrations/OperationalRegistrationFlow.tsx`, `src/features/clients/ClientDocumentPicker.tsx`, `src/features/equipment/EquipmentForm.tsx`, `src/features/evidence/EvidenceDrafts.tsx`, `src/hooks/useFormStepFocus.ts`, `src/pages/RegistrationRequests.tsx`, `tests/helpers/mvp-browser.ts`, siete E2E existentes (`dni`, `evidence`, `mvp-codart`, `mvp-form-speed`, `mvp-scanner`, `mvp-vault`, `workflow`), `vitest.config.ts`, `playwright.config.ts` y `playwright.mvp.config.ts`.

## Capturas de referencia de esta implementación

Estas capturas contienen únicamente fixtures sintéticas. Se comparan las cuatro etapas entre escritorio y móvil; no se atribuyen a la maqueta de ChatGPT.

| Etapa | Desktop 1280 | Móvil 390 |
|---|---|---|
| 1. Cliente | [Abrir](../.test-results/registration-redesign/step-1-1280.png) | [Abrir](../.test-results/registration-redesign/step-1-390.png) |
| 2. Equipo | [Abrir](../.test-results/registration-redesign/step-2-1280.png) | [Abrir](../.test-results/registration-redesign/step-2-390.png) |
| 3. Registro | [Abrir](../.test-results/registration-redesign/step-3-1280.png) | [Abrir](../.test-results/registration-redesign/step-3-390.png) |
| 4. Evidencias | [Abrir](../.test-results/registration-redesign/step-4-1280.png) | [Abrir](../.test-results/registration-redesign/step-4-390.png) |

La misma matriz incluye 375, 430 y 768 px en la carpeta indicada. Las imágenes de control del nuevo PDF se encuentran en `.test-results/registration-pdf/rendered/`.

## Resultado de cierre — 17/10/2026

**STATUS: PASS** para el alcance local verificado, con los límites externos y de hardware indicados arriba.

| Control | Resultado |
|---|---|
| Unit | 297/297, 19 archivos |
| Integration | 370/370, 20 archivos, PostgreSQL/MinIO reales aislados |
| E2E | 65/65 pruebas únicas: 44 generales + 21 MVP |
| Total | **732 pruebas únicas**; las reejecuciones no se suman |
| TypeScript | PASS |
| Lint | PASS, cero errores/advertencias ESLint |
| Build | PASS, `prisma generate && tsc --noEmit && vite build` |
| Prisma | validate/generate PASS, 16 migraciones aplicadas, ninguna nueva |
| npm audit | 0 vulnerabilidades |
| Responsive | 375/390/430/768/1280, cuatro pasos y 20 capturas, sin overflow |
| Declaración | archivos sin diff respecto de `2d85514`, pruebas originales aprobadas |
| Base comercial | hashes idénticos al inicio; metadatos de inicio de sesión conservados |

La primera batería general E2E aprobó 39 casos y detectó cinco selectores/sincronizaciones del flujo anterior. Se corrigieron y los cinco aprobaron al reejecutarse. La matriz nueva de cinco casos se volvió a ejecutar después del ajuste visual final; también se revalidó la selección exclusiva del IMEI 2. No se eliminaron pruebas ni se redujeron verificaciones comerciales.

En la primera integración, una prueba antigua de ausencia de configuración heredó Gemini local. Tras corregir el aislamiento, la batería completa de 370 terminó sin fallos. Las llamadas externas quedan clasificadas como se detalla en Limitaciones; esa ejecución no valida OCR real.

La compilación emitió avisos informativos de anotaciones `@__PURE__` del paquete Zod instalado; eliminó esas anotaciones y terminó correctamente. No se cambiaron dependencias para ocultarlos. Los informes locales de unit e integración están en `.test-results/registration-unit.log` y `.test-results/registration-integration.log`.

Commits locales por bloques: backend documental (`3006de0`) e interfaz/automatización/documentación (consultar el HEAD final). Sin push ni deploy. `.impeccable/`, `output/` y `tmp/` se conservan ajenos a esta entrega.
