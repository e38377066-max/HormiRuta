import { defineBoot } from '#q-app/wrappers'
import axios from 'axios'

const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    const protocol = window.location.protocol
    return `${protocol}//${host}:8000`
  }
  return 'http://localhost:8000'
}

const api = axios.create({ 
  baseURL: getApiBaseUrl(),
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
})

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('user')
    }
    return Promise.reject(error)
  }
)

export default defineBoot(({ app }) => {
  app.config.globalProperties.$axios = axios
  app.config.globalProperties.$api = api
})

export { api }
