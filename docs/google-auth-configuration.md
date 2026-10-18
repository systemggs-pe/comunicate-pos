# Inicio de sesión con Google — configuración pendiente

La integración está implementada, pero esta fase no incluye pruebas de autenticación. No se ha habilitado Google con credenciales reales. El acceso por correo y contraseña sigue disponible, incluso después de configurar Google.

## Configuración del administrador

1. Crear un cliente OAuth de tipo aplicación web en Google Cloud y configurar su pantalla de consentimiento para los usuarios autorizados.
2. Definir **únicamente en backend** `GOOGLE_OIDC_CLIENT_ID` y `GOOGLE_OIDC_CLIENT_SECRET`. No usar prefijos `VITE_` ni incluirlos en código o capturas.
3. Establecer `GOOGLE_OIDC_APP_ORIGIN` con el origen exacto del POS, sin barra final; debe estar en `AUTH_ALLOWED_ORIGINS`.
4. Registrar exactamente `GOOGLE_OIDC_REDIRECT_URI` en Google. En local: `http://127.0.0.1:5173/api/auth/google/callback`. En producción: `https://<dominio-del-pos>/api/auth/google/callback`. La aplicación y callback requieren el mismo origen; si API y frontend están alojados por separado, configurar un proxy de `/api` en el dominio del POS. No apuntar el callback directamente a otro dominio.
5. Configurar `GOOGLE_OIDC_AUTHORIZED_ACCOUNTS` como un objeto JSON que relacione cada correo existente del POS con su identificador estable `sub` de Google, verificado por el administrador. El ejemplo `{}` mantiene Google deshabilitado. No usar nombres visibles, DNI ni correos como sustitutos del `sub`; obtenerlo de una integración de identidad confiable o del directorio de la organización. No compartir tokens ni credenciales para obtener este dato.
6. La cuenta del POS debe existir, estar activa y tener un rol. No se crean cuentas ni se asignan roles desde Google. Una primera conexión autorizada guarda el `sub` en esa misma cuenta; las siguientes conexiones deben coincidir con esa vinculación y la lista autorizada. Nunca se asocia una identidad sólo por coincidencia de correo.
7. Reiniciar el backend después de configurar el entorno. La comprobación del flujo real, cierre de sesión y rechazos queda para la siguiente fase, por instrucción del usuario.

## Implementación

- `POST /api/auth/google/start`: limitado por IP; crea intento de diez minutos, estado aleatorio, nonce y PKCE S256. El navegador recibe una cookie HttpOnly, SameSite Lax y Secure en producción.
- `GET /api/auth/google/callback`: comprueba estado y cookie, consume atómicamente el intento, intercambia el código en backend y valida firma RS256 con JWKS de Google, emisor, audiencia, `azp`, caducidad, antigüedad, nonce y correo verificado.
- Sólo admite el par correo/`sub` autorizado y el usuario activo existente. Usa el bloqueo administrativo existente al vincular la identidad y emitir la sesión. Conserva rol, permisos y cookies de sesión existentes.
- No guarda access tokens, refresh tokens ni ID tokens. La interfaz de usuarios muestra únicamente `googleLinked`; no publica el identificador de Google ni los datos temporales del flujo.
- El cierre de sesión usa el endpoint y la invalidación de sesión existentes del POS; no cierra la sesión global de Google del navegador.
- Los errores regresan a `/login?google=failed` con un mensaje general y auditoría interna sin tokens. Las variables incompletas dejan el botón deshabilitado con explicación.
- Migración aditiva: `20261018110000_interface_google_province`. Incluye el identificador opcional único de Google, tabla de intentos temporales y Provincia opcional en clientes/solicitudes. No modifica valores comerciales existentes.

Base del protocolo: [documentación oficial de Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect). Dependencia de validación: `jose`, instalada sin ejecutar scripts ni auditoría.

## Límites de esta entrega

No se ejecutaron pruebas, auditorías, compilaciones, comprobaciones de autenticación ni validaciones finales. Esta documentación describe el código preparado y la configuración requerida; no certifica que Google haya sido comprobado con cuentas reales. No se añadieron textos legales ni casillas de aceptación sin contenido legal aprobado.
