# Clientes: directorio y ficha

## Páginas inspeccionadas
Página 6: encabezado DIRECTORIO OPERATIVO, búsqueda avanzada y tabla CLIENTE / ACTIVIDAD / INGRESO TOTAL / ÚLTIMO MOVIMIENTO / EQUIPOS / DETALLE. Páginas 7–8: ficha modal, contacto y resumen a la izquierda, historial a la derecha, equipos asociados debajo del resumen. La documentación privada propia de 2.0 se conserva como sección desplegable.

## Componentes y datos
DirectoryPage y DirectoryDetails, compartiendo ReferenceDialog. Las rutas `/clientes/:id` siguen siendo enlaces profundos reales, con directorio de fondo y cierre a `/clientes`. ClientForm conserva edición auditada; no se añadió eliminación de clientes sin política aprobada.

Los nuevos endpoints autenticados `/api/client-directory` y `/api/client-directory/:id` exigen clients.read. El servidor sólo consulta y devuelve ventas, registros o equipos si existe el permiso correspondiente. Los valores restringidos son null; no se presentan como cero. La búsqueda por equipo requiere equipment.read y se rechaza en servidor sin él. Los modos persona, equipo y búsqueda conjunta tienen efecto real.

La lectura usa una transacción RepeatableRead para contar y consolidar sobre el mismo estado. Agrupa consultas de compras, solicitudes y equipos, sin una consulta por cliente. Las ventas se suman una vez por Sale con Decimal. Dos IMEIs no multiplican el total de venta ni el número de dispositivos. Los servicios suman precios de RECO y se muestran separadamente como importes registrados, sin atribuirles cobros confirmados. Una venta eliminada desaparece del historial y las agregaciones activas.

Los equipos relacionados incluyen propiedad actual y equipos adquiridos por el comprador, sin duplicar sus IDs. Los RECO se relacionan mediante el propietario del equipo según el modelo existente: no se atribuyen al comprador cuando el propietario es otra persona ni se inventan relaciones históricas inexistentes. No se migraron identidades ni se reasignaron propietarios. Fechas de movimientos en America/Lima, orden descendente por fecha operativa.

Los celulares y correos usados proceden de Client, snapshots de sus compras y solicitudes realmente relacionadas. Los equipos muestran nombre, ambos IMEIs y serie cuando existe. El historial tiene enlaces reales a cada venta/RECO, importe y fecha; tanto ventas como registros incluyen sus equipos e IMEIs.

## Documentación
DocumentVault sólo se monta cuando el usuario abre DOCUMENTACIÓN DEL CLIENTE; el directorio no solicita imágenes. Se conservan permisos, autorizaciones, procedencia, vencimiento, reutilización, referencias compartidas, auditoría y eliminación protegida. No se crean URLs públicas ni accesos anónimos. La ficha se adapta a una columna en móviles; la tabla mantiene desplazamiento dentro de su contenedor.

## Diferencias justificadas
El ingreso destacado corresponde exclusivamente a ventas. El precio de servicios queda en un renglón separado y sin afirmar cobro. No se reproduce el icono de borrar cliente porque no existe una política aprobada independiente. La documentación adicional usa un acceso discreto para conservar la composición del PDF.
