# MVP 01: estado de las integraciones

El proyecto incorpora escaneo de cajas para ventas y registros, el adaptador
CODART y las bases del almacén privado de documentos de clientes. Este avance
conserva el trabajo previo a la revisión de la importación de Tacna.

- Gemini y CODART permanecen desactivados por defecto. Las claves se configuran
  exclusivamente en el backend mediante variables de entorno.
- El escaneo comienza al seleccionar una imagen, conserva las correcciones
  manuales y no crea ventas, equipos ni solicitudes automáticamente.
- Las migraciones 20261012000100 a 20261012000300 agregan el nombre completo y
  las relaciones para documentos privados. Las migraciones de solicitantes
  creadas durante la revisión de Tacna fueron retiradas.
- El almacén de documentos tiene infraestructura de backend; la experiencia
  completa de interfaz, las pruebas específicas de CODART y la verificación
  con proveedores reales siguen pendientes. Este avance no certifica la
  entrega completa de la extensión MVP 01.

La importación de Tacna y sus correcciones se revirtieron en el entorno local.
La base activa conserva la primera importación: 603 clientes, 641 equipos,
643 IMEI, 576 ventas y 118 registros. El repositorio no contiene datos de esa
base, archivos de credenciales Firebase ni respaldos de las migraciones.

Los respaldos y herramientas locales de revisión permanecen bajo `.local/`,
excluido de Git. Los archivos temporales de PDF y las salidas locales no forman
parte de esta entrega.
