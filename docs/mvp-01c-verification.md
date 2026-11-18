# 01C — Expediente documental del cliente

La sección CLIENTES → DETALLE → DOCUMENTACIÓN muestra identidad privada e historial
RECO/equipos: frontal/reverso, boleta, caja e IMEI lógico. Permite vista previa,
descarga temporal, carga manual confirmada, clasificación explícita de imágenes
CODART, renovación de autorización, reemplazo y eliminación autorizada de asociaciones.

El nuevo registro recupera metadatos del cliente por DNI y ofrece selección explícita
de identidad vigente. Se comparten EvidenceAsset y archivos; cada solicitud conserva
su relación independiente. No se reutilizan cajas, boletas ni IMEI lógico para otro
equipo. El historial ambiguo de propietario requiere revisión y genera auditoría;
no se incorpora automáticamente.

La finalidad, referencia de autorización, origen, ordinal del proveedor y caducidad
se conservan en ClientDocument. Los registros de auditoría no guardan fotografías,
URLs firmadas, claves, referencia privada de autorización ni imágenes base64.
La retención configurable (CLIENT_DOCUMENT_RETENTION_DAYS, 365 por defecto) marca
los documentos caducados para revisión y bloquea su reutilización hasta renovación.
No borra documentos compartidos automáticamente; la eliminación requiere permiso
explícito y sólo retira el archivo cuando no quedan referencias.

El almacenamiento sigue siendo S3 privado y la base conserva metadatos/checksum,
no base64. Las migraciones 20261014000100 y 20261014000200 protegen scope, titular,
proveniencia, clasificación referenciada y unicidad del documento vigente por lado/tipo.
El servicio de eliminación y el worker incluyen referencias ClientDocument.

La incorporación de evidencia RECO al expediente usa IDs existentes y no copia
el archivo. Cuando hay cambio de propietario o referencias de distintos clientes,
se devuelve revisión manual; no se modifica la propiedad del equipo.

CODART real y autorización contractual/base legal: NOT VERIFIED. La configuración
permanece desactivada. Antes de habilitar fotografías reales, el responsable debe
verificar que el contrato autoriza conservación/reutilización y documentar la base
legal, finalidad, plazo y referencia de autorización. El indicador de configuración
es un requisito técnico, no sustituye dicha verificación. No hay reconocimiento facial.

Las comprobaciones de respaldo/restauración y reinicio usan datos sintéticos,
PostgreSQL aislado, un contenedor MinIO exclusivo y buckets privados de prueba.
No se reinicia el almacenamiento del sistema comercial.
Validación final: 6 pruebas unitarias de contrato documental, 15 de integración
(PostgreSQL/MinIO reales, incluyendo respaldo, restauración y reinicio aislado) y
6 E2E del expediente. La regresión completa reúne 287 unitarias, 364 de integración
y 58 E2E: 709 pruebas únicas; las reejecuciones no se suman. Son 87 casos nuevos
respecto del baseline. No se eliminaron pruebas anteriores.

Los cuatro anchos (1280/375/390/430) se verificaron sin overflow y con controles
documentales dentro de pantalla; también se abrió/cerró el visor en cada ancho.
Hay capturas sintéticas en `.test-results/mvp-responsive/`. Se corrigió una colisión
de claves React entre edición del cliente y documentación detectada por la prueba
anterior de registro; ese escenario volvió a pasar sin filtrar los errores de consola.

TypeScript, lint, compilaciones web/API, Prisma validate/generate, migraciones
locales (16 aplicadas) y npm audit pasan; auditoría: 0 vulnerabilidades.
Las consultas de listado conservan el límite existente de 100 documentos y 100
vínculos históricos más recientes por cliente. El responsable revisa y renueva los
documentos vencidos; su caducidad no elimina automáticamente archivos compartidos.
Cámara y galería físicas: NOT VERIFIED. No hubo push, despliegue ni llamadas a las
APIs reales. La base comercial sigue sin cambios; las migraciones fueron aditivas.
