# Operational refinement — baseline y política

Baseline master / ea505c1, Git limpio. Respaldo privado .local/operational-refinement.dump restaurado y verificado en communicate_pos_refinement_copy: 1 cliente, 2 equipos, 4 IMEIs, 0 ventas y 2 solicitudes. No se realizan purgas de datos locales durante el desarrollo.

La copia conserva el baseline y sirve para validar la migración antes de aplicarla a la base de uso. Un caso COMPLETED/BLOCKED requiere decisión humana: se conserva toda la información histórica y la migración debe bloquear mientras no haya una resolución explícita. Ventas PENDING/CANCELLED/REFUNDED o equipos compartidos entre ventas bloquean la migración de ventas; no se reinterpretan como ventas realizadas.

IMEI sin solicitud y sin atención histórica usa NULL (sin solicitud); no es un cuarto estado operativo. Los tres estados de atención son BLOCKED/PENDING/REGISTERED. Los estados y condiciones previos permanecen en columnas históricas privadas; no son entradas operativas. PROCESSING/REJECTED/CANCELLED ambiguos bloquean migración. REGISTERED/PENDING conservan significado.

Se elimina Sale.status, su enum y SaleEquipment.isActive; una venta existe o se elimina mediante una operación explícita autorizada. Cada línea solo crea equipo nuevo. IMEI global UNIQUE y equipo con una sola venta. Permisos delete solo SUPERADMIN inicialmente.

Eliminación usa preflight autenticado y fingerprint del conjunto exacto, confirmación ELIMINAR y motivo; revalida y bloquea dependencias cambiadas dentro de una transacción serializable. Los clientes nunca son parte del conjunto. Solicitud individual conserva equipos con venta/otras solicitudes; expediente externo huérfano puede eliminarse con confirmación explícita. Expediente con venta obliga usar la eliminación integral de esa venta. Auditoría anterior de entidades borradas se purga para evitar snapshots sensibles y se deja un evento mínimo de eliminación con UUIDs y conteos.

No hay facturación fiscal ni archivos persistentes en este modelo; no se introduce una afirmación de autorización legal. Nuevas dependencias futuras deben integrarse en el preflight y bloquear eliminación incompatible.

Normalización Unicode mayúscula para datos operativos; correo guardado normalizado en minúscula; autenticación, contraseñas/tokens/UUIDs/IMEIs no se transforman. Client añade dirección/departamento nullable y se reutiliza el autocompletado local sin sobrescribir datos guardados.
