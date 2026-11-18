# Comparación visual: referencia y aplicación

## Método
DISEÑO VENTA.pdf fue renderizado en sus diez páginas e inspeccionado visualmente. La comparación se hizo por estructura, proporción, jerarquía, márgenes, columnas, tokens, badges y acciones. No se calculó ni se inventó un porcentaje de similitud. Los textos/longitudes de prueba son sintéticos y diferentes de los datos personales de la referencia.

Capturas locales: `.test-results/design-sales-reference/sales-01.png` a `sales-10.png`. Implementación: `.test-results/design-sales-implementation/`. Los PDFs, sus imágenes con datos personales y los estados de prueba no se agregan al repositorio.

| PDF | Implementación a comparar | Aspectos |
|---|---|---|
| 1 | reco-{ancho}.png | Modal, overlay, acciones izquierda, información derecha, scroll |
| 2 | sales-list-{ancho}.png | Panel comercial, herramientas, cinco columnas, montos verdes |
| 3 | sale-client-{ancho}.png | Dos pasos, documento/nombre y celular/correo, Cancelar/Siguiente |
| 4 | sale-equipment-{ancho}.png | IMEI 1/2, serie/comercial, marca/modelo, RAM/memoria, color/precio |
| 5 | sale-total-{ancho}.png | Origen, pago/fecha, accesorios, total y guardado |
| 6 | clients-{ancho}.png | Directorio, seis columnas, actividad y métricas |
| 7–8 | client-profile-{ancho}.png | Contacto, resumen, equipos, línea temporal y documentación |
| 9–10 | more-{ancho}.png / more-bottom-{ancho}.png | Sesión, módulos, sistema y logout |

Anchos previstos: 375, 390, 430, 768, 1280 y 1440, altura 900. El script E2E prepara datos comparables, espera carga y captura cada estado. Se abre el documento local de comparación para inspección antes de la entrega.

## Correcciones verificables de la primera iteración
Se redujo el ancho de venta a 800 px, se corrigió el header de modales que heredaba display:flex global, se dejó IMEI 2 opcional visible, se movieron tipos/propietario a un bloque contextual y se reservó espacio para la cámara/galería. Más concentra módulos administrativos en un desplegable. Se conservó el área de trabajo separada de la cápsula, porque sólo agregar padding dejaba controles debajo de ella.

## Tokens compartidos
Aproximaciones del diseño existente, coherentes con ambos PDFs: azul #096acb; fondo #f3f6fa; superficie #fbfdfe; línea #d3dae2; fondo de secciones #ecf1f6; selección #dcedff; texto #18212d; secundario #637086; importe positivo #008567. Se reutilizan Lucide y tipografía local disponible, sin descargar fuentes ni introducir otra identidad.

## Diferencias justificadas
La cámara es la acción principal por la instrucción posterior del usuario. La ficha distingue ventas y servicios sin pagos inventados. La documentación privada y múltiples equipos permanecen disponibles aunque no estén completos en la captura. No se agrega borrar cliente. Ticket en RECO abre los documentos A4 existentes, sin inventar otro comprobante térmico. Los módulos públicos, incidencias, descarga web de respaldo y tema oscuro quedan explícitamente pendientes o administrativos. En móvil se cambia a una columna o scroll de tabla controlado; la cápsula no cubre contenido.

## Resultado de la revisión final
PASS estructural tras inspección manual de las referencias y las capturas generadas. Se renderizaron e inspeccionaron 20 páginas entre los dos PDFs; la página 9 de DISEÑO.pdf está en blanco. La implementación produjo 54 capturas a seis anchos. Se revisaron formularios, listado de ventas, directorio, ficha, detalle RECO y Más, incluidos ejemplos de escritorio, tablet y móvil.

El índice privado `.test-results/design-sales-implementation/comparison.html` reúne las diez comparaciones por página. Las capturas del cliente usan una venta, dos registros y dos equipos para verificar la capacidad de múltiples equipos; fechas y nombres sintéticos difieren de la referencia y no se utilizan para inventar una medida de similitud. No se observaron discrepancias estructurales pendientes. Los cambios deliberados de privacidad, datos, funciones adicionales y responsive se describen arriba.

La matriz comprueba ausencia de scroll horizontal del documento, límites de controles y posición del guardado respecto a la navegación. Los modales tienen scroll interno; las tablas de clientes pueden desplazarse dentro de su contenedor. No se afirma validación de cámara o impresora físicas.
