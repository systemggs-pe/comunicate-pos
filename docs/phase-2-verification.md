# PHASE 2 — CLIENTS + EQUIPMENT + IMEI REGISTRATION CORE

STATUS: PASS. Verificación local del 08/10/2026.

## Baseline y base

- Rama: master. Inicio: `26ffea4`, `chore: initialize communicate pos foundation`.
- Schema Prisma y migración histórica sin cambios respecto del baseline.
- No se requiere migración nueva; la migración de fundación está aplicada.
- `npx prisma migrate status`: una migración, Database schema is up to date.
- `npm run db:validate`: PASS. `prisma generate` dentro del build: PASS, 6.19.3.
- Docker PostgreSQL 16 local: healthy; puerto 127.0.0.1:55432.
- Integración y E2E exclusivamente en communicate_pos_test, con guard de hostname/nombre.
- Consulta de sólo lectura a communicate_pos: 0 clientes, equipos, IMEIs y ventas.
  Ningún fixture de esta fase se escribió en la base de desarrollo.

## Quality gates ejecutados

| Comando | Resultado final |
|---|---|
| npm test | PASS — 24 pruebas unitarias/API |
| npm run test:integration | PASS — 62 pruebas contra PostgreSQL real |
| npm run test:e2e | PASS — 1 recorrido completo, Microsoft Edge |
| Total | 87 pruebas, 0 fallos finales |
| npm run lint | PASS — 0 warnings |
| npm run typecheck | PASS; build también ejecuta tsc --noEmit |
| npm run build | PASS — Prisma + TypeScript + Vite |
| npm run db:validate | PASS |
| npx prisma migrate status | PASS |
| npm audit --audit-level=low | 0 vulnerabilidades |
| git diff --check | PASS |

El build emite dos avisos no bloqueantes de anotaciones PURE en Zod/Rollup y las
elimina; compila correctamente. Playwright emite el aviso de NO_COLOR/FORCE_COLOR
del entorno; no afecta sus resultados. Los avisos no se presentan como errores ocultos.

## Evidencia funcional

- Client: alta, DNI único y normalizado, búsqueda por DNI/nombres, edición de
  nombres/contactos, DNI inmutable, detalle con equipos por ownerId y paginación.
- Equipment: alta externa ACTIVE, uno/dos IMEIs, propietario correcto, código
  secuencial, búsqueda y detalle; edición limitada a marca/modelo/serie.
- Imei: índice único global, slots 1/2, valores distintos, seis estados independientes,
  método nullable, búsqueda canónica y registro idempotente.
- Registro: cliente nuevo/equipo nuevo, cliente existente/equipo nuevo, equipo
  existente/IMEI existente; preflight de ambos valores y revalidación transaccional.
- Conflictos: dos equipos distintos, propietario diferente, ownerId manipulado,
  slot ocupado, selección ajena, equipo esperado incorrecto y mezcla sin confirmar.
- Confirmación explícita permite añadir el segundo IMEI sólo al equipo correcto.
- PostgreSQL: UNIQUE, FKs, CHECKs, serialización, carreras y rollback real de
  cliente/equipo/IMEIs/historial/auditoría ante fallo posterior.
- Historial: creación, propietario, IMEIs, inicio/resultado independientes,
  rechazo, cancelación, actualización y equipo editado; timeline humano en UI.
- API: errores controlados `{error:{code,message}}`, sin stacks, no-store;
  códigos concretos comprobados en HTTP para duplicados, ausentes y owner mismatch.
- TEMPORARY AUTH: acceso verificado, token sólo en memoria, sin cookies ni storage;
  reload vuelve a Acceso temporal. No conexión productiva, push, deploy ni tags.
- Los servicios de ventas del baseline conservan sus pruebas de regresión;
  no se agregó UI de ventas ni se crean ventas al registrar IMEIs.

## Criterio E2E obligatorio

1. DNI nuevo → Brand Peralta → Samsung Galaxy S25 Ultra EXTERNAL, dos IMEIs.
2. Registrar sólo IMEI 1; IMEI 2 sigue NOT_REGISTERED; resumen Registro parcial.
3. Salir a Inicio y buscar IMEI 2; regresar exactamente al mismo Equipment.id.
4. Actualizar únicamente IMEI 2; ambos REGISTERED y mismo Client.id/ownerId.
5. Consultar DB: 1 cliente, 1 equipo, 2 IMEIs, 0 ventas; dos eventos IMEI_REGISTERED
   vinculados a los dos IDs IMEI distintos.
6. Cliente existente + equipo nuevo mantiene un cliente; IMEI existente + equipo
   existente mantiene dos equipos/tres IMEIs tras ese segundo caso.
7. Recorrer pantallas responsive; comprobar ausencia de errores React y pageerror.
8. Recargar cierra el acceso; localStorage y sessionStorage permanecen vacíos.

## Revisión visual

PASS en escritorio 1280x900 y viewports 375x900, 390x900 y 430x900 con Edge real.
44 capturas completas en `.test-results/visual` (ignoradas por Git), 11 por ancho:
clientes tabla/detalle/edición, equipos tabla/detalle-historial/edición, formulario
individual IMEI y cuatro pasos del asistente. Comprobación automática de ancho
scrollWidth <= viewport y revisión visual directa de pantallas de escritorio y
móvil: labels/inputs IMEI, selección, botones, navegación, tarjetas, tablas adaptadas,
detalle y eventos independientes. No hay modales en esta fase.

Las capturas son artefactos locales reproducibles con `npm run test:e2e`, no snapshots
de píxeles versionados ni una prueba de dispositivos físicos/iOS/otros motores.

## Incidencias detectadas y corregidas

- Nueve nuevas expectativas de prueba usaban rejects para validación síncrona:
  corregidas a toThrow; suite completa posterior PASS.
- Una corrida E2E perdió el acceso mientras se modificaban archivos; se repitió
  con servidores dedicados y sin modificaciones durante el recorrido.
- Claves React duplicadas al reiniciar búsqueda y página generaban duplicación del
  buscador: prefijos distintos y comprobación de errores de consola añadida; E2E PASS.
- Resultado de búsqueda retenía estado anterior tras guardar: se descarta al navegar
  o completar una mutación; capturas finales ya muestran el comportamiento corregido.
- Build simultáneo con integración produjo EPERM de DLL Prisma en Windows:
  generación/build repetidos sin proceso consumidor activo, PASS. No se borraron datos.

## Limitaciones deliberadas

Acceso compartido temporal sin identidad verificada/roles/sesiones finales.
Sin transferencia de propietario, catálogo avanzado, proveedores de registro,
ventas nuevas, producción ni integraciones externas. Paginación puede mostrar una
página siguiente vacía si la anterior contiene exactamente 20 filas. Método texto.
Confirmar pertenencia física del segundo IMEI sigue siendo responsabilidad del operador;
el sistema protege propietario/slots/unicidad y exige la confirmación explícita.

## Archivos de esta fase

Nuevos: ApiProvider, router, componentes comunes, hooks de lectura/envío, formularios
Client/Equipment/IMEI, EquipmentHistory, búsqueda global, RegistrationFlow, páginas
Inicio/Clientes/Equipos, tipos frontend, configuración y spec Playwright, documentos
de flujo y verificación. Modificados: README, arquitectura de datos, API, errores,
repositorio/servicio, validaciones compartidas, App, cliente HTTP, estilos, suites de
integración/API, Vite, package/lock y gitignore. Inventario exacto disponible en el commit.
