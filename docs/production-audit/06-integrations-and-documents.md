# Integraciones, documentos y privacidad

19/10/2026, America/Lima. HEAD `2751768cf07febf2e0ea7287cf34161fcb445239`. Auditoría sin correcciones.

## Proveedores

| Integración | Revisión | Ejecución real |
|---|---|---|
| Google | PKCE/state/nonce/JWT/cuenta autorizada/subject único | REAL GOOGLE AUTH: NOT VERIFIED |
| Gemini | Clave backend/modelo/cuota/timeout/abort/esquema/Luhn | REAL GEMINI API: NOT VERIFIED |
| CODART RENIEC | Solo result.full_name, origen fijo/Bearer/redirect bloqueado/límites/caché | REAL CODART API: NOT VERIFIED |
| CODART fotos | Autorización/vigencia/deduplicación/lados | REAL CODART API: NOT VERIFIED |

No se enviaron fotos reales, no se consultaron identidades reales ni se consumieron créditos. Mocks no prueban disponibilidad, créditos, costo o comportamiento real. Google OIDC no está configurado localmente.

BoxScanner: contador de solicitud, baseline/versiones por campo, AbortController y descarte de respuestas tardías revisados. useDniLookup: debounce/clave DNI-revisión/abort. Algunas pruebas correspondientes están bloqueadas por fixtures/perfil fijo, no se declara integración completa aprobada. AUD-08: sin etiquetas, exactamente dos fotos se clasifican por índice; debe existir contrato probado o revisión explícita.

## Storage y expedientes

Firma MIME real, límites de bytes/píxeles, sharp y conversión WebP lossless sin EXIF/GPS. Claves UUID, bucket privado, firmas de vida limitada y scope de sesión/usuario para borradores. No se usa DNI en la clave del objeto.

MinIO separado: dos lados manuales guardados en cliente; anónimo→403; documentId con clientId distinto→404 sin firma; falso PNG→400; reutilización automática en nuevo RECO sin duplicación. Primera prueba de falso PNG obtuvo 409 por falta de confirmación de reemplazo; la repetición con precondición correcta alcanzó y aprobó el decodificador. No fue una vulnerabilidad.

Referencias SQL independientes preservan archivos compartidos; revisión de guardas de última referencia y limpieza. No todas las rutas concurrentes de borrado/reemplazo quedaron probadas. Restore manual copió y comprobó dos objetos. PDF de evidencias suplementario→200. Política/CORS/cifrado/TTL efectivo y recuperación del proveedor productivo pendientes.

## Privacidad

Controles técnicos no prueban cumplimiento jurídico. Revisar finalidad/base de tratamiento, autorizaciones reales, información al titular, conservación/derechos, encargados/proveedores, transferencias y contratos. No se valida eficacia jurídica del texto de no devoluciones del ticket ni se afirma cumplimiento integral.

Fuente primaria consultada: [ANPD, normativa de protección de datos personales](https://www.gob.pe/institucion/anpd/colecciones/3482-normativa-de-proteccion-de-datos-personales), que incluye reglamento de Ley 29733/DS 016-2024-JUS. Aplicación concreta a validar con asesoría especializada. Esta carpeta no incluye secretos ni información personal comercial.
