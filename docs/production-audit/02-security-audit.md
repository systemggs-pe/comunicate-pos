# Auditoría de seguridad

Fecha: 19/10/2026, America/Lima. Baseline: master `2751768cf07febf2e0ea7287cf34161fcb445239`. Solo auditoría y diagnóstico.

## Autenticación, sesiones y Google

Auth usa hash Argon2, hash dummy, errores genéricos, contadores atómicos IP/correo, tokens aleatorios de 32 bytes persistidos como hash y expiración de 12 horas. El login se serializa con cambios administrativos y revalida estado/contraseña. Logout elimina sesión; cambios administrativos revocan sesiones. Pruebas sintéticas: desactivado→401, último superadmin protegido→409.

Cookies HttpOnly/SameSite=Lax; producción añade Secure y prefijo __Host. Origin exacto obligatorio para mutaciones; origen ausente/ajeno→403. CORS sin wildcard y credenciales para origen admitido. Cookies sobre HTTPS público y proxy real NO VERIFICADOS.

Google revisado en código: PKCE S256, state/nonce, cookie vinculada al navegador, intento de un solo uso; JWT RS256 con issuer/audience/exp/iat/nonce/email_verified y azp; allowlist email→sub, usuario local activo y subject único. No crea usuarios/roles desde Google. Sin variables OIDC locales: REAL GOOGLE AUTH: NOT VERIFIED. Revisión estática no equivale a prueba real.

## Autorización y ataques

Servidor verifica permisos en rutas y vuelve a verificar ámbito/vigencia en servicios documentales. Sin sesión→401; actor forjado→403; SELLER contra usuarios/configuración/documentos→403; documento consultado con clientId de otro cliente→404 sin firma. Es una sola empresa; no se supone multi-tenancy inexistente. La matriz total de roles no quedó aprobada porque parte de las suites falla antes por fixtures.

- SQL: Prisma parametrizado; raw dinámico revisado con validación de identificadores. No se demostró inyección; no se ejecutó campaña exhaustiva.
- XSS/CSV: escape React y neutralización de fórmulas; políticas CSP en templates. No se valida el hosting remoto por leer un archivo _headers.
- CSRF/mass assignment: origen y esquemas strict, actor derivado de sesión. Casos negativos reproducidos.
- Upload: firma real, bytes/píxeles, sharp, una imagen y eliminación EXIF/GPS. Falso PNG→400 EVIDENCE_TYPE_INVALID al alcanzar el decodificador. Primer intento fue rechazado antes por confirmación de reemplazo, no fue bypass.
- SSRF/path traversal: origen CODART fijo/redirects bloqueados; endpoint DNI genérico de configuración confiable. Claves físicas UUID, no nombres aportados por usuario. Revisión estática sin ataques externos.
- Cabeceras/logs: Helmet, API no-store y requestId; logs HTTP no contienen URL/query/cuerpo/cookie/identidad por diseño.

No se confirmó exposición privada o elevación de privilegios. No se certifica ausencia universal de vulnerabilidades. AUD-02 es un bypass documental de negocio por un usuario ya autorizado.

## Secretos, dependencias y privacidad

Solo .env.example rastreado. No se publican valores privados. 61 archivos de bundle sin coincidencias con secretos configurados. No es una búsqueda de todos los secretos históricos de Git. npm audit: cero vulnerabilidades conocidas en el lockfile actual; no garantía completa de supply chain. No se instalaron actualizaciones ni se ejecutó audit fix.

Licencias, SBOM/firmas, instalación limpia reproducible y obligaciones contractuales de paquetes/proveedores no se certificaron. Credenciales públicas de desarrollo no son aptas para producción; el entorno local no se presenta como entorno productivo.

Criterio técnico: [OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) y [Business Logic Security](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html): controles relevantes en cada petición y reglas derivadas en servidor. Estas fuentes orientan la revisión y no prueban cumplimiento de la aplicación.
