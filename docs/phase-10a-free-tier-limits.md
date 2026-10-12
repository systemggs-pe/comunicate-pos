# Phase 10A — Cuotas gratuitas

Verificación documental: 11/10/2026. Límites mutables; confirmar en cuenta antes de activar. No se crearon cuentas ni se introdujeron tarjetas.

| Proveedor | Referencia gratuita | Tarjeta/cargos | Disponibilidad/dependencias | Alertas/control |
|---|---|---|---|---|
| Oracle A1 | 1.500 OCPU-h y9.000 GB-h/mes ≈2 OCPU/12GB; 200GB boot+block compartidos | Alta puede exigir tarjeta/verificación; sin upgrade PAYG | Home region, etiqueta eligible, capacidad; reclamación por inactividad | Budget/quotas/Console; notificar no equivale a hard cap |
| Neon Free | 1GB/proyecto,100 CU-h/mes/proyecto | Free sin tarjeta; no cambiar plan | Agotamiento/autosuspend/cold starts; 0,25CU continuo excede100 CU-h | Panel por proyecto; no asumir operación permanente |
| Pages Free |500 builds/mes,1 concurrente,20min/build;20.000 archivos,25MiB/archivo | Estático Free; extras fuera del alcance | Cuenta/proyecto; Functions consumen Workers | Builds manuales y contador; sin deploy automático |
| R2 Standard |10GB-mes,1M ClassA,10M ClassB/mes; egress directo gratis | Subscription/checkout; verificar método de pago; excesos facturables | Free sólo Standard, no Infrequent Access | Panel/billing y alertas propias; no hard cap garantizado |
| B2 |Primeros10GB; egress gratis hasta3× almacenamiento medio | Inicio sin tarjeta; controlar exceso | Todas las copias/versiones consumen cuota; caps pueden bloquear | Caps diarios, alertas75/100%; ClassD sin cap |
| Actions Free |Privados:2.000min/mes,500MB artifacts; públicos estándar gratis | Larger runners facturables | Cuota compartida con otros proyectos/Packages | Budget Stop usage y correo90/100%; no workflow habilitado |

Fuentes: [Oracle](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm), [Neon pricing](https://neon.com/pricing), [Neon actualización02/10/2026](https://neon.com/blog/neon-free-plan-1-gb-per-project), [Pages](https://developers.cloudflare.com/pages/platform/limits/), [R2](https://developers.cloudflare.com/r2/pricing/), [alta R2](https://developers.cloudflare.com/r2/get-started/), [B2 pricing](https://www.backblaze.com/cloud-storage/pricing), [B2 caps](https://www.backblaze.com/docs/en/cloud-storage-data-caps-and-alerts), [B2 alta sin tarjeta](https://help.backblaze.com/hc/en-us), [Actions](https://docs.github.com/en/billing/reference/product-usage-included).

El lector no extrajo pricing Neon; anuncio oficial02/10/2026 confirma1GB/100CU-h. No usar artículos antiguos0,5GB como configuración actual. Requisitos de contratación/tarjeta se confirman manualmente, no hay alta aprobada.

## Presupuesto

Objetivo S/0 dentro de cuotas, preparación local sin cargos cloud. Oracle inicial1OCPU/6GB y50GB boot deja margen. Neon: health público no abre DB; worker15min puede afectar autosuspend: medir CU-h. R2 reads/listados de backups también consumen operaciones.

`backupEstimate` suma todas las copias, manifiestos y20% margen: 3GB×3 copias ya excede10GB. BACKUP_MAX_RETAINED_BYTES=8GB limita objetos visibles del prefijo; NO incluye versiones ocultas B2, otros buckets, operaciones ni transferencia. Configurar lifecycle aprobado para versiones, caps/alertas antes de upload. Nunca borrar respaldos para esconder exceso.

Registrar uso semanal y responsable. Umbrales70/85/95% sólo alertan; no garantizan impedir cargos. Ante posible cargo detener y solicitar autorización. No contratar sustitutos pagos.
