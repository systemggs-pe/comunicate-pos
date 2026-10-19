# UI/UX y responsive

19/10/2026, America/Lima. HEAD `2751768cf07febf2e0ea7287cf34161fcb445239`. Auditoría sin correcciones.

Criterios de Impeccable y UI/UX Pro Max aplicados como auditoría, sin rediseñar ni corregir. Microsoft Edge/Playwright headless, entorno y datos sintéticos.

## Cobertura

16 vistas × 375/390/430/768/1280/1440 px = **96 observaciones finales**. Inicio, registros/nuevo, ventas/nueva, clientes, equipos, usuarios, roles, reportes, foto DNI, configuración, detalle venta/registro y tickets 58/80. Capturas 375/1440 por vista, selector y login 390 en evidence/screenshots.

Primera pasada capturó varias pantallas antes de acabar carga. Se conserva browser-initial-loading-observations.json como insuficiente y se repitió esperando networkidle y desaparición de “Cargando...”. La última muestra cargada no presentó overflow horizontal ni pageerror. role=status vacío del escáner no significa carga pendiente. La repetición no se cuenta como 96 tests nuevos.

No prueba todos los datos largos, cuatro pasos, estados de cada modal, combinaciones de rol o dispositivos físicos. Los PDFs de referencia previos no se asumieron verificación actual ni se difundieron sus datos; no se afirma comparación pixel-perfect con DISEÑO/DISEÑO VENTA/LOGIN(1).

## Interacción y límites

Correo mixto conserva valor y text-transform:none. Tab deja foco visible y Escape cierra selector. ReferenceDialog usa dialog/showModal/aria-label. Inputs principales etiquetados y botones con nombres accesibles.

AUD-11/P3: Buscar IMEI 33×36 y Cerrar sesión 36×36 a 390 px; ampliar área táctil preferente 44×44 sin confundirlo con diagnóstico automático WCAG. Contraste exhaustivo, lector de pantalla, zoom, teclado/cámara físicos y movimiento reducido en dispositivos: NOT VERIFIED. Hay estilos reduced-motion revisados, no certificación de accesibilidad.

Selector de ticket contiene solo 58/80 y Cancelar; ambas descargas se ejecutaron. Detalles/scroll del modal y navegación inferior inspeccionados en capturas seleccionadas. Nuevo registro móvil solo acredita el primer paso visible.

E2E normal/MVP: límites 180/120 s; siete casos aprobaron, 16 fallaron, 53 sin concluir. Selectores/fixtures desactualizados impiden certificar el diseño funcional completo.
