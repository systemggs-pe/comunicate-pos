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
