import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { StatusBar, Style } from '@capacitor/status-bar'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'

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
                accuracy: position.coords.accuracy
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
          accuracy: pos.coords.accuracy
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
