# 01B — CODART

Implementación local probada: consulta exclusiva de `result.full_name`, selector
de DNI azul/electrónico, acción explícita para obtener fotografías, consentimiento
y finalidad, vista previa/descarga privada, recuperación de fotografías existentes
y errores recuperables. No se interpreta automáticamente el orden como anverso
o reverso. El nombre completo no se divide en apellidos inferidos.

Configuración backend: `CODART_API_KEY` (con aliases anteriores compatibles),
`CODART_ENABLED` y `CODART_PHOTO_STORAGE_AUTHORIZED`. No se modificó `.env`.
El adaptador no reintenta automáticamente peticiones que puedan generar cargos.

Validación: 28 pruebas unitarias de contrato; 7 de integración PostgreSQL/MinIO;
4 E2E y verificación en 1280/375/390/430 px. Se conservaron y ejecutaron además
las 12 pruebas de integración DNI anteriores. TypeScript y lint pasan.

La migración nueva 20261014000100 conserva los scopes de evidencias existentes
y permite archivos de identidad cuyo único scope es el cliente. También protege
los metadatos de archivos referenciados por ClientDocument.

CODART real, sus créditos efectivos y autorización contractual/base legal real:
NOT VERIFIED. Las imágenes y datos de las pruebas son sintéticos. El servidor
de pruebas inyecta respuestas controladas y las identifica como simuladas.
