# Menú Más: referencia y contratos reales

Páginas 9 y 10 inspeccionadas: overlay oscuro, panel blanco centrado con scroll interno, NAVEGACIÓN / Más, sesión, módulos con iconos y descripciones, sistema, apariencia y cierre de sesión. No se reprodujeron la interfaz del navegador ni la notificación de Windows.

BottomNavigation conserva cinco destinos, permisos y resaltado activo. Más utiliza un dialog nativo con cierre y Escape. Sus contenidos se montan sólo mientras está abierto. Se muestran nombre/correo de sesión, sin tokens ni contraseñas.

| Entrada | Implementación y alcance |
|---|---|
| Foto DNI | Ruta real /foto-dni, client.documents.read, consulta documental explícita y autorizada |
| Configuración | Ruta real /configuracion, settings.read, datos empresariales existentes |
| Solicitudes públicas | Pendiente de especificación; texto informativo, sin endpoint público inventado |
| Problemas | Pendiente de especificación; no se creó un sistema de soporte |
| Más módulos autorizados | Equipos, reportes, usuarios, roles y auditoría según permisos; sección contextual para mantener la densidad del PDF |
| Respaldos cifrados | Informa del procedimiento administrativo existente. No descarga la base ni sustituye scripts de backup/restauración por JSON |
| Apariencia | Claro; oscuro identificado como no disponible, sin interruptor falso |
| Cerrar sesión | Llama al cierre real de AuthProvider/backend, invalida sesión y desmonta el estado privado |

Se omiten entradas administrativas sin permiso. No hay botones sin operación real: funciones no definidas se describen como pendientes. El cierre de sesión queda accesible mediante el scroll del panel en todos los anchos. Los respaldos continúan siendo una operación administrativa protegida, no una descarga abierta a trabajadores.
