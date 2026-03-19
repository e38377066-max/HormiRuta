import axios from 'axios'
import { Capacitor } from '@capacitor/core'

const getBaseURL = () => {
  if (Capacitor.isNativePlatform()) {
    return import.meta.env.VITE_API_URL || ''
  }
  return ''
}

const isNative = Capacitor.isNativePlatform()

const api = axios.create({ 
  baseURL: getBaseURL(),
  withCredentials: !isNative,
  headers: {
    'Content-Type': 'application/json'
  }
})

const getToken = async () => {
  if (isNative) {
    try {
      const { Preferences } = await import('@capacitor/preferences')
      const { value } = await Preferences.get({ key: 'authToken' })
      return value || localStorage.getItem('authToken')
    } catch {
      return localStorage.getItem('authToken')
    }
  }
  return localStorage.getItem('authToken')
}

api.interceptors.request.use(async config => {
  const token = await getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  response => response,
  error => Promise.reject(error)
)

export default api
