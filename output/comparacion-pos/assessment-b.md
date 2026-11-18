# Assessment B — evidencia local y detector

Revisión independiente sin navegador, red ni cambios de UI. Fecha: 14/10/2026.

## Detector

Resultado en detector.json: 3 advertencias, 0 errores; 1 quality y 2 slop.

| Regla | Ubicación | Interpretación |
|---|---|---|
| broken-image | src/features/registrations/TemporaryEvidence.tsx:10 | Probable falso positivo: useEffect en línea 8 asigna Blob URL a preview.current.src; imagen sólo se monta si hay archivo. Verificación visual de la previsualización pendiente. |
| border-accent-on-rounded | src/styles.css:15 | Patrón real: tarjeta de métricas con borde superior verde de 3 px y radio 12 px. Juicio visual, sin demostrar fallo funcional. |
| overused-font | src/styles.css:42 | Inter declarada con Segoe UI como alternativa. Preferencia estética del detector, no defecto de accesibilidad ni motivo suficiente para cambiar tipografía. |

## Evidencia local

Se inspeccionaron .test-results/workflow/1280-registration-client.png y 1280-sale-editor.png, capturadas hoy a las 15:15 hora Lima. Son posteriores a styles.css (10/10), y coinciden con los cinco pasos de registro de OperationalRegistrationFlow.tsx, la sidebar y las leyendas FASE 04 de App.tsx, y text-transform:uppercase global. Son evidencia vigente para composición general, sin probar cada estado actual ni rapidez real.

Registro: sidebar fija amplia; búsqueda global por IMEI antes del encabezado; cinco pasos; primer paso largo, con cliente, fotografías de identidad, contacto operativo y equipos vinculados. La captura completa mide 1280×2340. Acciones CONTINUAR y SALIR al fondo.

Ventas: comprador, equipo, accesorios, pago/fecha y revisión en una página larga (1280×3563). Cada equipo expande varios campos. La búsqueda global por IMEI antecede al formulario. Acceso REVISAR VENTA al final.

Observaciones: texto en mayúsculas casi universal y abundante ayuda de tamaño pequeño; contenido técnico de fase en sidebar/footer; mucha navegación vertical antes de completar tareas. Se puede preservar marca verde, estructura de datos, validación, revisión e idempotencia mientras se evalúa densidad y visibilidad de acciones. Las medidas de altura describen estas capturas, no todo caso posible.

Hay otras capturas en .test-results/workflow, refinement, dual-imei, phase9/responsive, y pruebas a 1280/375/390/430 px. docs/workflow-verification.md:54 registra 48 capturas de doce vistas; docs/operational-refinement-verification.md:118 informa ausencia de overflow horizontal. Son resultados documentados, no pruebas rerun en esta revisión.

## Límites

No se halló referencia visual verificable de 1.0 publicada en docs/output/tests. docs/verification.md indica que 2.0 se creó desde cero y sin reutilizar código del POS anterior. No hay base para afirmar coincidencias/diferencias visuales entre versiones, pasos exactos de 1.0 ni superioridad de fluidez. No se abrió el sitio remoto. Las capturas sintéticas locales no equivalen a evaluación de latencia, uso móvil físico ni revisión de producción.
