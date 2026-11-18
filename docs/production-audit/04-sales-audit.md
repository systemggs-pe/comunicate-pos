# Ventas, accesorios, edición y tickets

19/10/2026, America/Lima. HEAD `2751768cf07febf2e0ea7287cf34161fcb445239`. Auditoría sin correcciones.

## Revisión

Formulario de dos pasos, cliente por DNI, comprador/propietario separados, varios equipos, accesorios/cantidades, pagos y fecha operativa. El servidor valida precio/IMEI, recalcula con Decimal y guarda en transacción. La consulta no guarda por sí sola. Clave/hash de idempotencia permiten recuperar una operación repetida. Edición usa expectedUpdatedAt, versión de equipo y permisos adicionales al modificar equipo/IMEI.

| Prueba sintética | Resultado |
|---|---|
| API directa con IMEI inválido | 400, sin venta parcial |
| Dos envíos concurrentes, misma clave | 201/201, mismo id, una venta |
| Equipos 100.10+20.00, accesorios 2×0.10, descuento 0.05 | 120.25 exactos |
| Mismo IMEI, clave diferente | 409 |
| Edición simultánea, misma versión | 200/409 |
| Reporte general sintético | salesRevenue=120.25 |

No se probó pérdida real de paquetes ni toda combinación de compradores/propietarios en navegador. Las suites previas contienen fixtures Luhn inválidos y expectativas anteriores: no son cobertura comercial aprobada. No se editó ninguna venta real.

## Tickets vigentes

Solo **58/80 mm**, conforme a la instrucción posterior del usuario. La mención a 48 en el documento de auditoría es anterior a esa decisión. Selector visible sin 48; ambos PDF descargados desde UI y medidos: 58×254.59 y 80×372.10 mm, una página, Courier/Courier-Bold, venta de dos equipos. Alto variable según contenido. No se reintrodujeron notas/descuentos visuales retirados por el usuario.

No se afirma igualdad de cada píxel con una foto impresa. Impresión física, lector y comportamiento del driver térmico: NOT VERIFIED. Las preferencias de contacto/serie/vendedor/pie que ya no gobiernan la plantilla son AUD-09; se recomienda alinear la configuración sin cambiar unilateralmente el recibo aprobado.

Evidencias: supplemental-probes.json, additional-security-probes.json, ticket-download-results.json, ticket-pdf-measurements.json y ticket-synthetic-58/80.pdf. Las medidas prueban el tamaño del PDF, no la impresión en papel.
