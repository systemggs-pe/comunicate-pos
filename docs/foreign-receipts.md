# Boletas extranjeras

El módulo se abre desde **Más → Boletas extranjeras**. Incluye emisión desde ventas y manual, emisores por formato, historial y la consulta pública en `/boleta`. La sesión y los permisos son los del POS.

El módulo toma el precio de cada línea de equipo seleccionada. Usa la fecha más reciente de las ventas seleccionadas y resta un día calendario en hora de Lima. Guarda ambas fechas. Los documentos manuales usan la fecha declarada en el formulario. Los PDFs identifican a COMUNIC@TE y usan los datos del emisor configurado. La consulta pública confirma coincidencias con el historial del POS.

Cada boleta conserva su folio y una copia de los datos usados para reproducir el PDF. El archivo se genera en el navegador de la sesión autorizada para descargar o imprimir. El POS guarda los datos de la boleta en PostgreSQL. No se publica un enlace al PDF.

Los siete formatos derivan del módulo original en el commit `db2e2c7b9a923777607e4df708abe612f3865e35`. Se conservan sus dimensiones, incluido el formato Thermer de 48 mm del módulo original.

## Configurar emisores

En **Emisores**, guarda el nombre y documento para cada formato que se vaya a utilizar. Los formatos en dólares requieren indicar el tipo de cambio PEN/USD. La conversión a CLP conserva la regla operativa del módulo original, con factor 266.67 y redondeo al múltiplo de 5000 más próximo.

Los permisos iniciales son:

| Rol | Consultar | Emitir | Editar | Configurar emisores |
| --- | --- | --- | --- | --- |
| Vendedor | Sí | Sí | | |
| Administrador | Sí | Sí | Sí | |
| Superadministrador | Sí | Sí | Sí | Sí |

## Importar el historial

Usa una exportación JSON autorizada. El archivo acepta un arreglo de documentos históricos o un objeto con `boletas` y, opcionalmente, `emisores` y `ultimoFolio`. Incluye el ID de Firestore como `id` en cada fila y conserva `nBoleta`, `formato`, `boletaData` y los totales disponibles. Los emisores se agrupan por `formato1` a `formato7`. Usa `ultimoFolio` para traer el valor de `contadorBoletas.last` si es mayor que el último folio exportado.

Primero ejecuta una simulación con la base de destino verificada:

```powershell
npx tsx scripts/import-foreign-receipts.ts exportacion.json
```

El reporte indica filas listas, existentes, duplicadas, vínculos pendientes y el siguiente folio. Tras revisar el resultado, usa `--apply` para guardar. La importación conserva la fecha y el importe históricos, identifica cada fila por su ID de origen y puede repetirse. Cuando hay un conflicto de folio o IMEI, la fila queda en el reporte. Una boleta importada puede conservarse sin vínculo si la venta o el equipo no se pueden identificar con certeza.

En **Nuevo registro → Evidencias → Boleta de venta**, el POS busca primero una boleta del equipo. Si falta, puede generarla desde la línea de venta o pedir los datos pendientes para emitirla manualmente. La generación requiere permiso de emisión y un emisor configurado. La boleta generada se guarda como imagen privada y ocupa su recuadro en la segunda página del RECO. Si adjuntas un PDF original, el expediente conserva el archivo que subiste y usa la página que identifica al equipo. Ambas solicitudes comparten la misma evidencia cuando se registran dos IMEIs.
