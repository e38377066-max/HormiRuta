import axios from 'axios'
import { Capacitor } from '@capacitor/core'
import { storageGet, StorageKeys } from './utils/storage'

const api = axios.create({
  baseURL: Capacitor.isNativePlatform() ? (import.meta.env.VITE_API_URL || '') : '',
  withCredentials: !Capacitor.isNativePlatform(),
  headers: { 'Content-Type': 'application/json' },
})

// Adjuntar token JWT en cada request (síncrono, sin async)
api.interceptors.request.use(config => {
  const token = storageGet(StorageKeys.AUTH_TOKEN)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export default api
