# Verificación reproducible Phase 4

Código final: `67875fe`. Runner privado: .local/phase4-runner.mjs; fuente reproducible en evidence/phase4-runner.mjs.source.txt. Antes de cada prueba verifica DATABASE_URL=TEST_DATABASE_URL de la base communicate_pos_test en loopback 55438; endpoint S3 loopback 59040; contenedores, propósito p2-remediation, proyecto propio, puertos y volúmenes nuevos. Los servicios propios están ahora detenidos y los volúmenes conservados: no ejecutar las suites contra otro perfil para sortear el preflight.

## Comandos y resultados

- Prisma migrate deploy sobre base nueva: 19 aplicadas. Antes: diff exit 2, SQL sólo inspeccionado; después de representar SQL en schema: diff exit 0/empty migration. Prisma validate exit 0.
- Vitest `--project unit tests/unit/registration-share.test.ts`: 10/10; `codart.test.ts`: 39/39; `receipts.test.ts`: 12/12.
- Vitest integración por hallazgo: refinement 31/31; migration-contract 2/2; codart/client-vault/registration-identity-required 30/30; historical-imei 5/5.
- Vitest unit global: 317/322 inicial; los cinco errores fueron el alias Python, no aserciones funcionales fallidas. Con PDF_TEST_PYTHON apuntando al intérprete disponible y PYTHONUTF8=1, declaration/evidence-pdf completos 10/10 PASS. Consolidación sustituye los resultados completos de esos archivos, preservando 322 casos incluidos los parametrizados con el mismo título. No contar 322+10 como cobertura distinta.
- Vitest integración regresión: pos, sales, workflow, dual-imei, receipts, declaration, evidence-pdf, auth y scanner-protection: 234/234 PASS. Unión con suites enfocadas: 302 casos, sin sumar repetidos.
- Playwright receipts + audit-p2: 6/6 PASS, omitidos/flaky 0. APIs web de prueba 3002 y Vite 5175 detenidos por el runner de Playwright al concluir; no se usó la aplicación habitual 3001/5173. El caso UI de fotos usa interceptación sintética y prueba ausencia de POST automático + elección/confirmación por foto; la API/storage real aislada se comprueba en integración.
- ESLint `--max-warnings 0`: exit 0. TypeScript `--noEmit`: exit 0. npm ci en copia nueva con node_modules propios: exit 0, 476 paquetes/23 s observados; stdout completo de instalación no preservado. No hubo actualización deliberada de dependencias; se usó lockfile existente.
- npm run build oficial en copia limpia: exit 0, incluye prisma generate/tsc/Vite. npm run build:api exit 0. Se compararon 315 archivos de entrada con la copia: ninguna diferencia, sin compartir node_modules ni .env. Los mensajes npm de deprecación/allowScripts observados durante instalación no se ocultaron como fallos funcionales ni motivaron actualizaciones ajenas.

Los reportes JSON/log nativos en evidence contienen comandos, fechas, casos y exit codes. Fuente de contadores: verification-summary.json. El último control fallido de setup no se convierte retroactivamente en un PASS: migrations.log, aud06-integration.json, aud08-unit.json y unit-regression.json conservan los errores y sus resultados finales se guardan aparte. Los logs pueden normalizar finales de línea/espacios, sin cambiar exit codes ni mensajes.

## Límites

No se repitió toda la suite histórica de 770. No se ejecutaron reinicios de storage, simulacro restore/cloud ni hardware ajenos a P2. No se consume CODART/Gemini/Google real ni se declara su contrato probado. La plantilla y medidas térmicas se comprueban en PDF/navegador, no con impresora física. No se sanearon IMEI ni se reclasificaron fotos comerciales; son actuaciones caso por caso pendientes.

Todos los comandos comerciales de escritura están fuera de este procedimiento. Las fuentes operativas requieren recrear un entorno de prueba independiente; nunca reemplazar sus guardas por URLs comerciales. Evidencia de preservación/retención de recursos: service-preservation.json. SHA256SUMS usa bytes UTF-8 LF de Git y excluye su propio archivo.
