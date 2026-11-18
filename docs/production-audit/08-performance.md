# Rendimiento y capacidad

19/10/2026, America/Lima. HEAD `2751768cf07febf2e0ea7287cf34161fcb445239`. Auditoría sin correcciones.

## Frontend y backend

Bundle Vite emitido en ~10.45 s y backend esbuild generado. No equivalen a superar tsc/build oficial. Index 351.31 kB (107.71 gzip); gráficos diferidos 157.85 kB, recibos ~78.93 kB, PDF ~387.50/437.62 kB, además de chunks jsPDF/html2canvas. No es Core Web Vitals sobre móvil físico.

Revisados lazy imports, paginación, límites de exportación, imágenes bajo demanda y abort/caché. No hay perfil prolongado de memoria ni benchmark de render con miles de filas visibles.

## Carga aislada

Conjunto: 1002 clientes, una venta, cuatro equipos, tres RECO. Concurrencia cuatro, veinte solicitudes por escenario, API local 3004.

| Escenario | HTTP | p50 ms | p95 ms | p99 ms |
|---|---|---:|---:|---:|
| Clientes | 20×200 | 18.95 | 42.49 | 44.28 |
| Ventas | 20×200 | 24.62 | 32.83 | 40.92 |
| Registros | 20×200 | 28.28 | 33.96 | 34.91 |
| Reporte general | 20×200 | 32.91 | 67.41 | 68.51 |
| IMEI existente | 20×200 | 36.22 | 66.64 | 86.75 |

Un primer IMEI sintético no existía y produjo veinte 404. Se conserva como búsqueda negativa, no como éxito de consulta positiva. Solo ese escenario se repitió con un IMEI existente. Total: 120 solicitudes de medición, fuera del conteo de tests únicos.

Conductor: ~105.09 MiB RSS; ~141000 µs CPU usuario/31000 sistema. **Son del conductor, no de API/PostgreSQL.** CPU/RSS del servidor, saturación/pool, carga de escrituras/PDF/fotos y latencias de proveedores: NOT VERIFIED. Una prueba de idempotencia simultánea no es un benchmark de ventas por segundo.

Definir volumen/concurrencia/SLO; repetir en staging con conjunto representativo y límites seguros, instrumentar servidor/pool/consultas/CPU/memoria. No extrapolar esta muestra al plan cloud. El benchmark phase9 anterior no se reutilizó: fija perfil local y contiene IMEI anteriores a Luhn.
