# Inventario general del sistema

Fecha: 19/10/2026, America/Lima. Baseline: master `2751768cf07febf2e0ea7287cf34161fcb445239`. Solo auditoría y diagnóstico.

## Arquitectura y alcance

React 19/Vite, router propio, Express 5, Prisma/PostgreSQL. Validaciones compartidas en shared; servicios/repositorios/integraciones en server. S3/MinIO privado para imágenes; tickets en navegador y PDFs A4 en servidor. Templates para Node 24, proxy TLS, Neon, R2/B2 y worker. Versiones instaladas exactas: `evidence/baseline.json`.

Se ejecutaron estáticas, bundles, unitarias, integración y ambos grupos E2E. Límites globales E2E: 180/120 s. Ninguna interrupción se declaró PASS. No se reutilizaron resultados históricos como evidencia de este HEAD.

| Módulo | Implementación | Verificación actual |
|---|---|---|
| Login/sesiones | IMPLEMENTADO | Parcial: API/CSRF/revocación; E2E no completo |
| Google Auth | IMPLEMENTADO | NO VERIFICADO real; dependencia externa/configuración |
| Usuarios/roles/permisos | IMPLEMENTADO | Parcial: jerarquía, revocación, denegaciones de servidor |
| Clientes/búsqueda | IMPLEMENTADO | API/UI/expediente de muestra |
| Equipos/IMEI | IMPLEMENTADO | Unicidad, doble IMEI y relación venta/RECO de muestra |
| Luhn | IMPLEMENTADO | Nuevas escrituras/formatos probados; históricos intactos |
| Ventas/accesorios/pagos | IMPLEMENTADO | Dinero/idempotencia/concurrencia de muestra |
| Registros RECO | IMPLEMENTADO PARCIALMENTE | Falta enforcement documental; cobertura no completa |
| Evidencias/Fotos DNI | IMPLEMENTADO | Privacidad/reutilización de muestra comprobadas |
| Gemini | IMPLEMENTADO | Mocks/código; API real NO VERIFICADA |
| CODART | IMPLEMENTADO | Mocks/contrato interno; API real NO VERIFICADA |
| Declaración jurada A4 | IMPLEMENTADO | Unitarias PDF aprobadas tras configurar Python |
| PDF de evidencias | IMPLEMENTADO | Unitarias/generación de muestra; no todo E2E |
| Tickets 58/80 | IMPLEMENTADO | Descarga/dimensiones comprobadas; hardware NO VERIFICADO |
| Dashboard/reportes/CSV | IMPLEMENTADO | Parcial: revisión y muestra exactitud/Lima |
| Configuración | IMPLEMENTADO PARCIALMENTE | Opciones de ticket obsoletas |
| Backups/restore | IMPLEMENTADO | Ruta del producto NO VERIFICADA; restore manual separado probado |
| Auditoría interna | IMPLEMENTADO | Trazabilidad técnica; política de retención pendiente |
| Navegación/MÁS | IMPLEMENTADO | Muestra seis anchos; no toda combinación de permisos |
| Worker/limpieza | IMPLEMENTADO | Código; suite de perfil fijo bloqueada; instalación NO VERIFICADA |
| Alertas completas | NO IMPLEMENTADAS/NO DEMOSTRADAS como cadena | Logs/estado no prueban entrega al responsable |
| Infraestructura cloud | Plantillas presentes | BLOQUEADO por evidencia externa |

Presencia en el menú no se consideró prueba de funcionamiento. No se hizo instalación limpia npm ci, build ARM64 ni prueba de proveedor productivo. Reproducibilidad completa y runtime del destino quedan pendientes. Los servicios comerciales siguieron funcionando; pruebas de escritura solo en contenedores separados.
