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

## Corrección posterior — lado indicado por CODART

El adaptador ya no descarta las etiquetas explícitas de lado de cada imagen. Reconoce valores de anverso/frontal/front y reverso/back en los metadatos de la imagen (side, lado, face, cara, label, name, nombre, type, tipo, category), conserva esa clasificación en el documento y muestra el lado automáticamente. No deduce el lado del índice. Las etiquetas incompatibles o duplicadas se dejan sin identificar y conservan la opción manual.

Al reutilizar un archivo durante una consulta autorizada, permite completar la clasificación desconocida con la etiqueta recibida, siempre que no esté vinculado a evidencias. No sobrescribe una clasificación previa conocida. No se modifica el almacenamiento de las imágenes con campos ajenos a su esquema.

Las fotos guardadas antes del cambio no conservaban los metadatos originales; su lectura del expediente no dispara consultas nuevas ni consume créditos. No se ejecutó una consulta real para recuperar esas etiquetas. La documentación pública de CODART requiere inicio de sesión; se solicitó al usuario la clave y valor del campo del proveedor, sin datos personales, para confirmar el nombre exacto si difiere de los campos contemplados. No se ejecutaron pruebas, push ni deploy.

## Regla posterior confirmada por el usuario — orden CODART

El usuario confirmó que la respuesta real sólo contiene data_uri y autorizó la regla: imagen 1 anverso, imagen 2 reverso. Para respuestas de dos imágenes sin etiqueta explícita se utiliza ese orden. Si el proveedor incluye etiquetas reconocidas, se conservan.

Al consultar Foto DNI, los documentos CODART ya guardados se identifican mediante su sourceOrdinal, sin solicitudes externas ni consumo de créditos. La clasificación se persiste mediante una operación explícita, con permisos y auditoría, únicamente para pares vigentes de la misma fuente y tipo, ordenados 1/2. No sobrescribe lados conocidos, no cambia documentos asociados a evidencias, no renueva autorizaciones ni modifica archivos. Otros conjuntos conservan la identificación manual. No se ejecutó consulta real ni suite de pruebas.

## Simplificación posterior — ficha documental del cliente

Por solicitud del usuario, se retiran completamente de DocumentVault la autorización documental con finalidad/referencia, carga manual de identidad y sus confirmaciones, listado separado de documentos de identidad, documentación histórica de registros y equipos y acciones de incorporación/reemplazo/eliminación de esos bloques. La ficha conserva únicamente la consulta y visor de fotos CODART con su casilla de autorización. No se eliminan documentos, archivos, relaciones ni datos históricos. El selector de documentos utilizado por Registros conserva su contrato de datos. No se ejecutan pruebas, push ni deploy.

## Mejora posterior — diseño y movimiento de Fotos del DNI

Se aplican Impeccable y UI/UX Pro Max al panel de fotos de la ficha del cliente y a Foto DNI. Se conserva la identidad azul del POS y se reduce el anidamiento visual. Se comparten selector de DNI, mensajes de estado, carga y visor de anverso/reverso. Los textos se simplifican: Buscar fotos, Ampliar, Descargar, Parte de adelante/Parte de atrás y una casilla breve de permiso. Pedir fotos nuevas conserva la indicación de posible consumo de créditos.

Las fotos reservan espacio mientras cargan. Se añaden indicadores de carga reales, confirmación breve de selección y aparición suave de la imagen, con duración acotada. Se respeta prefers-reduced-motion y se preservan estados de foco, botones táctiles y mensajes accesibles. La ampliación utiliza el modal compartido. No se agregan librerías de animación ni imágenes decorativas.

La configuración de consultas, permisos, almacenamiento y datos existentes se conserva. No se ejecutaron suites, builds, auditorías ni comparaciones visuales, por la instrucción vigente de implementación sin pruebas; se omiten también las comprobaciones automáticas sugeridas por las skills. No se afirma verificación del resultado visual. Sin push ni deploy.

## Ajuste posterior — DNI guardado y actualización

Cuando el cliente ya tiene fotos vigentes del DNI, la ficha oculta el selector de tipo y la explicación inicial de créditos. Detecta el tipo de DNI guardado en vez de presuponer siempre DNI azul. Muestra las fotos y una opción Actualizar DNI, que despliega el tipo de DNI, el aviso de posible consumo de créditos y la casilla de permiso sólo al abrirla. Se conserva el permiso para reemplazar documentos y no se llama a CODART al desplegar opciones. Sin pruebas, push ni deploy.

## Ajuste posterior — apertura del bloque DNI

El acceso de la ficha se presenta como DNI del cliente, con icono y una explicación breve. Se sustituyen los triángulos nativos por flechas con giro y estados de foco. El contenido aparece con una transición breve de opacidad y recorte; no se animan alturas ni se añaden dependencias. El estado real DNI guardado se muestra como una etiqueta discreta. Actualizar DNI tiene apariencia de botón y abre su formulario con el mismo movimiento. Se respeta movimiento reducido. El expediente sigue cargándose únicamente al abrirlo. Sin pruebas, push ni deploy.

## Optimización posterior — espacio de la ficha del cliente

Se elimina la estructura de dos columnas con alturas desiguales que dejaba una gran zona vacía al lado de los equipos. El resumen pasa a una franja compacta; contacto, equipos e historial utilizan el ancho completo en orden de lectura. Equipos se organiza en dos columnas dentro de su propia sección y pasa a una en pantallas estrechas. El historial agrupa fecha, equipo e IMEI con menos separación. Se compacta el encabezado y se amplía el modal hasta 760 px, respetando el ancho disponible.

Se conservan todos los contactos, equipos, IMEIs, series, movimientos y métricas autorizadas, sin cambiar cálculos ni datos. Los marcadores repetidos NO CONSIGNADO se presentan como dirección no registrada. Se mantiene la diferencia entre importe de ventas y servicios sin cobro confirmado. Hay una transición breve de entrada, desactivada para movimiento reducido; los controles no dependen de que termine la animación. Se aplican Impeccable y UI/UX Pro Max y se registra la preferencia del usuario de utilizarlas en futuros cambios de diseño y movimiento. Sin pruebas, auditorías, push ni deploy en esta fase.

## Pulido posterior — ficha minimalista

Con Impeccable y UI/UX Pro Max se refina la ficha compacta sin cambiar su estructura funcional. Resumen plano sin fondo adicional, tipografía y pesos más contenidos, identidad separada en DNI/código, teléfonos y correos legibles sin separadores amontonados, iconos más discretos y bloque DNI integrado sin un recuadro anidado. Se mantienen todos los valores y sus restricciones por permiso.

Los controles conservan foco visible y objetivos táctiles; se pulen hover, pulsación y una sola entrada breve del contenido. Movimiento reducido mantiene la vista estática. No se agregan dependencias, consultas ni cambios de datos. Sin pruebas, auditorías, push ni deploy.

## Refinamiento posterior — detalle y edición de equipos

Se aplica el estilo minimalista del POS al detalle del equipo con Impeccable y UI/UX Pro Max: encabezado compacto con código y estado, propietario/DNI/origen agrupados, edición independiente, características en cuadrícula sin panel gris y bloques claros para cada IMEI. Se preservan todas las características, solicitudes y enlaces autorizados.

El historial completo se conserva dentro de un desplegable con número de eventos. La presentación compacta elimina el margen excesivo del timeline y alinea fecha/evento, sin modificar su orden o contenido. La información comercial y la eliminación permanecen bajo sus permisos; la eliminación conserva su confirmación original y sólo cambia la etiqueta del acceso. La edición mantiene sus formularios y actualización técnica autorizada, con la misma presentación.

Hay apertura breve y giro de flecha sin dependencias nuevas, con preferencia de movimiento reducido, foco visible y tamaños táctiles. No se modifican datos ni se ejecutan pruebas, auditorías, push o deploy.

## Ajuste posterior — historial sólo de registro

El detalle del equipo muestra Historial de registro filtrado por eventos de registro e IMEI. Los rótulos son Registro iniciado, Registro pendiente y Registro completado. Una transición real a BLOQUEADO se presenta como Solicitud de desbloqueo recibida; una transición de BLOQUEADO a REGISTRADO se presenta como Equipo registrado y desbloqueado. Cuando inicio y estado pendiente corresponden al mismo evento, el título es Registro iniciado y el detalle Registro pendiente, conservando su fecha real. No se inventan eventos o fechas ni se usa el estado del otro IMEI.

Se ocultan creación del equipo, asignación de propietario, incorporación de IMEI, ventas y cambios técnicos sin transición de registro. El contador incluye sólo los movimientos mostrados. La API y los eventos internos se conservan intactos. Sin pruebas, push ni deploy.

## Ajuste posterior — navegación flotante con frosted glass

Por solicitud del usuario, el contenido vuelve a desplazarse detrás de la cápsula de navegación, eliminando la franja fija que reservaba parte de la altura del área principal. El área usa el alto restante del contenedor flex; conserva margen de desplazamiento al final y scroll-padding para que los últimos controles puedan subir por encima del menú y del área segura del móvil.

La cápsula usa fondo con 60 % de opacidad (40 % de transparencia), desenfoque de 18 px, borde tenue y sombra suave. La transparencia afecta al fondo, sin reducir la opacidad de iconos o textos. Se conservan las cinco opciones, permisos, estados activos, foco y movimiento reducido; el efecto tiene una alternativa opaca para navegadores sin backdrop-filter. Se utilizan Impeccable y UI/UX Pro Max. Sin pruebas, auditorías, push ni deploy.

## Integración posterior — DNI del cliente como evidencia automática

Las fotos vigentes e identificadas del DNI del cliente se vinculan automáticamente a los registros nuevos, sin seleccionar manualmente cada documento. Para registros existentes, la sección de evidencias realiza una sincronización explícita autorizada antes de leer las fotos. La generación del expediente PDF también completa las asociaciones faltantes cuando el usuario dispone de los permisos correspondientes.

Se reutiliza EvidenceAsset y se crean únicamente las asociaciones RegistrationEvidence que faltan para DNI_FRONT/DNI_BACK. No se copian archivos, consultan proveedores ni consumen créditos CODART. Cada IMEI mantiene su propia solicitud y puede compartir los archivos del mismo cliente. La operación es transaccional e idempotente y no reemplaza evidencias adjuntas. Se conserva el tipo de DNI ya vinculado cuando se conoce.

Sólo se consideran documentos CURRENT, vigentes y con archivo READY del cliente propietario. No se vinculan automáticamente equipos con cambios de propietario históricos, grupos ambiguos o archivos incompatibles. Se conservan RBAC, auditoría y almacenamiento privado. El autovínculo exige permiso documental y de adjuntar evidencias; en registros existentes también exige edición del registro. La vista espera la sincronización y muestra un mensaje si falla. Las fotos de caja y boleta siguen siendo propias de cada registro. No se ejecutan pruebas, auditorías, push ni deploy; no se aplica migración ni backfill masivo.

## Aclaración posterior — DNI reutilizable del cliente y carga en registro

Las fotos vigentes del cliente se seleccionan automáticamente en el paso de evidencias, con vista previa privada. Se ocultan los controles de carga de cada lado ya guardado y se pide únicamente el que falte. Una carga manual de DNI sirve para ambos IMEI de la misma operación. Al confirmar, el mismo archivo se vincula al registro y a la ficha del cliente, sin duplicarlo ni consultar CODART. Las demás evidencias permanecen opcionales. El asistente solicita frontal y posterior, y el backend valida ambos cuando se recibe `requireIdentityPhotos`; los consumidores anteriores conservan su contrato opcional.

El guardado manual requiere permiso `client.documents.upload`, conserva las fotos vigentes anteriores, registra operador y fecha de confirmación y aplica la retención documental existente. Completar un lado manual permite reutilizar la otra foto guardada de tipo azul o electrónico. Eliminar evidencia de un registro no elimina la copia vinculada al cliente. En un registro histórico con cambio de propietario o sin propietario no se atribuye automáticamente la foto: se guarda en el registro y se muestra que requiere revisión. No se modifican propietarios, ventas ni datos históricos.

Se aplican Impeccable y UI/UX Pro Max a la simplificación del paso, estados de carga/error, texto y aparición breve de las fotos, respetando movimiento reducido. No se ejecutaron pruebas, compilaciones, auditorías, push ni deploy, conforme a la fase de implementación indicada.

## Refinamiento posterior — reportes compactos y total histórico

Reportes abre con **Todo el historial** y agrupación mensual, conservando los filtros elegidos explícitamente y el periodo mensual predeterminado del Inicio. El nuevo periodo se calcula con los límites reales de ventas, registros, clientes y equipos dentro de la misma transacción del reporte; no utiliza una fecha arbitraria ni aplica el límite de 732 días de los rangos personalizados. La exportación recibe el mismo periodo y conserva sus límites existentes.

Se sustituye la cabecera de gran tamaño por una línea breve, se corrige la herencia que apilaba las pestañas en columna, y se compactan filtros e indicadores. Las ventas muestran cantidad y total vendido; el gráfico abre con importe vendido. El estado de registros usa barras pequeñas con cantidad y porcentaje, evitando repetirlo en otra tabla. Evolución, métodos de pago y operadores se consultan al desplegarlos; la evolución carga su gráfico solo al abrirse. Los filtros adicionales siguen disponibles, con indicación cuando hay alguno activo. Tablas y controles se adaptan al ancho móvil. Se aplican Impeccable y UI/UX Pro Max, con transiciones breves y respeto por movimiento reducido.

No se ejecutaron pruebas, compilaciones, auditorías, push ni deploy, siguiendo la fase indicada. No se modificaron los datos comerciales.

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
