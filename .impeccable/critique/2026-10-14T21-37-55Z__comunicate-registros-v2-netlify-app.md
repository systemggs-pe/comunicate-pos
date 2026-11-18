---
target: COMUNICATE Registros V2 publicado
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "url:https://comunicate-registros-v2.netlify.app/"
timestamp: 2026-10-14T21-37-55Z
slug: comunicate-registros-v2-netlify-app
---
Method: dual-agent (A: ux_design_review · B: ux_browser_audit).

# Informe UX/UI — COMUNICATE Registros V2

Revisión: 14 de octubre de 2026. Fuente: https://comunicate-registros-v2.netlify.app/

La web es una referencia útil para ordenar el trabajo diario de COMUNICATE 2.0.
Sus mejores aportes son los accesos rápidos, la navegación por tareas y la adaptación
a móvil. La mayor oportunidad está en simplificar los formularios y mantener visible
el contexto de la operación. La revisión detectó también defectos de accesibilidad
y señales de carga que conviene corregir antes de adoptar su diseño.

No apareció un inicio de sesión: la web abrió directamente mostrando el espacio de
trabajo. Se inspeccionaron Inicio, Registros, Clientes, Foto DNI y los primeros dos
pasos de registro y venta. No se guardaron ni eliminaron operaciones. Sólo se usaron
datos ficticios en borradores con Pasaporte, que se descartaron explícitamente;
no se consultaron DNI/IMEI, no se subieron archivos y no se activaron proveedores.

## Flujo de trabajo observado

| Área | Recorrido comprobado | Lectura operativa |
|---|---|---|
| Inicio | Nueva venta / Nuevo registro; resumen; accesos a módulos | Acciones frecuentes fáciles de encontrar. |
| Registro | Cliente → Equipo; Atrás; salida con confirmación | División útil, aunque la identificación del equipo acumula campos y decisiones. |
| Venta | Cliente → Equipo y Precio; Atrás; salida con confirmación | El segundo paso reúne identificación, precio, pago, origen, fecha y accesorios. |
| Seguimiento | Registros → filtros y acciones visibles por fila/tarjeta | Permite distinguir estados, pero necesita jerarquía entre acciones habituales y excepcionales. |
| Clientes | Directorio → búsqueda general y selector de criterios | Búsqueda disponible; demasiadas opciones iniciales para una consulta habitual. |
| Foto DNI | Selector de formato y consulta explícita | Advierte sobre créditos; el botón está desactivado con DNI vacío. Consulta real no probada. |

## Valoración heurística

Puntuación provisional de las superficies observadas: **23/40**. Cada criterio se
valora de 0 a 4; no es una certificación ni una nota del backend o del flujo completo.

| Criterio | Nota | Evidencia principal |
|---|---:|---|
| Visibilidad del estado | 3/4 | Pasos y cargas visibles; los totales iniciales muestran ceros antes de cargar. |
| Lenguaje de la operación | 3/4 | Cliente, IMEI, operador y soles son comprensibles; el término bloquear es ambiguo. |
| Control y libertad | 3/4 | Atrás conserva el cliente y abandonar un borrador exige confirmación. |
| Consistencia | 2/4 | Estilo coherente; conteos y nombres accesibles no son uniformes. |
| Prevención de errores | 2/4 | Salida protegida y formatos orientativos; validación final no comprobada. |
| Reconocimiento | 3/4 | Módulos descriptivos y equipos vinculados; falta resumen persistente del cliente. |
| Eficiencia | 2/4 | Búsqueda, filtros y escáner visible; atajos y uso efectivo del escáner no comprobados. |
| Diseño y simplicidad | 2/4 | Jerarquía clara en Inicio; formularios extensos y barra superpuesta. |
| Recuperación ante errores | 2/4 | Error del DNI visible, pero sin instrucciones suficientes para corregirlo. |
| Ayuda operacional | 1/4 | Algunas instrucciones; no se observó ayuda contextual para completar las tareas. |

## Diseño y experiencia

La apariencia es consistente: superficies claras, azul para acciones, tipografía
sobria y tarjetas. Su identidad está más en el contenido operativo que en una
composición visual exclusiva. Para 2.0, la marca debe acompañar la identificación
inequívoca del equipo, el cliente y la acción pendiente.

Inicio transmite orden. Al entrar al paso de equipo aumenta el esfuerzo: más
campos, decisiones y términos operativos, con menos contexto visible. La protección
al salir devuelve confianza. El resultado final después de confirmar no se evaluó.

Funcionan especialmente bien:

- Los dos accesos frecuentes aparecen antes de desarrollar el resto del trabajo.
- Los formularios se dividen en etapas y permiten retroceder conservando datos.
- Foto DNI informa del costo y exige una acción explícita para consultar.

## Cinco prioridades

### 1. P1 — Asociar correctamente las etiquetas de los formularios

En Nuevo registro, el selector de documento y siete entradas del primer paso
carecen de asociación de etiqueta, aria-label e identificador según el DOM.
En Nueva venta se repite el problema en documento, nombre, celular y correo.
Las etiquetas visuales no bastan para quien utiliza lector de pantalla.

Mejora: vincular cada etiqueta con su campo, identificar los datos obligatorios y
relacionar instrucciones/errores con el control. Conservar en 2.0 las asociaciones
que ya implementa ValidatedInput. Verificar teclado y lector de pantalla real.
Comando aplicable: $impeccable harden.

### 2. P1 — Reducir la carga del paso de equipo y mantener su contexto

En venta, Equipo y Precio incluye IMEI, serie, nombre, marca/modelo, memoria/RAM,
color, precio, origen, pago, fecha y accesorios. Al avanzar en registro se observó
scrollY aproximadamente 320, dejando encabezado y progreso fuera de vista. La barra
inferior flotante se superpuso a campos como Color y Memoria/RAM durante la inspección
visual de escritorio; no se demostró que fuese imposible recuperarlos con scroll.

Mejora: agrupar Identificación, Datos comerciales y Opcionales; conservar un resumen
compacto del cliente; llevar foco y vista al título de cada nueva etapa. Reservar
espacio para la navegación y el pie de acciones, y comprobar que no tapen el campo
activo ni los botones al abrir el teclado móvil.
Comandos aplicables: $impeccable layout y $impeccable distill.

### 3. P2 — Explicar el progreso también en móvil

A 375 px, registro muestra 1/2/3/4 sin los nombres de las etapas. A 430 px, venta
muestra 1/2. No se encontró aria-current="step" en el registro inspeccionado.

Mejora: mostrar siempre «Paso 1 de 4: Datos del cliente» y marcar la etapa actual.
En 2.0 conservar sus cinco etapas cuando correspondan, con nombres breves y un
resumen de lo completado. No reducir pasos sin mantener la revisión necesaria.
Comando aplicable: $impeccable adapt.

### 4. P2 — Hacer confiables y comprensibles los contadores

La primera carga mostró ceros y después 34 registros, 31 ventas y 44 clientes sin
una señal visible que distinguiera carga de vacío real. Además, Inicio mostró
44 clientes y el directorio «10 de 33». No se verificó si representan universos,
filtros o permisos distintos; esto no demuestra un error en la base.

Mejora: mostrar «Cargando resumen» o una reserva visual hasta obtener datos; nombrar
el alcance de cada total y usar la misma definición en resumen y listado.
Comandos aplicables: $impeccable clarify y $impeccable harden.

### 5. P2 — Unificar las instrucciones y los controles de recuperación

«DNI no valido» también aparece al avanzar vacío y no explica cómo corregirlo.
«Se bloqueará como registrado» puede confundirse con el bloqueo del equipo.
Foto DNI promete captura/gestión en Inicio, mientras la vista inspeccionada presenta
consulta al proveedor. La X de Nueva venta carece de nombre accesible; la del registro
sí lo tiene y ambas deberían anunciar su propósito.

Mejora: errores como «Ingresa los 8 dígitos del DNI»; separar registrar, bloquear y
consultar foto; nombrar la X «Cerrar formulario de venta». Mantener los mensajes de
proveedor, validación y configuración como situaciones distintas.
Comando aplicable: $impeccable clarify.

## Responsive y fluidez

Se revisaron muestras en 1280×900, 375×900, 390×900 y 430×900. En las vistas medidas
no se detectó overflow horizontal. Registro y venta pasan a una columna; Registros
se presenta en tarjetas en móvil. No se midieron todas las pantallas en cada tamaño.

- Los filtros de Registros miden 34 px de alto a 375 px. Conviene ampliar su área
  táctil aproximadamente a 44 px para un uso cómodo; no se presenta como una
  declaración de incumplimiento normativo.
- Las acciones principales del listado miden 44 px. Cancelar/Siguiente del formulario
  miden 43 px; esa diferencia por sí sola no constituye un problema prioritario.
- Siguiente y Cerrar registro mostraron foco visible con contorno aproximado de 2,7 px.
  La verificación no cubre todo el recorrido de teclado.
- Se observó «Cargando modulo...» en la primera apertura de los formularios y después
  cargaron. No se midieron tiempo de carga, FPS, conexión lenta ni rendimiento comparado.

La fluidez debe valorarse por el esfuerzo para completar cada operación: mantener
contexto, recuperar datos, evitar repetir campos y entender el resultado. Eso ofrece
más valor inmediato para 2.0 que añadir animaciones.

## Qué trasladar a COMUNICATE 2.0

Esta comparación usa el código local actual, no una nueva auditoría completa de 2.0.

| Prioridad | Cambio propuesto en 2.0 | Base que se conserva |
|---|---|---|
| Alta | Inicio con Nueva venta/Nuevo registro visibles antes del dashboard; resumen operativo compacto. | Reportes y métricas existentes. |
| Alta | Navegación móvil de tareas frecuentes y Más para administración. | Permisos, usuarios, roles y auditoría. |
| Alta | Resumen cliente/equipo entre etapas y grupos de campos más pequeños. | Doble IMEI, una solicitud por IMEI y revisión antes de guardar. |
| Media | Acción explícita para reutilizar datos de contacto en esta atención. | Separación entre datos del cliente y contacto histórico del registro. |
| Media | Ayudas y párrafos en escritura normal; mayúsculas selectivas para códigos/estados. | Normalización de nombres y datos que requiera el sistema. |
| Media | Estado visible de CODART/Gemini y explicación de consultas, créditos y fotos guardadas. | Confirmación documental, almacenamiento privado y clasificación humana de las imágenes. |

El código actual de 2.0 impone mayúsculas a toda la interfaz mediante una regla global;
reducir esa imposición ayudaría a jerarquizar títulos, ayudas y mensajes. Su formulario
actual ya declara la etapa activa con aria-current="step" y tiene errores asociados:
esas mejoras deben conservarse. La web de referencia ofrece DNI/CE/Pasaporte en la
interfaz; no se verificó su guardado y no se propone incorporarlos a 2.0 sin validar
previamente su modelo y reglas.

## Personas y observaciones secundarias

- Operador nuevo: necesita distinguir bloqueo del dispositivo de cierre de una solicitud.
- Operador frecuente: pierde tiempo recorriendo formularios amplios y filtros específicos.
- Usuario de teclado/lector de pantalla: necesita etiquetas y cierre de venta identificables.

La búsqueda de Clientes ofrece siete criterios en el selector. Una búsqueda general
con filtros avanzados progresivos reduce decisiones iniciales. Las acciones repetidas
por registro también requieren separar lo frecuente de lo excepcional.

## Límites

No se verificaron guardado, edición/eliminación, resultado de proveedores, escáner,
archivos, cámara, impresión, tickets, constancias, seguridad del backend, contraste
calculado, zoom al 200 %, lector de pantalla real ni recuperación de errores de guardado.
Los borradores ficticios fueron descartados. No se modificó el código de 2.0.

## Decisiones para una siguiente fase

1. ¿Qué priorizamos: formularios y rapidez, navegación móvil o Inicio/dashboard?
2. ¿Qué alcance quieres: conservar el estilo actual y pulirlo, renovar toda la interfaz,
   o comenzar con un prototipo de registro/venta?
