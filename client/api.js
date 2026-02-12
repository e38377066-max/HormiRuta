import axios from 'axios'
import { Capacitor } from '@capacitor/core'

const getBaseURL = () => {
  if (Capacitor.isNativePlatform()) {
    return import.meta.env.VITE_API_URL || 'https://api.area862.com'
  }
  return ''
}

const api = axios.create({ 
  baseURL: getBaseURL(),
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('authToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('user')
      localStorage.removeItem('authToken')
    }
    return Promise.reject(error)
  }
)

export default api
