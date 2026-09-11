const TERMINAL_ORDER_STATUSES = new Set(['delivered', 'ups_shipped']);

/**
 * Una asignación activa de despacho prevalece sobre retrocesos o cambios
 * externos de lifecycle. Solo Delivered puede avanzar una orden aún en ruta.
 */
export function shouldProtectAssignedRoute(order, incomingOrderStatus) {
  return Boolean(order?.route_id) &&
    !TERMINAL_ORDER_STATUSES.has(order?.order_status) &&
    incomingOrderStatus !== 'delivered';
}