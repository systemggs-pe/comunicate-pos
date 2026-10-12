# Phase 10A — B2 independiente

PREPARED, proveedor real NOT VERIFIED. Reutiliza createBackup/restoreBackup/verifyBackup Phase9: pg_dump custom, AES256GCM+scrypt/sal/IV, manifest cifrado,SHA256, reconciliación READY/counts y revocación sesiones. Se agrega transporte native Neon y transferencia S3 B2, no segundo sistema.

B2 endpoint/region del panel, bucket separado R2 y key independiente con scope bucket+prefijo communicate-pos-backups/. Upload requiere write/read/list; DELETE sólo operador de retención. Bucket privado. Passphrase mínimo32 aleatorios fuera de B2/backup/repo/argv/Actions, custodia independiente offline/gestor. DB contiene hashes, no secretos env. Rotación AES debe conservar claves de copias retenidas y probar restore antes de retirarlas.

## Operaciones preparadas, NO ejecutar cloud10A

`npm run backup:cloud -- estimate` es local. create/upload/download/restore/retention requieren `--authorized-cloud`, env privado y autorización humana previa. create además `--quiesced`: pausar realmente API maintenance, worker y operadores, esperar125s+inflight quiet. El flag no demuestra que otros procesos estén pausados. No cambiar env operativo desde ejemplos.

create usa BACKUP_DATABASE_URL directa/pgtools compatible; dump fluye directo a AES sin SQL plaintext disco. Objetos R2 sólo memoria ≤10MiB, luego cifrados. Directorio nuevo recomendado0700. Upload verifica GCM/hashes antes, compara bytes visibles retenidos+nuevos con presupuesto8GB. complete.json último contiene sólo filenames genéricos/tamaños/hashes cifrados/fecha, sin DNI ni storage keys originales. Incompleto no cuenta SUCCESS.

Download requiere ID seguro/directorio nuevo/whitelist/size/hash/GCM/manifest. Restore sólo Neon staging_restore y R2 staging restore vacío, nunca operativo. Verificar links/permisos/Decimal/secuencias/sesiones/checksums. CLI local Docker conservada.

Retención propuesta diaria3 días, configurable tras dimensionar. retention sin BACKUP_DELETE_ID es dry-run; borrar exige ID vencido en plan + DELETE_EXPIRED:<id>. Mantiene marcador completo más reciente y nunca última copia. Aprobación política/restore reciente antes de DELETE. No borrar para esconder cuota. B2 versiones ocultas pueden ocupar espacio tras DeleteObject: lifecycle autorizado obligatorio para acreditar liberación, sin regla destructiva automática10A.

Status privado contiene modo/resultado/bytes/fecha; alertar último SUCCESS>26h, FAILED y último restore>30d. No mensajes ni timer backup activado. B2 caído: conservar copia cifrada local y previa, registrar FAILED, reintentar. Presupuesto no incluye versiones/otros buckets/operaciones/transferencia; configurar caps antes. Clave no viaja con copia.

Fuentes: [B2 S3](https://www.backblaze.com/docs/en/cloud-storage-call-the-s3-compatible-api), [scoped keys](https://www.backblaze.com/docs/en/cloud-storage-get-started-with-a-backblaze-integration), [caps](https://www.backblaze.com/docs/en/cloud-storage-data-caps-and-alerts).

Estimador exige BACKUP_ESTIMATED_COPY_BYTES medido (>0) y BACKUP_ESTIMATED_COPIES independiente de días; para diario3d, presupuestar4 copias por frontera temporal antes de limpieza. No informar espacio libre garantizado con tamaño desconocido. Upload verifica también checksum SHA256 de lectura física remota antes de complete.json; esas lecturas consumen operaciones/transferencia y deben presupuestarse.
