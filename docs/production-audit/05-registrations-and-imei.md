# Registros, doble IMEI, Luhn y compartir

19/10/2026, America/Lima. HEAD `2751768cf07febf2e0ea7287cf34161fcb445239`. Auditoría sin correcciones.

## Validación global

shared/imei.ts opera sobre string de 15 dígitos y checksum de derecha a izquierda, preservando ceros. Se integra con Zod en escrituras/ediciones/detección. La búsqueda histórica no impone la barrera de nueva escritura. Se probaron formato válido con cero inicial, longitudes, letras, espacios y checksum inválido. API directa inválida→400 sin venta parcial; duplicado→409. La longitud no sustituye Luhn.

70 históricos reales no cumplen la regla actual: se conservaron y no se ocultaron. No se deben reparar checksums automáticamente ni confundir esta validación con consulta de robo/bloqueo/lista blanca.

## Flujo de cuatro pasos

Revisados cliente/contacto, equipo/IMEI, condiciones/precio y evidencias. Hay entrada específica para celular de IMEI 2; el esquema exige teléfonos distintos. BITEL predeterminado, TIENDA/EXTERNO, BLOQUEADO/PENDIENTE son opciones internas; marcar registrado no demuestra interacción real con el operador.

Muestra suplementaria: dos IMEI válidos→dos RECO/un dispositivo, celulares distintos. Dos transiciones concurrentes→200/409 y una sola finalización. La transacción Serializable impide presentar una lectura anterior al lock como una carrera demostrada.

AUD-02/P1: requireIdentityPhotos opcional controlado por cliente. Omitirlo sin evidence/documentEvidence devuelve 201 con cero fotos. Con dos lados vigentes guardados manualmente, el siguiente trámite reutilizó ambos automáticamente y pasó la comprobación.

La cobertura completa UI de los cuatro pasos, cada operador/estado y todas las evidencias no quedó aprobada: gran parte de suites se detiene en fixtures Luhn. No se modificaron fixtures durante la auditoría.

## Compartir y documentos

Se distinguen REGISTRO, REGISTRO DOBLE y DESBLOQUEO LISTA BLANCA; IMEI objetivo/celulares y agrupación por operación/equipo/propietario. Portapapeles sin envío automático. Defecto reproducido AUD-06: provincia omitida, se concatena departamento y no se compara provincia al agrupar.

Declaración jurada A4 usa layout/fuentes locales, sin modificar plantilla. PDF de evidencias es documento independiente. Permisos de servidor revisados. Unitarias PDF seleccionadas aprobaron al indicar Python instalado; recorridos integrales siguen limitados. Generación no equivale a impresión física.
