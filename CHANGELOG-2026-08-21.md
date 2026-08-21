# Changelog semanal — 17 al 21 de agosto de 2026

## Resumen

Durante esta semana se reforzaron los flujos de despacho, planificación de rutas,
entregas, recepción de paquetes, navegación móvil y contabilidad. También se
mejoró la consistencia entre las paradas reales de una ruta y las órdenes
asociadas.

## Despacho y rutas

- Se consolidó `Stop` como la fuente principal de las paradas reales de una ruta.
- Se mejoró la creación transaccional de rutas para órdenes normales y direcciones favoritas.
- Las direcciones favoritas ahora se convierten en paradas persistentes con su referencia de origen.
- Se reforzó la edición y ampliación de rutas con órdenes y favoritas.
- Se mejoraron las validaciones de dirección, coordenadas y número de calle antes de crear una parada.
- Se evitó la duplicación de paquetes retenidos al asignar una nueva ruta.
- Las rutas asignadas sincronizan correctamente el estado de las órdenes y la asignación del chofer.
- Se mantuvo el comportamiento idempotente para asignaciones repetidas al sistema de mensajería.

## Paquetes retenidos y recepción

- Se implementó el flujo persistente para saltar una parada indicando si el paquete:
  - queda en el vehículo del chofer;
  - debe regresar a la oficina.
- Se almacenan el chofer responsable, el motivo y las fechas relacionadas con el salto.
- Los paquetes retenidos aparecen en Recepción con el estado **“En el chofer”**.
- La recepción incluye tanto órdenes normales como paradas favoritas.
- Las órdenes retenidas se agregan automáticamente a la siguiente ruta del mismo chofer.
- Las favoritas retenidas también se recargan en la siguiente ruta sin crear duplicados.
- Se añadieron acciones para recibir paquetes en la oficina y liberarlos nuevamente al despacho.
- Se conservan los datos de dirección, cliente, pagos y notas de las órdenes normales.
- Las favoritas retenidas no se pierden cuando se elimina una ruta o una parada individual; quedan disponibles para ser recargadas.
- Se añadió la fecha de recepción en oficina al registro de las paradas.

## Planificador del chofer

- Se eliminó la guía superior de navegación.
- Se mantuvo el menú de opciones dentro del botón de tres puntos.
- Se eliminó la barra inferior móvil.
- El panel inferior ahora puede ocupar toda la pantalla.
- Las distancias visibles se muestran en millas.
- Las velocidades visibles se muestran en millas por hora.
- Después de completar una parada se vuelve a solicitar la ubicación GPS.
- Si el GPS falla, se utiliza la última ubicación disponible como respaldo.
- Se recalculan automáticamente el orden, la distancia y el tiempo de las paradas pendientes.
- Se conectó la decisión final de saltar una parada con el estado persistente del paquete.
- Se corrigieron estados visuales para distinguir paradas completadas, saltadas y retenidas.

## Navegación móvil

- Se corrigió la generación de enlaces de Apple Maps para utilizar un único destino por coordenadas.
- Se eliminó el uso de parámetros que causaban problemas con la ubicación de inicio,
  waypoints o navegación en CarPlay.
- Apple Maps utiliza la ubicación actual del teléfono o del vehículo como origen.
- Se verificó el comportamiento tanto en la aplicación normal como en CarPlay.
- Se actualizaron manualmente las copias compiladas utilizadas por los proyectos móviles.

## Contabilidad e historial

- Los reportes de entregas por ruta utilizan las paradas completadas como fuente principal.
- Las paradas favoritas y las paradas desvinculadas de una orden también pueden aparecer en el historial.
- Se conservaron los datos de pagos cobrados, método de pago, estado de pago y comisión.
- Se mantuvieron las exportaciones y los filtros de historial por ruta, chofer, fecha y mes.

## Interfaz administrativa

- Se actualizaron las vistas de Dispatcher y Recepción para mostrar estados más claros.
- Se añadió la etiqueta visual **“En el chofer”** en el Dispatcher.
- Se mejoraron los contadores y listas de recepción por parada.
- Se mantuvieron los controles de asignación, confirmación y devolución de rutas.
- Se corrigió el modal de entrega de pagos para desactivar el botón superior mientras
  el modal de confirmación permanece abierto.
- Se retiraron estilos y artefactos antiguos relacionados con las versiones anteriores
  del planificador.

## Seguridad y estabilidad

- Se conservaron las comprobaciones de autenticación y autorización para las acciones
  de chofer y administrador.
- Se validó que el chofer solo pueda modificar paradas de sus rutas asignadas.
- Se reforzó la sincronización de estados para evitar que una orden retenida vuelva a
  aparecer como disponible mientras sigue asociada al chofer.
- Se ejecutaron comprobaciones de sintaxis del backend y del modelo de paradas.
- Se generó correctamente el build de producción.
- El servidor inició correctamente y las tablas se sincronizaron sin errores.

## Pendiente conocido

- Las paradas favoritas creadas antes de guardar `favorite_address_id` no siempre pueden
  distinguirse automáticamente de una orden normal cuando solo comparten dirección y
  coordenadas. Las favoritas creadas con el flujo actual sí quedan vinculadas correctamente.