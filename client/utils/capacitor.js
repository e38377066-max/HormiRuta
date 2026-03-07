import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { StatusBar, Style } from '@capacitor/status-bar'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { KeepAwake } from '@capacitor-community/keep-awake'

export const isNative = Capacitor.isNativePlatform()
export const platform = Capacitor.getPlatform()

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

export const requestCameraPermission = async () => {
  if (!isNative) return true
  try {
    const permission = await Camera.checkPermissions()
    if (permission.camera === 'granted' && permission.photos === 'granted') return true
    const result = await Camera.requestPermissions({ permissions: ['camera', 'photos'] })
    return result.camera === 'granted'
  } catch (e) {
    console.error('Camera permission error:', e)
    return false
  }
}

export const takePhoto = async () => {
  if (isNative) {
    const granted = await requestCameraPermission()
    if (!granted) {
      throw new Error('Permiso de cámara denegado. Actívalo en Configuración > Aplicaciones > Area 862 > Permisos')
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

export const allowScreenSleep = async () => {
  try {
    await KeepAwake.allowSleep()
  } catch (e) {}
}

export const openNativeNavigation = (stops, userLocation = null) => {
  if (!stops || stops.length === 0) return

  const waypoints = stops.map(s => ({
    lat: parseFloat(s.lat || s.latitude),
    lng: parseFloat(s.lng || s.longitude),
    label: s.customer_name || s.address || ''
  })).filter(w => !isNaN(w.lat) && !isNaN(w.lng))

  if (waypoints.length === 0) return

  const destination = waypoints[waypoints.length - 1]
  const intermediates = waypoints.slice(0, -1)

  const plt = Capacitor.getPlatform()

  if (plt === 'ios') {
    let url = `maps://?daddr=${destination.lat},${destination.lng}&dirflg=d`
    if (intermediates.length > 0) {
      const waypointStr = intermediates.map(w => `${w.lat},${w.lng}`).join('+to:')
      url = `maps://?daddr=${waypointStr}+to:${destination.lat},${destination.lng}&dirflg=d`
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

export const speakInstruction = (text, lang = 'es-MX') => {
  if (!text) return
  if (!('speechSynthesis' in window)) return
  if (!speechSynth) speechSynth = window.speechSynthesis

  if (currentUtterance) {
    speechSynth.cancel()
  }

  const cleanText = text
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\//g, ' ')

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

export const stopSpeaking = () => {
  if (speechSynth) {
    speechSynth.cancel()
    currentUtterance = null
  }
}
