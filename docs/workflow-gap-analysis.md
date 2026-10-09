# Workflow alignment — análisis inicial (Bloque A)

Base: master / e404c1b; Git limpio. Phase 5 DNI implementada con prioridad
PostgreSQL, mock local y adaptador API sin credenciales comerciales verificadas.

| Capacidad | Estado inicial | Cambio previsto |
| --- | --- | --- |
| Client → Equipment → Imei | Canónica y transaccional | Reutilizar |
| DNI, auth, permisos, auditoría | Implementados | Reutilizar sin credenciales nuevas |
| Doble IMEI y estados independientes | Implementados | Reutilizar y agregar solicitudes por IMEI |
| Registro técnico | Actualiza IMEI, no conserva solicitud comercial | Mantener acceso técnico histórico; proteger IMEIs gestionados por solicitud |
| Contacto histórico/operador/precio/condiciones | Ausentes | Snapshot operativo en RegistrationRequest |
| Revisión e idempotencia de solicitud | Ausentes | Wizard operativo y clave por confirmación |
| Evidencias | Ausentes | Archivos temporales de navegador; sin respaldo ni PDF |
| Seguimiento de solicitudes | Ausente | Listado, detalle, edición segura, completar/cancelar, lote confirmado |
| Venta con múltiples equipos y owner != buyer | Implementada | Conservar |
| Accesorios y fecha comercial | Ausentes | SaleAccessory y occurredAt, suma Decimal/céntimos |
| Identificación técnica ampliada | Marca/modelo/serie | Agregar nombre comercial, RAM/ROM/color sin duplicar equipo |
| Ficha consolidada | Equipos y ventas | Añadir solicitudes reales e historial |

Client.dni tiene VARCHAR(8), UNIQUE y CHECK, y DNI se usa en contratos existentes.
No se amplían documentos en esta entrega: selector explicita DNI disponible;
CE/pasaporte/RUC requieren una migración futura de identidad y sus contratos.
No se asigna significado a PASE ni se convierte a EXTERNAL. STORE/EXTERNAL
mantienen su definición. Sin OSIPTEL, PDF/ticket, scanner ficticio o fotos persistentes.

Política de solicitudes: PENDING → COMPLETED (IMEI REGISTERED) o CANCELLED;
cancelar COMPLETED es acción explícita autorizada y deja IMEI CANCELLED, historial
y motivo. Un IMEI PENDING/PROCESSING/REGISTERED previo o con solicitud vigente no
admite una nueva solicitud. Una cancelación expresa permite una nueva atención.
No se editan IMEI, equipo ni propietario en el formulario genérico.

Revisión por bloques: A análisis; B esquema/migración y validación Prisma;
C/D servicios, registro y seguimiento; E venta/accesorios; F fichas;
G UX y búsquedas; H regresión, PostgreSQL real, E2E y documentación.
Los commits se realizan tras pasar los controles pertinentes. No push ni deploy.
