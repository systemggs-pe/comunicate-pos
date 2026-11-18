# COMUNIC@TE POS 2.0 — IMEI LUHN IMPLEMENTATION

**STATUS: IMPLEMENTADO**

Estado de implementación del código; no equivale a una validación mediante pruebas. La verificación funcional y de regresión queda para la fase posterior solicitada.

## ALGORITMO

- Función global: `isValidImeiLuhn(imei: string): boolean`.
- Ubicación: `shared/imei.ts`, junto a `imeiValidationError` y los mensajes comunes.
- Exige exactamente 15 caracteres ASCII del 0 al 9. Rechaza números JSON, espacios, letras, signos y decimales.
- Recorre de derecha a izquierda, conserva el control, duplica desde el penúltimo dígito, resta nueve a los resultados mayores de nueve y comprueba suma módulo diez.
- Conserva ceros iniciales. El identificador permanece como string; solamente se calculan los valores individuales de los caracteres.
- No completa ni repara el dígito de control. Luhn no acredita registro ante OSIPTEL, legitimidad del fabricante, ausencia de bloqueo, robo o clonación.

## MÓDULOS

| Módulo | Implementación |
|---|---|
| Ventas | `saleFlowSchema` usa la regla compartida para todos los IMEI de todos los equipos, antes de resolver o guardar. Un campo inválido bloquea la venta completa y el botón final. |
| Registros | El asistente operativo de cuatro pasos y el flujo secundario validan IMEI 1 y el segundo no vacío. Las solicitudes y selecciones usan el mismo esquema; no se generan RECO parciales. |
| Equipos | Altas normales y externas, alta de segundo IMEI y asociaciones aplican Luhn. Se revalida también en los helpers internos de creación y resolución. |
| Ediciones | Los datos técnicos, notas, cliente y datos operativos de un trámite existente no obligan a alterar un IMEI histórico. La corrección numérica tiene confirmación, motivo, permiso y control de concurrencia. |
| Gemini | El servidor y el cliente revisan el candidato con la regla compartida. Un candidato inválido permanece visible para corrección, con advertencia por campo; no se presenta como validado ni puede guardarse. Se conservan los controles de respuesta tardía y de cambios manuales. |
| API | Los clientes HTTP directos reciben el mismo rechazo en las altas, asociaciones y correcciones de identificadores. |

### Endpoints y puntos de entrada

- `POST /api/sales` y `POST /api/sales/resolve`.
- `POST /api/registration-operations`.
- `POST /api/registrations`, `POST /api/registrations/resolve`, `POST /api/registrations/external`.
- `POST /api/equipment`, `POST /api/equipment/external`, `POST /api/equipment/:id/imeis`.
- `PATCH /api/equipment/:id/imeis/:imeiId`: corrección explícita del valor, con permiso `equipment.update`, valor anterior esperado, valor nuevo válido, motivo y confirmación.
- `PATCH /api/imeis/:value/registration`: antes de iniciar un registro sobre un IMEI sin estado previo exige Luhn. Las ediciones de estado o método de un registro ya existente no introducen un número nuevo y mantienen compatibilidad histórica.
- Esquemas de selección de documentos/evidencias para operaciones nuevas heredan la validación compartida.
- No se identificó un importador comercial activo versionado ni una automatización de altas que constituya otro punto de entrada del producto. No se ejecutaron ni se modificaron importaciones históricas, scripts locales de mantenimiento, backups o restauraciones.

## FRONTEND

- `ValidatedInput` admite validación IMEI compartida y se utiliza en los campos de venta, ambos asistentes y la corrección autorizada.
- Incompleto: indicación neutral de los 15 dígitos, sin check verde.
- Formato incorrecto: mensaje para usar solo dígitos; no se limpia silenciosamente el número.
- Checksum incorrecto: **IMEI INVÁLIDO: NO CUMPLE EL ALGORITMO DE LUHN.**
- Válido: **IMEI VÁLIDO.**, con check y verde discreto.
- Error accesible con icono, texto, `aria-invalid`, descripción vinculada y borde de error; no depende solo del color.
- Continuación y guardado deshabilitados cuando el conjunto de IMEI es inválido. Se mantienen los valores introducidos para corregirlos.
- En ventas, los nombres de campo identifican equipo y número de IMEI. Los errores del backend incluyen su ruta, sin incluir el identificador completo.
- Se conservan obligatoriedad del primer IMEI, segundo opcional, máximo dos, posiciones distintas, valores distintos y unicidad persistida.
- Se usan los controles, colores e iconos existentes del POS, sin cambiar el diseño general ni añadir animaciones.

## BACKEND

- Regla obligatoria central en `imeiValueSchema`; las escrituras no dependen de React.
- Errores HTTP 400: `INVALID_IMEI_FORMAT`, `INVALID_IMEI_LENGTH`, `INVALID_IMEI_CHECKSUM`.
- Se mantienen los conflictos de unicidad (`IMEI_ALREADY_EXISTS`) y las comprobaciones comerciales existentes.
- Los payloads se validan antes de escribir. Las operaciones de varios equipos o IMEI conservan la transacción atómica.
- La corrección bloquea el equipo, verifica pertenencia, valor anterior y unicidad; actualiza el valor conservando el UUID y sus relaciones. Registra motivo y sufijos de referencia en la auditoría, sin añadir números completos a logs.
- Un fallo o conflicto no guarda una parte de la operación.

## DATOS

- No se ejecutaron consultas masivas de revisión, modificaciones ni limpieza de los IMEI almacenados.
- No se modificaron clientes, ventas, RECO, evidencias, fotografías o PDF históricos durante esta implementación.
- Migraciones: ninguna. No se agregó una restricción retroactiva que impida restaurar o consultar datos históricos.
- `imeiLookupSchema` mantiene separado el formato de búsqueda del criterio de escritura. Las consultas, filtros y vistas de solo lectura no exigen checksum.
- La detección estructural de doble IMEI continúa siendo independiente de Luhn para no reclasificar datos históricos.
- Un IMEI histórico inválido necesita corrección explícita antes de reutilizarse en una operación nueva. La ficha técnica ofrece esa acción a usuarios con permiso; no se efectúa ninguna corrección automática.
- Las transiciones y ediciones no numéricas de solicitudes ya existentes, las descargas y los backups no quedan bloqueados por esta regla.

## ENTREGA

- Commit inicial: `406e0aae22967f9e3eb0f1e29765926c3080189f`.
- Commit final: el hash del commit de esta implementación se incluye en el reporte de entrega del chat.
- Pendientes: ejecutar la fase de verificación autorizada posteriormente; los fixtures históricos de pruebas pueden requerir IMEI válidos en altas nuevas. No se cambiaron ni ejecutaron pruebas durante esta fase.

### Archivos modificados

- `server/app.ts`
- `server/lib/errors.ts`
- `server/services/pos.service.ts`
- `shared/registration.ts`
- `shared/scanner.ts`
- `shared/validation.ts`
- `src/components/FormValidation.tsx`
- `src/features/equipment/BoxScanner.tsx`
- `src/features/equipment/ImeiCard.tsx`
- `src/features/registrations/GlobalImeiSearch.tsx`
- `src/features/registrations/OperationalRegistrationFlow.tsx`
- `src/features/registrations/RegistrationFlow.tsx`
- `src/features/sales/NewSale.tsx`
- `src/features/sales/SaleEquipmentEditor.tsx`
- `src/pages/Equipment.tsx`

### Archivos creados

- `shared/imei.ts`
- `src/components/imei-validation.css`
- `src/features/equipment/ImeiCorrection.tsx`
- `docs/imei-luhn-implementation-report.md`

## PRUEBAS

**NO EJECUTADAS POR INSTRUCCIÓN DEL USUARIO.** Tampoco se ejecutaron compilaciones, typecheck, lint, auditorías, comparaciones visuales ni verificaciones responsive.

## PUSH

**NO.**

## DEPLOY

**NO.**
