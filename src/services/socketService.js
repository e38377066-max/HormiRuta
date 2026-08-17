/**
 * @fileoverview Servicio singleton de Socket.IO.
 * Centraliza la instancia de io para que cualquier ruta pueda emitir eventos
 * sin importar el servidor HTTP directamente.
 */

let _io = null;

/**
 * Guarda la instancia de io al arrancar el servidor.
 * @param {import('socket.io').Server} io
 */
export function setIo(io) {
  _io = io;
}

/**
 * Emite un evento a todos los sockets en la sala del chofer indicado.
 * @param {number|string} driverId
 * @param {string} event
 * @param {any} data
 */
export function emitToDriver(driverId, event, data) {
  if (_io) _io.to(`driver:${driverId}`).emit(event, data);
}

/**
 * Emite un evento a todos los admins conectados.
 * @param {string} event
 * @param {any} data
 */
export function emitToAdmins(event, data) {
  if (_io) _io.to('admins').emit(event, data);
}

/**
 * Emite un evento a todos los conectados (admins + driver específico).
 * @param {number|string} driverId
 * @param {string} event
 * @param {any} data
 */
export function emitToAll(driverId, event, data) {
  emitToDriver(driverId, event, data);
  emitToAdmins(event, data);
}
