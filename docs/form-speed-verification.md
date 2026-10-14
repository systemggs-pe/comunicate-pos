# Formularios y rapidez — primera mejora

Cambios locales en registro y venta:

- Contactos guardados se proponen únicamente mientras el campo no se haya editado.
  Vaciar el dato conserva el vacío y permite corregirlo; las validaciones siguen activas.
- «Usar contacto guardado» completa campos vacíos conservando correcciones no vacías.
  El contacto de la atención conserva su independencia respecto a la ficha del cliente.
- Progreso «Paso N de M: nombre» visible también en móvil. El registro mantiene cinco
  etapas y la venta sus fases de captura/revisión; la confirmación final sigue explícita.
- Cliente visible entre etapas; el equipo se resume después de identificarlo, evitando
  repetirlo durante su búsqueda. Avanzar/volver lleva foco al encabezado y vista al
  progreso. Agregar un equipo en venta lleva al equipo nuevo.
- Teclado numérico para celular y referencia.

Verificación: TypeScript, lint y compilación Vite pasan. Detector Impeccable: []
para los componentes inspeccionados. 22 E2E únicas verificadas: 16 MVP y 6 de
ventas/flujos operativos. Incluyen escaneo, consultas simuladas, documentación,
doble IMEI, accesorios, comprador/propietario distinto y conservación del borrador.
Una prueba detectó duplicación del nombre de equipo en el paso de identificación;
se redujo esa redundancia y el escenario volvió a pasar. Se reejecutaron las dos
pruebas nuevas de foco/contactos tras el ajuste, sin sumarlas como pruebas adicionales.

Las pruebas usan PostgreSQL/MinIO aislados y datos sintéticos. Capturas móviles en
.test-results/forms-speed/. No hubo consultas reales a CODART/Gemini en las pruebas.
No hay migraciones ni cambios de requisitos comerciales. No se midió una reducción
cuantitativa de tiempos de atención o rendimiento de red.

El error DATABASE_UNAVAILABLE coincidió con la recuperación de PostgreSQL tras
un reinicio. Terminó la recuperación y se verificó SELECT 1 y los conteos comerciales:
603 clientes, 576 ventas, 118 registros. No fue necesario restaurar ni inicializar la base.
