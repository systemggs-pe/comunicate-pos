# Phase 10A — Worker acotado

PREPARED. `npm run worker:run` Node independiente, DATABASE_URL y WORKER_DATABASE_URL explícitas. No ejecutar con DB operativa sólo para demostrar conectividad; pruebas usan fixtures locales.

Timer systemd OnUnitInactiveSec15min,OnBoot5min,jitter60s. Units en ops/worker NO instaladas/habilitadas. Oneshoot no se solapa y lock pg_try_advisory_xact_lock(741021,10) dentro transacción dedicada impide concurrentes entre hosts. Liberado en commit/rollback/desconexión; compatible pooling transaccional. Cliente de lock separado con1 conexión, no mismo pool ocupado por sí mismo.

Batch25(max100),2 batches(max10),90s(max180s). Deadline entre objetos; S3 timeout15s/2 intentos y transacción por asset20s. SIGTERM AbortController detiene nuevo trabajo y permite finalizar operación; unidad130s start/25s stop. Outbox DB persiste DELETING/deleteAttempts/errorCode. Limpia PENDING/FAILED expirados sin links, READY staging tras ventanaPUT+5s y borrados última referencia; respeta verification window. No modifica estados IMEI/RECO/ventas ni notifica clientes.

SUCCESS/PARTIAL/FAILED; PARTIAL exit2 para lock busy, pendientes,orphans,truncamiento/interrupción; unidad reconoce2 pero monitor debe alertar persistencia. FAILED exit1 genérico sin DNI/IDs/URLs/tokens. Status atómico0600 con conteos/fecha/duración; public health no publica información privada.

Escaneo sólo100 keys por invocación, reporta scanTruncated. NO elimina objetos desconocidos ni loguea nombres. No afirmar auditoría completa del bucket; preparar paginación/cursor si supera100 antes de depender de scan global. Inconsistencias no reparables se revisan manualmente, nunca crear/terminar solicitudes. Monitor PARTIAL3 runs, FAILED, pendientes crecientes y antigüedad>45min.

Backup pausa API/worker/operadores. Oracle reclamable/noSLA: sin actividad artificial. Alternativa ejecución manual externa con lock/secrets/cuotas, o Actions workflow_dispatch tras autorización; NO habilitada ni copias como artifacts. Sin sustituto pago automático.
