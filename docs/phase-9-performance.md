# Phase 9 — Rendimiento medido

## Frontend: comparación equivalente

Build Vite 7.3.7, mismo lockfile/dependencias y configuración de compresión. `scripts/measure-bundle.mjs` suma el entry y TODOS sus imports estáticos recursivos del manifest; excluye imports dinámicos hasta navegar. No comparar sólo un chunk dejando dependencias fuera.

| JavaScript inicial | Baseline 1e12910 | Final Phase 9 |
|---|---:|---:|
| Bytes sin compresión | 539.624 | 338.006 |
| Bytes gzip | 155.189 | 103.923 |

Reducción medida: 37,36% sin compresión y 33,03% gzip. No equivale a ese porcentaje de mejora del tiempo percibido; no se midió red móvil real ni Core Web Vitals productivos. Las rutas de formularios, reportes, usuarios, roles, configuración y tickets ahora se importan al navegar. Charts/PDF ya eran cargas dinámicas; no se atribuye ese trabajo anterior a Phase 9. Suspense muestra carga, boundary de página permite reintentar conservando navegación. No se eliminaron Zod, validaciones, diagramación ni textos de los PDFs.

El warning de entry >500 kB desapareció por reducción real, no por elevar `chunkSizeWarningLimit`. Se conservan dos avisos upstream de comentarios PURE en Zod: Rollup retira anotaciones de comentarios mal colocadas. Dependencias y lockfile no fueron actualizados sin necesidad. Un release debe conservar assets antiguos o dirigir un error de chunk a recarga, como hace el boundary.

Reproducción: `npx vite build`, `npm run bundle:measure -- final`. JSON en `.test-results/phase9/bundle-final.json`; para repetir baseline, usar checkout aislado del commit inicial, nunca resetear el trabajo actual. Cambiar código/hash puede cambiar unos bytes sin cambiar estrategia.

## API local

Medición HTTP real en servidor loopback, PostgreSQL 16 y MinIO, concurrencia 4. Fixture separada `communicate_pos_phase9_load` / `communicate-evidence-phase9-load`: 1.000 clientes, 40 equipos, 80 IMEIs, 20 ventas, 40 solicitudes y foto compartida. No consultar DNI externo. Por escenario: 20 solicitudes; login 4 para no desactivar su rate limiter. Descarga mide autorización más GET físico del archivo. Datos del equipo propio, tamaño de imagen pequeño: no representa todas las cargas posibles.

| Escenario | p50 antes ms | p95 antes ms | p50 después ms | p95 después ms |
|---|---:|---:|---:|---:|
| Clientes | 11,54 | 43,02 | 16,81 | 63,35 |
| Búsqueda IMEI | 14,66 | 39,41 | 20,78 | 46,79 |
| Ventas | 14,66 | 17,28 | 21,53 | 35,81 |
| Registros | 34,92 | 50,51 | 32,50 | 49,70 |
| Dashboard | 20,76 | 54,02 | 25,00 | 45,98 |
| Reportes | 18,22 | 22,51 | 21,54 | 27,74 |
| Login | 109,48 | 122,19 | 109,58 | 125,14 |
| Foto autorizada | 21,84 | 38,13 | 28,29 | 57,00 |

En ambas ejecuciones: 144 solicitudes, 144 respuestas HTTP 200, cero errores, cero consultas ≥100 ms. RSS máximo observado en el proceso Node: 200,06 MiB antes / 190,43 MiB después. Incluye runtime y efectos de setup; no se atribuye la diferencia de RSS a una optimización ni mide memoria del contenedor PostgreSQL/MinIO. Resultados JSON guardan máximos, p50/p95, conteo de SQL por ruta, RSS y hora; nunca texto/params SQL.

La consulta del límite persistente agrega aproximadamente un SQL por operación protegida. No presentar el conjunto como una mejora general del backend: algunas rutas aumentaron tiempos por ese control y variabilidad de medición. Un cliente S3 por servicio elimina construcción duplicada; no se afirma ahorro porcentual no aislado. Los listados siguen paginados y reportes usan agregaciones parametrizadas/RepeatableRead; no se añaden índices sin evidencia. Búsqueda exacta de DNI/IMEI tiene índice único, más nueve índices de analytics ya presentes en Phase 8.

Presupuesto inicial de regresión local: p95 de cada escenario ≤máximo(250 ms, 2×p95 baseline), sin errores. Se eligió 250 ms como margen local del mayor p95 medido (~122 ms), no como SLA comercial. Las ocho rutas cumplen en esta medición. Revisar tras medir red, región, pool y volumen reales. Perfil pequeño y moderado: no prueba saturación, miles de usuarios, escalado serverless, cold starts ni rendimiento de archivos de 10 MiB.

Reproducción: `npm run test:load -- final` reutiliza exclusivamente la fixture sintética validando sus conteos; no modifica registros operativos. Ejecutarlo sin otras pruebas/cargas concurrentes. No usar `baseline` después de modificar código y etiquetarlo como commit inicial. Login y exportación tienen cupos diferentes; prueba explícita de 16 exportaciones concurrentes comprueba 10×200, 6×429 y Retry-After.

## UI y documentos

Regresión Playwright cubre 1280, 375, 390 y 430 px, flujos aprobados, modales, errores, doble clic/idempotencia, tablas, descarga, cámara simulada y PDFs. `npm run test:production-ui` sirve el build real con cabeceras estáticas de Vercel en loopback y prueba 12 rutas a cuatro anchos (48 comprobaciones adicionales, no sumadas como casos de Vitest/Playwright). Guarda capturas en `.test-results/phase9/responsive`. Eso verifica carga de chunks y layout con CSP, no DNS/HTTPS/CDN ni hardware.
