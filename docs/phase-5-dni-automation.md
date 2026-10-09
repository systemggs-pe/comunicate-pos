# Phase 5 — DNI automation + client data flow

## Base y alcance

Rama `master`, base de implementación `a6037ba`, descendiente de Phase 4
`acff326`. Se conservan el doble IMEI `c1f1da8` y el arranque local de Windows
`a6037ba`. No se modifica el modelo Client, esquema Prisma ni migraciones.
PostgreSQL sigue siendo la única fuente de verdad. No hay OCR ni integración
con comprobantes, PDF, OSIPTEL, WhatsApp ni múltiples empresas.

## Flujo y arquitectura

`GET /api/dni/:dni` exige sesión activa y al menos uno de `clients.create`,
`sales.create` o `registration.create`. Valida trim y ocho dígitos, preservando
ceros iniciales. El servicio busca Client por DNI en PostgreSQL **antes** de
consultar caché o proveedor. Si existe, devuelve `{ source: 'LOCAL', client }`
sin llamar al proveedor ni alterar nombres o contactos locales.

`server/dni/provider.ts` define DniProvider y errores seguros;
`providers.ts` contiene MockDniProvider, ApiDniProvider y createDniProvider;
`lookup.service.ts` valida, normaliza, controla plazos/reintentos y consulta local.
La aplicación admite inyección de proveedor y opciones para pruebas sin internet.
Un nuevo adaptador puede implementar la misma interfaz sin cambiar React.

Si no existe Client, un resultado válido produce
`{ source: 'EXTERNAL', data: { dni, firstName, lastName } }`. Se recortan extremos
y colapsan espacios, conservando Ñ, tildes y nombres/apellidos compuestos.
Se exige DNI coincidente y nombres/apellidos no vacíos (máximo 100 caracteres).
Se combinan paternalLastName y maternalLastName cuando falta lastName.
fullName solo no permite separar nombres de forma fiable: se rechaza.
Teléfono, correo y campos extra del proveedor no se reenvían ni se autocompletan.
Después de una respuesta externa se vuelve a buscar Client: una creación concurrente
local tiene prioridad incluso sobre el resultado recién obtenido.

Consultar no inserta Client ni genera AuditLog. La confirmación utiliza los
servicios comerciales existentes, DNI único y transacciones canónicas. La creación
real mantiene CLIENT_CREATED con actor autenticado; CLIENT_UPDATED no cambia.
Registro y venta continúan resolviendo referencias dentro de su transacción,
con rollback, Equipment, doble IMEI y propietario independiente conservados.

## Fallos, timeout, reintentos y caché

HTTP 400 devuelve DNI_INVALID para entrada inválida; 401/403 conservan el contrato
de autenticación/autorización. Los fallos de proveedor devuelven HTTP 200 con
`{ source: 'NONE', error: { code, message } }`, para permitir ingreso manual:

| Código | Situación |
| --- | --- |
| DNI_NOT_FOUND | Proveedor sin resultado / HTTP 404 |
| DNI_PROVIDER_UNAVAILABLE | Configuración ausente, conexión fallida o HTTP 5xx |
| DNI_PROVIDER_TIMEOUT | Consulta excede el plazo |
| DNI_PROVIDER_RATE_LIMIT | HTTP 429 |
| DNI_PROVIDER_INVALID_RESPONSE | HTTP 4xx distinto de 404/429, JSON inválido, DNI/nombres inválidos o cuerpo excesivo |

No se devuelven excepciones crudas, payloads ni credenciales. Hay máximo dos
intentos para indisponibilidad, timeout o rate limit, con backoff de 150 ms.
400/404/respuesta inválida no se reintentan. El plazo **total**, incluidos ambos
intentos y backoff, es 4000 ms por defecto; el primer intento usa aproximadamente
la mitad del presupuesto. AbortController cancela fetch y Promise.race protege
también frente a un adaptador que ignore la señal.

Caché únicamente en memoria del servidor, TTL 60000 ms, máximo 512 entradas,
expiración y expulsión de la entrada más antigua. Almacena resultados normalizados
y ausencia de resultado; los fallos temporales no se cachean. Solicitudes simultáneas
del mismo DNI comparten la consulta externa. PostgreSQL se consulta siempre primero.
No hay tabla, persistencia ni caché distribuida; cada instancia mantiene la suya.

## Configuración y proveedor real

Variables exclusivamente de servidor, documentadas en `.env.example`:

```dotenv
DNI_PROVIDER=mock
DNI_API_URL=
DNI_API_TOKEN=
DNI_TIMEOUT_MS=4000
DNI_CACHE_TTL_MS=60000
```

Sin configuración se usa mock en desarrollo; producción deshabilita el mock y
permite ingreso manual si falta una configuración real. `DNI_PROVIDER=api` activa
ApiDniProvider. Timeout configurable acotado a 100–10000 ms; se recomienda 3000–5000.
TTL acotado a 0–60000 ms; 0 deshabilita reutilización posterior de caché.

El adaptador API usa GET a DNI_API_URL agregando `?dni=12345678` (conserva otros
parámetros), `Authorization: Bearer DNI_API_TOKEN` y `Accept: application/json`.
Exige HTTPS; solo desarrollo admite HTTP localhost/127.0.0.1. No acepta credenciales
embebidas en URL ni sigue redirecciones. Limita la respuesta a 16 KiB antes de parsear.
El endpoint real debe devolver directamente este contrato JSON:

```json
{ "dni": "12345678", "firstName": "Ana María", "paternalLastName": "Muñoz", "maternalLastName": "Álvarez" }
```

Puede devolver lastName en lugar de ambos apellidos. 404 representa ausencia.
Servicios con envelopes/campos distintos necesitan su propio adaptador; esta fase
no integra un proveedor comercial específico ni implementa failover.

**REAL PROVIDER: NOT VERIFIED.** No hay URL ni credenciales reales configuradas.
No se envió ningún DNI a servicios externos. Fetch se prueba con respuestas simuladas.

Mock usa datos ficticios: `12345678` Ana María Muñoz Álvarez, `12345679` Luis Andrés
Pérez Rojas, `12345680` Lucía Elena Peña del Río. `99999999` simula indisponibilidad;
cualquier otro DNI devuelve ausencia (salvo que ya exista en PostgreSQL).

## UI compartida

`useDniLookup` y `DniClientFields` se reutilizan en `/clientes/nuevo`,
`/registros/nuevo`, comprador y propietario distinto en `/ventas/nueva`.
Consulta automática con debounce de 250 ms solamente con ocho dígitos válidos.
Se cancelan respuestas obsoletas al cambiar DNI. Una respuesta tardía no pisa
nombres escritos manualmente; celular/correo siempre se ingresan manualmente.

Se muestran Consultando DNI, Cliente encontrado (código/datos locales), Datos
encontrados con indicación discreta de consulta, ausencia/fallo con fallback y
Reintentar consulta DNI. Durante la espera es posible elegir Ingresar datos
manualmente. Los controles dependientes esperan la consulta; los campos manuales
siguen disponibles. Local oculta el formulario de alta y permite Usar cliente o
continuar el flujo existente. El proveedor nunca guarda automáticamente.

## Seguridad y verificación

React llama solo a la API interna autenticada. No hay VITE_DNI_API_TOKEN, token
en respuestas, logs de payload ni metadata de auditoría de proveedor. Se mantiene
la protección de origen/cookies y Cache-Control no-store de la API privada.
El cuerpo externo se reduce a DNI/nombres/apellidos antes de cruzar al frontend.

Pruebas con DB dedicada `communicate_pos_test` (nunca ejecutar integración y E2E
simultáneamente), proveedor mock/inyección/fetch simulado y usuario autenticado:

- Unit/API de adaptador: normalización, errores HTTP, timeout, reintentos,
  caché/expiración/concurrencia, prioridad local y descarte de contactos/token.
- Integración de endpoint: sesión/permisos OR, DNI inválido, ausencia de altas
  anticipadas, actor real, duplicados, registros, compradores y propietarios.
- E2E: cliente nuevo/local/manual; registro con contactos y doble IMEI y reutilización;
  venta con buyer distinto de owner; fallback; correcciones y respuestas obsoletas.
- Responsive: tres formularios, 1280/375/390/430 px, loading/autofill/fallback,
  comprobación de overflow y 36 capturas en `.test-results/phase-5-dni` ignoradas.
- Regresión completa de auth, permisos, auditoría, clientes, equipos, IMEI,
  registros, ventas, varias líneas y rollback en las suites existentes.

Resultados ejecutados el 2026-10-09: 102 unitarias (36 nuevas de DNI),
197 de integración/API (12 nuevas de DNI) y 20 E2E (9 nuevas de DNI):
319 pruebas aprobadas, incluyendo la regresión existente. Lint, TypeScript,
build, prisma validate y prisma generate aprobados; PostgreSQL Docker healthy.
npm audit: 0 vulnerabilidades en todas las severidades. Se construyó el frontend
con una credencial ficticia de control en DNI_API_TOKEN y se comprobó su ausencia
en dist. Las 36 capturas se revisaron en hojas de contacto; no hubo overflow.

Build emitió dos avisos de Rollup por comentarios @__PURE__ de Zod en
core/util.js y core/regexes.js; elimina esas anotaciones y termina correctamente.
No se modifican dependencias para silenciar avisos fuera del alcance.
No se hace push, deploy ni tags. La integración comercial real permanece pendiente
de configurar credenciales y verificar el contrato del proveedor elegido.
