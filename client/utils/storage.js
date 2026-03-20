// Almacenamiento simple y directo usando localStorage.
// En iOS con Capacitor (WKWebView), localStorage persiste entre reinicios de la app.
// No usamos Capacitor Preferences para evitar complejidad innecesaria con código async.

export const StorageKeys = {
  AUTH_TOKEN: 'authToken',
  USER: 'user',
}

export const storageGet = (key) => {
  try { return localStorage.getItem(key) } catch { return null }
}

export const storageSet = (key, value) => {
  try { localStorage.setItem(key, value) } catch {}
}

export const storageRemove = (key) => {
  try { localStorage.removeItem(key) } catch {}
}
