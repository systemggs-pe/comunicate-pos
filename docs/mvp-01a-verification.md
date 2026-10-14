# 01A — Escaneo de cajas

Implementación local comprobada con proveedor simulado en PostgreSQL aislado:
18 pruebas unitarias, 7 de integración y 4 E2E. Las pruebas de navegador cubren
venta completa, registro completo, edición durante el análisis, cambio A→B,
dos equipos independientes, doble evento, respuesta inválida y cuota agotada.
Se comprobaron anchos de 1280, 375, 390 y 430 px sin desbordamiento horizontal.

TypeScript y lint pasan. El backend exige habilitación, clave y modelo antes de
consumir presupuesto del proveedor real. Las respuestas vuelven a validarse
en el navegador. Los proveedores del servidor de pruebas se muestran como
simulados y ese servidor exige la base `communicate_pos_test` en loopback.

Gemini real y cámara/galería de dispositivos físicos: NOT VERIFIED.
No hubo llamadas reales, push, deploy ni cambios en la base comercial local.
