/**
 * @fileoverview Configuración del cliente API utilizando Axios para realizar peticiones al backend.
 * Maneja la URL base según la plataforma y adjunta automáticamente el token de autenticación.
 */

import axios from 'axios'
import { Capacitor } from '@capacitor/core'
import { storageGet, StorageKeys } from './utils/storage'

const isNative = Capacitor.isNativePlatform()

/**
 * Determina la URL base del API según la plataforma.
 * En nativo (iOS/Android) usa VITE_API_URL. Si no está configurada, lanza error claro en consola.
 */
const resolveBaseURL = () => {
  if (!isNative) return ''
  const url = import.meta.env.VITE_API_URL || ''
  if (!url) {
    console.error(
      '[API] VITE_API_URL no está configurada. ' +
      'Las llamadas al servidor fallarán en la app nativa. ' +
      'Configura VITE_API_URL=https://tu-servidor.com antes de compilar.'
    )
  }
  return url
}

/**
 * Instancia de Axios configurada con la URL base y cabeceras por defecto.
 * @type {import('axios').AxiosInstance}
 */
const api = axios.create({
  baseURL: resolveBaseURL(),
  withCredentials: !isNative,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000,
})

/**
 * Interceptor de peticiones para incluir el token JWT en la cabecera de Authorization.
 * Se ejecuta antes de cada petición enviada por la instancia `api`.
 */
api.interceptors.request.use(config => {
  const token = storageGet(StorageKeys.AUTH_TOKEN)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

/**
 * Interceptor de respuestas para convertir timeouts en mensajes legibles.
 */
api.interceptors.response.use(
  res => res,
  err => {
    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      err.isTimeout = true
      if (!err.response) {
        err.friendlyMessage = isNative
          ? 'No se pudo conectar al servidor. Verifica que la app esté configurada con la URL correcta del servidor.'
          : 'La solicitud tardó demasiado. Verifica tu conexión a internet.'
      }
    }
    return Promise.reject(err)
  }
)

export default api
