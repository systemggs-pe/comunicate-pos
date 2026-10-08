# Phase 4 — Auth, users, roles, permissions and audit

COMUNIC@TE POS is a private single-company application.
It is not a SaaS or multi-tenant platform.

## Revisión antes de implementar

Baseline master / 938b8a9, Git limpio. TEMPORARY AUTH funcionaba mediante una
clave privada compartida API_ACCESS_TOKEN, Bearer en Authorization y comparación
constante en server/app.ts. ApiProvider guardaba la clave sólo en memoria; la UI
usaba /api/access, perdía acceso al recargar y no identificaba al operador.
User sólo contenía nombre/correo/referencias históricas. AuditLog identificaba
acciones CREATE/UPDATE sin usuario en varias operaciones. No existían roles,
permisos, sesiones ni hash de contraseñas. Su reemplazo es el alcance de esta fase.

Inventario inicial: clientes/equipos/IMEI/ventas existentes verificados en Phase 3;
autenticación real, administración de usuarios, roles y auditoría visual NOT IMPLEMENTED.
Hallazgo P1 en server/app.ts, guardia compartida: no distingue actor/autorización;
causa el diseño temporal, solución sesiones y permisos centrales. La identidad
de createdById/userId enviada por consumidor no puede ser autoridad HTTP.

Diseño: conservar verde #206650, fondo #f5f8f7, tinta #142d29, blanco #ffffff,
borde #c5d8d0 y fuente Segoe UI de la app. Login centrado de ancho limitado,
formulario claro; administración con tablas/cards y permisos agrupados por módulo.
Sin onboarding de empresas ni selector de organización.

## Flujo y decisiones

Login normaliza email, aplica limitación persistida y verifica Argon2id. Respuestas
para email/password incorrecto o cuenta desactivada son iguales. Crea Session,
lastLoginAt y LOGIN auditado en transacción. Navegador recibe cookie HttpOnly; /auth/me
entrega usuario/rol/permisos sin credenciales. Logout elimina sesión, cookie y registra
LOGOUT. Expiración absoluta de 12h; no se renueva indefinidamente por actividad.

AuthProvider obtiene una vez el usuario actual y mantiene can(permission). Al recibir
401 elimina el estado y muestra /login. Recargar conserva la sesión; no usa localStorage,
sessionStorage ni token JavaScript. Rutas sin permiso muestran acceso restringido;
menú y botones usan permisos enviados por backend. requireAuth/requirePermission
vuelven a comprobar la autorización incluso si se llama directamente a la API.

Contraseñas de 10 a 128 caracteres, sin exigir composiciones arbitrarias. La política
se reutiliza en alta, reset y bootstrap, frontend/backend. Se usa node-argon2 Argon2id
con 19 MiB, 2 iteraciones, paralelismo 1 y sal automática. Tokens de sesión de 32 bytes
aleatorios base64url; sólo SHA-256 en DB, nunca tokens de baja entropía o hashes de
contraseña rápidos. [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
y [node-argon2](https://github.com/ranisalt/node-argon2) sustentan la elección.

## Matriz inicial

| Permiso | SUPERADMIN | ADMIN | SELLER |
|---|---|---|---|
| `clients.read` | Sí | Sí | Sí |
| `clients.create` | Sí | Sí | Sí |
| `clients.update` | Sí | Sí | Sí |
| `equipment.read` | Sí | Sí | Sí |
| `equipment.create` | Sí | Sí | Sí |
| `equipment.update` | Sí | Sí | No |
| `registration.read` | Sí | Sí | Sí |
| `registration.create` | Sí | Sí | Sí |
| `registration.update` | Sí | Sí | Sí |
| `sales.read` | Sí | Sí | Sí |
| `sales.create` | Sí | Sí | Sí |
| `sales.cancel` | Sí | Sí | No |
| `users.read` | Sí | Sí | No |
| `users.create` | Sí | Sí | No |
| `users.update` | Sí | Sí | No |
| `users.disable` | Sí | Sí | No |
| `roles.read` | Sí | Sí | No |
| `roles.update` | Sí | No | No |
| `audit.read` | Sí | Sí | No |
| `settings.read` | Sí | Sí | No |
| `settings.update` | Sí | No | No |

SUPERADMIN conserva todos los permisos, incluso si una lectura del rol fuera incompleta;
no se edita por API. Puede editar las matrices de ADMIN/SELLER con confirmación.
ADMIN administra cuentas comerciales/ADMIN, pero no puede gestionar o asignar SUPERADMIN.
Ésta es la única restricción jerárquica central; las rutas comerciales usan permisos.
Cambios de matriz cierran sesiones del rol. settings.* está preparado como permiso,
sin UI/API empresarial en esta fase. No se crea CompanySettings sin necesidad real.

Los endpoints compuestos de registro exigen registration.create/update y clients.create,
equipment.create; ventas exige sales.create, clients.create y equipment.create.
Resolve permite comprobar sin escribir, y ventas canceladas exige sales.cancel.
Agregar IMEI por endpoint de equipo exige equipment.update; crear/asociar desde el
asistente de registro es parte de registration.create. Para usar formularios de
administración, roles.read proporciona sus opciones. Si se personaliza una matriz,
conservar los permisos de lectura necesarios para los enlaces/formularios del flujo.

## Cookies, CSRF y CORS

Cookie HttpOnly, SameSite=Lax, Path=/; Secure obligatorio con NODE_ENV=production y
nombre __Host-pos_session (sin Domain). Localhost usa pos_session sin Secure. No hay
cookie persistente infinita. El servidor elimina cookie al rechazar sesión inválida,
expirada o usuario desactivado. Session token/passwordHash nunca salen por JSON.

AUTH_ALLOWED_ORIGINS es lista exacta del frontend; en producción debe configurarse.
Todas las mutaciones y login exigen Origin permitido; Origin ausente/extraño se rechaza
403. CORS refleja sólo el origen autorizado y credentials=true; nunca wildcard.
SameSite es defensa adicional, no la única medida. Preflight OPTIONS permitido sólo
para origen admitido, sin datos privados. La API es JSON y body está limitado a 32KB.
[OWASP CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
explica el uso de validación de origen como defensa complementaria.

## Límite de login y operación

AuthRateLimit guarda claves SHA-256 de IP y email normalizado, ventana fija 15min,
máximo 30 intentos/IP y 10/email, exitosos o fallidos. UPSERT atómico funciona entre
instancias, sin memoria de proceso como fuente de verdad. Superar límite responde
429 y audita motivo, sin password/email en metadata. No hay bloqueos perpetuos.
Se limita userAgent a 300 e IP a 100 caracteres, sin cabeceras arbitrarias en auditoría.

Express no confía por defecto en X-Forwarded-For. Antes de producción se debe validar
el proxy de Vercel y su cadena real para IP; no configurar trust proxy=true a ciegas.
El bucket por email funciona independientemente; el bucket IP puede agrupar usuarios
si el despliegue presenta una sola IP. Vercel/TLS real no se verificó ni desplegó.
Argon2 depende de binario nativo; el build local lo verifica, y el empaquetado Linux
serverless debe validarse antes de publicar.

npm run sessions:cleanup elimina sesiones y contadores expirados. No hay cron creado.
La API niega sesiones expiradas aunque no se ejecute limpieza. Un operador puede
programar ese comando fuera del alcance de esta fase.

## Bootstrap y usuarios históricos

Aplicar migraciones y definir ADMIN_NAME, ADMIN_EMAIL y ADMIN_PASSWORD en entorno
privado. npm run seed:admin crea el primer SUPERADMIN y su evento USER_CREATED.
No imprime credenciales. Si ya hay SUPERADMIN activo, no cambia cuentas/passwords.
Si el correo ya pertenece a un usuario histórico, se detiene sin sobrescribirlo;
elegir un correo nuevo y rehabilitar después la cuenta desde Usuarios.
Retirar ADMIN_PASSWORD del entorno después del bootstrap. No hardcodear claves reales.
El E2E ejecuta este script dos veces con credenciales sintéticas sólo en la DB test.
No se crea una cuenta real en la base principal sin valores privados del propietario.

User preexistente conserva ID y referencias, queda DISABLED sin credenciales. Asignar
rol, resetear password y habilitar para permitir login. Desactivar nunca borra el
usuario y elimina todas las sesiones; habilitar no resucita cookies anteriores.
Reset administrativo también elimina todas las sesiones. Email/rol cambiados
invalidan sesiones. El cambio de contraseña propia con contraseña actual queda
pendiente; no hay recuperación por email, OAuth, 2FA, SSO ni invitaciones.

El último SUPERADMIN activo no se desactiva ni pierde rol. Todos los cambios y
bootstrap comparten un bloqueo transaccional; en dos desactivaciones concurrentes
sólo una puede terminar, conservando un administrador activo. No hay borrado de usuarios.

## Auditoría

AuditLog: quién hizo qué. EquipmentHistory: qué ocurrió al equipo. Se conservan ambos.
LOGIN, LOGOUT, LOGIN_FAILED; USER_CREATED/UPDATED/DISABLED/ENABLED/PASSWORD_RESET/
ROLE_CHANGED; CLIENT_CREATED/UPDATED; EQUIPMENT_CREATED/UPDATED;
IMEI_REGISTRATION_UPDATED con from/to; SALE_CREATED/CANCELLED. Cambios de matriz
agregan ROLE_PERMISSIONS_UPDATED. Auditoría usa usuario real de sesión; no se aceptan
IDs de operador por request body. Eventos comerciales/auditoría son transaccionales.
Failed login permite userId nulo y metadata de motivo, sin credenciales. Logs públicos
sólo reportan nombre de error; no stack/SQL/password. No se reescriben eventos anteriores.

/usuarios lista/busca/crea/edita, desactiva/habilita y restablece contraseñas. /roles
muestra matrices y permite editar ADMIN/SELLER. /auditoria lista eventos paginados y
filtra por usuario, acción y fechas Lima; requiere audit.read. No hay endpoint para
editar/eliminar auditoría, ni de borrado de usuarios. Retención/archivo queda pendiente.

## Verificación

Resultados ejecutados, fallos corregidos y límites: [phase-4-verification.md](phase-4-verification.md).
