# Doble IMEI para todas las marcas

## Alcance y análisis del estado anterior

Este checkout es COMUNIC@TE POS 2.0: React/Vite, Express, Prisma y PostgreSQL.
Se revisaron `src`, `shared`, `server`, `prisma`, `scripts` y `tests` antes de
modificar el flujo. Samsung aparece en fixtures y ejemplos, pero **no se encontró
ninguna condición de marca que habilite o impida doble IMEI**. La capacidad ya
existía en el modelo `Equipment` → `Imei`, con posiciones 1 y 2.

No existen en este repositorio `registroDual`, `registroGrupoId`,
`registroGrupoPosicion`, `imei1Registrado`, `imei2Registrado`, `isRegistrado`,
`searchTerms`, Firestore, comprobantes Apple, fingerprints ni un generador de PDF.
No se ha portado código de otro sistema ni se ha creado una implementación paralela.

El defecto encontrado estaba en `RegistrationFlow`: al consultar sólo un IMEI de
un equipo ya dual, la selección final mostraba únicamente el IMEI escrito por el
usuario. El otro IMEI existente no podía seleccionarse en el mismo registro.

## Regla genérica y validaciones

`isDualImei` en `shared/registration.ts` comprueba que existan slots 1 y 2,
que ambos pasen `imeiValueSchema` y que sus valores normalizados sean diferentes.
No recibe marca ni la consulta. Usa la validación existente: 15 dígitos ASCII,
eliminación de espacios y conservación de ceros iniciales. No añade Luhn ni inventa
un segundo número.

`imeiListSchema` centraliza las validaciones de listas que antes estaban repetidas
en equipos y registros. Un slot 2 con valor vacío se omite; el IMEI restante sigue
el flujo single. Un segundo valor no vacío inválido se rechaza antes de escribir.
Los valores iguales y slots repetidos se rechazan. No se omite silenciosamente
un IMEI inválido. Las ventas mantienen sus validaciones anteriores.

La restricción global `Imei.value @unique` evita duplicados entre cualquier equipo
y posición. `@@unique([equipmentId, slot])` evita repetir posiciones. El preflight
rechaza combinar números que pertenecen a equipos diferentes y exige confirmación
para asociar un IMEI nuevo a un equipo existente. Todo se revalida en la transacción.

## Flujo y estados

El asistente reutiliza los IMEI canónicos del equipo encontrado y agrega sólo las
incorporaciones confirmadas. Buscar IMEI 2 conserva su posición original; no lo
convierte en IMEI 1. Muestra el estado actual de cada IMEI y ofrece **Registrar
ambos IMEI** únicamente si los datos son duales. La selección por defecto sigue
siendo el IMEI consultado/primero introducido. Cada casilla permite actualizar
sólo una posición.

El registro doble reutiliza `submitRegistration`, su transacción y las mismas
filas `Imei`; no hay un segundo servicio de registro. Las dos posiciones quedan
relacionadas mediante el mismo `equipmentId`. Los eventos `EquipmentHistory`
referencian `equipmentId` e `imeiId`, con la FK existente que impide mezclar equipos.
No se crean campos de grupo nuevos.

| Datos del equipo | Estado agregado |
| --- | --- |
| Un IMEI registrado | REGISTERED |
| IMEI 1 registrado, IMEI 2 no registrado | PARTIALLY_REGISTERED |
| IMEI 1 no registrado, IMEI 2 registrado | PARTIALLY_REGISTERED |
| Ambos registrados | REGISTERED |
| Ninguno registrado | NOT_REGISTERED |

Cada IMEI conserva su `registrationStatus`, fechas, método y actor. El agregado
se calcula con `deriveRegistrationStatus`; no se escriben banderas históricas
inventadas. Los estados PENDING, PROCESSING, REJECTED y CANCELLED se conservan.
Registrar uno no registra automáticamente el otro. El agregado anterior permanece
compatible y representa cuántos IMEI están REGISTERED, no las etapas pendientes.

## Locks, atomicidad y duplicados

Se mantienen las transacciones SERIALIZABLE con reintentos acotados P2034,
constraints, comprobación de propietario, confirmación de asociaciones, bloqueo
de submit en frontend e idempotencia al repetir un mismo estado/método.

Se añade un lock de fila PostgreSQL `SELECT ... FROM Equipment ... FOR UPDATE`
en actualizaciones individuales, reutilización de equipo y asociación de otro IMEI.
Ambas posiciones comparten el lock de su equipo, independientemente de la marca.
El lock se libera al terminar o revertir la transacción. Las altas simultáneas de
equipos desconocidos siguen protegidas por la unicidad global de IMEI y el rollback;
no se reemplaza ese mecanismo por locks por marca o servicios externos.

Las pruebas observan directamente `pg_stat_activity` mientras una transacción
retiene el lock: el registro de IMEI 1 y el de IMEI 2 esperan ese mismo equipo.
También ejecutan dos registros individuales en paralelo y doble submit del par,
comprobando estados finales, una sola entidad y eventos sin duplicación.

## Búsqueda, edición y compatibilidad

La búsqueda existente consulta la relación `imeis` y el índice único de valor.
Ambos números devuelven el mismo equipo tanto por lookup exacto como por listado.
No se necesita `searchTerms`, nuevos índices ni un cambio de esquema.

Los equipos creados antes del cambio se leen con su estructura SQL actual sin
banderas duales. Las pruebas cubren Samsung y Honor con IMEI 2 existente y con
registro parcial por la API legacy `registerExternalImei`. No se hace migración
masiva ni se alteran registros históricos. La edición de marca/modelo y la
asociación explícita del segundo IMEI conservan sus contratos. No se implementa
una nueva fase de edición del registro doble.

**Límite legacy:** no se puede certificar la lectura de documentos Firestore o de
una estructura Samsung perteneciente a otro checkout: no existen adaptadores ni
fixtures de esos documentos aquí.

## Apple y PDF

Apple utiliza el mismo modelo del equipo, admite IMEI físico/eSIM y se prueba como
cualquier otra marca. No se cambian reglas de ventas, boletas o automatizaciones.
La suite de ventas existente incluye Apple y se ejecuta como regresión.

No existe generación de PDF en este checkout. Las verificaciones PDF single/dual
y las reglas de comprobante/fingerprint Apple de otro sistema **no son aplicables
ni certificables**. No se creó un módulo de documentos para simular cobertura.

## Pruebas y verificación local

- `npm test`: validación, selección, detección dual, normalización y estados.
- `npm run test:integration`: PostgreSQL real en `communicate_pos_test`, aislado
  de la base principal. Incluye las suites existentes de registros, equipos,
  ventas y autenticación, más 20 casos de integración dual.
- `npm run test:e2e`: Edge local, API 3002 y Vite 5175, usando exclusivamente la
  base de pruebas. Nuevas pruebas de Samsung, Honor, Xiaomi, Motorola, Apple y
  marca desconocida, incluyendo búsqueda por IMEI 2, selección de ambos e historial.
- La prueba Honor captura la selección dual en 375, 390 y 430 px y comprueba
  que no haya desbordamiento horizontal. Las suites anteriores revisan detalle,
  formularios y ventas en esos mismos anchos.
- `npm run lint` y `npm run build`: validaciones del proyecto completo.

Las capturas se guardan en `.test-results/dual-imei`, ignoradas por Git. Las
herramientas y bases locales de `.local` también quedan fuera de ESLint; no se
lintan dependencias descargadas como si fueran código de la aplicación.

No se consultaron servicios productivos ni Firestore remoto. No se modificaron
autenticación, roles, secretos, esquema o migraciones. Los cambios de arranque
local de la tarea anterior permanecen separados del commit de doble IMEI.

Resultados: 66 pruebas unitarias, 185 pruebas de integración y 11 pruebas E2E
aprobadas. Lint y build aprobados. Las capturas de 375, 390 y 430 px se inspeccionaron
visualmente: valores, selección, estados y acciones legibles, sin recortes ni
desbordamiento horizontal. No fue necesaria una prueba visual manual pendiente.
El build muestra avisos de anotaciones de Zod; son no bloqueantes y no corresponden
a cambios de esta tarea.

## Riesgos pendientes

- La información de boletas Apple, PDF y documentos Firestore de la solicitud
  corresponde a otra implementación; requiere ese código para validarla.
- Bajo contención sostenida, los reintentos SERIALIZABLE siguen siendo acotados;
  un conflicto agotado conserva la respuesta de error y no deja cambios parciales.
- No se añade una clave de idempotencia para transiciones diferentes de estado:
  repetir el mismo estado/método es idempotente, pero una transición nueva crea
  su historial legítimo.
- La ruta de ventas sigue rechazando IMEI 2 vacío si se envía expresamente;
  en ventas single debe omitirse esa entrada, como ya hacía el contrato previo.

El commit se mantiene exclusivamente local. No se hace push ni deploy.
