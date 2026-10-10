# COMUNIC@TE POS — Workflow alignment

Documento histórico del baseline ea505c1. Sus reglas de condiciones, cancelación y estados fueron reemplazadas por [operational-refinement-analysis.md](operational-refinement-analysis.md) y [database-architecture.md](database-architecture.md).

## Base y entrega por bloques

Rama master, commit inicial e404c1b, descendiente de Phase 4 acff326.
Phase 5 DNI se reutiliza; no se revierte doble IMEI ni arranque local Windows.
La inspección está en [workflow-gap-analysis.md](workflow-gap-analysis.md).
La empresa es única y privada; no se introducen tenants u organizaciones.

Commits de análisis, modelo/migración y servicios se verificaron por separado.
El reporte final registra pruebas, controles y commit de UI/documentación.
No push, deploy ni modificación de una base productiva.

## Modelo e invariantes

Se reutilizan Client → Equipment → Imei y Sale → SaleEquipment → Equipment.
Equipment agrega commercialName/color/ram/storage nullable para preservar datos
históricos sin inventarlos. Client sigue con DNI de ocho dígitos y UNIQUE.
La ampliación a CE/pasaporte/RUC necesita migración futura de identidad,
unicidad por tipo/número, búsquedas y contratos diferenciados; no se habilitan
opciones con validaciones falsas. Esta entrega opera con DNI.

RegistrationOperation agrupa una confirmación: UUID de idempotencia, hash de
entrada y actor. RegistrationRequest referencia un Imei y conserva **solo**
datos de esa atención: operador, celular, referencia, dirección, departamento,
correo, precio, bloqueo declarado, caja, condiciones y fecha operativa. No
duplica cliente ni equipo. RegistrationRequestHistory preserva correcciones,
transiciones y actor. Códigos RECO- independientes por solicitud.

La nueva migración `20261009000100_operational_workflows` no modifica las
históricas. FKs RESTRICT conservan relaciones; CHECK valida precios/cantidades,
contactos y teléfono; UNIQUE parcial impide más de una solicitud vigente por IMEI;
UNIQUE de operación/celular exige teléfonos distintos en registro doble.
Triggers diferidos verifican estado coherente de solicitud e IMEI al commit.
No se inventan solicitudes para actualizaciones técnicas históricas.

SaleAccessory representa líneas comerciales con nombre, cantidad y precio
unitario histórico; no genera Equipment ni Imei. El total de venta se recalcula
con Prisma.Decimal incluyendo cantidades y descuento. Los triggers de total
de PostgreSQL incluyen accesorios, incluso en SQL directo. React usa céntimos
BigInt. Sale conserva estado, precio, propietario y relaciones existentes.

Sale.occurredAt es la fecha comercial; createdAt/updatedAt son timestamps del
sistema. La migración copia createdAt en ventas históricas. Formularios, filtros
e indicadores comerciales usan Lima (UTC-5); no dependen de la zona del equipo.
No se altera la fecha del sistema para simular una operación histórica.

## Registro operativo

`/registros/nuevo`: cliente/contacto → equipo/IMEI objetivo → precio/condiciones
→ evidencias opcionales → revisión → confirmación. No hay altas antes de confirmar.

La consulta DNI comparte el mecanismo Phase 5: PostgreSQL primero, nombres
externos editables si no existe y fallback manual. Mock solo ficticio local;
**REAL DNI PROVIDER: NOT VERIFIED** sin credenciales comerciales.
Celular de atención, dirección, departamento y correo son obligatorios aquí;
no se convierten en requisitos de ventas. Se muestra contacto canónico por
separado y puede elegirse el celular guardado. Contactos de atención se conservan
aunque luego cambie el cliente.

Equipos vinculados se consultan por ownerId. Buscar IMEI recupera equipo,
propietario, IMEIs relacionados, datos técnicos y ventas. Cambiar IMEI invalida
selección, resolución y datos recuperados. Debounce y AbortController evitan
respuestas antiguas; el backend vuelve a resolver ambos IMEIs al confirmar.
Dos equipos distintos o propietario incompatible generan conflicto.
Un IMEI adicional exige confirmación explícita de pertenencia al mismo equipo.

Los IMEIs objetivo se seleccionan explícitamente, sin marcar ambos por defecto.
PENDING, PROCESSING, REGISTERED o solicitud vigente bloquean una nueva solicitud.
Cada celular tiene nueve dígitos y empieza por 9; el doble exige celulares distintos.
Cada IMEI recibe operador CLARO/MOVISTAR/ENTEL/BITEL, precio (incluido cero),
estado y bloqueo propios. El bloqueo es declaración de atención, **no OSIPTEL**.
STORE/EXTERNAL conservan su significado. PASE no se interpreta ni convierte.

Confirmar crea/reutiliza cliente/equipo/IMEIs y crea todas las solicitudes en una
transacción serializable, con locks, reintentos acotados de conflictos y rollback
completo. La clave de idempotencia pertenece al actor y al hash del formulario:
repetir una confirmación idéntica reutiliza la operación; cambiarla con la misma
clave genera 409. Errores recuperables conservan el formulario y la clave.

## Evidencias temporales

DNI frontal/reverso, caja, boleta e IMEI lógico: archivo o cámara móvil mediante
capture cuando el navegador lo soporte, preview, reemplazo y eliminación.
JPG/PNG/WEBP, hasta 8 MB por categoría. No tener caja deshabilita/elimina su foto.
URLs temporales se revocan al cambiar archivo o salir del componente; los File
se liberan al confirmar o abandonar el wizard. No se suben a API, PostgreSQL,
Firebase ni storage. No se afirma que hay respaldo. No se genera PDF ni ticket;
es una mejora futura opcional, al igual que una política de retención segura.

## Seguimiento y edición

`/registros`: búsqueda por RECO, DNI, nombre o IMEI; filtros PENDING, COMPLETED,
CANCELLED y bloqueo declarado independiente. Detalles muestran contactos/precios
históricos, responsables, fecha operativa, timestamps e historial.

PENDING → COMPLETED corresponde a Imei.REGISTERED, fecha de realización y actor.
Anular PENDING o COMPLETED exige registration.cancel, confirmación y motivo;
deja Imei.CANCELLED y conserva historial. Una anulación explícita permite una
nueva atención; no hay reapertura silenciosa ni DELETE. Solo pendientes admiten
correcciones operativas, registrando antes/cambios/actor. Nunca se editan IMEI,
equipo o propietario mediante PATCH genérico. Un lote de realizados requiere
confirmación y entrega éxito/fallo por solicitud; cada transición es atómica.

`/registros/tecnico` conserva la herramienta de actualización técnica histórica
de fases previas (sin solicitud comercial). No modifica un IMEI con solicitud
vigente; se debe gestionar esa solicitud. La ficha de IMEI dirige a ella.
Los tests anteriores conservan cobertura del flujo técnico en esta ruta; los
nuevos E2E cubren el flujo operativo real y su revisión.

## Ventas

`/ventas/nueva` agrupa comprador, múltiples equipos y accesorios/pago/fecha,
con una revisión completa antes de confirmar. Se conservan comprador diferente
de propietario, IMEI 2 opcional, Yape/Plin y métodos históricos. Celular/correo
del cliente siguen opcionales. Nombre comercial es obligatorio en el formulario
nuevo; contratos técnicos heredados siguen compatibles con datos históricos.

IMEI conocido muestra su equipo y advierte venta activa antes de revisar;
selección de equipo vendido está deshabilitada. El servidor e índice parcial
impiden otra venta activa. Seleccionar equipo existente conserva su propietario.
Una nueva venta tras cancelación requiere selección/confirmación explícita,
sin recrear el equipo. No hay reembolso o transferencia compleja de dueño.

Accesorios permiten agregar/modificar/eliminar líneas antes de confirmar,
cantidad entera positiva, precio unitario no negativo e importe exacto.
Revisión incluye comprador, owners, equipos, IMEIs, accesorios, subtotal,
descuento, método, fecha y total. Confirmar se protege con bloqueo de UI y clave
de idempotencia; toda la venta, líneas, equipo, historial y auditoría son atómicos.
Cancelar conserva datos e historial; no representa un reembolso.
Solo notas pueden corregirse desde el detalle por sales.update, con auditoría y bloqueo transaccional; ventas canceladas o reembolsadas rechazan la corrección.
No se alteran libremente cantidades/precios de una venta confirmada.

## API, permisos y privacidad

- GET `/api/registration-requests`: registration.read, búsqueda/filtros/paginación.
- GET `/api/registration-requests/:id`: registration.read y detalle/historial.
- POST `/api/registration-operations`: registration.create + clients.create + equipment.create.
- PATCH `/api/registration-requests/:id`: registration.update, campos operativos seguros.
- POST `/api/registration-requests/:id/transition`: registration.update para completar,
  registration.cancel para anular, con confirmación/motivo.
- POST `/api/registration-requests/complete`: registration.update, lote confirmado.
- POST `/api/sales[/resolve]`: permisos existentes, accesorios/fecha/idempotencia ampliados.
- PATCH `/api/sales/:id`: sales.update, solo notas de ventas PENDING/COMPLETED,
  sin alterar precios ni relaciones.

Los nuevos permisos registration.cancel/sales.update corresponden inicialmente
a ADMIN y SUPERADMIN, conservando el resto de la matriz. Backend comprueba sesión
y permisos actuales. Argon2id, cookies HttpOnly, origen/CSRF, sesiones y auditoría
se reutilizan. Actor viene de sesión, nunca del cuerpo. AuditLog de solicitudes
no almacena fotos, contactos de atención completos ni tokens; historial operativo
privado sí conserva los campos necesarios para rastrear una corrección.
Compartir copia únicamente un enlace privado sin DNI/celular en el URL; abrirlo exige sesión y registration.read. No envía mensajes a terceros.
No hay enlace público anónimo, envío externo ni payloads sensibles en logs.

## Fichas y pruebas

Cliente muestra conteos y relaciones reales de equipos, ventas y solicitudes.
Equipo muestra identificación técnica, propietario, precios históricos de venta,
una línea por solicitud e historial por IMEI. Dos IMEIs siguen siendo un equipo.

Pruebas usan únicamente communicate_pos_test y mock/fetch simulado; integración
y E2E se ejecutan secuencialmente. Cubren la venta y ambas solicitudes del mismo
equipo, equipo externo, selección de solo uno, precios cero, contactos/estados
independientes, rollback de la primera solicitud cuando falla la segunda,
idempotencia/concurrencia, SQL directo, permisos/actor, accesorios y totales.
Los formularios muestran errores junto a los campos, conservan borradores y enfocan el primer error. La navegación interna y Atrás/Adelante piden confirmar antes de abandonar cambios.
E2E incluye edición de solicitudes/notas, foco ante precios inválidos, Atrás, fotos temporales, falta de caja, cambio de identidad, respuestas tardías,
advertencia de venta activa y salida con cambios sin guardar. Capturas en
`.test-results/workflow`: escritorio 1280 y móviles 375/390/430.

Fuera de alcance: OCR/escáner sin mecanismo disponible, OSIPTEL/RENTESEG/CODART,
facturación, almacenamiento permanente, PDF/ticket, pagos mixtos y reembolsos
avanzados. La consulta comercial real de DNI permanece sin verificar.
