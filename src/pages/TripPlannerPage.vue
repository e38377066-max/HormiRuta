<template>
  <q-page class="bg-dark q-pa-md">
    <div class="text-h5 text-white q-mb-md">
      <q-icon name="route" class="q-mr-sm" />
      Planificar Ruta
    </div>

    <q-card class="bg-grey-9 q-mb-md">
      <q-card-section>
        <q-input v-model="startAddress" label="Punto de partida (opcional)" outlined dense dark
          placeholder="Tu ubicacion actual" @update:model-value="searchStartAddress">
          <template #prepend>
            <q-icon name="my_location" color="positive" />
          </template>
          <template #append>
            <q-btn flat round size="sm" icon="gps_fixed" @click="useCurrentLocation" :loading="gettingLocation" />
          </template>
        </q-input>
        <q-list v-if="startSuggestions.length" bordered class="suggestion-list q-mt-xs">
          <q-item v-for="(sug, i) in startSuggestions" :key="i" clickable @click="selectStartSuggestion(sug)">
            <q-item-section>{{ sug.description }}</q-item-section>
          </q-item>
        </q-list>
      </q-card-section>
    </q-card>

    <q-card class="bg-grey-9 q-mb-md">
      <q-card-section>
        <div class="row items-center q-mb-sm">
          <div class="text-subtitle1 text-white">Paradas</div>
          <q-space />
          <q-chip color="primary" text-color="white" size="sm">{{ stops.length }}</q-chip>
        </div>

        <q-input v-model="newStopAddress" label="Agregar direccion" outlined dense dark
          @keyup.enter="addStop" @update:model-value="searchStopAddress">
          <template #prepend>
            <q-icon name="add_location" color="primary" />
          </template>
          <template #append>
            <q-btn flat round size="sm" icon="add" color="primary" @click="addStop" :disable="!newStopAddress" />
          </template>
        </q-input>
        <q-list v-if="stopSuggestions.length" bordered class="suggestion-list q-mt-xs">
          <q-item v-for="(sug, i) in stopSuggestions" :key="i" clickable @click="selectStopSuggestion(sug)">
            <q-item-section>{{ sug.description }}</q-item-section>
          </q-item>
        </q-list>
      </q-card-section>

      <q-card-section v-if="stops.length" class="q-pt-none">
        <q-list class="stops-list">
          <q-item v-for="(stop, index) in stops" :key="index" class="stop-item">
            <q-item-section avatar>
              <div class="stop-number">{{ index + 1 }}</div>
            </q-item-section>
            <q-item-section>
              <q-item-label class="text-white">{{ stop.address }}</q-item-label>
              <q-item-label v-if="stop.distance" caption class="text-grey-5">
                {{ stop.distance.toFixed(1) }} km - {{ Math.round(stop.duration) }} min
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <div class="row q-gutter-xs">
                <q-btn flat round size="sm" icon="navigation" color="info" @click="navigateToStop(stop)" />
                <q-btn flat round size="sm" icon="delete" color="negative" @click="removeStop(index)" />
              </div>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>

      <q-card-section v-else class="text-center text-grey q-py-xl">
        <q-icon name="add_location" size="48px" class="q-mb-sm" />
        <div>Agrega direcciones para planificar tu ruta</div>
      </q-card-section>
    </q-card>

    <div v-if="stops.length >= 2" class="row q-gutter-sm q-mb-md">
      <q-btn color="primary" icon="auto_fix_high" label="Optimizar Ruta" @click="optimizeRoute" 
        :loading="optimizing" class="col" />
      <q-btn v-if="isOptimized" color="positive" icon="navigation" label="Iniciar Navegacion" 
        @click="startNavigation" class="col" />
    </div>

    <q-card v-if="isOptimized && totalDistance" class="bg-grey-9 q-mb-md">
      <q-card-section>
        <div class="text-subtitle1 text-white q-mb-sm">Resumen de Ruta</div>
        <div class="row q-gutter-md">
          <div class="col text-center">
            <q-icon name="straighten" size="sm" color="primary" />
            <div class="text-h6 text-white">{{ totalDistance.toFixed(1) }} km</div>
            <div class="text-caption text-grey">Distancia total</div>
          </div>
          <div class="col text-center">
            <q-icon name="schedule" size="sm" color="info" />
            <div class="text-h6 text-white">{{ formatDuration(totalDuration) }}</div>
            <div class="text-caption text-grey">Tiempo estimado</div>
          </div>
          <div class="col text-center">
            <q-icon name="place" size="sm" color="positive" />
            <div class="text-h6 text-white">{{ stops.length }}</div>
            <div class="text-caption text-grey">Paradas</div>
          </div>
        </div>
      </q-card-section>
      <q-card-actions>
        <q-btn flat icon="share" label="Compartir" color="primary" @click="shareRoute" class="col" />
        <q-btn flat icon="content_copy" label="Copiar" color="secondary" @click="copyRoute" class="col" />
      </q-card-actions>
    </q-card>

    <q-card v-if="stops.length" class="bg-grey-9">
      <q-card-section class="q-pa-none">
        <div id="trip-map" style="height: 300px; width: 100%;"></div>
      </q-card-section>
    </q-card>
  </q-page>
</template>

<script setup>
import { ref, onMounted, watch, nextTick } from 'vue'
import { useQuasar } from 'quasar'
import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'
import { Browser } from '@capacitor/browser'

const $q = useQuasar()

const startAddress = ref('')
const startLat = ref(null)
const startLng = ref(null)
const startSuggestions = ref([])

const newStopAddress = ref('')
const stopSuggestions = ref([])

const stops = ref([])
const isOptimized = ref(false)
const optimizing = ref(false)
const gettingLocation = ref(false)

const totalDistance = ref(0)
const totalDuration = ref(0)

let map = null
let directionsService = null
let directionsRenderer = null
let searchTimeout = null

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || 'AIzaSyBLqGtCFZG3-cl9oILRHE-1QOJATX-gm-4'

onMounted(() => {
  loadGoogleMaps()
})

const loadGoogleMaps = () => {
  if (window.google && window.google.maps) {
    initMap()
    return
  }
  
  const script = document.createElement('script')
  script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=places`
  script.async = true
  script.defer = true
  script.onload = initMap
  document.head.appendChild(script)
}

const initMap = () => {
  const mapEl = document.getElementById('trip-map')
  if (!mapEl || !window.google) return
  
  map = new window.google.maps.Map(mapEl, {
    center: { lat: 19.4326, lng: -99.1332 },
    zoom: 12,
    styles: [
      { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
      { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
      { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] }
    ]
  })
  
  directionsService = new window.google.maps.DirectionsService()
  directionsRenderer = new window.google.maps.DirectionsRenderer({
    map: map,
    suppressMarkers: false,
    polylineOptions: {
      strokeColor: '#00bcd4',
      strokeWeight: 4
    }
  })
}

const searchStartAddress = (val) => {
  if (searchTimeout) clearTimeout(searchTimeout)
  if (!val || val.length < 3) {
    startSuggestions.value = []
    return
  }
  searchTimeout = setTimeout(() => searchPlaces(val, startSuggestions), 300)
}

const searchStopAddress = (val) => {
  if (searchTimeout) clearTimeout(searchTimeout)
  if (!val || val.length < 3) {
    stopSuggestions.value = []
    return
  }
  searchTimeout = setTimeout(() => searchPlaces(val, stopSuggestions), 300)
}

const searchPlaces = async (query, suggestionsRef) => {
  if (!window.google) return
  
  const service = new window.google.maps.places.AutocompleteService()
  service.getPlacePredictions(
    { input: query, componentRestrictions: { country: 'mx' } },
    (predictions, status) => {
      if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
        suggestionsRef.value = predictions.map(p => ({
          description: p.description,
          place_id: p.place_id
        }))
      } else {
        suggestionsRef.value = []
      }
    }
  )
}

const selectStartSuggestion = async (sug) => {
  startAddress.value = sug.description
  startSuggestions.value = []
  
  const coords = await getPlaceCoords(sug.place_id)
  if (coords) {
    startLat.value = coords.lat
    startLng.value = coords.lng
  }
}

const selectStopSuggestion = async (sug) => {
  newStopAddress.value = sug.description
  stopSuggestions.value = []
  
  const coords = await getPlaceCoords(sug.place_id)
  if (coords) {
    stops.value.push({
      address: sug.description,
      lat: coords.lat,
      lng: coords.lng,
      distance: null,
      duration: null
    })
    newStopAddress.value = ''
    isOptimized.value = false
    updateMapMarkers()
  }
}

const getPlaceCoords = (placeId) => {
  return new Promise((resolve) => {
    if (!window.google) {
      resolve(null)
      return
    }
    const service = new window.google.maps.places.PlacesService(document.createElement('div'))
    service.getDetails({ placeId, fields: ['geometry'] }, (place, status) => {
      if (status === window.google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
        resolve({
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng()
        })
      } else {
        resolve(null)
      }
    })
  })
}

const addStop = () => {
  if (!newStopAddress.value.trim()) return
  
  stops.value.push({
    address: newStopAddress.value.trim(),
    lat: null,
    lng: null,
    distance: null,
    duration: null
  })
  newStopAddress.value = ''
  isOptimized.value = false
  updateMapMarkers()
}

const removeStop = (index) => {
  stops.value.splice(index, 1)
  isOptimized.value = false
  updateMapMarkers()
}

const useCurrentLocation = async () => {
  gettingLocation.value = true
  try {
    const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true })
    startLat.value = position.coords.latitude
    startLng.value = position.coords.longitude
    startAddress.value = 'Mi ubicacion actual'
    
    if (map) {
      map.setCenter({ lat: startLat.value, lng: startLng.value })
    }
    
    $q.notify({ type: 'positive', message: 'Ubicacion obtenida', position: 'top' })
  } catch (error) {
    console.error('Error getting location:', error)
    $q.notify({ type: 'negative', message: 'No se pudo obtener tu ubicacion', position: 'top' })
  } finally {
    gettingLocation.value = false
  }
}

const optimizeRoute = async () => {
  if (stops.value.length < 2) {
    $q.notify({ type: 'warning', message: 'Agrega al menos 2 paradas', position: 'top' })
    return
  }
  
  optimizing.value = true
  
  try {
    const hasCustomOrigin = startLat.value && startLng.value
    
    let origin, destination, waypoints
    
    if (hasCustomOrigin) {
      origin = { lat: startLat.value, lng: startLng.value }
      destination = stops.value[stops.value.length - 1].lat && stops.value[stops.value.length - 1].lng
        ? { lat: stops.value[stops.value.length - 1].lat, lng: stops.value[stops.value.length - 1].lng }
        : stops.value[stops.value.length - 1].address
      
      waypoints = stops.value.slice(0, -1).map(s => ({
        location: s.lat && s.lng ? { lat: s.lat, lng: s.lng } : s.address,
        stopover: true
      }))
    } else {
      origin = stops.value[0].lat && stops.value[0].lng
        ? { lat: stops.value[0].lat, lng: stops.value[0].lng }
        : stops.value[0].address
      destination = stops.value[stops.value.length - 1].lat && stops.value[stops.value.length - 1].lng
        ? { lat: stops.value[stops.value.length - 1].lat, lng: stops.value[stops.value.length - 1].lng }
        : stops.value[stops.value.length - 1].address
      
      waypoints = stops.value.slice(1, -1).map(s => ({
        location: s.lat && s.lng ? { lat: s.lat, lng: s.lng } : s.address,
        stopover: true
      }))
    }
    
    const request = {
      origin,
      destination,
      waypoints,
      optimizeWaypoints: waypoints.length > 0,
      travelMode: window.google.maps.TravelMode.DRIVING
    }
    
    directionsService.route(request, (result, status) => {
      if (status === 'OK') {
        directionsRenderer.setDirections(result)
        
        const waypointOrder = result.routes[0].waypoint_order || []
        const legs = result.routes[0].legs
        
        let totalDist = 0
        let totalDur = 0
        
        if (hasCustomOrigin) {
          const reorderedStops = []
          
          for (let i = 0; i < waypointOrder.length; i++) {
            const originalIdx = waypointOrder[i]
            const stop = { ...stops.value[originalIdx] }
            stop.distance = legs[i].distance.value / 1000
            stop.duration = legs[i].duration.value / 60
            totalDist += stop.distance
            totalDur += stop.duration
            reorderedStops.push(stop)
          }
          
          const lastStop = { ...stops.value[stops.value.length - 1] }
          const lastLeg = legs[legs.length - 1]
          lastStop.distance = lastLeg.distance.value / 1000
          lastStop.duration = lastLeg.duration.value / 60
          totalDist += lastStop.distance
          totalDur += lastStop.duration
          reorderedStops.push(lastStop)
          
          stops.value = reorderedStops
        } else {
          const reorderedStops = []
          
          const firstStop = { ...stops.value[0] }
          firstStop.distance = 0
          firstStop.duration = 0
          reorderedStops.push(firstStop)
          
          for (let i = 0; i < waypointOrder.length; i++) {
            const originalIdx = waypointOrder[i] + 1
            const stop = { ...stops.value[originalIdx] }
            stop.distance = legs[i].distance.value / 1000
            stop.duration = legs[i].duration.value / 60
            totalDist += stop.distance
            totalDur += stop.duration
            reorderedStops.push(stop)
          }
          
          const lastStop = { ...stops.value[stops.value.length - 1] }
          const lastLeg = legs[legs.length - 1]
          lastStop.distance = lastLeg.distance.value / 1000
          lastStop.duration = lastLeg.duration.value / 60
          totalDist += lastStop.distance
          totalDur += lastStop.duration
          reorderedStops.push(lastStop)
          
          stops.value = reorderedStops
        }
        
        totalDistance.value = totalDist
        totalDuration.value = totalDur
        isOptimized.value = true
        
        $q.notify({ type: 'positive', message: 'Ruta optimizada', position: 'top' })
      } else {
        console.error('Directions API error:', status)
        $q.notify({ type: 'negative', message: 'Error al optimizar ruta: ' + status, position: 'top' })
      }
      optimizing.value = false
    })
  } catch (error) {
    console.error('Optimization error:', error)
    $q.notify({ type: 'negative', message: 'Error al optimizar', position: 'top' })
    optimizing.value = false
  }
}

const updateMapMarkers = () => {
  if (!map || !window.google) return
  
  const bounds = new window.google.maps.LatLngBounds()
  
  if (startLat.value && startLng.value) {
    bounds.extend({ lat: startLat.value, lng: startLng.value })
  }
  
  stops.value.forEach(stop => {
    if (stop.lat && stop.lng) {
      bounds.extend({ lat: stop.lat, lng: stop.lng })
    }
  })
  
  if (!bounds.isEmpty()) {
    map.fitBounds(bounds)
  }
}

const navigateToStop = async (stop) => {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stop.address)}&travelmode=driving`
  
  if (Capacitor.isNativePlatform()) {
    await Browser.open({ url })
  } else {
    window.open(url, '_blank')
  }
}

const startNavigation = async () => {
  if (!stops.value.length) return
  
  const waypoints = stops.value.slice(0, -1).map(s => encodeURIComponent(s.address)).join('|')
  const destination = encodeURIComponent(stops.value[stops.value.length - 1].address)
  const origin = startAddress.value ? encodeURIComponent(startAddress.value) : ''
  
  let url = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`
  if (origin) url += `&origin=${origin}`
  if (waypoints) url += `&waypoints=${waypoints}`
  
  if (Capacitor.isNativePlatform()) {
    await Browser.open({ url })
  } else {
    window.open(url, '_blank')
  }
}

const shareRoute = async () => {
  const text = generateRouteText()
  
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Mi Ruta - HormiRuta', text })
    } catch {
      copyToClipboard(text)
    }
  } else {
    copyToClipboard(text)
  }
}

const copyRoute = () => {
  const text = generateRouteText()
  copyToClipboard(text)
}

const generateRouteText = () => {
  let text = 'Mi Ruta - HormiRuta\n\n'
  if (startAddress.value) text += `Inicio: ${startAddress.value}\n\n`
  
  stops.value.forEach((stop, i) => {
    text += `${i + 1}. ${stop.address}\n`
    if (stop.distance) text += `   ${stop.distance.toFixed(1)} km - ${Math.round(stop.duration)} min\n`
  })
  
  if (totalDistance.value) {
    text += `\nTotal: ${totalDistance.value.toFixed(1)} km - ${formatDuration(totalDuration.value)}`
  }
  
  return text
}

const copyToClipboard = (text) => {
  navigator.clipboard.writeText(text)
  $q.notify({ type: 'positive', message: 'Copiado al portapapeles', position: 'top' })
}

const formatDuration = (minutes) => {
  if (!minutes) return '0 min'
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins} min`
}

watch(stops, () => {
  nextTick(() => {
    if (stops.value.length > 0 && !map) {
      loadGoogleMaps()
    }
  })
}, { deep: true })
</script>

<style scoped>
.stop-number {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #00bcd4;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 14px;
}

.stop-item {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  margin-bottom: 8px;
}

.suggestion-list {
  max-height: 200px;
  overflow-y: auto;
  background: #1a2942;
  border-radius: 8px;
}

.suggestion-list .q-item {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.suggestion-list .q-item:last-child {
  border-bottom: none;
}
</style>
