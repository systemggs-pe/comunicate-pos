# Phase 9 — Auditoría de seguridad

Fecha de ejecución: 10 de octubre de 2026 (America/Lima). Baseline `master`, `1e12910`. Aplicación privada de empresa única. No se realizó push, deploy, contratación, rotación de credenciales ni modificación de datos operativos. `output/` y `tmp/` se conservaron sin seguimiento.

## Matriz de hallazgos concretos

| ID | Área / severidad | Problema y componente | Impacto | Corrección / evidencia | Riesgo de regresión / pendiente |
|---|---|---|---|---|---|
| OPS-001 | Recuperación / HIGH | No había procedimiento probado de recuperación conjunta PostgreSQL + objetos | Recuperar sólo SQL pierde fotos de DNI | `server/ops/recovery.ts`, CLI y `tests/integration/recovery.test.ts`: archivo cifrado, recursos nuevos, checksum, descarga autorizada, fotos compartidas, sesiones revocadas | Validado con datos sintéticos locales. Backups externos y recuperación productiva NOT VERIFIED; bloquea release |
| SEC-001 | Storage / HIGH | `authorizeUpload` omitía SSE aunque `upload` final lo aplicaba | Staging podía quedar fuera del cifrado expresamente configurado | SSE y clave KMS incluidos en PUT temporal, final y firma; prueba de headers firmados | Compatibilidad real SSE/KMS depende del proveedor. MinIO local sin KMS; producción NOT VERIFIED |
| SEC-002 | Sesiones / MEDIUM | `requireAuth` borraba cookies ante cualquier fallo de DB | Una interrupción cerraba sesiones válidas | Sólo errores 401 eliminan cookie; P1001/P1002/P1008/P1017/P2024 producen mensaje público 503 | Pruebas 401/503; la UI permite reintentar; cookie conservada no autentica sin DB |
| SEC-003 | CORS / MEDIUM | Configuración aceptaba origen HTTP remoto o URL no canónica | Una mala configuración debilitaba CSRF en producción | Orígenes exactos HTTPS; HTTP únicamente loopback en desarrollo | Pruebas de siete configuraciones inválidas y HTTPS válido; los operadores deben definir dominio real |
| SEC-004 | Abuso / MEDIUM | Sólo login tenía contador persistente; exportaciones/fotos no tenían cupo de peticiones | Repetición autorizada podía consumir recursos | Contador atómico PostgreSQL por usuario y grupo, Retry-After; 16 exportaciones concurrentes → 10 permitidas, 6 rechazadas | Una consulta adicional por operación. Umbrales iniciales revisables después de medir usuarios reales |
| SEC-005 | Observabilidad / MEDIUM | No había trazabilidad HTTP estructurada que evitara logs de URLs con DNI | Diagnóstico incompleto o exposición de datos al agregar logging informal | UUID por respuesta; logs sólo método, patrón de ruta, status y duración | Prueba demuestra ausencia de DNI, cookies y query/token. Retención/acceso del colector pendiente |
| SEC-006 | Endpoints / MEDIUM | URL S3 permitía credenciales incrustadas y componentes ambiguos | Configuración errónea y exposición involuntaria | URL HTTPS limpia; HTTP sólo localhost; SSE inválido falla cerrado | Pruebas negativas. No se sustituyó el adaptador existente |
| SEC-007 | Proxy / MEDIUM | `req.ip` no diferenciaba clientes de un proxy serverless | Límite compartido de login y atribución IP incorrecta | Sólo `NODE_ENV=production` + `VERCEL=1` leen IP válida de `x-vercel-forwarded-for`; local ignora header falsificado | No se confía globalmente en X-Forwarded-For. Camino de red real debe verificarse en Phase 10 |
| SEC-008 | HTTP / MEDIUM | API tenía Helmet, pero Vite estático no heredaba esas cabeceras | HTML productivo sin política equivalente | Cabeceras declaradas en `vercel.json`, CSP, no-referrer, nosniff, HSTS, DENY, permisos de cámara propios; no-store API | Política permite destinos HTTPS para storage hasta elegir proveedor. Respuesta CDN/dominio real NOT VERIFIED |
| OPS-002 | Serverless / MEDIUM | `server/local.ts` ejecuta limpieza; `api/index.ts` no posee un proceso residente | Outbox y sesiones caducadas requieren trabajador programado | CLI existentes conservados, cola visible en readiness privado; procedimiento y alerta documentados | Scheduler externo no instalado: bloqueo antes de producción. No simular setInterval en Vercel |
| API-001 | Payload / LOW | CSV limitado por filas, sin límite explícito de bytes | Exportación excepcional puede exceder payload serverless | Límite UTF-8 4 MiB antes de auditar/enviar; 5.000 filas siguen vigentes | Requiere filtros más pequeños si se excede; no se truncan documentos |
| API-002 | Fechas / LOW | Filtro aceptaba año 0000 y fecha cuyo fin exclusivo excede formato de cuatro dígitos | Consulta podía llegar a DB con fecha inválida y producir 500 | Zod rechaza año 0000 y 9999-12-31 antes de construir el rango; dos regresiones | No afecta fechas operativas; último día soportado 9999-12-30 |
| PERF-001 | Frontend / LOW | Todas las páginas importadas desde App; entrada 539.624 bytes | Login descargaba módulos de administración/formularios | Rutas lazy, Suspense, error boundary; entrada 338.006 bytes | Pruebas navegador preservan navegación y PDFs; fragmentos nuevos requieren retención de assets durante releases |
| PERF-002 | Storage / LOW | Factory creaba varios clientes S3 dentro de una operación | Trabajo repetido sin utilidad | Una instancia resuelta por servicio | Sin alterar credenciales, permisos ni lifecycle |
| INFO-001 | Dependencias / INFORMATIONAL | Avisos de anotaciones PURE de Zod | Rollup elimina comentarios mal ubicados, no las validaciones | Zod preservado; no se ocultan warnings ni sube umbral de chunks | Avisos upstream permanecen; no hay motivo de sustituir la librería |
| INFO-002 | Infraestructura / INFORMATIONAL | Compose contiene credenciales públicas de desarrollo y MinIO fijado | Serían inseguras si se reutilizan fuera del equipo | Puertos loopback, separación dev explícita, preflight rechaza configuración local | No son credenciales productivas verificadas ni fueron rotadas. MinIO local se mantiene |
| TEST-001 | Regresión / LOW | Fixture firmaba URLs por 1 segundo con timestamp redondeado; se reprodujo caducidad antes del PUT bajo carga local | Fallo intermitente sin comprobar realmente el flujo | TTL de fixture 3s; pruebas esperan4,1s para comprobar expiración y9,1s para ventana de cleanup | No cambia TTL productivo ni se elimina la aserción403; pruebas no se ejecutan mientras se editan sus fuentes |

No se encontró una vulnerabilidad CRITICAL reproducible en la aplicación local. Esto no constituye pentest ni certificación. OPS-001 y SEC-001 se resolvieron en el alcance local; infraestructura real sigue bloqueada hasta obtener evidencia externa.

## Controles revisados

- Argon2id con sal aleatoria, respuesta genérica contra enumeración, token aleatorio de 32 bytes almacenado como hash, sesión de 12 h, logout, usuario desactivado y permisos releídos en backend.
- Cookie productiva `__Host-pos_session`, HttpOnly, Secure, SameSite=Lax, Path=/; identidad de operador siempre derivada de sesión. Rechazo de actor enviado en cuerpo.
- CORS exacto y Origin obligatorio en escrituras; no hay autenticación mediante tokens persistidos en localStorage. Cookies entre frontend/API del mismo origen previsto.
- Endpoints privados comprobados por integración: usuarios/roles/configuración, eliminación permanente, reportes/exportación, declaraciones, evidencia contextual. UUID de otro registro no da acceso a un link aunque ambos compartan archivo.
- React escapa textos; búsqueda de `dangerouslySetInnerHTML` sin usos inseguros en producto. SQL de negocio parametrizado; identificadores dinámicos del backup provienen de catálogo y whitelist. CSV neutraliza fórmulas incluso con espacios/control characters. Request JSON 32 KiB; imágenes directas a S3 con límites y verificación de contenido/checksum.
- Respuestas privadas no-store. Fotos webp sin EXIF/GPS, nombres de objetos UUID opacos, URLs de acceso ≤60 s. Permisos conservadores: ADMIN/SELLER no reciben acceso a DNI por defecto.
- AuditLog revisado: eventos de fotos/declaraciones/reportes almacenan IDs/checksum de contexto y datos mínimos, no base64, URL firmada o credenciales. IP y user-agent también son datos sujetos a control de acceso/retención. Los registros históricos no se reescribieron.
- `.env` no versionado; variables privadas sin prefijo VITE_. Preflight compara secretos configurados con todos los chunks JS del manifest sin imprimir valores. No afirmar que este control detecta toda posible credencial histórica.

## Privacidad: revisión jurídica pendiente

Inventario: DNI, nombres, dirección, correo, teléfonos, fotografías del DNI/dispositivo, documentos de compra y trabajadores. Finalidad: operación interna de ventas y registros; no comprobantes tributarios. No hay acceso público a archivos, acceso mínimo por permiso, confirmaciones de reemplazo/borrado y respeto de archivos compartidos.

Antes de producción, solicitar revisión sobre base jurídica/consentimiento y aviso de privacidad; necesidad de conservar cada fotografía; inscripción y responsable del banco de datos; contratos de encargado y ubicación/transferencias internacionales; ejercicio de derechos; retención y eliminación; acceso de empleados; atención de incidentes y obligaciones de notificación. Definir quién autoriza y documenta cada punto. El borrado operativo no elimina copias históricas: aplicar retención finita y un registro protegido de eliminaciones que se reaplique antes de habilitar una recuperación antigua.

Referencia oficial para la revisión, sin afirmar cumplimiento legal: [Reglamento de la Ley 29733, D.S. 016-2024-JUS](https://www.gob.pe/institucion/smv/normas-legales/6426760-016-2024-jus). IP del host: [cabeceras Vercel](https://vercel.com/docs/headers/request-headers).

## Dependencias

`npm audit --json`: cero vulnerabilidades reportadas en los paquetes instalados.
`npm outdated --json` consultado: existen majors de Prisma, Vite/plugin React,
TypeScript, ESLint, Vitest, dotenv, lucide y otros; también actualizaciones menores
de Express y parches de types/concurrently. No son por sí mismas vulnerabilidades.
Se mantiene el lockfile probado, sin `audit fix --force` ni migración ORM/toolchain.
Prisma/client siguen 6.19.3 y Vite 7.3.7. Revaluar versiones en mantenimiento con
pruebas completas; los avisos PURE no justifican quitar Zod. MinIO local está
fijado a código fuente existente y requiere alternativa mantenida para producción.
Runtime local Node24; binarios nativos de argon2/sharp/Prisma en Vercel aún requieren
smoke del entorno real. `engines` ya exige Node≥22.13.
