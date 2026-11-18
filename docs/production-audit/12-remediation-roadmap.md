# Roadmap propuesto de remediación

19/10/2026, America/Lima. HEAD auditado `2751768cf07febf2e0ea7287cf34161fcb445239`. Sin correcciones funcionales.

Este plan **no fue implementado**. Requiere autorización posterior para corregir código; recursos externos, históricos y despliegue necesitan su autorización correspondiente.

## Fase 1 — Críticos y contención

No se confirmó un P0. Mantener congelada la salida a producción, conservar evidencia y secretos fuera de los reportes. Cualquier exposición/corrupción crítica confirmada se trata antes del resto. Responsable sugerido: líder técnico y dueño de operación.

## Fase 2 — Altos

1. AUD-01: resolver 12 diagnósticos y obtener build oficial reproducible. No omitir tsc.
2. AUD-02: regla DNI derivada en servidor; caso negativo de bypass y positivo de reutilización, sin filas parciales.
3. AUD-03: fixtures Luhn válidos, históricos inválidos deliberados solo para lectura, expectativas UI actualizadas; investigar cada fallo restante.
4. AUD-04: perfil de recuperación verdaderamente aislado, sin retirar allowlists, y ejecutar ruta del producto con objetos compartidos, sesiones/checksums.
5. AUD-05: responsables de infraestructura, custodia, backup, alertas y rollback; demostración en staging.

No se estima plazo sin dimensionar tareas. Criterio de salida: P1 cerrado con evidencia o aceptación formal excepcional de riesgo no crítico, según política; ausencia de recuperación no es un detalle menor.

## Fase 3 — Medios y mantenimiento

Provincia en compartir; conciliación Prisma/SQL; clasificación CODART probada o confirmada; configuración coherente con ticket aprobado. Históricos: revisión caso por caso autorizada, nunca arreglar dígitos automáticamente. Áreas táctiles del encabezado como mantenimiento P3.

Cada arreglo debe conservar reproducción anterior/comprobación posterior y casos negativos. Actualizar fixtures no demuestra por sí solo que se corrigieron todos los problemas. No sumar reintentos como cobertura nueva.

## Fase 4 — Verificaciones externas

Google/Gemini/CODART con permisos y presupuesto explícitos, datos sintéticos cuando se admita. Revisión especializada de privacidad, contratos, finalidad, retención y transferencias. DNS/TLS/cookies reales, storage privado/TTL/cifrado, backups externos y alerta recibida. Cámara, lector e impresoras físicas 58/80/A4.

Definir volumen/concurrencia/SLO, RPO/RTO, retención y presupuesto. La muestra local no fija compromisos operativos.

## Fase 5 — Release controlado

HEAD inmutable, instalación/build limpios, pruebas críticas sin pendientes, backup recuperable, ensayo de migración, rollback, monitoreo y responsables. Staging aceptado y aprobación posterior antes de producción. Validar ingresos/RECO/relaciones/permisos sin datos sensibles en logs. Push y deploy siguen fuera del alcance de esta auditoría.

## Actualización posterior — fase 2, 20/10/2026

Este documento conserva el diagnóstico y plan del baseline original. La remediación local posterior se detalla en [P1 remediation report](../p1-remediation/00-remediation-report.md). AUD-01/02/03 resueltos localmente; AUD-04 con restore local aprobado y aceptación operativa pendiente; AUD-05 bloqueado externo. No se autoriza producción. El manifest original corresponde al snapshot 0ee3e53, no a estas actualizaciones.

## Actualización de fase 4 — P2 local, 20/10/2026

AUD-06–10 satisfacen sus criterios técnicos locales sobre código 67875fe: provincia en captura/compartir, Prisma reconciliado con 19 migraciones intactas (diff 0), fotos sin lado requieren revisión explícita, configuración coherente con ticket fijo y consulta/corrección IMEI histórica protegida. No se repararon los históricos comerciales ni se comprobó CODART real. Se verificaron 322 casos unitarios consolidados (cinco fallos iniciales por alias Python sustituidos por rerun completo de los dos archivos afectados), 302 de integración relacionadas y 6 E2E enfocadas; no se repitió la suite completa de 770. Instalación limpia, build oficial frontend/backend, tsc, lint y validate PASS. Detalle de resultados, fuentes, fallos iniciales y límites en [Phase4 P2 remediation](../p2-remediation/00-remediation-report.md).

AUD-04 sigue PARCIAL, AUD-05 BLOQUEADO EXTERNO y AUD-11 P3 abierto. Custodia/RPO/RTO representativos, infraestructura/backup/alertas reales y hardware siguen pendientes. La autorización de P2 local no acepta riesgos para producción. No se hizo push/deploy ni operaciones comerciales de escritura; servicios habituales conservan CreatedAt/StartedAt/mounts. Los apartados históricos de fases anteriores permanecen como evidencia de sus respectivos baselines. **NOT READY para producción.**
