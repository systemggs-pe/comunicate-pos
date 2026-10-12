# Phase 10A — Oracle API

PREPARED, sin VM creada. Principal: Ubuntu24.04 ARM64, Node24, systemd y Caddy. A1.Flex1OCPU/6GB inicial; home region, etiqueta Always Free y capacidad obligatorias. Sin capacidad: BLOCKED, esperar; no sustituir por instancia pagada. Ver cuotas y reclamación en free-tier-limits.

## Empaquetado local

`npm ci`, `npm run db:generate`, `npm run typecheck`, `npm run build:api`. esbuild0.28.2 declarado, paquetes externos; build-server incluye API/worker/backup y fuentes Lato junto a bundles que las usan. Instalar dependencias nativas en Linux ARM64: NO copiar node_modules/motores Windows. Sin sourcemaps.

Dockerfile reproduce build aislado nativo/emulado; .dockerignore excluye env/datos/output/tmp. `docker build --platform linux/arm64 -f ops/oracle/Dockerfile -t communicate-phase10a-arm64:local .`. Smoke con DSN SINTÉTICO loopback puerto9: argon2/sharp/PDF/AES y motor Prisma responde P1001 esperado. No implica conexión Neon ni Oracle física. Imagen local no publicada; Docker no es segundo despliegue.

## Instalación futura — modifica VM, NO ejecutada

Después de aprobación10B: crear usuario de sistema communicate sin shell/login; /opt/communicate/releases/<commit>, enlace current, /etc/communicate(root:communicate0750), /var/lib/communicate(0700). Instalar Node24 ARM64 oficial verificando checksum; unidad espera /usr/bin/node, ajustar si distribución cambia. Caddy mantenido. Instalar deps/generar motores/build en Linux del mismo ABI; conservar release anterior.

Completar api.env fuera del repo, permisos root:communicate0640. DATABASE_URL pooled Neon con connection_limit2/pool_timeout10/connect_timeout10. R2 privado, orígenes exactos. Sin ADMIN_PASSWORD en servicio; bootstrap autorizado aparte y retirar credenciales. No migraciones en start/restart/build. Usuario no root, servicio sólo lectura, RAM1GB/CPU100%, journald; configuración administrada SystemMaxUse100M/MaxRetentionSec7day, monitor uso/errores/restarts.

Copiar unidad, `systemd-analyze verify`, daemon-reload/start sólo10B. Health público no abre DB; readiness privado exige settings.read y verifica DB/storage. Reinicio on-failure, SIGTERM drena HTTP antes de desconectar Prisma; cierre forzado tras25s, unidad35s. Sin limpieza residente en API; worker separado.

## Proxy, TLS y firewall

API_HOST debe ser hostname real controlado; Caddyfile no fija dominio ficticio. Caddy ACME y redirect HTTP→HTTPS. Validar antes de reload. Sobrescribe X-Real-IP con peer y retira header Vercel. TRUST_LOOPBACK_PROXY=true sólo para proceso loopback; sin trust proxy global. Sin CDN delante API inicialmente; añadirlo exige revisar confianza/IP.

NSG/VCN y firewall OS:443 público,80 ACME/redirect,22 SOLO IP/CIDR administrador. Nunca abrir3001. SSH claves, PasswordAuthentication no, PermitRootLogin no; probar segunda sesión antes de cerrar acceso. No modificar reglas10A. JSON32KB; fotos directas R2. Throttle persistente existente. Sin accesslog de URLs en Caddy; API eventos sanitizados.

Oracle caído: Console/shape/restarts/disco; restaurar release/env/worker desde custodia privada. Pérdida VM: reconstruir sólo autorizado y reconectar DB/R2. No restaurar sobre recursos operativos ni generar carga artificial anti-inactividad.

`sh ops/oracle/install-template.sh` muestra plan sin cambios. `--apply-local-host` exige root/LinuxARM64/Node24, crea usuario/directorios y copia units sólo si no existen; nunca habilita/inicia servicios, instala secretos, aprovisiona cloud ni abre firewall. Comando de modificación de VM reservado10B. Lockfile reparado para dependencias opcionales WASM que npmci ARM detectó faltantes, sin actualización de librerías comerciales.
