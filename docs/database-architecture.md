# Arquitectura de datos

Phase 2 conservó íntegros schema.prisma y la migración de fundación. No requirió
migración nueva: Client, Equipment, Imei y EquipmentHistory ya tienen las relaciones,
campos, enums, FKs y restricciones necesarios.
La edición de cliente excluye DNI; equipo excluye ownerId/id/code/IMEIs. Registro
resuelve todos los IMEIs antes de escribir y exige confirmación ligada al equipo
canónico para agregar uno desconocido. El propietario se comprueba por DNI y, cuando
se suministra, por ownerId. Nunca se transfiere automáticamente.
Consulte [el flujo de Phase 2](phase-2-registration-flow.md) para atomicidad,
reutilización, registro parcial e historial; su sección TEMPORARY AUTH es histórica
y fue reemplazada en Phase 4.

```text
Client 1 ── N Equipment 1 ── N Imei
Client (buyer) 1 ── N Sale 1 ── N SaleEquipment N ── 1 Equipment
Equipment 1 ── N EquipmentHistory
User 1 ── N Sale / Imei / EquipmentHistory / AuditLog
```

PostgreSQL es la única fuente de verdad comercial. UI → API → servicios → acceso
a datos → Prisma → PostgreSQL. No se usan Firebase, Supabase, almacenamiento local
ni IMEIs en JSON. Historial y auditoría son trazabilidad, no estado actual.

## Entidades y propiedad

- `Client`: persona única, DNI normalizado de ocho dígitos, código único.
- `Equipment`: dispositivo físico, marca/modelo/serie, propietario por FK.
- `Imei`: identidad única de 15 dígitos, FK a equipo, slot 1 o 2, tipo físico/eSIM.
- `Sale`: comprador independiente, estado, método de pago, descuento, total decimal y notas.
- `SaleEquipment`: relación de muchas líneas por venta con precio unitario decimal.
- `EquipmentHistory`: evento vinculado al equipo e IMEI opcional.
- `AuditLog`: acciones exitosas persistidas en la misma transacción.
- `User`: cuenta privada con rol, estado, hash de contraseña, código y último acceso.
- `Role`, `Permission`, `RolePermission`: permisos persistidos por rol.
- `Session`: hash del token y expiración absoluta.
- `AuthRateLimit`: contadores de login compartidos entre instancias.

`STORE` representa equipos de tienda; permite propietario nulo antes de asignación.
`EXTERNAL` representa equipos traídos por clientes y exige propietario en PostgreSQL.
Todos los registros de IMEI que avanzan desde `NOT_REGISTERED` requieren propietario.
Comprador (`Sale.buyerId`) y propietario (`Equipment.ownerId`) pueden ser distintos.
Un equipo nuevo vendido se crea como STORE/ACTIVE y recibe por defecto al comprador
como propietario, o al propietario elegido. Un equipo STORE existente conserva su
propietario; si está sin asignar, el contrato nuevo permite asignarlo al vender.
La venta no transfiere automáticamente equipos ya asociados a otra persona.

## IMEIs y registro

`Imei.value` tiene índice único global. `(equipmentId, slot)` también es único, y un
CHECK limita slot a 1/2: máximo dos IMEIs por equipo incluso con escrituras directas.
Los servicios crean equipos con al menos un IMEI; la base permite dispositivos sin
IMEI como preparación futura de inventario, sin habilitar un registro sin IMEI.

Cada IMEI mantiene su propio estado, método, fechas y usuario opcional. `registeredAt`
se mantiene sólo cuando el estado actual es `REGISTERED`. Repetir la misma actualización
no agrega eventos. Se permiten cambios explícitos entre los estados enumerados; las
transiciones de un proveedor específico quedan para su futura integración.
No se impone checksum Luhn: esta fase exige exactamente 15 dígitos, tal como se solicitó.

El estado global se deriva al leer: ninguno registrado → `NOT_REGISTERED`, algunos
registrados → `PARTIALLY_REGISTERED`, todos registrados → `REGISTERED`. No se persiste
otra columna de registro en Equipment. Un estado global NOT_REGISTERED puede contener
IMEIs PENDING, PROCESSING o REJECTED; consulte siempre los estados individuales.

El endpoint de registro primero busca por IMEI. Si existe, reutiliza su equipo y
cliente. Si no existe, busca cliente por DNI, crea/reutiliza persona y crea equipo
externo con sus IMEIs dentro de una sola transacción. Registrar el segundo IMEI luego
no crea otra venta, persona ni equipo. No se vinculan dos IMEIs existentes a equipos
distintos mediante una inferencia automática.

## Restricciones y concurrencia

- IDs internos UUID independientes de los códigos visibles.
- UNIQUE en DNI, código cliente, código equipo, código venta e IMEI global.
- CHECKs de formato para DNI/IMEI, slots y montos no negativos.
- FKs con `RESTRICT`: no se borran registros relacionados accidentalmente.
- FK compuesta de historial asegura que el IMEI del evento corresponde al equipo.
- Triggers exigen propietario durante registro, incluso si se escribe fuera de API.
- Secuencias independientes generan `CL-000001`, `EQ-000001`, `SALE-000001`.
- Función `next_visible_code` usa mínimo seis dígitos y crece sin truncar al superar
  999999. Los códigos son únicos, no consecutivos sin huecos: rollback consume secuencia.
- Transacciones serializables con hasta tres intentos por P2034. UNIQUE es la última
  defensa para carreras; P2002 responde 409, sin ocultar conflictos.

Las líneas tienen `isActive`, indicador técnico **mantenido sólo por triggers** desde
Sale.status. No es un estado comercial editable. Un índice único parcial sobre
equipmentId WHERE isActive impide varias ventas PENDING/COMPLETED del mismo equipo.
Cancelar/reembolsar una venta libera la exclusividad; reactivarla vuelve a aplicar
esa restricción. Phase 3 habilita cancelación confirmada de COMPLETED/PENDING,
sin reembolsos. Los equipos/propietarios/IMEIs no se eliminan ni se reinician.
Triggers diferidos exigen al commit al menos una línea y total igual a su suma menos descuento.
Los servicios venden exclusivamente equipos STORE/ACTIVE. Los importes usan
`Decimal(12,2)` y Prisma.Decimal; nunca suma de números float.

Los triggers y CHECKs están versionados en la migración inicial, ya que Prisma 6
no los expresa íntegramente en el esquema. No sustituir migraciones por `db push`.
Los scripts SQL del directorio scripts son los fragmentos de creación inicial;
la fuente desplegable es `prisma/migrations/20261007000100_foundation/migration.sql`.
No volver a generar ni editar una migración aplicada. Toda evolución debe tener
una migración nueva y pruebas de sus invariantes.

## Docker y producción

PostgreSQL 16 Alpine local, puerto enlazado únicamente a loopback, healthcheck
`pg_isready`, persistencia en volumen `postgres_data`. `docker compose down` conserva
datos; `down -v` los elimina y no forma parte de la rutina del proyecto.
El arranque tiene un margen de diez minutos para recuperación en discos lentos y
el apagado concede dos minutos para completar checkpoints sin SIGKILL prematuro.

Prisma 6.19.3 se fija como línea conocida con datasource DATABASE_URL y PrismaClient
tradicional; no se depende de cambios de arquitectura de versiones mayores.
El lockfile fija el resto de dependencias. Se documenta esta decisión para que
una futura actualización mayor tenga revisión explícita.

La auditoría inicial detectó avisos en herramientas de desarrollo. Se seleccionó
Vitest 4.1.11 y Prisma 6.19.3, y se fijaron overrides de `deepmerge-ts` 8.0.2
(sólo dentro de @prisma/config) y `shell-quote` 1.11.0. La compatibilidad de estos
overrides debe comprobarse al actualizar Prisma/concurrently; no eliminarlos sin
repetir auditoría, CLI de migraciones y pruebas. La instalación corregida reportó
cero vulnerabilidades. ESLint 9 emite aviso de fin de soporte, sin aviso de seguridad
en la auditoría ejecutada; la actualización mayor se deja como mantenimiento explícito.

Cambiar DATABASE_URL basta para mover la conexión. Vercel sirve Vite y una función
Express. La base gestionada debe soportar PostgreSQL, transacciones, secuencias,
triggers y migraciones. No conectar producción en esta fase. Phase 4 implementa sesiones y permisos por usuario; retención/archivo de auditoría
sigue pendiente. La instalación local no equivale a un despliegue comercial verificado.

## Evolución Phase 3 — Sales core

`20261008000100_sales_core` agrega YAPE y PLIN al enum PaymentMethod y agrega
`Sale.discount Decimal(12,2) default 0` y `Sale.notes varchar(1000)`. Reemplaza la
función `validate_sale_total` conservando los triggers diferidos existentes.
Las ventas históricas reciben descuento cero. La migración de fundación no se edita.

La cadena canónica es Client → Sale → SaleEquipment → Equipment → Imei.
Sale almacena buyerId; SaleEquipment almacena equipmentId y unitPrice histórico.
No se copian DNI, nombres, marca/modelo o IMEIs en Sale. El historial SOLD incluye
saleId/saleCode para navegación, sin convertirse en fuente de verdad de la venta.

Dinero: PostgreSQL Decimal(12,2), cálculos de servidor con Prisma.Decimal y contratos
JSON con cadenas. El frontend usa BigInt en céntimos para el estimado, que el servidor
recalcula. El subtotal se deriva de total + discount; el trigger asegura que coincide
con la suma de unitPrice. Descuento a nivel de venta: no se reparte entre equipos y
no se persiste un segundo finalPrice redundante en cada línea.

La creación usa la transacción serializable existente: reutiliza/crea comprador por
DNI, reutiliza/crea propietarios, valida todos los IMEIs, crea equipos STORE y uno/dos
IMEIs NOT_REGISTERED, venta/líneas, historial y auditoría. Cualquier fallo revierte
todo; las secuencias pueden consumir códigos. UNIQUE global y exclusividad parcial
protegen frente a carreras. El preflight de UI comprueba IMEIs y totales sin escribir;
confirmar repite comprobaciones y resuelve las referencias dentro de la transacción.

Cancelar registra motivo en AuditLog y SALE_CANCELLED por equipo. Conserva el precio
histórico y la relación, libera isActive vía trigger, y excluye la venta de los
indicadores de ventas COMPLETED del día Lima. No afirma que el equipo regresó
físicamente a tienda, no libera propietario y no revierte registro IMEI. Una venta
posterior del mismo equipo usa equipmentId y conserva sus relaciones anteriores.
El estado Equipment.ACTIVE indica vigencia del dispositivo, no disponibilidad de stock.

Consulte [flujo y política de ventas](phase-3-sales-flow.md).

## Evolución Phase 4 — Auth y permisos

COMUNIC@TE POS is a private single-company application.
It is not a SaaS or multi-tenant platform.

La nueva migración agrega UserStatus, código USR-, passwordHash nullable, roleId,
lastLoginAt, Role/Permission/RolePermission, Session y AuthRateLimit. AuditLog acepta
entityId nulo para fallos de login y registra IP/user-agent acotados. No crea Tenant,
Organization, Workspace, Membership ni companyId en tablas comerciales.
CompanySettings no se agrega porque esta fase no requiere configuración empresarial.

Los usuarios anteriores quedan DISABLED sin contraseña/rol. CHECK exige que ACTIVE
posea ambos; el servicio sólo crea hashes Argon2id. Email se normaliza antes de UNIQUE,
y CHECK impide mayúsculas/espacios en escrituras directas. Si existen emails que
colisionan al normalizar, la migración falla en lugar de fusionar referencias.
Las FKs históricas se conservan con RESTRICT; no hay DELETE comercial de usuarios.

Las sesiones persisten tokenHash SHA-256 UNIQUE, userId FK, expiresAt, createdAt,
lastUsedAt opcional, IP y userAgent. El token tiene 32 bytes aleatorios; no se guarda
su texto en DB. Expiración absoluta de 12h; actualizar lastUsedAt cada cinco minutos
no renueva expiresAt. Desactivar, cambiar rol/email o resetear password elimina
sesiones del usuario. Editar permisos elimina sesiones del rol afectado; además,
cada petición vuelve a leer permisos/estado actuales. No se cachea autorización.

Las mutaciones administrativas y bootstrap usan el mismo advisory transaction lock
para contar SUPERADMIN activos y preservar al último incluso ante carreras.
La protección está en los servicios; SQL administrativo directo sigue siendo un
acceso privilegiado y no debe usarse para alterar usuarios/roles en operación normal.
Los flujos comerciales conservan sus transacciones serializables, triggers y reglas.
El contexto de auditoría se pasa por petición, sin actor global compartido.

LOGIN/LOGOUT/LOGIN_FAILED y acciones USER_* se agregan a la auditoría comercial.
Las operaciones nuevas usan CLIENT_*, EQUIPMENT_*, IMEI_REGISTRATION_UPDATED,
SALE_CREATED y SALE_CANCELLED. No se reescriben eventos históricos CREATE/UPDATE.
EquipmentHistory continúa separado. Registro guarda estados anterior/nuevo y
registeredById real; ventas guardan createdById real. Ni hashes ni contraseñas ni
tokens aparecen en API/logs/metadata. Los usuarios desactivados conservan referencias.

Matriz, seguridad cookie, bootstrap y límites: [Phase 4](phase-4-auth-and-permissions.md).

## Evolución Phase 5 — Consulta DNI y captura de clientes

Sin cambios al esquema Client ni nuevas migraciones. PostgreSQL conserva DNI único,
datos canónicos y relaciones existentes. La consulta autenticada busca primero
Client; un cliente local impide consultar al proveedor y nunca se sobrescribe.
También se verifica Client después de la respuesta externa para priorizar altas
concurrentes. El proveedor solo prellena nombres/apellidos; no inserta clientes.

La caché temporal de resultados normalizados vive en memoria, máximo 512 entradas
con TTL de 60 segundos. No es una tabla ni fuente persistente/distribuida; no evita
la búsqueda local. Confirmar cliente, registro o venta mantiene los servicios,
transacciones, UNIQUE por DNI y auditoría con actor real. Lookup no genera AuditLog
ni almacena respuestas crudas, token, teléfono/correo externos o campos duplicados.
Ante fallo externo la captura manual sigue operativa.

Detalles de proveedor, seguridad, límites y contrato: [Phase 5](phase-5-dni-automation.md).
