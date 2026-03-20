import { Capacitor } from '@capacitor/core'

const isNative = Capacitor.isNativePlatform()

let _prefs = null

const loadPreferences = async () => {
  if (_prefs) return _prefs
  const mod = await import('@capacitor/preferences')
  _prefs = mod.Preferences
  return _prefs
}

export const StorageKeys = {
  AUTH_TOKEN: 'authToken',
  USER: 'user',
}

export const storageGet = async (key) => {
  if (!isNative) {
    return localStorage.getItem(key)
  }

  try {
    const prefs = await Promise.race([
      loadPreferences(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
    ])

    const result = await Promise.race([
      prefs.get({ key }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
    ])

    if (result?.value != null) {
      localStorage.setItem(key, result.value)
      return result.value
    }
  } catch (e) {
    console.warn('[Storage] Preferences.get error, using localStorage fallback:', e.message)
  }

  return localStorage.getItem(key)
}

export const storageSet = async (key, value) => {
  localStorage.setItem(key, value)

  if (!isNative) return

  try {
    const prefs = await Promise.race([
      loadPreferences(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
    ])
    await Promise.race([
      prefs.set({ key, value }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
    ])
  } catch (e) {
    console.warn('[Storage] Preferences.set error (localStorage already saved):', e.message)
  }
}

export const storageRemove = async (key) => {
  localStorage.removeItem(key)

  if (!isNative) return

  try {
    const prefs = await Promise.race([
      loadPreferences(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
    ])
    await prefs.remove({ key })
  } catch (e) {
    console.warn('[Storage] Preferences.remove error:', e.message)
  }
}
