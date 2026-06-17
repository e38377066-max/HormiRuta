/**
 * @fileoverview Utilidades para interactuar con las APIs de Capacitor y funcionalidades nativas.
 * Proporciona abstracciones para geolocalización, cámara, barra de estado, haptics y navegación.
 */

import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { StatusBar, Style } from '@capacitor/status-bar'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { KeepAwake } from '@capacitor-community/keep-awake'

/** @type {boolean} Indica si la aplicación se está ejecutando en una plataforma nativa (iOS/Android) */
export const isNative = Capacitor.isNativePlatform()

/** @type {string} Nombre de la plataforma actual ('ios', 'android', o 'web') */
export const platform = Capacitor.getPlatform()

/**
 * Configura el estilo inicial de la barra de estado.
 * @async
 */
export const setupStatusBar = async () => {
  if (isNative) {
    try {
      await StatusBar.setStyle({ style: Style.Dark })
      await StatusBar.setBackgroundColor({ color: '#1e1e2e' })
    } catch (e) {
      console.log('StatusBar not available')
    }
  }
}

/**
 * Inicializa la barra de estado con colores específicos y configuración de overlay.
 * @async
 */
export const initStatusBar = async () => {
  if (isNative) {
    try {
      await StatusBar.setStyle({ style: Style.Dark })
      await StatusBar.setBackgroundColor({ color: '#0f172a' })
      await StatusBar.setOverlaysWebView({ overlay: true })
    } catch (e) {
      console.log('StatusBar not available')
    }
  }
}

/**
 * Solicita permisos de ubicación si es necesario.
 * @async
 * @returns {Promise<boolean>} True si se concedieron los permisos, false en caso contrario.
 */
export const requestLocationPermission = async () => {
  if (!isNative) return true
  try {
    const permission = await Geolocation.checkPermissions()
    if (permission.location === 'granted') return true
    const result = await Geolocation.requestPermissions()
    return result.location === 'granted'
  } catch (e) {
    console.error('Permission error:', e)
    return false
  }
}

/**
 * Obtiene la posición actual del dispositivo.
 * @async
 * @param {Object} [options={}] - Opciones de geolocalización.
 * @returns {Promise<Object>} Objeto con las coordenadas de la posición.
 * @throws {Error} Si el permiso es denegado o el GPS está desactivado.
 */
export const getCurrentPosition = async (options = {}) => {
  if (isNative) {
    const granted = await requestLocationPermission()
    if (!granted) {
      throw new Error('Permiso de ubicación denegado. Actívalo en Configuración > Aplicaciones > Area 862 > Permisos')
    }
    try {
      return await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        ...options
      })
    } catch (e) {
      if (e.message?.includes('location disabled') || e.message?.includes('Location services')) {
        throw new Error('GPS desactivado. Por favor activa la ubicación en tu dispositivo')
      }
      throw e
    }
  } else {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({
          coords: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy
          }
        }),
        reject,
        { enableHighAccuracy: true, timeout: 10000, ...options }
      )
    })
  }
}

/**
 * Suscribe una función de callback para recibir actualizaciones de la posición en tiempo real.
 * @param {Function} callback - Función que recibe la nueva posición.
 * @param {Function} errorCallback - Función que recibe errores de geolocalización.
 * @param {Object} [options={}] - Opciones de seguimiento.
 * @returns {Function} Función para cancelar el seguimiento.
 */
export const watchPosition = (callback, errorCallback, options = {}) => {
  if (isNative) {
    let watchId
    const startWatch = async () => {
      const granted = await requestLocationPermission()
      if (!granted) {
        errorCallback && errorCallback(new Error('Permiso de ubicación denegado. Actívalo en Configuración > Aplicaciones > Area 862 > Permisos'))
        return
      }
      watchId = await Geolocation.watchPosition(
        {
          enableHighAccuracy: true,
          timeout: 10000,
          ...options
        },
        (position, err) => {
          if (err) {
            if (err.message?.includes('location disabled') || err.message?.includes('Location services')) {
              errorCallback && errorCallback(new Error('GPS desactivado. Activa la ubicación en tu dispositivo'))
            } else {
              errorCallback && errorCallback(err)
            }
          } else {
            callback({
              coords: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                speed: position.coords.speed
              }
            })
          }
        }
      )
    }
    startWatch()
    return () => {
      if (watchId) {
        Geolocation.clearWatch({ id: watchId })
      }
    }
  } else {
    const id = navigator.geolocation.watchPosition(
      (pos) => callback({
        coords: {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed
        }
      }),
      errorCallback,
      { enableHighAccuracy: true, timeout: 10000, ...options }
    )
    return () => navigator.geolocation.clearWatch(id)
  }
}

/**
 * Solicita permisos para usar la cámara.
 * @async
 * @returns {Promise<boolean>} True si se concedieron los permisos.
 */
export const requestCameraPermission = async () => {
  if (!isNative) return true
  try {
    const permission = await Camera.checkPermissions()
    if (permission.camera === 'granted') return true
    if (permission.camera === 'denied') return false
    const result = await Camera.requestPermissions({ permissions: ['camera'] })
    return result.camera === 'granted'
  } catch (e) {
    console.error('Camera permission error:', e)
    return false
  }
}

/**
 * Abre la cámara para capturar una foto.
 * @async
 * @returns {Promise<Object|null>} Objeto de la foto capturada o null si no es plataforma nativa.
 * @throws {Error} Si el permiso de cámara es denegado.
 */
export const takePhoto = async () => {
  if (isNative) {
    const granted = await requestCameraPermission()
    if (!granted) {
      const msg = platform === 'ios'
        ? 'Permiso de cámara denegado. Ve a Configuración > Privacidad y Seguridad > Cámara > Area 862 y actívalo'
        : 'Permiso de cámara denegado. Actívalo en Configuración > Aplicaciones > Area 862 > Permisos'
      throw new Error(msg)
    }
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
      quality: 80,
      width: 1280,
      height: 1280,
      allowEditing: false,
      correctOrientation: true,
      promptLabelHeader: 'Evidencia de entrega',
      promptLabelPhoto: 'Elegir de galería',
      promptLabelPicture: 'Tomar foto'
    })
    return photo
  }
  return null
}

/**
 * Convierte un DataURL de imagen en un objeto File.
 * @param {string} dataUrl - La cadena de datos de la imagen.
 * @param {string} filename - El nombre que tendrá el archivo generado.
 * @returns {File} El objeto archivo listo para subir.
 */
export const dataUrlToFile = (dataUrl, filename) => {
  const arr = dataUrl.split(',')
  const mime = arr[0].match(/:(.*?);/)[1]
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new File([u8arr], filename, { type: mime })
}

/**
 * Activa la vibración háptica del dispositivo.
 * @async
 * @param {string} [style='medium'] - Estilo de impacto ('light', 'medium', 'heavy').
 */
export const vibrate = async (style = 'medium') => {
  if (isNative) {
    try {
      const impactStyle = {
        light: ImpactStyle.Light,
        medium: ImpactStyle.Medium,
        heavy: ImpactStyle.Heavy
      }[style] || ImpactStyle.Medium
      
      await Haptics.impact({ style: impactStyle })
    } catch (e) {
      console.log('Haptics not available')
    }
  } else {
    if (navigator.vibrate) {
      navigator.vibrate(style === 'light' ? 10 : style === 'heavy' ? 50 : 25)
    }
  }
}

/**
 * Mantiene la pantalla del dispositivo encendida (evita el bloqueo).
 * @async
 */
export const keepScreenAwake = async () => {
  try {
    await KeepAwake.keepAwake()
  } catch (e) {
    if ('wakeLock' in navigator) {
      try {
        await navigator.wakeLock.request('screen')
      } catch (err) {}
    }
  }
}

/**
 * Permite que la pantalla del dispositivo se apague normalmente.
 * @async
 */
export const allowScreenSleep = async () => {
  try {
    await KeepAwake.allowSleep()
  } catch (e) {}
}

/**
 * Abre la aplicación de navegación nativa (Apple Maps o Google Maps) con una lista de paradas.
 * @param {Array<Object>} stops - Lista de paradas a incluir en la ruta.
 * @param {Object} [userLocation=null] - Ubicación actual del usuario para el punto de origen.
 */
export const openNativeNavigation = (stops, userLocation = null) => {
  if (!stops || stops.length === 0) return

  const waypoints = stops.map(s => {
    const baseAddr = (s.address || '').trim()
    const apt = baseAddr && s.apartment_number ? ` Apt ${s.apartment_number}` : ''
    return {
      lat: parseFloat(s.lat || s.latitude),
      lng: parseFloat(s.lng || s.longitude),
      address: baseAddr ? baseAddr + apt : '',
      label: s.customer_name || baseAddr || ''
    }
  }).filter(w => !isNaN(w.lat) && !isNaN(w.lng))

  if (waypoints.length === 0) return

  const destination = waypoints[waypoints.length - 1]
  const intermediates = waypoints.slice(0, -1)

  const plt = Capacitor.getPlatform()

  if (plt === 'ios') {
    // Apple Maps / CarPlay: usar la dirección en texto para evitar "address not found" en CarPlay.
    // Las coordenadas solas a veces no se resuelven en el mapa del coche.
    const encAddr = (w) => {
      const addr = (w.address || '').trim()
      return addr ? encodeURIComponent(addr) : `${w.lat},${w.lng}`
    }
    const destHasAddr = !!(destination.address && destination.address.trim())

    let url
    if (intermediates.length > 0) {
      const waypointStr = intermediates.map(encAddr).join('+to:')
      url = `maps://?daddr=${waypointStr}+to:${encAddr(destination)}&dirflg=d`
    } else {
      url = `maps://?daddr=${encAddr(destination)}&dirflg=d`
    }
    // Si el destino cae a coordenadas, añadimos q= con el nombre para que CarPlay muestre etiqueta legible
    if (!destHasAddr) {
      url += `&q=${encodeURIComponent(destination.label || 'Destino')}`
    }
    if (userLocation) {
      url += `&saddr=${userLocation.lat},${userLocation.lng}`
    }
    window.open(url, '_system')
    return
  }

  if (plt === 'android') {
    let url
    if (intermediates.length > 0) {
      const waypointStr = intermediates.map(w => `${w.lat},${w.lng}`).join('|')
      url = `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}&waypoints=${encodeURIComponent(waypointStr)}&travelmode=driving`
    } else {
      url = `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}&travelmode=driving`
    }
    if (userLocation) {
      url += `&origin=${userLocation.lat},${userLocation.lng}`
    }
    window.open(url, '_system')
    return
  }

  let url
  if (intermediates.length > 0) {
    const waypointStr = intermediates.map(w => `${w.lat},${w.lng}`).join('|')
    url = `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}&waypoints=${encodeURIComponent(waypointStr)}&travelmode=driving`
  } else {
    url = `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}&travelmode=driving`
  }
  if (userLocation) {
    url += `&origin=${userLocation.lat},${userLocation.lng}`
  }
  window.open(url, '_blank')
}

let speechSynth = null
let currentUtterance = null

/**
 * Utiliza la síntesis de voz del navegador para leer un texto instructivo.
 * Limpia el texto de etiquetas HTML y entidades especiales antes de hablar.
 * @param {string} text - El texto a leer.
 * @param {string} [lang='es-MX'] - Idioma de la voz.
 */
export const speakInstruction = (text, lang = 'es-MX') => {
  if (!text) return
  if (!('speechSynthesis' in window)) return
  if (!speechSynth) speechSynth = window.speechSynthesis

  if (currentUtterance) {
    speechSynth.cancel()
  }

  const cleanText = text
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, 'y')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '')
    .replace(/&gt;/g, '')
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '')
    .replace(/&#\d+;/g, '')
    .replace(/[<>]/g, '')
    .replace(/&/g, 'y')
    .replace(/\//g, ' ')
    .trim()

  currentUtterance = new SpeechSynthesisUtterance(cleanText)
  currentUtterance.lang = lang
  currentUtterance.rate = 1.0
  currentUtterance.pitch = 1.0
  currentUtterance.volume = 1.0

  const voices = speechSynth.getVoices()
  const spanishVoice = voices.find(v => v.lang.startsWith('es'))
  if (spanishVoice) currentUtterance.voice = spanishVoice

  speechSynth.speak(currentUtterance)
}

/**
 * Detiene cualquier síntesis de voz en curso.
 */
export const stopSpeaking = () => {
  if (speechSynth) {
    speechSynth.cancel()
    currentUtterance = null
  }
}
