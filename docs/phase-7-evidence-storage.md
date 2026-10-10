# PHASE 7 — Secure evidence storage

## Arquitectura y consistencia

`EvidenceAsset` guarda únicamente metadatos técnicos: clave UUID, SHA-256, tamaño,
tipo WebP, dimensiones, estado y propiedad de la carga. `RegistrationEvidence`
asocia un activo a una solicitud RECO y a una de cinco categorías. La clave única
solicitud/categoría permite una imagen por categoría. Las FKs impiden registros
huérfanos; triggers protegen el estado READY, la inmutabilidad, el alcance de la
operación/equipo y la independencia de LOGICAL_IMEI.

La carga directa usa un PUT firmado a una clave temporal aleatoria. La API lee
hasta 10 MB, compara tamaño/SHA-256, verifica firma y decodifica la imagen. Sharp
aplica orientación EXIF, elimina metadatos y escribe WebP lossless, sin resize ni
OCR, a otra clave que jamás recibe autorización PUT del navegador. Se aceptan
JPEG/PNG/WebP de 32 px o más, hasta 20 MP y 12000 px por lado; HEIC se rechaza.

Las cargas PENDING pertenecen al usuario, sesión y operación o solicitud indicada.
Preparar fotografías no crea clientes, equipos ni RECO. La confirmación comercial
asocia todos los archivos y solicitudes dentro de la misma transacción PostgreSQL
serializable. La clave idempotente evita repetir el lote. Si falla, se revierte el
lote y los archivos PENDING quedan disponibles para reintento durante una hora.
Una foto común se comparte solamente mediante la selección explícita del usuario.
Los dos IMEIs lógicos tienen archivos independientes. Ningún activo se puede
vincular entre equipos u operaciones diferentes.

S3 y PostgreSQL **no forman una transacción ACID conjunta**. La compensación usa
estados persistentes. Quitar/reemplazar un vínculo marca DELETING únicamente si no
queda otro vínculo. Después del commit se elimina el objeto; ante fallo permanece
DELETING con contador y código técnico de error. La UI informa que la limpieza
está pendiente. Un vínculo compartido restante mantiene READY y su objeto.

La API local ejecuta la limpieza cada 60 s. `npm run evidence:cleanup` también
procesa cargas vencidas, fallidas y eliminaciones pendientes. El comando devuelve
estado 2 si quedan pendientes. El worker procesa hasta 100 candidatos por pasada.
Una clave temporal puede volver a escribirse mientras su PUT firmado siga vigente:
se mantiene un tombstone hasta finalizar esa ventana más 5 s, se vuelve a eliminar
la clave temporal y sólo entonces desaparece la fila. Una verificación interrumpida
retiene además el seguimiento durante su lease de 120 s para compensar escrituras
que terminen después de un timeout SQL; el cliente S3 limita cada solicitud a 15 s
y dos intentos. Después de fallar, el reintento crea una carga nueva. La escritura final/verificación y
la eliminación final usan bloqueos de fila para evitar objetos sin seguimiento.

## Seguridad y permisos

Todo endpoint requiere sesión activa y origen autorizado en escrituras. Cuatro
permisos nuevos: `registration.evidence.read`, `.upload`, `.replace`, `.delete`.
SUPERADMIN los tiene todos. ADMIN y SELLER no los reciben por defecto; se pueden
otorgar explícitamente mediante la administración de roles existente. Se mantienen
los permisos de lectura/creación/edición/eliminación comerciales correspondientes.
La eliminación definitiva exige `.delete` dentro de la transacción si hay fotos.

La API de acceso comprueba solicitud, vínculo y activo READY antes de emitir un
GET firmado. El DTO no contiene claves de storage, credenciales ni URLs permanentes.
GET por defecto 30 s (máximo 60); PUT 60 s (máximo 60), con tipo y longitud firmados.
Son tokens bearer: un GET ya emitido puede seguir funcionando hasta su vencimiento
aunque se cierre sesión; nuevos enlaces requieren volver a autenticar y autorizar.
Cache-Control es privado/no-store y el frontend utiliza referrerPolicy no-referrer.
La auditoría registra actor, fecha, categoría, requestId y assetId para subidas,
reemplazos, eliminación y autorización de descarga. Autorizar descarga no afirma
que el navegador haya recibido todos sus bytes. No registra contenido/base64,
documentos personales, tokens, claves ni URLs. La eliminación conserva estos
eventos técnicos, incluso después de quitar los registros comerciales.

## Inicio local y almacenamiento

1. Instalar dependencias con `npm install`.
2. Copiar o completar `.env` con las variables S3 de `.env.example`.
3. `docker compose up -d --wait postgres minio`.
4. `npm run db:generate` y `npm run db:deploy`.
5. `npm run evidence:provision` (sólo acepta endpoint localhost, nunca producción).
6. `npm run dev`; abrir `http://127.0.0.1:5173`.

`npm run local` automatiza estos pasos. La alternativa PostgreSQL nativo todavía
requiere Docker para MinIO. La primera construcción descarga y compila MinIO y
puede tardar varios minutos. No ejecutar `docker compose down -v`: borraría datos.
PostgreSQL usa su volumen anterior y MinIO un volumen separado `evidence_data`.
Puertos MinIO 59000/59001 publicados exclusivamente en 127.0.0.1. Healthcheck HTTP
local; credenciales explícitas de desarrollo, separadas de PostgreSQL y del POS.
Los buckets `communicate-evidence` y `communicate-evidence-test` son privados.
La configuración CORS de MinIO es global y limita orígenes a 5173 y 5175, sin `*`.
Ninguna imagen documental se escribe en PostgreSQL, LocalStorage, IndexedDB o en
el filesystem de la aplicación. Sólo los fixtures sintéticos de pruebas y las
capturas de QA se guardan fuera del seguimiento Git.

## Producción preparada, no conectada

`server/storage/provider.ts` define upload/download/delete/exists y autorizaciones;
`s3.ts` implementa el proveedor AWS SDK. Configurar STORAGE_PROVIDER, S3_ENDPOINT,
S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_FORCE_PATH_STYLE y
MAX_EVIDENCE_FILE_SIZE. Sin endpoint el SDK usa AWS S3. R2 generalmente requiere
endpoint HTTPS, región auto y configuración compatible. El operador configura
bucket privado, IAM mínimo, CORS exacto, TLS, backups, límites y tareas de cleanup.
El borrado operativo elimina el objeto activo: no elimina versiones históricas,
backups externos, descargas previas ni copias retenidas por el proveedor. Antes
de producción deben definirse retención, versionado, Object Lock y borrado de
copias; no se configuraron ni verificaron esas políticas externas.
Las claves sólo pertenecen al servidor; no deben tener prefijo VITE_. El PUT
directo evita enviar archivos de hasta 10 MB dentro de una función Vercel de 4.5 MB.
No se configuró cron productivo, ni se desplegó ni se conectaron cuentas externas.

El SDK permite solicitar SSE AES256/aws:kms mediante S3_SERVER_SIDE_ENCRYPTION.
La compatibilidad depende del proveedor: no configurar KMS/SSE en R2 sin comprobar
su soporte. Localmente HTTP está permitido sólo en loopback y no se configuró KMS
ni cifrado de objetos en reposo. TLS/SSE productivos: **NOT VERIFIED**.

MinIO Community fue archivado en 2026 y actualmente se distribuye como código
fuente. El Dockerfile compila la revisión oficial fija
`7aac2a2c5b7c882e68c1ce017d8256be2feea27f`, conserva LICENSE/NOTICE AGPLv3 y usa
usuario sin privilegios. Es una dependencia local sin mantenimiento activo; no
presentarla como un servicio productivo mantenido. Antes de producción elegir y
verificar el proveedor S3/R2 y sus políticas de retención, privacidad y cifrado.

Fuentes primarias: [MinIO](https://github.com/minio/minio),
[CORS MinIO](https://github.com/minio/minio/blob/master/docs/config/README.md),
[URLs firmadas S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html),
[compatibilidad R2](https://developers.cloudflare.com/r2/api/s3/api/),
[límites Vercel](https://vercel.com/docs/functions/limitations),
[Sharp](https://sharp.pixelplumbing.com/api-constructor/).

## Verificación y pruebas físicas

Los tests utilizan exclusivamente `communicate_pos_test` y `communicate-evidence-test`,
imágenes sintéticas, PostgreSQL Docker y MinIO Docker reales. Ejecutar integración
y E2E de forma secuencial: ambos limpian los mismos fixtures. Las pruebas de
seguridad comprueban bucket privado, IDs de otra solicitud, 401/403, URLs caducadas,
ausencia de secretos y estado de eliminación recuperable. Una prueba reinicia
controladamente el contenedor MinIO (recreándolo sobre el volumen) y el proceso Node de la API con los datos preservados.
Las pruebas E2E cubren RECO-000101/102, seis archivos/diez asociaciones, logout/login,
descarga, ampliación, conservación al eliminar la primera solicitud, limpieza tras
eliminar la segunda y cliente conservado. Se capturan 1280/375/390/430 px.
El resultado y números finales se registran en `phase-7-verification.md`.

Cámara física, permisos nativos, vuelta de cámara en Android/iPhone, HEIC nativo y
proveedores productivos: **NOT VERIFIED**. Los inputs ofrecen capture=environment
y una galería independiente; el navegador decide si puede abrir cámara física.
