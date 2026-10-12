# Phase 10A — R2 privado

PREPARED usando el MISMO S3EvidenceStorage. Endpoint real del panel https://<account-id-real>.r2.cloudflarestorage.com; región auto, STORAGE_PROVIDER=s3, path style true, bucket privado. Plantillas no contienen accountID ficticio. S3_ENCRYPTION_PROVIDER=r2-managed declara configuración, no prueba cifrado externo. SSE/KMS vacíos: no enviar headers AWS KMS a R2. Verificación proveedor10B pendiente.

10B autorizado: revisar subscription/checkout/facturación R2 Standard; bucket sin r2.dev ni custom domain público; token Object Read&Write sólo bucket. Worker scope mínimo que permita read/list/delete, backup readOnly. Credenciales fuera de React/repo. CORS EXACTO appHTTPS: GET/PUT/HEAD, Content-Type y headers checksum requeridos por SDK, ETag expuesto opcional; sin wildcard origen. CORS no autentica: backend/firma S3 son frontera.

Preservados JPEG/PNG/WebP,10MiB,firma/pixels máximos,orientación,WebP sin EXIF/GPS,checksum y UUID. PUT60s/GET30s, sin URLs permanentes. Foto compartida/links PostgreSQL preservan última referencia, scope por RECO/IMEI y outbox idempotente.

10B con fotos SINTÉTICAS: init/PUT/verify/attach/list/access; expiración403, borrado última referencia, doble IMEI compartido, scope404/permiso403/sin sesión401, acceso anónimo403. MinIO local no acredita R2 real. R2 caído: no afirmar guardado, retener outbox y referencias válidas. Orphans desconocidos sólo reportados por worker; revisión antes de eliminar.

Fuentes: [S3 API](https://developers.cloudflare.com/r2/api/s3/api/), [data security](https://developers.cloudflare.com/r2/reference/data-security/), [CORS](https://developers.cloudflare.com/r2/buckets/cors/).
