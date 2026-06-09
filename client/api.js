/**
 * @fileoverview Configuración del cliente API utilizando Axios para realizar peticiones al backend.
 * Maneja la URL base según la plataforma y adjunta automáticamente el token de autenticación.
 */

import axios from 'axios'
import { Capacitor } from '@capacitor/core'
import { storageGet, StorageKeys } from './utils/storage'

/**
 * Instancia de Axios configurada con la URL base y cabeceras por defecto.
 * @type {import('axios').AxiosInstance}
 */
const api = axios.create({
  baseURL: Capacitor.isNativePlatform() ? (import.meta.env.VITE_API_URL || '') : '',
  withCredentials: !Capacitor.isNativePlatform(),
  headers: { 'Content-Type': 'application/json' },
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

export default api
