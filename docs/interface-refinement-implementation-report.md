# COMUNIC@TE POS 2.0 — IMPLEMENTATION REPORT

## Corrección posterior — dirección operativa

Por instrucción posterior del usuario, la dirección final y los tres formatos de Compartir usan **DIRECCIÓN - DEPARTAMENTO**. Provincia se retiró de los formularios y detalles comerciales. No se eliminan columnas ni datos existentes; no se aplica otra migración. Esta corrección sustituye las menciones de Provincia como componente de dirección en el reporte original. No se ejecutan pruebas, push ni deploy.

## Corrección posterior — autorización de fotos CODART

La consulta de fotos CODART requiere únicamente una casilla explícita de autorización para consultar y almacenar. Se retiran finalidad y referencia del formulario de fotos; el backend registra el contexto de esa confirmación con usuario y fecha cuando no se reciben los campos del contrato anterior. Se conserva la casilla obligatoria en backend, permisos, almacenamiento privado y autorización contractual existente. La carga manual y clasificación documental conservan sus formularios anteriores. Sin pruebas, push ni deploy.

## Corrección posterior — errores de consulta CODART

El adaptador solicita JSON explícitamente y clasifica redirecciones, rechazo de autorización, errores de red/DNS/TLS y tiempo de espera. No sigue redirecciones ni envía la clave a otro destino. Las fotos tienen un margen de respuesta de veinte segundos frente a los ocho anteriores. Se registra únicamente un código de transporte permitido, sin DNI, claves o contenido del proveedor.

El mensaje de la captura anterior no permite atribuir una causa concreta: el adaptador agrupaba redirecciones y errores de transporte bajo un mensaje genérico. Se revisó resolución DNS y acceso HTTPS a la raíz pública del proveedor, sin consultar DNI ni fotos. La consulta real de fotos sigue sin comprobarse; no se ejecutan suites, push ni deploy.

## Ampliación posterior — identificar anverso y reverso

Foto DNI y el panel de consulta de fotos del expediente permiten seleccionar y confirmar el lado de una imagen sin identificar. Tras guardar, muestran ANVERSO DEL DNI o REVERSO DEL DNI. Se utiliza el archivo privado existente, sin llamadas adicionales a CODART, copias ni cambio de caducidad o autorización. El backend exige permisos documentales, confirmación explícita y documento vigente; impide sobrescribir otra foto del mismo lado, cambiar un lado ya identificado o reclasificar archivos vinculados a evidencias. Registra la identificación en auditoría. No se presupone que imagen 1 sea anverso o imagen 2 reverso. Sin pruebas, push ni deploy.

## ESTADO

**IMPLEMENTADO**, en alcance de desarrollo. Google queda preparado y pendiente de configuración real. No se declara la aplicación comprobada ni completamente verificada.

Especificación: refinamiento exclusivo de implementación recibido el 18/10/2026. Referencia recibida: `LOGIN.pdf`, cinco páginas; el texto la denomina `LOGIN(1).pdf`. Se leyeron las cinco páginas de la referencia. No se realizaron comparaciones de screenshots ni pruebas del producto.

## LOGIN

- Cambios realizados: diseño en dos columnas, mensaje «Claridad para cada equipo, venta y cliente.», indicación de acceso restringido, tarjeta blanca, icono de identidad, bienvenida y botón Google. Estilos para móvil. Sin imágenes decorativas ni textos legales no aprobados.
- Integración Google preparada: OAuth/OIDC con código de autorización, PKCE, estado vinculado al navegador, nonce, validación del ID token en backend y sesión HttpOnly existente. Lista explícita de pares correo/identificador Google previamente autorizados, cuenta existente activa y rol obligatorio. No crea usuarios ni asigna privilegios. Vinculación única y auditoría interna. Cierre de sesión existente conservado.
- Configuración pendiente: cliente OAuth, secreto del backend, origen autorizado, callback y mapa de identidades aprobadas. El acceso administrativo con correo y contraseña se conserva. Google permanece deshabilitado mientras falte configuración.
- Guía: [google-auth-configuration.md](google-auth-configuration.md). Preparación basada en la [documentación oficial de Google OIDC](https://developers.google.com/identity/openid-connect/openid-connect).

## FOTO DNI

- Diseño implementado: encabezado Documento / Foto DNI, selección DNI azul o electrónico, campo de ocho dígitos y botón dinámico de consulta. Estado vacío, carga, errores, vista previa, ampliación y descarga autorizada.
- Integración existente utilizada: expediente documental, adaptador CODART y acceso privado MinIO mediante enlaces temporales autorizados. No consulta al escribir; busca el cliente y las fotos guardadas al confirmar. Sin fotos vigentes, exige autorización antes de solicitar al proveedor. No ofrece renovación externa automática ni asigna anverso/reverso a imágenes sin identificar.
- Se conserva la necesidad de un cliente existente para asociar la documentación privada. Si no existe, se ofrece registrar sus datos reales desde Clientes; no se crean fichas ficticias ni se consultan fotos sin propietario documental.

## EQUIPOS

- Cambios visuales: panel compartido, icono azul, búsqueda por código, características, propietario o IMEI, filtros reales de origen y estado, tabla con IMEIs, características, propietario y badges.
- Detalle en modal de consulta. Edición independiente con el formulario existente y opciones técnicas previas para los permisos correspondientes. Conserva relaciones, registros asociados, información comercial e historial del equipo. No cambia ni duplica dispositivos por motivos visuales.

## USUARIOS

- Cambios visuales: tabla compacta, nombre/código, correo, rol, estado, vinculación Google y acciones por permiso; búsqueda y filtros de estado/rol. Modal de consulta y modalidad de edición separada.
- Conserva creación, edición, activación/desactivación confirmada y restablecimiento de contraseña. El backend conserva la protección del superadministrador y la invalidación de sesiones. Sólo expone un indicador de vinculación Google; no publica el identificador, tokens ni contraseñas.

## ROLES

- Cambios visuales: panel compacto, búsqueda, secciones desplegables por rol, descripción contextual, número real de usuarios asignados y permisos agrupados por módulo, incluida documentación privada.
- Las descripciones contextuales son textos de interfaz; no se ha añadido edición del nombre o descripción de los roles. Conserva los permisos almacenados, SUPERADMIN protegido y confirmación de cambios. La administración de permisos mantiene su restricción existente a SUPERADMIN.

## REPORTES

- Cambios visuales: encabezado azul, fondo claro, filtros compactos, pestañas, tarjetas, gráficos y tablas con la presentación compartida.
- Conserva los reportes, filtros, fechas, series, cálculos y exportación CSV existentes. No modifica `Analytics` ni los servicios de cálculo. Mantiene separados ingresos de ventas e importes registrados de servicios, sin presentarlos como cobros confirmados.

## COMPARTIR

- Formato BLOQUEADO: DESBLOQUEO LISTA BLANCA con prioridad por el estado de la solicitud objetivo, tipo TIENDA/EXTERNO e IMEI exacto a desbloquear.
- Formato REGISTRO: IMEIs físicos disponibles, teléfono de la solicitud e IMEI exacto a registrar. IMEI 2 vacío cuando no existe.
- Formato REGISTRO DOBLE: sólo dos solicitudes distintas de la misma operación, del mismo equipo y cliente, con slots 1 y 2 y datos comunes coherentes. Teléfonos distintos asociados a sus respectivos IMEIs. Si no cumple estas condiciones, utiliza el formato individual. Tener dos IMEIs físicos no basta.
- Copia al portapapeles desde listado y detalle, con mensaje «DATOS COPIADOS AL PORTAPAPELES». Si el navegador lo bloquea, muestra un modal con texto seleccionable para copiar manualmente. No abre WhatsApp, envía mensajes ni crea enlaces públicos.
- Plantillas con saltos de línea, mayúsculas operativas y TIENE CAJA: SI/NO. Provincia se captura mediante campo aditivo independiente de Departamento. No rellena provincias históricas: el espacio permanece vacío en el texto compartido cuando no está registrado.

## VENTAS Y REGISTROS

- Historial visible retirado: bloques de cambios administrativos, Creada por / Fecha de sistema, FINALIZADO POR y Último responsable en RECO; operador administrativo retirado del detalle comercial de venta. No se sustituyen por paneles equivalentes.
- Visualización sólo lectura: venta en modal con código, fecha operativa, total, pago, cliente, equipos, IMEIs y accesorios. Registro en modal informativo y evidencias consultables sin controles de modificación.
- Edición independiente: venta abre únicamente su corrección de notas ya autorizada; registro abre formulario separado de datos operativos y evidencias bajo sus permisos existentes. Las transiciones de estado siguen en sus acciones comerciales explícitas del listado.
- Conserva acceso autorizado a Ticket, declaración jurada A4, expediente A4 de evidencias, copia de datos y eliminación independiente. Los generadores A4 y térmicos no se modifican.
- Conserva AuditLog, historial interno, fechas operativas e historial comercial de Clientes. La ficha de cliente muestra Provincia cuando esté registrada.

## IMPRESIÓN

- Modal actualizado: centrado, blanco, icono de impresora, dos botones de tamaño y Cancelar. Conserva apertura del ticket y sus funciones actuales de impresión y descarga PDF.
- Formatos conservados: **48 mm y 80 mm**. No introduce 58 mm ni cambia los generadores existentes.

## ENTREGA

- Commit inicial: `205aff6`.
- Commit de backend y datos operativos: `508309b`.
- Commit final de implementación de interfaces: `608d3d4`.
- El hash del commit documental final se indica en la entrega del chat.
- Archivos creados: **8**. Archivos modificados: **29**. Total: **37**.
- Migraciones: **1**, aditiva: `20261018110000_interface_google_province`, aplicada a la base local `communicate_pos`. Añade Provincia opcional en Client/RegistrationRequest, identificador Google único opcional en User y tabla temporal GoogleAuthAttempt. Sin backfill, eliminación ni reemplazo de datos comerciales. Cliente Prisma regenerado.
- Dependencia añadida: `jose`, para validación del ID token y JWKS. Instalación sin scripts ni auditoría.
- Pendientes de configuración: las cinco variables Google descritas en `.env.example` y la configuración del cliente OAuth en Google Cloud.
- Limitaciones: sin credenciales reales Google, sin comprobación real de autenticación, proveedor CODART, impresión o interacción de las interfaces. No se ejecutó compilación, lint, comprobación de tipos, auditoría ni validación final. Los estilos adaptativos están implementados pero no comprobados en esta fase. Las fotos requieren cliente existente y las autorizaciones documentales vigentes. Los cambios no se presentan como verificados.

### Archivos creados

1. `server/auth/google.ts`
2. `shared/registration-share.ts`
3. `prisma/migrations/20261018110000_interface_google_province/migration.sql`
4. `src/features/registrations/ShareRegistration.tsx`
5. `src/features/sales/SaleDetails.tsx`
6. `src/refinement.css`
7. `docs/google-auth-configuration.md`
8. `docs/interface-refinement-implementation-report.md`

### Archivos modificados

1. `.env.example`
2. `package.json`
3. `package-lock.json`
4. `prisma/schema.prisma`
5. `server/app.ts`
6. `server/services/auth.service.ts`
7. `server/services/pos.service.ts`
8. `server/services/registration-requests.service.ts`
9. `server/services/users.service.ts`
10. `shared/auth.ts`
11. `shared/validation.ts`
12. `shared/workflow.ts`
13. `src/app/App.tsx`
14. `src/features/auth/Login.tsx`
15. `src/features/clients/ClientFields.tsx`
16. `src/features/clients/ClientForm.tsx`
17. `src/features/clients/Directory.tsx`
18. `src/features/evidence/EvidenceSection.tsx`
19. `src/features/receipts/Receipt.tsx`
20. `src/features/registrations/OperationalRegistrationFlow.tsx`
21. `src/hooks/useDniLookup.ts`
22. `src/pages/Equipment.tsx`
23. `src/pages/PhotoDni.tsx`
24. `src/pages/RegistrationRequests.tsx`
25. `src/pages/Reports.tsx`
26. `src/pages/Roles.tsx`
27. `src/pages/Sales.tsx`
28. `src/pages/Users.tsx`
29. `src/types/pos.ts`

## PRUEBAS

**NO EJECUTADAS POR INSTRUCCIÓN DEL USUARIO.**

## PUSH

NO.

## DEPLOY

NO.
