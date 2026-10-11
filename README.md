# COMUNIC@TE POS

Phase 8: dashboard real y reportes en `/reportes`, filtros de Lima, CSV seguro y
permisos `reports.read` / `reports.export` (SUPERADMIN por defecto).
Documentación: [Dashboard y reportes](docs/phase-8-reports-dashboard.md).

Refinamiento operativo: tres estados por IMEI, ventas con equipos nuevos y eliminación definitiva autorizada. Acceso privado con usuarios, sesiones, roles, permisos y auditoría; ventas Cliente → Venta → Equipo → IMEI, compatible con Cliente → Equipo → IMEI → Registro sobre la fundación independiente del POS anterior. React, Vite, TypeScript,
Tailwind CSS, Lucide React, API Express, Prisma y PostgreSQL. No contiene migración
del sistema anterior ni integraciones comerciales.

## Requisitos

- Node.js 22.13 o superior (validado con Node 24).
- Docker Desktop con motor Linux y Docker Compose.
- Alternativa en Windows: PostgreSQL nativo descargado automáticamente al usar `-SinDocker` (317 MB).
- Puerto local 55432 disponible.

La URL local usa `127.0.0.1` explícitamente: el contenedor publica sólo IPv4 y
`localhost` puede resolverse a `::1` en Windows, produciendo errores P1001 intermitentes.

## Desarrollo local

### Inicio rápido en Windows

Inicia Docker Desktop y, desde la carpeta del proyecto, ejecuta:

```powershell
powershell -ExecutionPolicy Bypass -File .\iniciar-local.ps1
```

Si acabas de descargar el proyecto, instala primero Node.js 22.13 o superior y
ejecuta `npm install`. Con Node/npm disponibles también puedes usar `npm run local`.
El lanzador de Windows admite el Node incluido con Codex si no está en PATH.

El inicio copia `.env.example` sólo si falta `.env`, espera a PostgreSQL en Docker,
genera Prisma, aplica las migraciones pendientes y levanta frontend y API.
Abre <http://127.0.0.1:5173>. Si no existe un SUPERADMIN activo, crea uno local
con una contraseña aleatoria y guarda el acceso en `.local-admin.txt`, excluido
de Git. También respeta las variables privadas `ADMIN_NAME`, `ADMIN_EMAIL` y
`ADMIN_PASSWORD`. Si ya existe una cuenta administradora, conserva sus credenciales.

Usa Ctrl+C para detener frontend/API. La base persiste en el volumen de Docker;
puedes detenerla con `docker compose stop`.

El inicio automático sólo acepta
la base `communicate_pos` en el puerto local 55432. Si 5173 o el puerto de API
está ocupado, cierra el proceso anterior y vuelve a iniciar.

Para ejecutar sin Docker en Windows, usa
`powershell -ExecutionPolicy Bypass -File .\iniciar-local.ps1 -SinDocker`
o `npm run local -- --native`. Detén primero el contenedor con `docker compose stop`:
ambas opciones usan el puerto 55432 y bases independientes. La base nativa persiste
en `.local/postgres/data`, excluida de Git. Para detenerla:

```powershell
& '.\.local\postgres\runtime\pgsql\bin\pg_ctl.exe' -D '.\.local\postgres\data' -m fast -w stop
```

El runtime nativo se descarga de los [binarios oficiales distribuidos por EDB](https://www.enterprisedb.com/download-postgresql-binaries).

### Preparación manual

```powershell
npm install
Copy-Item .env.example .env
```

Configure `AUTH_ALLOWED_ORIGINS` con los orígenes exactos del frontend. En desarrollo
se admite localhost; en producción la lista es obligatoria y nunca debe contener `*`.
Después de aplicar las migraciones, defina en el entorno privado `ADMIN_NAME`,
`ADMIN_EMAIL` y `ADMIN_PASSWORD` (10–128 caracteres) y ejecute `npm run seed:admin`.
El script crea el primer SUPERADMIN; si ya hay uno activo, no altera ninguna cuenta.
No incluya credenciales reales en archivos versionados. Retire ADMIN_PASSWORD del
entorno una vez terminado el bootstrap. La pantalla `/login` usa correo/contraseña.
Las sesiones duran 12 horas, sobreviven a recargas y utilizan cookie HttpOnly.

```powershell
docker compose up -d
docker compose ps
npm run db:generate
npm run db:deploy
npm run seed:admin
npm run dev
```

Frontend: <http://127.0.0.1:5173>. API: <http://127.0.0.1:3001/api/health>.
Vite redirige `/api` al servidor local. La salud de API indica que el proceso responde,
no constituye una comprobación de disponibilidad de PostgreSQL.

La navegación depende de permisos. SELLER ve Inicio, Clientes, Equipos, Registros
y Ventas; SUPERADMIN también ve Usuarios, Roles y Auditoría.
Clientes permite listar/buscar/crear/editar y ver equipos asociados; equipo muestra
propietario, IMEIs independientes e historial. La búsqueda global por IMEI está
siempre visible. El asistente `/registros/nuevo` reutiliza entidades existentes
y guarda nuevas entidades y estados atómicamente. `/ventas/nueva` permite seleccionar o crear comprador, agregar hasta 20 equipos, asignar propietarios, revisar precios y confirmar una venta atómica. Vender no registra los IMEIs. El dashboard muestra ventas completadas del día en America/Lima.

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

Las rutas privadas requieren una sesión real y permisos verificados en backend.
Los cuerpos no pueden elegir userId/createdById/registeredById: el actor proviene de
la sesión. Argon2id protege contraseñas; sólo SHA-256 del token aleatorio de sesión
se almacena en PostgreSQL. Cookie HttpOnly, SameSite=Lax, Path=/; en producción
Secure y prefijo __Host-. No hay tokens en localStorage ni autenticación compartida.
Las mutaciones, incluido login, requieren un Origin exacto autorizado; clientes
HTTP internos deben enviarlo y conservar cookie. CORS sólo refleja orígenes permitidos.

| Método | Ruta | Operación |
|---|---|---|
| GET | `/api/health` | Salud pública de proceso |
| POST | `/api/auth/login` | Validar credenciales y emitir cookie de sesión |
| POST | `/api/auth/logout` | Invalidar sesión y limpiar cookie |
| GET | `/api/auth/me` | Usuario/rol/permisos seguros |
| GET / POST | `/api/users` | Listar / crear cuentas |
| GET / PATCH | `/api/users/:id` | Consultar / actualizar |
| POST | `/api/users/:id/disable`, `/enable`, `/reset-password` | Estado o contraseña; invalida sesiones |
| GET / PATCH | `/api/roles`, `/api/roles/:id` | Consultar roles / editar permisos protegidos |
| GET | `/api/audit` | Auditoría por usuario/acción/fecha |
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
| GET | `/api/dashboard` | Ventas, total neto y equipos vendidos hoy |
| POST | `/api/sales/resolve` | Comprobar equipos/IMEIs y calcular resumen sin escribir |
| GET / POST | `/api/sales` | Listado paginado / crear venta atómica |
| GET | `/api/sales/:id` | Venta, comprador, propietario, equipos e IMEIs relacionados |
| GET | `/api/{sales,registration-requests,equipment}/:id/deletion-preview` | Revisar dependencias y huella de confirmación |
| DELETE | `/api/{sales,registration-requests,equipment}/:id` | ELIMINAR, motivo y huella; transacción y permiso explícito |

Listados de clientes/equipos paginados: `q`, `offset`, `limit` (20 por defecto,
máximo 100). Clientes busca DNI/nombres; equipos busca código/marca/modelo/IMEI y
admite `ownerId`. Ventas admite `q` (código, DNI, nombre o IMEI exacto),
`from` y `to` (YYYY-MM-DD, fechas inclusivas en Lima), `offset` y `limit`.
La venta acepta `buyer: {id}` o `buyer: {client}` y cada línea requiere un equipo
nuevo: `items[].equipment` con uno o dos IMEIs únicos. No acepta `status`,
`items[].equipmentId`, cancelación ni reembolso. Conserva los accesorios y los precios.

El registro operativo nace PENDING con modalidad REGISTRATION, o BLOCKED con modalidad
BLOCKED. PENDING permite MARK_REGISTERED; BLOCKED permite UNBLOCK. Ambas acciones
confirmadas pasan solamente el IMEI objetivo a REGISTERED. BITEL es el operador por
defecto; referencia vacía usa el celular de cada solicitud. La numeración RECO de seis
dígitos usa secuencia PostgreSQL que no reutiliza números. Las condiciones antiguas
quedan históricas, fuera del formulario y del contrato operativo.

DELETE exige permiso específico (SUPERADMIN por defecto), resumen previo, huella,
texto ELIMINAR y motivo. Nunca elimina clientes. Un equipo con venta obliga a eliminar
la venta completa; una solicitud individual mantiene los demás IMEIs y solicitudes.
La auditoría de entidades borradas se purga y se conserva solo UUIDs, conteos y actor.
Consulta [la política y respaldo](docs/operational-refinement-analysis.md).

Moneda inicial: soles (PEN), importes JSON como cadenas decimales. `total` se calcula
en servidor a partir de las líneas menos el descuento de la venta. El subtotal
se deriva de total + descuento, protegido por un trigger diferido que comprueba
la suma de precios históricos. No aceptar totales del consumidor.

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
prisma/                → esquema y migraciones SQL versionadas
tests/unit/            → validaciones y HTTP
tests/integration/     → invariantes en PostgreSQL real
tests/e2e/             → Edge, flujo completo y pantallas responsive
docs/                  → decisiones y verificaciones
```

## Vercel, preparación para despliegue posterior

`vercel.json` prepara build de Vite, ruta `/api/*` a la función única y fallback SPA.
La función exporta la misma aplicación Express sin abrir un puerto. Prisma corre
exclusivamente en servidor y se genera durante el build. Configure `DATABASE_URL`
y `AUTH_ALLOWED_ORIGINS` con el dominio real del frontend en Vercel. Use PostgreSQL administrado compatible
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

## Phase 3

[Flujo de ventas](docs/phase-3-sales-flow.md) y
[verificación de Phase 3](docs/phase-3-verification.md).
La migración nueva `20261008000100_sales_core` añade YAPE/PLIN, descuento y notas;
no modifica la migración histórica de fundación. Para una base existente use
`npm run db:deploy`. No use `db push`.

El precio por equipo es histórico en SaleEquipment; los datos canónicos se leen
mediante FKs. El descuento corresponde a la venta, sin reparto artificial por línea.
Cancelar conserva comprador, propietario, equipo, IMEIs, precio e historial y libera
únicamente la exclusividad de venta activa. No ejecuta un reembolso ni devuelve
automáticamente el equipo al stock. No hay DELETE comercial de ventas.

E2E de ventas: `.test-results/phase-3-visual`, 8 pantallas en 1280/375/390/430 px.
Capturas y fixtures sólo locales; no se incluyen en Git ni en la base principal.
Phase 3 utilizaba acceso temporal; Phase 4 lo reemplaza por sesiones y actor real.

## Phase 4

COMUNIC@TE POS is a private single-company application.
It is not a SaaS or multi-tenant platform.

[Autenticación y matriz de permisos](docs/phase-4-auth-and-permissions.md),
[verificación de Phase 4](docs/phase-4-verification.md).
Nueva migración `20261008000200_auth_permissions`; las anteriores permanecen intactas.
Usuarios históricos sin credenciales quedan DISABLED, conservando ventas/historial.
El administrador puede asignar rol, restablecer contraseña y habilitarlos.

`npm run sessions:cleanup` elimina sesiones y contadores de login expirados.
No requiere cron para negar sesiones vencidas; programar limpieza operacional después.
El límite de login usa PostgreSQL y se comparte entre instancias. Express no confía
ciegamente en X-Forwarded-For: antes de desplegar, validar la topología real de proxy;
el límite por email seguirá funcionando y el bucket por IP puede agrupar clientes.
No se ha realizado despliegue ni verificado TLS/proxy en producción.

La gestión del último SUPERADMIN se protege mediante transacciones y bloqueo
administrativo común, incluso con cambios concurrentes. ADMIN no gestiona SUPERADMIN.
Editar permisos de ADMIN/SELLER requiere SUPERADMIN; invalidará las sesiones del rol.
La auditoría identifica actor real sin guardar contraseñas, hashes o tokens.
E2E y capturas de Phase 4 se guardan en `.test-results/phase-4-visual`, ignorado por Git.

## Phase 5 — Consulta DNI

[Arquitectura, configuración y pruebas](docs/phase-5-dni-automation.md).
Clientes, registros, comprador y propietario distinto comparten consulta DNI.
Primero PostgreSQL: los datos locales tienen prioridad y nunca se sobrescriben
con datos externos. Si no existe Client, se prellenan nombres editables y los
contactos se ingresan manualmente. La confirmación mantiene la creación canónica;
consultar no crea clientes. Una caída del proveedor permite continuar manualmente.

Desarrollo usa datos ficticios: DNI `12345678`, `12345679` o `12345680`;
`99999999` simula indisponibilidad. Configure DNI_PROVIDER, DNI_API_URL,
DNI_API_TOKEN, DNI_TIMEOUT_MS y DNI_CACHE_TTL_MS solo en servidor, según
`.env.example`. Nunca use variables VITE para credenciales. El adaptador API
está preparado y probado con fetch simulado; proveedor comercial real no verificado.
Sin cambio de esquema ni migración. Capturas: `.test-results/phase-5-dni`.

## Flujos operativos — Registros y ventas

[Análisis de diferencias](docs/workflow-gap-analysis.md) y
[modelo, operación y políticas](docs/operational-workflows.md).
Nueva migración `20261009000100_operational_workflows`: solicitudes por IMEI,
contacto histórico de atención, accesorios de venta y fecha comercial. Para la
base local existente ejecute `npm run db:deploy` o el arranque local habitual.
Las migraciones anteriores se conservan; no use db push.

`/registros` ofrece seguimiento y `/registros/nuevo` revisión explícita de cliente,
equipo, objetivos, condiciones y evidencias privadas opcionales. Registrar ambos IMEIs
crea dos solicitudes atómicas con celulares distintos. Realizar uno conserva
pendiente el otro. Las fotografías se almacenan permanentemente en MinIO privado conforme a Phase 7. Declaraciones A4 disponibles según Phase 6B.
Ventas conserva múltiples equipos y propietarios independientes, agrega accesorios
con cantidades/precios exactos y advierte IMEIs ya vendidos. DNI es el documento
actualmente habilitado; CE/pasaporte/RUC requieren una ampliación futura segura.
# Tickets térmicos y empresa (Phase 6A)

En **Configuración → Datos de la empresa**, SUPERADMIN puede guardar la información comercial y las preferencias de tickets en PostgreSQL. En ventas, **VER TICKET / IMPRIMIR / DESCARGAR PDF** permiten seleccionar 48 u 80 mm y abrir automáticamente una vista previa con impresión y descarga PDF. Las nuevas generaciones usan la configuración guardada sin reiniciar. Son tickets internos, sin facturación electrónica.

Consulta [la guía de impresión](docs/phase-6a-thermal-printing.md) para márgenes, diferencia entre papel y área imprimible, límites del navegador y pruebas físicas. Aplicar la nueva migración con el inicio local o `npm run db:deploy`. Compatibilidad física con impresoras: **NOT VERIFIED**.

## Phase 6B — Declaración jurada A4 por IMEI

Desde el detalle de cada registro, **GENERAR DECLARACIÓN JURADA** permite revisar,
confirmar y abrir un PDF A4 para ese IMEI, con descarga e impresión. El agente
debe tener nombre real y DNI de ocho dígitos en **Usuarios → Administrar**.
Un registro doble tiene dos declaraciones independientes. Aplicar la nueva
migración con `npm run db:deploy` o el inicio local habitual.

[Plantilla, validaciones y verificación visual](docs/phase-6b-declaration-template.md).
Se conserva la distribución del original con fuentes Lato de licencia abierta;
la diferencia tipográfica se documenta. El POS no realiza validaciones externas.

## Phase 7 — Evidencias fotográficas privadas

El registro ofrece DNI frontal/reverso, caja, boleta e IMEI lógico; ninguna foto
es obligatoria. Las imágenes comunes pueden compartirse explícitamente entre ambos
IMEIs. Cada IMEI lógico conserva una fotografía independiente. El expediente
permite consultar, descargar, reemplazar con confirmación y eliminar con permisos.
SUPERADMIN tiene acceso completo; ADMIN/SELLER requieren permisos explícitos.

Además de PostgreSQL, el desarrollo requiere MinIO Docker en 127.0.0.1:59000,
con volumen persistente separado. Agrega las variables S3 de `.env.example` a tu
`.env` existente, ejecuta `docker compose up -d --wait postgres minio`,
`npm run db:deploy`, `npm run evidence:provision` y `npm run dev`.
`npm run local` automatiza la preparación. PostgreSQL nativo también requiere
Docker para el almacenamiento de imágenes. MinIO se compila desde código fuente
oficial fijado; la primera construcción puede tardar varios minutos.

[Arquitectura, configuración, permisos, cleanup y limitaciones](docs/phase-7-evidence-storage.md).
[Reporte de verificación Phase 7](docs/phase-7-verification.md).
No ejecutar `docker compose down -v`: borraría los volúmenes persistentes.
Las pruebas de integración y E2E comparten fixtures dedicados: ejecutarlas
secuencialmente, nunca al mismo tiempo. Cámara física y producción: NOT VERIFIED.
