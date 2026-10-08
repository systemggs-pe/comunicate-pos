# COMUNIC@TE POS

Fase 2: núcleo funcional Cliente → Equipo → IMEI → Registro sobre la fundación independiente del POS anterior. React, Vite, TypeScript,
Tailwind CSS, Lucide React, API Express, Prisma y PostgreSQL. No contiene migración
del sistema anterior ni integraciones comerciales.

## Requisitos

- Node.js 22.12 o superior (validado con Node 24).
- Docker Desktop con motor Linux y Docker Compose.
- Puerto local 55432 disponible.

La URL local usa `127.0.0.1` explícitamente: el contenedor publica sólo IPv4 y
`localhost` puede resolverse a `::1` en Windows, produciendo errores P1001 intermitentes.

## Desarrollo local

```powershell
npm install
Copy-Item .env.example .env
```

Cambie `API_ACCESS_TOKEN` en `.env` por un valor aleatorio de al menos 32 caracteres.
Es una clave privada temporal, nunca una variable `VITE_` ni un secreto incluido en el bundle.
Para usar la UI local, ingrésela en Acceso temporal. Se verifica con `/api/access`
y permanece sólo en memoria hasta recargar/cerrar la pestaña. **TEMPORARY AUTH**;
no hay sesiones definitivas ni identidad por operador.

```powershell
docker compose up -d
docker compose ps
npm run db:generate
npm run db:migrate
npm run dev
```

Frontend: <http://127.0.0.1:5173>. API: <http://127.0.0.1:3001/api/health>.
Vite redirige `/api` al servidor local. La salud de API indica que el proceso responde,
no constituye una comprobación de disponibilidad de PostgreSQL.

La navegación funcional incluye Inicio, Clientes, Equipos y Nuevo registro.
Clientes permite listar/buscar/crear/editar y ver equipos asociados; equipo muestra
propietario, IMEIs independientes e historial. La búsqueda global por IMEI está
siempre visible. El asistente `/registros/nuevo` reutiliza entidades existentes
y guarda nuevas entidades y estados atómicamente. No se amplía el módulo de ventas.

## Validaciones y pruebas

```powershell
npm run db:validate
npm run lint
npm run typecheck
npm run build
npm test
npm run db:test:prepare
npm run test:integration
npm run test:e2e
```

En Windows, detenga `npm run dev` antes de ejecutar `prisma generate`, migraciones
o build: el motor DLL de Prisma puede permanecer bloqueado por un servidor abierto
y producir `EPERM`. Termine ese proceso y repita el comando; no borre datos.

Las pruebas de integración usan **PostgreSQL real** en `communicate_pos_test`.
El script crea esa base local si falta y aplica las mismas migraciones.
Cada prueba vacía exclusivamente las tablas de esa base dedicada. El guard exige
hostname local y nombre exacto; nunca use una URL productiva para pruebas.
`npm test` ejecuta sólo las pruebas unitarias y de frontera HTTP, sin requerir base.

## API privada

Todas las rutas comerciales requieren `Authorization: Bearer <API_ACCESS_TOKEN>`.
Si falta configuración, la API deniega el acceso. El token temporal permite probar
la fundación; no representa autenticación por usuario ni roles. `User` está preparado
para una siguiente fase. No habilitar uso comercial multiusuario hasta implementar
sesiones y autorización. `userId` y `createdById` son referencias opcionales para
consumidores internos confiables, no una identidad verificada del operador.

| Método | Ruta | Operación |
|---|---|---|
| GET | `/api/health` | Salud pública de proceso |
| GET | `/api/access` | Comprobar clave temporal, sin sesión |
| PATCH | `/api/clients/:id` | Editar nombres/contacto, DNI inmutable |
| PATCH | `/api/equipment/:id` | Editar marca/modelo/serie |
| POST | `/api/registrations/resolve` | Comprobar todos los IMEIs sin altas |
| POST | `/api/registrations` | Registro múltiple atómico con reutilización |
| GET / POST | `/api/clients` | Listado / crear cliente |
| GET | `/api/clients/by-dni/:dni` | Buscar DNI |
| GET | `/api/clients/:id` | Obtener cliente |
| GET / POST | `/api/equipment` | Listado / crear equipo |
| POST | `/api/equipment/external` | Alta externa transaccional |
| GET | `/api/equipment/by-imei/:value` | Buscar equipo por IMEI |
| GET | `/api/equipment/:id` | Equipo, propietario, IMEIs y estado derivado |
| POST | `/api/equipment/:id/imeis` | Agregar segundo IMEI |
| GET | `/api/equipment/:id/history` | Trazabilidad |
| PATCH | `/api/imeis/:value/registration` | Actualizar sólo el IMEI |
| POST | `/api/registrations/external` | Buscar primero; crear sólo si es desconocido |
| GET / POST | `/api/sales` | Listado / crear venta |
| GET | `/api/sales/:id` | Venta con líneas relacionadas |

Listados de clientes/equipos paginados: `q`, `offset`, `limit` (20 por defecto,
máximo 100). Clientes busca DNI/nombres; equipos busca código/marca/modelo/IMEI y
admite `ownerId`. Las rutas de ventas conservan el comportamiento de Phase 1.
Moneda inicial: soles (PEN), importes JSON como cadenas decimales. `total` se calcula
en servidor a partir de las líneas. No aceptar totales del consumidor.

Ejemplo para IMEI conocido:

```json
{
  "value": "351111111111111",
  "registration": { "status": "REGISTERED", "method": "MANUAL" }
}
```

Para un IMEI desconocido, incluya `newEquipment`:

```json
{
  "value": "351111111111111",
  "registration": { "status": "PENDING", "method": "MANUAL" },
  "newEquipment": {
    "client": { "dni": "00123456", "firstName": "Ana", "lastName": "Pérez" },
    "brand": "Samsung",
    "model": "S26 Ultra",
    "imeis": [
      { "slot": 1, "value": "351111111111111", "type": "PHYSICAL" },
      { "slot": 2, "value": "352222222222222", "type": "ESIM" }
    ]
  }
}
```

La alta externa explícita rechaza IMEIs existentes con 409 para evitar enlazar
accidentalmente dispositivos distintos. El endpoint de registro busca primero y
actualiza únicamente el IMEI existente. Un conflicto concurrente de unicidad responde
409 y no deja cambios parciales; el consumidor puede volver a buscar por IMEI.

## Estructura

```text
src/app, src/services   → navegación, acceso temporal y cliente HTTP
src/features, src/pages → formularios, búsquedas, detalle y asistente
shared/                → validaciones y cálculos puros, sin Prisma
api/index.ts           → entrada Vercel
server/app.ts          → HTTP y guardia de acceso
server/services/       → reglas y transacciones
server/repositories/   → consultas relacionadas
server/db/             → Prisma reutilizable por proceso
prisma/                → esquema y migración SQL inicial versionada
tests/unit/            → validaciones y HTTP
tests/integration/     → invariantes en PostgreSQL real
tests/e2e/             → Edge, flujo completo y pantallas responsive
docs/                  → decisiones y verificaciones
```

## Vercel, preparación para despliegue posterior

`vercel.json` prepara build de Vite, ruta `/api/*` a la función única y fallback SPA.
La función exporta la misma aplicación Express sin abrir un puerto. Prisma corre
exclusivamente en servidor y se genera durante el build. Configure `DATABASE_URL`
y `API_ACCESS_TOKEN` como secretos de Vercel. Use PostgreSQL administrado compatible
con TLS y pooler; ajuste `connection_limit` al proveedor y número de instancias.
El singleton evita duplicación por hot reload, pero no es un pool global entre funciones.

Ejecute `npm run db:deploy` en un paso controlado de release contra la base destino;
no ejecutar `migrate dev` ni migraciones automáticas en cada invocación o preview.
Si el pooler no permite DDL, ejecute ese comando con `DATABASE_URL` directa temporal.
No se ha conectado una base productiva, publicado ni desplegado este proyecto.
La configuración está preparada; un despliegue real sigue pendiente de verificación.

Referencias: [Vite en Vercel](https://vercel.com/docs/frameworks/frontend/vite),
[migraciones SQL personalizadas en Prisma](https://docs.prisma.io/docs/orm/prisma-migrate/workflows/customizing-migrations).

Consulte [docs/database-architecture.md](docs/database-architecture.md) para las
restricciones y [docs/verification.md](docs/verification.md) para los resultados ejecutados.

## Phase 2

[Flujo y casos](docs/phase-2-registration-flow.md),
[verificación de Phase 2](docs/phase-2-verification.md).
No hay cambios al esquema ni a la migración histórica. Errores API normalizados
con `error.code` y `error.message`; se mantiene `message` superior por compatibilidad.
E2E requiere Microsoft Edge instalado, usa backend 3002/Vite 5175 y DB local
`communicate_pos_test`. No ejecutar E2E e integración simultáneamente: ambas
limpian únicamente esa DB dedicada. Capturas ignoradas: `.test-results/visual`.
