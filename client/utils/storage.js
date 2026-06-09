/**
 * @fileoverview Utilidades para el almacenamiento persistente en el cliente.
 * Utiliza localStorage de forma síncrona para facilitar el acceso a tokens y datos de usuario.
 */

/**
 * Claves utilizadas para almacenar datos en localStorage.
 * @enum {string}
 */
export const StorageKeys = {
  /** Token de autenticación JWT */
  AUTH_TOKEN: 'authToken',
  /** Datos básicos del perfil de usuario */
  USER: 'user',
}

/**
 * Obtiene un valor de localStorage.
 * @param {string} key - La clave del dato a recuperar.
 * @returns {string|null} El valor almacenado o null si no existe o hay un error.
 */
export const storageGet = (key) => {
  try { return localStorage.getItem(key) } catch { return null }
}

/**
 * Guarda un valor en localStorage.
 * @param {string} key - La clave donde se guardará el dato.
 * @param {string} value - El valor a guardar.
 */
export const storageSet = (key, value) => {
  try { localStorage.setItem(key, value) } catch {}
}

/**
 * Elimina un dato de localStorage.
 * @param {string} key - La clave del dato a eliminar.
 */
export const storageRemove = (key) => {
  try { localStorage.removeItem(key) } catch {}
}
