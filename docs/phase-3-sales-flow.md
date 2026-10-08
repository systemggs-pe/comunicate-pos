# Phase 3 — Sales core

Baseline: `master`, `1e58117`. Se extiende la arquitectura existente; no se reconstruye
Phase 1/2 ni se modifica la migración histórica.

## Relaciones y responsabilidades

```text
Client.id ← Sale.buyerId
Sale.id ← SaleEquipment.saleId
Equipment.id ← SaleEquipment.equipmentId
Client.id ← Equipment.ownerId
Equipment.id ← Imei.equipmentId
```

Client → Sale → SaleEquipment → Equipment → Imei mantiene una sola fuente canónica
para personas, dispositivos e identidades. Una venta almacena sus propios datos:
código, estado, método, descuento, total, notas, fechas y operador opcional.
SaleEquipment conserva unitPrice histórico, aunque se venda posteriormente a otro precio.
No se copian datos de cliente/equipo/IMEI dentro de Sale.

`buyerId` identifica quién compró. `ownerId` identifica de quién es el dispositivo.
Pueden ser distintos: comprador Brand, propietario Gianfranco. La ficha de cliente
separa ventas por buyerId de equipos por ownerId. Se reutilizan personas por DNI;
un borrador con DNI existente no sobrescribe sus contactos.

## Uso en tienda

1. Abrir Ventas → Nueva venta (`/ventas/nueva`). Buscar comprador por DNI/nombres/apellidos
   y seleccionar su ID, o completar un cliente nuevo con los campos de Phase 2.
2. Agregar uno o más equipos (máximo 20); eliminar filas antes de revisar si hace falta.
   Cada equipo tiene marca, modelo, serie opcional, uno/dos IMEIs y precio en soles.
3. El propietario predeterminado de un equipo nuevo es el comprador. Activar
   “Propietario distinto” para seleccionar o completar otra persona.
4. Elegir Efectivo, Yape, Plin, Tarjeta, Transferencia u Otro; ingresar descuento
   global y notas opcionales. No hay pagos parciales ni cuotas.
5. Revisar: el servidor comprueba todos los IMEIs, elegibilidad y totales sin escribir.
   El resumen muestra comprador, equipos, propietarios, IMEIs, precios y totales.
6. Confirmar: la API vuelve a validar y guarda toda la operación dentro de una transacción.
   Durante el envío se muestra “Procesando venta...” y se bloquean los controles;
   el hook existente también bloquea reentradas mediante una referencia síncrona.
7. El detalle muestra éxito, código visible, enlaces al cliente/equipos y Nueva venta.

IMEIs: exactamente 15 dígitos, UNIQUE global, slots 1/2 y valores diferentes. Repetidos
entre filas también se rechazan. Un IMEI ya asociado exige buscar/reutilizar el equipo;
no se infiere un dispositivo nuevo ni se fusionan equipos por similitud.

El alta desde ventas crea STORE/ACTIVE, con IMEIs NOT_REGISTERED, sin método/fecha de
registro. EXTERNAL sigue reservado al equipo traído por un cliente en Phase 2.
Comprar y registrar son procesos separados: la búsqueda global y el asistente de
Registros reutilizan después ese mismo equipo STORE y sus IMEIs.

También se puede seleccionar equipo de tienda existente por código/IMEI. Debe ser
STORE/ACTIVE y no tener una venta PENDING/COMPLETED activa. Conserva su propietario;
si carece de él, el contrato nuevo permite asignarlo. Esta opción no implementa
inventario avanzado ni transferencia automática de propiedad.

## Dinero

PostgreSQL utiliza Decimal(12,2). El servidor calcula con Prisma.Decimal; la UI usa
BigInt en céntimos para el estimado. Importes JSON son cadenas, máximo dos decimales,
sin signos negativos. Máximo de subtotal: 9,999,999,999.99. El descuento no puede
superar el subtotal. No se acepta total calculado por el consumidor.

```text
subtotal = suma(SaleEquipment.unitPrice)
total = subtotal - Sale.discount
```

Se persisten total y discount; subtotal se deriva como total + discount. Un trigger
diferido verifica al commit la igualdad con la suma de líneas y exige al menos una
línea. El descuento corresponde a la venta completa; no se reparte artificialmente
en las líneas ni se almacena finalPrice redundante. Ejemplo probado:
0.10 + 0.20 - 0.05 = 0.25, exactamente.

## Atomicidad y concurrencia

`createSalesService` reutiliza transaction, createEquipmentInTx, history y audit de
Phase 2. En una transacción serializable resuelve comprador/propietarios, valida
todos los IMEIs, crea equipos/IMEIs, venta/líneas, historial y auditoría. Un fallo en
el segundo propietario/equipo o en la FK del operador revierte las altas previas.
No quedan ventas, clientes, IMEIs, auditorías o dispositivos parciales.

La validación anticipada mejora el mensaje; UNIQUE de PostgreSQL protege la carrera.
La exclusividad parcial existente impide dos ventas activas para un equipo. El helper
reintenta P2034 hasta tres intentos; el conflicto restante responde 409 normalizado.
Los códigos visibles son únicos, pero pueden tener huecos por rollback de secuencias.

Los equipos nuevos generan EQUIPMENT_CREATED, OWNER_ASSIGNED, IMEI_ADDED y SOLD.
SOLD incluye saleId/saleCode en metadata y un enlace visible a la venta. Auditar y
registrar historial forma parte del mismo commit, no de una operación posterior.

## Cancelación

COMPLETED/PENDING → CANCELLED requiere confirmación explícita y motivo no vacío
(máximo 500 caracteres). No hay DELETE comercial ni reembolsos en esta fase.
Una segunda cancelación responde SALE_ALREADY_CANCELLED sin duplicar eventos.

Se conservan venta, líneas/precios, comprador, propietarios, equipos, IMEIs y todos
los eventos previos. Se agrega SALE_CANCELLED por equipo y auditoría CANCEL con motivo.
El trigger existente pone isActive=false para liberar únicamente la exclusividad de
venta activa. Equipment.status sigue ACTIVE: expresa vigencia, no stock disponible.
No se desasigna propietario ni se reinicia el estado de registro de IMEI, y no se
afirma que ocurrió una devolución física o de dinero. Una venta posterior puede
reutilizar equipmentId conservando las dos relaciones y precios históricos.

## Consultas y API

Todas las rutas siguientes requieren el acceso temporal privado existente:

| Método | Endpoint | Resultado |
|---|---|---|
| GET | `/api/sales` | Resúmenes paginados con comprador y cantidad de equipos |
| GET | `/api/sales/:id` | Comprador, operador opcional, líneas, equipos, propietarios e IMEIs |
| POST | `/api/sales/resolve` | Validación de equipos/IMEIs y totales sin altas |
| POST | `/api/sales` | Venta atómica, respuesta 201 |
| POST | `/api/sales/:id/cancel` | Cancelación confirmada y auditada |
| GET | `/api/dashboard` | Ventas COMPLETED, suma neta y equipos vendidos hoy en Lima |

Listado: q por código, DNI, nombre/apellido e IMEI exacto; status; from/to YYYY-MM-DD
inclusivos en America/Lima; offset/limit (20 por defecto, máximo 100). El dashboard
excluye PENDING/CANCELLED/REFUNDED y utiliza ceros reales si no hay ventas.

Ejemplo del contrato nuevo; sustituir IDs por entidades existentes:

```json
{
  "buyer": { "id": "00000000-0000-4000-8000-000000000001" },
  "items": [{
    "equipment": {
      "brand": "Samsung",
      "model": "S25 Ultra",
      "imeis": [
        { "slot": 1, "value": "359607654320001", "type": "PHYSICAL" },
        { "slot": 2, "value": "359607654320002", "type": "ESIM" }
      ]
    },
    "unitPrice": "3500.00"
  }],
  "paymentMethod": "YAPE",
  "discount": "0.00"
}
```

Referencias nuevas: `{ "client": { "dni": "60765432", "firstName": "Brand",
"lastName": "Peralta" } }` en buyer u owner del ítem. Equipo existente:
`{ "equipmentId": "UUID", "unitPrice": "3200.00" }`. El contrato anterior
buyerId/items.equipmentId conserva su compatibilidad y estado inicial PENDING.
La UI y el contrato nuevo usan COMPLETED por defecto.

Errores mantienen `{error:{code,message},message}`. Se distinguen SALE_NOT_FOUND,
SALE_ALREADY_CANCELLED, SALE_INVALID_STATUS, SALE_EMPTY, INVALID_PRICE, INVALID_TOTAL,
IMEI_ALREADY_EXISTS, CLIENT_NOT_FOUND, OWNER_NOT_FOUND y VALIDATION_ERROR, además
de conflictos de equipo, propiedad, FK y concurrencia. No se expone un stack o SQL.

## Alcance y evidencia

TEMPORARY AUTH continúa sólo en memoria de la pestaña. No autentica operador, sesiones
o roles; createdById es opcional y no representa identidad verificada. El detalle
lo indica cuando falta. No hay producción, push, despliegue, integraciones, PDF,
stock avanzado, devoluciones, pagos parciales o migración del POS anterior.

Pruebas y revisión visual: [phase-3-verification.md](phase-3-verification.md).
