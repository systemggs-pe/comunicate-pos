# PHASE 8 — Dashboard y reportes operativos

PostgreSQL es la única fuente de datos. No existen tablas analíticas, copias de ventas,
reconstrucciones a partir de auditoría ni estadísticas persistidas en el navegador.
Los datos de prueba se crean exclusivamente en `communicate_pos_test`.

## Indicadores y fechas

Todos los periodos usan `America/Lima`: inicio a las 00:00 incluido, final a las 00:00
del día siguiente excluido. Los presets se resuelven por el servidor si no hay fechas
explícitas. HOY, AYER, ÚLTIMOS 7 DÍAS (hoy y seis anteriores), ESTE MES (hasta hoy),
MES ANTERIOR (mes completo), ESTE AÑO (hasta hoy) y PERSONALIZADO. Máximo 732 días
incluidos. Fechas inexistentes, rangos invertidos, campos desconocidos y filtros
inaplicables se rechazan. Agrupación semanal: lunes; mensual: primer día.

| Indicador | Cálculo PostgreSQL y fecha |
| --- | --- |
| VENTAS REALIZADAS | COUNT Sale; occurredAt |
| INGRESOS DE VENTAS | SUM Sale.total; occurredAt, incluye accesorios y descuenta descuentos |
| EQUIPOS VENDIDOS | COUNT SaleEquipment de las ventas seleccionadas; un equipo es único |
| REGISTROS IMEI | COUNT RegistrationRequest; occurredAt de la atención |
| IMPORTE REGISTRADO DE SERVICIOS | SUM RegistrationRequest.price; occurredAt; no confirma cobro |
| CLIENTES NUEVOS | COUNT Client.id; createdAt |
| ESTADO ACTUAL DE REGISTROS | Estado actual de las solicitudes cuya atención está en el periodo |
| REGISTROS POR OPERADOR | Operador guardado en cada solicitud; totales y estados actuales |
| SOLICITUDES CREADAS | createdAt; nunca se sustituye por occurredAt o completedAt |
| SOLICITUDES FINALIZADAS | completedAt real; no se deduce del estado actual |
| ACTUALMENTE PENDIENTES | Solicitudes creadas en cada grupo y actualmente PENDING |

Una atención doble: un cliente, un equipo, dos IMEI y dos RECO. Una venta con dos
equipos: una venta, dos equipos; Sale.total se suma antes y separadamente de las
relaciones IMEI/solicitudes/accesorios. No existe Sale.status.

Las series de ventas incluyen ceros explícitos dentro del periodo. Las finalizaciones
sin completedAt verificable no se reconstruyen desde columnas legacy. La serie de
pendientes es una cohorte con estado actual; no representa el saldo de pendientes que
existía en cada fecha histórica. Los reportes reflejan cambios y eliminaciones al
actualizar. El historial operativo original continúa conservándose según sus reglas.

## Reportes

`/reportes` contiene GENERAL, VENTAS, REGISTROS, CLIENTES, EQUIPOS y TRABAJADORES.
Los filtros se conservan en la URL, con soporte para Atrás/Adelante. Cambiar de tipo
conserva fechas y agrupación, elimina filtros incompatibles y reinicia paginación.

- Ventas: trabajador creador, método real de pago y marca mediante EXISTS. Filtrar
  marca selecciona ventas que contienen esa marca; el importe es el total de la venta
  completa y los equipos vendidos son todos sus equipos, no un prorrateo inventado.
- Registros: creador, operador, estado actual y marca; creador y finalizador separados.
  En evolución, el filtro trabajador usa createdById para creaciones y completedById
  para finalizaciones. El estado filtra el estado actual de la solicitud.
- Clientes: total global conservado, nuevos en el periodo, compras/atenciones del
  periodo, clientes con más de una operación. Una RegistrationOperation doble es una
  operación para este último indicador, aunque tiene dos solicitudes RECO. Las filas
  incluyen clientes nuevos o con compras/atenciones en el periodo. Identidad: Client.id;
  los registros se relacionan con el propietario actual del equipo. Si cambió de
  propietario, no existe snapshot histórico de identidad suficiente para atribuirlo
  al propietario anterior. Compras se atribuyen al comprador histórico Sale.buyerId.
- Equipos: cohorte creada en el periodo; físicos únicos, externos, uno/dos IMEI,
  cantidad de identificadores y marcas reales agrupadas con TRIM, espacios y UPPER
  en SQL. No se modifica el catálogo ni los valores históricos. EQUIPOS VENDIDOS usa
  ventas del periodo y puede pertenecer a otra cohorte de creación; VENTA VIGENTE en
  cada fila indica la existencia actual de SaleEquipment.
- Trabajadores: ventas por occurredAt/createdById; creaciones por createdAt/createdById;
  finalizaciones por completedAt/completedById; servicios registrados por
  occurredAt/createdById. Los inactivos con actividad histórica del periodo aparecen.
  La búsqueda de trabajadores incluye inactivos de cualquier fecha, paginada a 100.
- Métodos de pago: CASH, YAPE, PLIN, CARD, TRANSFER, OTHER del modelo existente.
  Porcentaje del importe vendido; cuando el total es cero, porcentaje cero.
  No se asignan métodos a los servicios de registro.

## API y consistencia

`GET /api/dashboard/summary`, `/api/reports/{general,sales,registrations,clients,equipment,users}`,
`/api/reports/actors` y `/api/reports/export?type=...`.
Capas: shared/reports.ts (validación/contrato), routes/reports.routes.ts (autorización),
services/reports.service.ts (coordinación/CSV), repositories/reports.repository.ts (SQL).
Prisma.sql parametriza todos los valores. No hay SQL construido desde entradas libres.

Cada reporte se lee en una transacción REPEATABLE READ, límite 20 segundos; filas,
totales y gráficos corresponden al mismo snapshot. COUNT usa enteros; SUM numeric
se serializa como texto con dos decimales. El navegador formatea cadenas, no suma
precios. Chart.js convierte agregados a number solo para coordenadas visuales;
los importes exactos permanecen en tarjetas, tablas, CSV y tooltip monetario.

Paginación estable code/id: 25 filas por defecto, máximo 100; conteo total separado
solo si la página está vacía. Series máximo 732 días, semanal/mensual opcional.
No se descargan filas completas para calcular estadísticas. Consultas correlacionadas
usan índices de relaciones; no hay una llamada API/Prisma por cada fila.
No se consultan fotos, EvidenceAsset ni MinIO para producir reportes.

## Índices y migración

20261010000500_reports_analytics: índices aditivos en Sale.occurredAt,
Sale(createdById,occurredAt), RegistrationRequest.occurredAt,
RegistrationRequest(operator,status,occurredAt), RegistrationRequest(createdById,createdAt),
RegistrationRequest.completedAt, RegistrationRequest(completedById,completedAt),
Client.createdAt y Equipment.createdAt. Las relaciones buyerId/ownerId/imeiId,
SaleEquipment.saleId y equipmentId ya tienen índices o claves existentes.
No se modificaron migraciones anteriores ni datos comerciales. No se añade índice
de marcas normalizadas: esa agregación recorre la cohorte y no justifica otro catálogo.

## Permisos y seguridad

reports.read y reports.export: SUPERADMIN por defecto; ADMIN y SELLER sin acceso por
defecto. SUPERADMIN puede concederlos en la matriz existente. Exportar requiere ambos.
La ruta financiera antigua /api/dashboard ahora requiere reports.read, cerrando el
acceso alternativo. El inicio mantiene los accesos operativos para SELLER y oculta las
métricas financieras; acceso directo a REPORTES se rechaza también en el backend.

401 sin sesión, 403 sin permisos, 400 filtros inválidos, 413 CSV demasiado grande.
Cache-Control no-store. Respuestas y CSV excluyen DNI, IMEI, teléfono, email, dirección,
credenciales, sesiones y evidencias. La ficha de cliente solo se enlaza con clients.read.
Los usuarios tienen nombres y códigos operativos; no se exportan sus correos.

Las lecturas no auditan cada consulta. Exportar genera REPORT_EXPORTED con actor,
tipo, periodo, fecha y cantidad de filas; nunca guarda contenido ni PII del reporte.

## CSV y límites

CSV obligatorio: BOM UTF-8, CRLF, todas las celdas entre comillas, comillas duplicadas,
comas/saltos de línea preservados y prefijo apóstrofe para fórmulas incluso tras
espacios/caracteres de control. Columnas: whitelist igual que pantalla, sin campos
internos. Incluye nombre, periodo, generación, filtros, indicadores, filas y tablas
agregadas. Máximo 5,000 filas; no trunca: devuelve 413 para reducir los filtros.
Exporta todo el conjunto filtrado autorizado, no solamente la página visible.

PDF de reportes no implementado (opcional). Tickets de 48/80 mm y declaración A4
mantienen sus componentes y plantillas originales, sin modificaciones de Phase 8.

## Interfaz y verificación

Chart.js/react-chartjs-2 con registro selectivo de elementos y carga diferida del
módulo de gráficos, según sus guías oficiales:
https://www.chartjs.org/docs/latest/getting-started/integration.html y
https://react-chartjs-2.js.org/.
Tarjetas responsive, tablas con desplazamiento interno, filtros accesibles, errores
recuperables, indicadores de carga y actualización explícita. Gráficos vacíos no
inventan datos. Capturas en .test-results/reports a 1280/375/390/430 px.

Pruebas nuevas: unit/reports.test.ts, integration/reports.test.ts y e2e/reports.spec.ts.
La regresión ejecuta también clientes/equipos/doble IMEI/ventas/eliminación, RBAC,
auditoría, DNI, tickets, declaración A4 y MinIO. Véase phase-8-verification.md para
resultados finales y commits. No push, despliegue ni credenciales productivas.
