/**
 * Singleton de socket.io-client.
 * Importar getSocket() donde se necesite; siempre devuelve la misma conexión.
 */
import { io } from 'socket.io-client'
import { storageGet, StorageKeys } from './utils/storage'

let _socket = null

export function getSocket() {
  if (!_socket) {
    _socket = io('/', {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    })
    // Autenticación del socket: el servidor resuelve rol y salas a partir del token.
    _socket.on('connect', () => {
      const token = storageGet(StorageKeys.AUTH_TOKEN)
      if (token) _socket.emit('join', { token })
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
