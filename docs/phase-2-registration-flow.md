# Phase 2 — Cliente → Equipo → IMEI → Registro

## Operación

1. Abrir `/registros/nuevo`. Ingresar DNI de ocho dígitos: se busca automáticamente.
2. Reutilizar el cliente encontrado o completar sus datos. Todavía no se escribe.
3. Ingresar IMEI 1 y, opcionalmente, IMEI 2 (15 dígitos, distintos; físico/eSIM).
4. Resolver **todos** los valores contra el índice único `Imei.value`.
5. Si ninguno existe, completar marca/modelo/serie. Si existe alguno, mostrar el
   equipo y propietario canónicos. Dos equipos distintos o propietario diferente bloquean.
6. Un IMEI conocido más uno desconocido exige confirmar su asociación al mismo
   equipo y que el slot solicitado esté libre. Nunca se sobrescribe un IMEI.
7. Seleccionar uno o ambos valores, estado y método opcional. Guardar registro.

`POST /api/registrations/resolve` sólo comprueba; `POST /api/registrations` vuelve
a resolver dentro de una transacción serializable. El preflight de UI no concede
autorización ni reserva slots. Crear/reutilizar cliente, crear equipo EXTERNAL ACTIVE,
agregar IMEIs, actualizar seleccionados y escribir historial/auditoría es una sola
operación atómica. Un fallo de unicidad, FK o validación revierte todos sus cambios.
Las secuencias pueden dejar huecos tras rollback, como en Phase 1.

## Casos

| Entrada | Resultado |
|---|---|
| Cliente nuevo + IMEI nuevo | Cliente y equipo nuevos en una transacción |
| Cliente existente + IMEI nuevo | Equipo nuevo, mismo Client.id y contactos |
| Un IMEI | Estado del equipo deriva de ese único IMEI |
| Dos IMEIs, sólo primero seleccionado | El segundo conserva NOT_REGISTERED; resumen parcial si el primero está REGISTERED |
| Buscar segundo posteriormente | Mismo Imei → Equipment → Client; actualización individual, sin altas |
| Ambos valores conocidos en mismo equipo | Reutilizar equipo; no modificar slots ni tipos existentes |
| Conocido + nuevo | Confirmación explícita ligada a expectedEquipmentId, slot disponible |
| Valores de equipos distintos | IMEI_EQUIPMENT_CONFLICT |
| Propietario diferente | OWNER_MISMATCH; transferencia futura |

La búsqueda global visible utiliza `GET /api/equipment/by-imei/:value`; muestra
slot, estado, equipo y propietario. El detalle permite actualizar cada IMEI.
Los seis estados de Phase 1 se conservan. `registrationMethod` admite texto o null
para limpiar; omitirlo conserva el método anterior. No hay integración con operadores.

## Clientes, edición y consultas

`/clientes` busca DNI o tokens de nombres/apellidos; `/clientes/nuevo` permite alta
independiente. Esa alta es una intención distinta del asistente y tiene su propia
transacción. El asistente nunca crea un cliente previamente por separado.
El detalle obtiene equipos mediante Equipment.ownerId. DNI es inmutable en edición.
Equipo sólo permite editar brand, model, serialNumber. Objetos con claves sensibles
adicionales se rechazan mediante esquemas strict en servidor.

Listados devuelven arrays paginados (`q`, `offset`, `limit`, máximo 100, defecto 20);
equipos admite ownerId. La UI pagina de 20 en 20. Al llenar exactamente una página,
puede ofrecer una página siguiente vacía; no mantiene un conteo total separado.

## Historial y errores

Eventos: EQUIPMENT_CREATED, OWNER_ASSIGNED, IMEI_ADDED, IMEI_REGISTRATION_STARTED,
IMEI_REGISTERED, IMEI_REGISTRATION_REJECTED, IMEI_REGISTRATION_CANCELLED,
IMEI_REGISTRATION_UPDATED y EQUIPMENT_UPDATED. Registro/rechazo directo inicial
genera inicio antes del resultado. Cada IMEI tiene eventos independientes; repetir
el mismo estado/método es idempotente. La UI muestra fechas es-PE/America/Lima,
descripciones humanas y slot; no expone JSON crudo.

Errores: `{error:{code,message}}`. Se conserva `message` superior por compatibilidad
con consumidores de Phase 1. Validación devuelve 400; conflictos 409; ausentes 404;
guardia temporal 401/503; errores internos 500 sin stack. También se controlan las
carreras mediante UNIQUE y reintentos acotados P2034.

## TEMPORARY AUTH

Ingresar en la pantalla de acceso el API_ACCESS_TOKEN privado del servidor local.
La UI verifica `/api/access` y guarda el token únicamente en memoria; se pierde al
recargar/cerrar o pulsar Cerrar acceso. No usar variables VITE_, localStorage,
sessionStorage ni cookies. Este acceso compartido no identifica al operador y no
implementa usuarios, roles ni sesiones definitivas. No se conecta producción.

## Pruebas

`npm test`, `npm run test:integration`, `npm run test:e2e`.
E2E requiere Microsoft Edge instalado y usa exclusivamente communicate_pos_test
local, backend 3002 y Vite 5175. No reutiliza servidores de desarrollo.
Ambas suites de base borran únicamente las tablas de prueba: ejecutarlas secuencialmente.
E2E crea Brand/Samsung, registra primero, sale, busca segundo, registra después y
comprueba IDs, conteos e historial. Luego prueba reutilización y captura pantallas
de escritorio/375/390/430 en `.test-results/visual` (ignoradas por Git).
