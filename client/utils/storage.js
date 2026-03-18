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

export const storageGet = async (key) => {
  if (isNative) {
    try {
      const prefs = await getPreferences()
      const { value } = await prefs.get({ key })
      return value
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
