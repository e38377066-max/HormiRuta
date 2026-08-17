/**
 * Singleton de socket.io-client.
 * Importar getSocket() donde se necesite; siempre devuelve la misma conexión.
 */
import { io } from 'socket.io-client'

let _socket = null

export function getSocket() {
  if (!_socket) {
    _socket = io('/', {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    })
  }
  return _socket
}

export function disconnectSocket() {
  if (_socket) {
    _socket.disconnect()
    _socket = null
  }
}
