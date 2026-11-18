# Ventas: análisis e implementación de la referencia

## Punto de partida
Rama master, HEAD 6786764. Se respetaron los cambios de desbloqueo y cámara trasera del último commit. El estado inicial sólo tenía `.impeccable/`, `output/` y `tmp/` ajenos sin seguimiento; se conservaron. No se hizo push ni despliegue.

Se renderizaron las diez páginas de DISEÑO VENTA.pdf con PDFium (Poppler no disponible) y se inspeccionaron como imágenes. DISEÑO.pdf también es accesible y se revisaron sus páginas relacionadas de inicio, navegación y formularios. Capturas del PDF y comparaciones permanecen en `.test-results/`, ignorado por Git: no se publican los datos personales visibles en la referencia.

## Inventario previo y mapa
| Página | Referencia | Diferencia inicial | Implementación |
|---|---|---|---|
| 1 | RECO, modal con acciones a la izquierda y equipo a la derecha | Detalle a página completa | RegistrationRequestDetailsPage + ReferenceDialog |
| 2 | Ventas, panel y cinco columnas | Siete columnas, sólo cantidad de equipos | SalesPage; inclusión agrupada de equipos, IMEIs y estado operativo |
| 3 | Cliente, primer paso | Cliente y equipos compartían el primer paso | SaleClientFields, DNI local primero y edición manual protegida |
| 4 | Equipo y precio, segundo paso | Segundo paso era revisión | NewSale + SaleEquipmentEditor; IMEI 2 opcional visible |
| 5 | Origen, medio de pago, accesorios y total | Orden y densidad diferentes | Origen por equipo, métodos reales, accesorios y céntimos exactos |

## Flujo
Dos pasos: Cliente → Equipo y Precio. Agregar equipos no introduce otro paso. Los IMEIs pertenecen a un único equipo físico; el segundo vacío se omite mediante la validación existente. El tipo eSIM y propietario distinto siguen disponibles mediante una sección contextual. Los campos de precio y características se mantienen independientes por equipo. Gemini conserva cámara primero, galería alternativa, inicio automático, cancelación, protección de cambios manuales y aislamiento de respuestas por equipo.

Confirmar y guardar resuelve y crea bajo un único bloqueo de envío. El UUID de operación permanece estable. Si se pierde la respuesta después de guardar, el reintento envía el mismo contenido directamente al endpoint idempotente; no repite la resolución de IMEIs ya creados. La revisión que aparece ante error es recuperación dentro del paso 2, no un tercer paso.

La fecha inicial se consulta al backend y se muestra en Lima. La fecha efectiva sigue la validación existente y createdAt/auditoría proceden del servidor. No se introdujeron permisos, pagos externos ni estados comerciales nuevos.

## Contacto operativo
La migración aditiva 20261017163000_sale_contact_snapshot incorpora buyerPhone y buyerEmail opcionales en Sale. Conserva los históricos en NULL; no cambia Client, importes, responsables ni fechas. Permite guardar un contacto diferente para esta venta sin sobrescribir una ficha existente. El ticket usa el celular de la venta y recurre al histórico del cliente cuando no hay snapshot. También respeta fullName sin dividirlo ni perderlo.

## Origen y documentos
El selector persiste STORE o EXTERNAL, los dos valores del modelo; STORE sigue como predeterminado para entradas anteriores. Ambos crean equipos nuevos, sin inventario ni reutilización. El origen se omite del ticket como establece receiptRows; la ayuda lo indica.

El guardado abre el ticket real, con formato empresarial predeterminado y cambio 48/80 mm, PDF y acceso a impresión. No se modificó la declaración A4 ni el expediente de evidencias. En RECO, Ticket abre un selector de los dos documentos A4 existentes, independientes. No se creó otro comprobante térmico ni se modificó el contrato de la declaración. Compartir copia sólo una ruta autenticada.

## Check de registro
La lista consulta los equipos y sus IMEIs de forma agrupada en el backend. El check requiere una RegistrationRequest REGISTERED para ese IMEI; PENDING, BLOCKED y ausencia de solicitud no lo activan. Etiqueta accesible y símbolo además del color. No hay migración para estados ni consultas individuales por fila. Los filtros por fecha anteriores se conservan tras el icono de calendario; quedan cerrados por defecto para respetar la composición del PDF.

## UI/UX Pro Max
Skill local leída y consulta ejecutada: `search.py "modal keyboard focus scroll" --domain ux -n 3`. Resultados aplicables: foco visible y foco no oculto por UI persistente. Se conservaron los tokens de los PDFs; no se generó otra identidad visual. El foco entre pasos ignora encabezados ocultos; los controles móviles tienen tamaño táctil y la cápsula queda fuera del área de trabajo.
