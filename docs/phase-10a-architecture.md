# Phase 10A — Arquitectura cloud

Fecha: 11/10/2026, America/Lima. Baseline `master` / `ddf3e32`. Opción B: frontend estático Cloudflare Pages → HTTPS API Node24 en Oracle A1 ARM64 → PostgreSQL Neon. Fotos privadas en R2; copias cifradas independientes en B2. Sin aprovisionamiento, publicación, migración operativa ni contratación. Objetivo S/0 condicionado a cuotas, sin garantía de costo cero.

PostgreSQL sigue como fuente de verdad. La VM contiene código, configuración privada, logs acotados y copias temporales YA cifradas; fotografías no persisten en disco. Subidas/descargas R2 conservan autorización, UUID y TTL. No cambian reglas comerciales, modelo, documentos ni migraciones.

Estrategia principal: systemd + Caddy sobre Ubuntu24.04 ARM64. Dockerfile es herramienta de compatibilidad aislada, no segundo despliegue. API loopback3001, Caddy80/443. Worker Node independiente mediante timer. Backups diarios propuestos con retención inicial3 días configurable; no activar hasta medir capacidad, probar restore y aprobar política. GitHub Actions opcional queda sin workflows nuevos ni auto-deploy.

## Dominio y sesiones

Frontend y API HTTPS deben estar en subdominios del MISMO dominio registrable controlado. Cookie `__Host-pos_session` pertenece sólo al API: sin Domain, HttpOnly/Secure/Lax/Path=/; fetch usa credentials=include y CORS exacto. No se comparte cookie con Pages.

Un proyecto pages.dev y hostname independiente Oracle son cross-site: Lax no habilita fetch autenticado. NO cambiar a SameSite=None ni desactivar CSRF. Dominio propio no supuesto; ausencia de control DNS es BLOCKED. Proxy gratuito de mismo origen requeriría Pages Functions/Workers, cuotas y validación independiente: no implementado ni habilitado. `/api` relativo se conserva para desarrollo, no basta para publicar Pages sin API/proxy.

PREPARED significa archivos implementados; LOCALLY VERIFIED exige ejecución registrada; EXTERNALLY VERIFIED exige proveedor real. Proveedores reales NOT VERIFIED y producción NO. Perder VM no debe perder DB/fotos/backups. Oracle no garantiza capacidad/continuidad; no generar actividad artificial contra reclamación.
