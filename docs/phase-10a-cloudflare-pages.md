# Phase 10A — Pages estático

PREPARED, sin despliegue real. React/Vite conservado; sin SSR/Next/Workers backend. Build `npm ci && npx vite build`, salida dist. Build completo local `npm run build` también verifica Prisma/TypeScript.

Sólo VITE_API_BASE_URL es público. Build rechaza otras VITE_, credenciales, query/fragmento, HTTP remoto y URL ambigua. Valor cloud: origen HTTPS real seguido `/api`, sin slash final. Vacío conserva proxy local. Cliente usa credentials=include para API/auth/health/CSV. Cookie Lax requiere dominio same-site; Pages `/api` retorna404 y no sustituye Oracle.

public/_redirects reescribe sólo rutas reales login/dashboard/clientes/equipos/registros/ventas/reportes/configuracion/usuarios/roles/auditoria y subrutas a index200. public/404.html desactiva fallback global implícito: assets inexistentes y/api no reciben indexHTML. Sin catch-all. Router History API existente preservado.

public/_headers se copia al build: CSP, nosniff,DENY,HSTS,no-referrer,camera(self),noindex. HTML revalidado; assets con hash immutable. Sin sourcemaps públicos. CSP permite HTTPS para API/R2; restringir hosts reales antes de publicar, sin relajar script-src.

10B autorizado: preferir Direct Upload manual, revisar dist/secrets y entonces usar Wrangler Pages deploy/panel. Ningún comando remoto ejecutado10A. Si posteriormente se elige Git Integration, desactivar automatic production deployments y preview branch deployments en controles de ramas; probar que push no publica. Sin workflows deploy ni Pages Functions añadidos. Mantener assets anteriores o boundary de recarga.

Prueba local HTTPS dos hosts con certificado sintético y navegador ignorando CA sólo en fixture; verifica cookies, CORS y SPA, no DNS/CDN/ACME reales.

Fuentes: [serving Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/), [Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/), [branch controls](https://developers.cloudflare.com/pages/configuration/branch-build-controls/).

Cache-Control se declara sólo para `/`, `/index.html` y `/assets/*` sin reglas contradictorias: Pages concatena valores de headers repetidos. SPA HTML utiliza además el default del proveedor max-age0/must-revalidate; verificar respuesta real10B. [Semántica de headers](https://developers.cloudflare.com/pages/configuration/headers/).
