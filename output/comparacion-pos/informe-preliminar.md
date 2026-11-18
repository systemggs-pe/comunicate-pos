# COMUNIC@TE — revisión preliminar para comparar 1.0 y 2.0

Fecha: 14 de octubre de 2026, America/Lima.

Método: dos evaluaciones independientes, A (design_review: diseño y flujos en código) y B (ui_evidence: detector y capturas locales), con síntesis posterior. Este documento es parcial: no se pudo acceder a la versión publicada ni recorrer las páginas en vivo porque la herramienta del navegador devuelve una denegación de acceso guardada, pese a la captura del usuario con «Permitir siempre».

## Qué está comprobado

- Fuentes actuales de la versión 2.0: componentes de ventas, registro, navegación, inicio y estilos.
- Capturas de pruebas locales existentes: escritorio de 1280 px y móvil de 375 px, entre otros tamaños. Se contrastaron composición, mayúsculas, navegación y campos con las fuentes actuales.
- Detector local ya ejecutado: tres advertencias, sin errores. No equivale a una certificación de accesibilidad ni de funcionamiento.
- No se realizaron ventas, registros, consultas externas de DNI, cambios en datos o modificaciones de la interfaz durante esta revisión.

## Matriz comparativa disponible

| Aspecto | Publicada 1.0 | Local 2.0 |
|---|---|---|
| Identidad visual | Pendiente de observar | Verde, fondos claros, paneles blancos y bordes finos |
| Navegación | Pendiente | Barra lateral en escritorio; rejilla de opciones en móvil |
| Venta | Pendiente | Formulario de comprador, equipos, accesorios y pago; revisión y confirmación |
| Registro | Pendiente | Cinco etapas: cliente, equipo/IMEI, datos operativos, evidencias y revisión |
| Velocidad percibida | Sin medir | Sin medir en esta revisión |
| Número real de clics | Sin medir | Depende del cliente y de los equipos; no medido |
| Validación y recuperación | Pendiente | En código hay errores por campo, consulta DNI con alternativa manual y aviso al salir |
| Equivalencia visual entre versiones | No establecida | Requiere observar 1.0 |

No se puede concluir cuál versión es mejor o más rápida con la evidencia disponible.

## Venta en la 2.0

Secuencia en `src/features/sales/NewSale.tsx`:

1. Buscar o crear comprador.
2. Introducir equipos, datos técnicos, IMEI, propietario y precio. El formulario admite hasta veinte equipos.
3. Añadir accesorios si corresponde.
4. Revisar fecha, método de pago, descuento y notas.
5. Pulsar «Revisar venta»: se validan datos y se solicitan totales al servidor.
6. Revisar comprador, equipos, propietarios, accesorios e importes. Es posible volver a editar.
7. Confirmar y abrir el detalle de venta si se guarda correctamente.

Vender y registrar los IMEI son operaciones independientes. El formulario lo comunica expresamente.

La captura `1280-sale-editor.png` mide 1280 × 3563 px. En ese caso, la acción final queda al pie de un formulario extenso. La altura corresponde a esa captura, no a todas las ventas.

## Registro en la 2.0

Secuencia en `src/features/registrations/OperationalRegistrationFlow.tsx`:

1. Cliente: DNI, datos del cliente, documentos de identidad, contacto de la atención y equipos vinculados cuando existen.
2. Equipo e IMEI: identificación o recuperación del equipo y selección de los IMEI objetivo.
3. Precio y datos operativos: celular, operador, precio y modalidad por IMEI; fecha y disponibilidad de caja.
4. Evidencias: selección de documentación reutilizable y preparación de archivos para los IMEI indicados.
5. Revisión: resumen del cliente, equipo, solicitudes, importes y evidencias antes de confirmar.

Tras guardar se presenta el resultado para continuar el seguimiento. La captura de cliente en escritorio mide 1280 × 2340 px: el primer paso ya reúne varias tareas y exige desplazamiento vertical.

## Hallazgos y prioridades

| Prioridad | Hallazgo y evidencia | Efecto probable | Propuesta para evaluar |
|---|---|---|---|
| P2 | Mayúsculas globales en `src/styles.css:793`, visibles en capturas | Reduce diferenciación entre instrucciones, títulos y valores | Mantenerlas en códigos y etiquetas breves; comprobar antes si responden a una preferencia operativa |
| P2 | Venta en una página larga; revisión al final | Más desplazamiento al introducir varios equipos | Resumir equipos completados y mantener accesibles total y acción de revisión |
| P2 | Primer paso de registro combina cliente, documentos, contacto y equipos | Carga inicial elevada | Mostrar bloques secundarios cuando sean necesarios, conservando la información obligatoria |
| P2 | Inicio titulado «Registro de equipos», seguido por venta, analítica y luego nuevo registro (`src/pages/Home.tsx:9`) | Las acciones de atención compiten con indicadores | Agrupar búsqueda, venta y registro antes de los indicadores |
| P2 | Configuración aparece antes de Inicio para quien tiene permiso; varios módulos comparten icono (`src/app/App.tsx:33`) | Menor reconocimiento de tareas frecuentes | Priorizar atención y agrupar administración |
| P3 | «FASE 04» y «Acceso privado · Fase 4» (`src/app/App.tsx:53`) | Texto de implementación sin ayuda operativa | Sustituir por información útil del negocio si corresponde |
| P2 | Aviso de cambios sin guardar sin recuperación integral de borrador visible en estos componentes | Repetición de datos tras abandonar o recargar | Evaluar recuperación privada y temporal; el aviso no equivale a guardar el formulario |

Las propuestas son recomendaciones, no cambios implementados. El diseño de 1.0 debe observarse antes de elegir la apariencia final de 2.0.

## Fortalezas que conviene conservar

- Separación entre comprador, propietario, equipo y estado de cada IMEI.
- Revisión previa y regreso a editar antes de confirmar operaciones.
- Reutilización de clientes y equipos; mensajes de validación y estados de carga.
- Marca verde y estructura visual consistente entre formularios.

## Riesgos según el uso

- Atención frecuente: el desplazamiento de ventas y el menú administrativo añaden trabajo visual. No se midió su impacto en segundos.
- Primer uso: el título de Inicio y las distintas tareas intercaladas pueden dificultar localizar el siguiente paso.
- Uso móvil: el menú de varias filas y el primer paso largo de registro merecen una prueba real con teclado abierto, zoom y una sola mano. Las capturas no verifican estas condiciones.

## Detector: cómo interpretar sus tres advertencias

1. `broken-image`, `TemporaryEvidence.tsx:10`: probable falso positivo. Un efecto asigna la URL temporal al elemento. Falta verificar su previsualización durante la ejecución; no se declara imagen rota confirmada.
2. `border-accent-on-rounded`, `styles.css:15`: borde superior acentuado en tarjeta redondeada. Es una observación estética, sin fallo funcional demostrado.
3. `overused-font`, `styles.css:42`: Inter con alternativas de sistema. Preferencia del detector; no justifica por sí sola cambiar la fuente.

No se asigna una puntuación global de usabilidad: falta evidencia en vivo de teclado, lectores de pantalla, contraste calculado, respuesta del servidor y recuperación de errores.

## Pendiente para completar la comparación

- Acceder a 1.0 y capturar inicio, ventas, registro, revisión, resultados y errores en escritorio y móvil.
- Extraer de 1.0 colores, tipografías efectivas, tamaños, espaciado, paneles, botones, formularios y estados.
- Recorrer ambas versiones con el mismo caso de cliente y equipo, aportado por el usuario; distinguir revisión de formulario de una operación que modifica datos.
- Medir pasos, clics, campos repetidos, desplazamiento y respuesta. Separar rapidez del sistema y tiempo de captura de datos.
- Redactar la especificación de diseño para llevar la apariencia elegida de 1.0 a 2.0 preservando sus reglas operativas.

## Notas de ejecución

La independencia A/B se conservó antes de sintetizar hallazgos. Se reutilizó el detector existente, sin repetirlo. No hubo inyección de superposiciones ni servidor de visualización iniciado para esta revisión; no hay procesos nuevos que detener. Las capturas citadas son anteriores a esta revisión y contienen datos de pruebas. No se inspeccionó la web bloqueada por otro método. Archivo de resultados del detector: `detector.json`. Evidencia de B: `assessment-b.md`. No se ejecutó persistencia con `critique-storage`; este informe constituye el archivo manual de la revisión parcial.

Preguntas omitidas: el siguiente paso ya está definido por el usuario; completar la comparación cuando se restablezca el acceso del navegador.
