# Verificación de la fase 1

Validación final retomada el 8 de octubre de 2026 (America/Lima).

## Alcance

Fundación creada desde cero. No se reutilizó código del POS anterior. No se realizó
push, despliegue ni conexión a una base productiva.

Los modelos y servicios están implementados. La interfaz contiene navegación base,
estados vacíos y salud de API; formularios comerciales, sesiones de usuario y roles
pertenecen a fases posteriores. La API comercial requiere un token privado temporal
y falla cerrada sin configuración válida.

## Incidencias observadas durante la preparación

- Docker instalado pero detenido: se inició Docker Desktop.
- Puerto 5432 ocupado: este proyecto usa 127.0.0.1:55432, sin cambiar el otro servicio.
- Inicialización de PostgreSQL lenta: el primer intento de migración falló antes de
  que la base aceptara conexiones. Posteriormente la migración inicial se aplicó.
- Primera auditoría npm: nueve avisos de seguridad. Se seleccionaron versiones y
  overrides corregidos; la instalación posterior reportó cero vulnerabilidades.
- Primera configuración de Vitest: opción fileParallelism en nivel incorrecto;
  se movió al nivel global.
- Una prueba HTTP inicial superó cinco segundos con el equipo bajo carga; se fijó
  timeout de treinta segundos. La suite posterior pasó.
- Prisma generate en Windows: EPERM al intentar reemplazar una DLL cargada por
  otro proceso del proyecto. Se detuvieron los consumidores antes de repetir build.
- Inspección visual del navegador: dos timeouts de la herramienta. No se da por
  verificada la apariencia en navegador. El preview compilado sí respondió HTTP 200.
- Al retomar la sesión, Docker estaba detenido y no existían los procesos anteriores.
  Se inició nuevamente y se repitieron las comprobaciones finales.
- PostgreSQL inició recuperación de su volumen tras el cierre de la sesión anterior.
  Se observaron esperas reales de fsync en disco. La limpieza de fixtures usa DELETE
  dentro de una transacción para evitar la recreación de archivos de TRUNCATE en
  cada caso; no se desactiva persistencia, fsync, restricciones ni triggers.
- Se reprodujo P1001 al usar localhost durante preparación de la base de pruebas.
  Windows resolvía localhost también a ::1 mientras el puerto de Compose sólo está
  publicado en IPv4. Las URLs locales se ajustaron a 127.0.0.1 explícito.

## Resultados finales

| Comprobación | Resultado de la versión final |
|---|---|
| npm install | PASS, lockfile generado |
| npm run lint | PASS, cero errores y warnings de lint |
| npm run build | PASS, incluye Prisma generate, TypeScript y Vite |
| npm test | PASS, 18 pruebas en dos archivos |
| npm audit | PASS, cero vulnerabilidades (producción y desarrollo) |
| PostgreSQL healthy | PASS, PostgreSQL 16.15 en 127.0.0.1:55432 |
| Persistencia tras reinicio controlado | PASS, migración y dos IMEIs de prueba registrados conservados |
| Migraciones reproducibles | PASS, inicial aplicada en ambas bases y deploy sin pendientes |
| npm run test:integration | PASS, 19 pruebas con PostgreSQL real en 27.96 segundos |
| Inspección visual en navegador | NOT VERIFIED, herramienta agotó su timeout |
| Despliegue Vercel | NOT VERIFIED, excluido expresamente de esta fase |

Build frontend: JS 228.45 kB (71.85 kB gzip), CSS 7.98 kB (2.47 kB gzip).
Prisma Client 6.19.3 se generó correctamente. La DLL no estaba cargada por una
API en ejecución durante este build final. El `.env` local contiene un token
generado aleatoriamente y se verificó que Git lo ignora.

Las 37 pruebas aprobadas incluyen las ocho reglas mínimas solicitadas, validación
en API y base, estados independientes, reutilización de cliente/equipo, registro
posterior del segundo IMEI, rollback de cliente/equipo/IMEIs/historial/auditoría,
concurrencia, separación comprador/propietario, montos decimales exactos, exclusividad
de ventas y códigos de más de seis dígitos. No se usaron mocks de PostgreSQL.

## Inventario de entrega

38 archivos nuevos: frontend base, API Vercel/local, servicios, repositorio, Prisma,
validaciones compartidas, migración SQL inicial, Compose, scripts, pruebas y documentos.
No se modificaron archivos preexistentes porque la carpeta estaba vacía.
Git se inicializó localmente; el commit de fundación no se envía a ningún remoto.

La revisión visual y el despliegue remoto siguen expresamente sin verificar.
El estado PASS corresponde a la fundación y a los checks locales solicitados,
no a una habilitación comercial en producción.
