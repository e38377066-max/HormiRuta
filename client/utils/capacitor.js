import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { StatusBar, Style } from '@capacitor/status-bar'

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

export const getCurrentPosition = async (options = {}) => {
  if (isNative) {
    const permission = await Geolocation.checkPermissions()
    if (permission.location !== 'granted') {
      await Geolocation.requestPermissions()
    }
    return await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
      ...options
    })
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
    Geolocation.watchPosition(
      {
        enableHighAccuracy: true,
        timeout: 10000,
        ...options
      },
      (position, err) => {
        if (err) {
          errorCallback && errorCallback(err)
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
    ).then(id => {
      watchId = id
    })
    
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
