import { Capacitor } from '@capacitor/core'

const isNative = Capacitor.isNativePlatform()

let Preferences = null

const getPreferences = async () => {
  if (!Preferences) {
    const mod = await import('@capacitor/preferences')
    Preferences = mod.Preferences
  }
  return Preferences
}

export const StorageKeys = {
  AUTH_TOKEN: 'authToken',
  USER: 'user',
}

const withTimeout = (promise, ms, fallback) =>
  Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve(fallback), ms))
  ])

export const storageGet = async (key) => {
  if (isNative) {
    try {
      const prefs = await withTimeout(getPreferences(), 5000, null)
      if (!prefs) return localStorage.getItem(key)
      const result = await withTimeout(prefs.get({ key }), 5000, null)
      if (result && result.value !== null && result.value !== undefined) {
        return result.value
      }
      return localStorage.getItem(key)
    } catch {
      return localStorage.getItem(key)
    }
  }
  return localStorage.getItem(key)
}

export const storageSet = async (key, value) => {
  if (isNative) {
    try {
      const prefs = await getPreferences()
      await prefs.set({ key, value })
    } catch {}
  }
  localStorage.setItem(key, value)
}

export const storageRemove = async (key) => {
  if (isNative) {
    try {
      const prefs = await getPreferences()
      await prefs.remove({ key })
    } catch {}
  }
  localStorage.removeItem(key)
}
