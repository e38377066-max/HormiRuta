<template>
  <q-page class="trip-planner-page">
    <div class="map-section">
      <div id="trip-map" class="map-container"></div>
      
      <div v-if="savedDistance > 0" class="savings-banner">
        <q-icon name="check_circle" color="positive" size="sm" />
        <span>{{ savedDistance.toFixed(1) }} km, {{ Math.round(savedDuration) }} min ahorrados</span>
        <q-btn flat dense icon="close" size="xs" @click="savedDistance = 0" />
      </div>
      
      <div class="map-controls">
        <q-btn fab-mini color="grey-8" icon="layers" @click="toggleMapType" />
        <q-btn fab-mini color="grey-8" icon="my_location" @click="centerOnLocation" class="q-mt-sm" />
      </div>
    </div>
    
    <div class="bottom-panel">
      <div class="panel-handle" @click="panelExpanded = !panelExpanded">
        <div class="handle-bar"></div>
      </div>
      
      <div class="search-section">
        <q-input v-model="searchQuery" placeholder="Pulsa para añadir" outlined dense dark
          class="search-input" @focus="showSearch = true" @update:model-value="searchAddress">
          <template #prepend>
            <q-icon name="search" />
          </template>
          <template #append>
            <q-btn v-if="voiceSupported" flat round dense icon="mic" size="sm"
              @click="startVoiceSearch" :color="isListening ? 'negative' : 'grey'" />
            <q-btn flat round dense icon="more_vert" size="sm" @click="showRouteMenu = true" />
          </template>
        </q-input>
        
        <q-list v-if="showSearch && searchSuggestions.length" class="suggestions-dropdown">
          <q-item v-for="(sug, i) in searchSuggestions" :key="i" clickable dense @click="selectSearchSuggestion(sug)">
            <q-item-section avatar>
              <q-icon name="place" color="primary" size="sm" />
            </q-item-section>
            <q-item-section>
              <q-item-label lines="1">{{ sug.description }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </div>
      
      <div class="route-header">
        <div class="stats-chips">
          <div class="stat-chip">
            <q-icon name="schedule" size="14px" />
            <span>{{ formatDuration(totalDuration) }}</span>
          </div>
          <div class="stat-chip">
            <q-icon name="place" size="14px" />
            <span>{{ stops.length }} paradas</span>
          </div>
          <div class="stat-chip">
            <q-icon name="straighten" size="14px" />
            <span>{{ totalDistance.toFixed(1) }} km</span>
          </div>
        </div>
        <div class="route-title" @click="showRouteNameDialog = true">
          <span class="text-h5 text-white text-weight-bold">{{ routeName || 'Mi Ruta' }}</span>
          <q-icon name="edit" size="xs" class="q-ml-sm text-grey-5" />
        </div>
      </div>
      
      <div class="action-row">
        <q-btn unelevated color="indigo-8" size="md" class="col action-btn" @click="shareRoute">
          <q-icon name="share" size="xs" class="q-mr-xs" />
          Compartir
        </q-btn>
        <q-btn unelevated :color="roundTrip ? 'purple-8' : 'grey-8'" size="md" class="col action-btn" @click="roundTrip = !roundTrip">
          <q-icon name="replay" size="xs" class="q-mr-xs" />
          {{ roundTrip ? 'Ida y vuelta' : 'Solo ida' }}
        </q-btn>
      </div>
      
      <div v-if="panelExpanded" class="stops-section">
        <q-item v-if="startAddress" dense class="origin-item">
          <q-item-section avatar>
            <q-icon name="home" color="positive" />
          </q-item-section>
          <q-item-section>
            <q-item-label class="text-weight-medium">Punto de partida</q-item-label>
            <q-item-label caption>{{ startAddress }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-btn flat round dense icon="schedule" size="sm" @click="showDepartureDialog = true" />
          </q-item-section>
        </q-item>
        
        <div class="stops-header text-caption text-grey q-px-md q-py-xs">
          PARADAS ({{ stops.length }})
        </div>
        
        <draggable v-model="stops" item-key="id" handle=".drag-handle" @end="onDragEnd" class="stops-list">
          <template #item="{ element: stop, index }">
            <q-item dense class="stop-item" clickable @click="navigationMode ? toggleStopComplete(index) : editStop(index)">
              <q-item-section avatar>
                <div class="stop-badge" :class="{ 'completed': stop.completed }" :style="{ background: stop.completed ? '#4caf50' : (stop.color || '#1976d2') }">
                  <q-icon v-if="stop.completed" name="check" size="xs" />
                  <span v-else>{{ stop.id || index + 1 }}</span>
                </div>
                <div v-if="stop.eta" class="stop-time text-caption">{{ formatTime(stop.eta) }}</div>
              </q-item-section>
              <q-item-section>
                <q-item-label class="text-white" :class="{ 'text-strike': stop.completed }" lines="1">{{ stop.name || stop.address }}</q-item-label>
                <q-item-label caption>
                  <span v-if="stop.distance">{{ stop.distance.toFixed(1) }} km</span>
                  <span v-if="stop.duration"> · {{ Math.round(stop.duration) }} min</span>
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <div class="row items-center no-wrap q-gutter-xs">
                  <q-btn v-if="navigationMode" flat round dense :icon="stop.completed ? 'replay' : 'check'" 
                    :color="stop.completed ? 'grey' : 'positive'" size="sm" @click.stop="toggleStopComplete(index)" />
                  <q-icon v-if="stop.type === 'pickup'" name="upload" color="info" size="sm" />
                  <q-btn v-if="!navigationMode" flat round dense icon="close" size="xs" color="negative" @click.stop="removeStop(index)" />
                  <q-icon v-if="!navigationMode" name="drag_indicator" class="drag-handle text-grey-6 cursor-move" />
                </div>
              </q-item-section>
            </q-item>
          </template>
        </draggable>
        
        <q-item v-if="roundTrip && startAddress" dense class="origin-item">
          <q-item-section avatar>
            <q-icon name="flag" color="warning" />
          </q-item-section>
          <q-item-section>
            <q-item-label>Regreso al inicio</q-item-label>
          </q-item-section>
        </q-item>
        
        <div v-if="!stops.length" class="empty-state">
          <q-icon name="add_location_alt" size="48px" color="grey-7" />
          <div class="text-grey-6 q-mt-sm">Agrega paradas para planificar tu ruta</div>
        </div>
      </div>
      
      <div class="bottom-bar">
        <div class="time-big text-h5 text-white text-center q-mb-sm">
          {{ formatDuration(totalDuration) }}
        </div>
        
        <template v-if="!isOptimized && stops.length >= 2">
          <q-btn color="primary" class="full-width" :loading="optimizing" @click="optimizeRoute">
            <q-icon name="auto_fix_high" class="q-mr-sm" />
            Optimizar la ruta
          </q-btn>
        </template>
        
        <template v-else-if="isOptimized && !navigationMode">
          <div class="row q-gutter-sm">
            <q-btn outline color="grey-5" class="col" @click="showAdjustMenu = true">Ajustar</q-btn>
            <q-btn color="primary" class="col" @click="confirmRoute">Confirmar</q-btn>
          </div>
        </template>
        
        <template v-else-if="navigationMode">
          <div v-if="nextPendingStop" class="next-stop-card q-mb-sm">
            <div class="row items-center">
              <div class="stop-badge-nav" :style="{ background: nextPendingStop.color || '#1976d2' }">
                {{ nextPendingStop.id }}
              </div>
              <div class="col q-ml-sm">
                <div class="text-caption text-grey-5">Próxima parada</div>
                <div class="text-body1 text-white text-weight-medium" style="line-height: 1.2">
                  {{ nextPendingStop.name || nextPendingStop.address }}
                </div>
                <div class="text-caption text-grey-5">
                  {{ nextPendingStop.distance ? nextPendingStop.distance.toFixed(1) + ' km' : '' }}
                  {{ nextPendingStop.duration ? ' · ' + Math.round(nextPendingStop.duration) + ' min' : '' }}
                  {{ nextPendingStop.eta ? ' · Llegada ' + formatTime(nextPendingStop.eta) : '' }}
                </div>
              </div>
            </div>
          </div>
          <div class="row q-gutter-sm">
            <q-btn outline color="grey-5" class="col-3" @click="exitNavigation">
              <q-icon name="edit" size="xs" />
            </q-btn>
            <q-btn v-if="nextPendingStop" color="positive" class="col" @click="completeNextStop">
              <q-icon name="check" class="q-mr-xs" />
              Completar
            </q-btn>
            <q-btn v-if="nextPendingStop" outline color="warning" class="col-3" @click="skipNextStop">
              <q-icon name="skip_next" size="xs" />
            </q-btn>
          </div>
          <div v-if="!nextPendingStop" class="text-center q-mt-sm">
            <q-icon name="celebration" size="md" color="positive" />
            <div class="text-positive text-h6 q-mt-xs">Ruta completada</div>
            <q-btn flat color="primary" label="Nueva ruta" @click="clearRoute" class="q-mt-sm" />
          </div>
        </template>
        
        <template v-else>
          <q-btn color="primary" class="full-width" @click="showAddOptions">
            <q-icon name="add" class="q-mr-sm" />
            Añadir paradas
          </q-btn>
        </template>
      </div>
    </div>
    
    <q-dialog v-model="showRouteNameDialog">
      <q-card class="bg-dark" style="min-width: 300px">
        <q-card-section>
          <div class="text-h6">Nombre de la ruta</div>
        </q-card-section>
        <q-card-section>
          <q-input v-model="routeName" outlined dense dark placeholder="Mi Ruta" autofocus />
          <div class="q-mt-md">
            <q-btn-toggle v-model="routeDate" spread toggle-color="primary" text-color="white"
              :options="[
                { label: 'Hoy', value: 'today' },
                { label: 'Mañana', value: 'tomorrow' }
              ]" />
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancelar" color="grey" v-close-popup />
          <q-btn color="primary" label="Guardar" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
    
    <q-dialog v-model="showStopDialog" position="bottom" full-width>
      <q-card class="bg-dark">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">Editar parada</div>
          <q-space />
          <q-btn flat round dense icon="close" v-close-popup />
        </q-card-section>
        
        <q-card-section v-if="editingStop">
          <q-input v-model="editingStop.name" label="Nombre (opcional)" outlined dense dark class="q-mb-sm" />
          <q-input v-model="editingStop.notes" label="Notas" outlined dense dark type="textarea" rows="2" class="q-mb-md" />
          
          <div class="row q-gutter-sm q-mb-md">
            <q-btn-toggle v-model="editingStop.priority" class="col" toggle-color="primary" size="sm"
              :options="[
                { label: '1°', value: 'first' },
                { label: 'Auto', value: 'auto' },
                { label: 'Últ', value: 'last' }
              ]" />
            <q-btn-toggle v-model="editingStop.type" class="col" toggle-color="primary" size="sm"
              :options="[
                { label: 'Entrega', value: 'delivery' },
                { label: 'Recogida', value: 'pickup' }
              ]" />
          </div>
          
          <div class="row q-gutter-sm">
            <q-input v-model.number="editingStop.stopDuration" type="number" label="Min en parada" 
              outlined dense dark class="col" />
            <q-input v-model.number="editingStop.packages" type="number" label="Paquetes" 
              outlined dense dark class="col" />
          </div>
        </q-card-section>
        
        <q-card-actions class="q-px-md q-pb-md">
          <q-btn outline color="negative" class="col" @click="deleteCurrentStop" v-close-popup>
            <q-icon name="delete" class="q-mr-xs" /> Eliminar
          </q-btn>
          <q-btn color="primary" class="col" @click="saveStopEdits" v-close-popup>
            <q-icon name="check" class="q-mr-xs" /> Guardar
          </q-btn>
        </q-card-actions>
      </q-card>
    </q-dialog>
    
    <q-dialog v-model="showAdjustMenu" position="bottom">
      <q-card class="bg-dark full-width">
        <q-list>
          <q-item clickable v-close-popup @click="invertRoute">
            <q-item-section avatar><q-icon name="swap_vert" /></q-item-section>
            <q-item-section>
              <q-item-label>Invertir ruta</q-item-label>
              <q-item-label caption>Cambia el orden de inicio a fin</q-item-label>
            </q-item-section>
          </q-item>
          <q-item clickable v-close-popup @click="reoptimize">
            <q-item-section avatar><q-icon name="refresh" /></q-item-section>
            <q-item-section>
              <q-item-label>Volver a optimizar</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card>
    </q-dialog>
    
    <q-dialog v-model="showRouteMenu" position="bottom">
      <q-card class="bg-dark full-width">
        <q-list>
          <q-item clickable v-close-popup @click="showRouteNameDialog = true">
            <q-item-section avatar><q-icon name="edit" /></q-item-section>
            <q-item-section>Editar nombre</q-item-section>
          </q-item>
          <q-item clickable v-close-popup @click="roundTrip = !roundTrip">
            <q-item-section avatar><q-icon name="replay" /></q-item-section>
            <q-item-section>{{ roundTrip ? 'Desactivar' : 'Activar' }} ida y vuelta</q-item-section>
          </q-item>
          <q-item clickable v-close-popup @click="clearRoute" class="text-negative">
            <q-item-section avatar><q-icon name="delete_sweep" color="negative" /></q-item-section>
            <q-item-section>Borrar todo</q-item-section>
          </q-item>
        </q-list>
      </q-card>
    </q-dialog>
    
    <q-dialog v-model="showAddDialog" position="bottom">
      <q-card class="bg-dark full-width">
        <q-card-section>
          <div class="text-h6">Añadir paradas</div>
        </q-card-section>
        <q-list>
          <q-item clickable v-close-popup @click="focusSearch">
            <q-item-section avatar><q-icon name="search" /></q-item-section>
            <q-item-section>Buscar dirección</q-item-section>
          </q-item>
          <q-item clickable v-close-popup @click="addFromMap">
            <q-item-section avatar><q-icon name="add_location" /></q-item-section>
            <q-item-section>Seleccionar en mapa</q-item-section>
          </q-item>
        </q-list>
      </q-card>
    </q-dialog>
    
    <q-dialog v-model="showOptimizing" persistent>
      <q-card class="bg-dark text-center" style="min-width: 250px">
        <q-card-section class="q-py-xl">
          <q-spinner-orbit size="60px" color="primary" />
          <div class="text-h6 q-mt-md">Optimizando ruta</div>
          <div class="text-grey q-mt-xs">Analizando paradas...</div>
        </q-card-section>
      </q-card>
    </q-dialog>
    
    <q-dialog v-model="showMapSelectDialog" position="bottom">
      <q-card class="bg-dark full-width" style="border-radius: 16px 16px 0 0">
        <q-card-section class="q-pb-none">
          <div class="row items-center q-mb-sm">
            <q-icon name="place" color="primary" size="md" class="q-mr-sm" />
            <div class="col">
              <div class="text-caption text-grey-5">Ubicación seleccionada</div>
              <div class="text-body1 text-white">{{ mapSelectedLocation.address }}</div>
            </div>
            <q-btn flat round icon="close" v-close-popup size="sm" />
          </div>
        </q-card-section>
        
        <q-card-section>
          <div class="text-caption text-grey-5 q-mb-xs">Orden en la ruta</div>
          <q-btn-toggle v-model="mapSelectPriority" spread no-caps unelevated
            toggle-color="primary" color="grey-9" text-color="white"
            :options="[
              { label: 'Primera', value: 'first' },
              { label: 'Automático', value: 'auto' },
              { label: 'Última', value: 'last' }
            ]" class="full-width" />
        </q-card-section>
        
        <q-card-actions class="q-px-md q-pb-md">
          <q-btn outline color="grey-5" label="Cancelar" v-close-popup class="col" />
          <q-btn color="primary" label="Agregar parada" @click="confirmMapSelection" class="col" />
        </q-card-actions>
      </q-card>
    </q-dialog>
    
    <div v-if="lastAction" class="undo-bar">
      <span>{{ lastAction.message }}</span>
      <q-btn flat dense label="Deshacer" color="primary" @click="undoAction" />
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useQuasar } from 'quasar'
import { Geolocation } from '@capacitor/geolocation'
import draggable from 'vuedraggable'

const $q = useQuasar()

const routeName = ref('')
const routeDate = ref('today')
const roundTrip = ref(false)
const panelExpanded = ref(true)

const startAddress = ref('')
const startLat = ref(null)
const startLng = ref(null)

const stops = ref([])
const isOptimized = ref(false)
const optimizing = ref(false)
const navigationMode = ref(false)

const totalDistance = ref(0)
const totalDuration = ref(0)
const savedDistance = ref(0)
const savedDuration = ref(0)

const searchQuery = ref('')
const searchSuggestions = ref([])
const showSearch = ref(false)
const isListening = ref(false)
const voiceSupported = ref(false)

const mapType = ref('roadmap')
const selectingOnMap = ref(false)

const showRouteNameDialog = ref(false)
const showStopDialog = ref(false)
const showAdjustMenu = ref(false)
const showRouteMenu = ref(false)
const showAddDialog = ref(false)
const showOptimizing = ref(false)
const showDepartureDialog = ref(false)
const showMapSelectDialog = ref(false)

const mapSelectedLocation = ref({ lat: null, lng: null, address: '' })
const mapSelectPriority = ref('auto')

const editingStop = ref(null)
const editingStopIndex = ref(-1)
const lastAction = ref(null)

const nextPendingStop = computed(() => {
  return stops.value.find(s => !s.completed) || null
})

const nextPendingStopIndex = computed(() => {
  return stops.value.findIndex(s => !s.completed)
})

let map = null
let directionsService = null
let directionsRenderer = null
let searchTimeout = null

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || ''

onMounted(() => {
  loadGoogleMaps()
  checkVoiceSupport()
  getCurrentLocation()
})

const checkVoiceSupport = () => {
  voiceSupported.value = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
}

const loadGoogleMaps = () => {
  if (window.google?.maps) {
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
    center: { lat: 23.6345, lng: -102.5528 },
    zoom: 5,
    mapTypeId: 'roadmap',
    disableDefaultUI: true,
    zoomControl: true
  })
  
  directionsService = new window.google.maps.DirectionsService()
  directionsRenderer = new window.google.maps.DirectionsRenderer({
    map,
    suppressMarkers: false,
    polylineOptions: { strokeColor: '#1976d2', strokeWeight: 4 }
  })
  
  map.addListener('click', (e) => {
    const lat = e.latLng.lat()
    const lng = e.latLng.lng()
    showMapLocationDialog(lat, lng)
  })
}

const showMapLocationDialog = async (lat, lng) => {
  mapSelectedLocation.value = { lat, lng, address: 'Obteniendo dirección...' }
  mapSelectPriority.value = 'auto'
  showMapSelectDialog.value = true
  
  const geocoder = new window.google.maps.Geocoder()
  geocoder.geocode({ location: { lat, lng } }, (results, status) => {
    if (status === 'OK' && results[0]) {
      mapSelectedLocation.value.address = results[0].formatted_address
    } else {
      mapSelectedLocation.value.address = `${lat.toFixed(6)}, ${lng.toFixed(6)}`
    }
  })
}

const confirmMapSelection = () => {
  const loc = mapSelectedLocation.value
  stops.value.push({
    id: stops.value.length + 1,
    address: loc.address,
    name: '',
    lat: loc.lat,
    lng: loc.lng,
    distance: null,
    duration: null,
    eta: null,
    color: '#1976d2',
    priority: mapSelectPriority.value,
    type: 'delivery',
    packages: 1,
    stopDuration: 1,
    notes: '',
    completed: false
  })
  showMapSelectDialog.value = false
  isOptimized.value = false
  updateMapBounds()
  $q.notify({ type: 'positive', message: 'Parada agregada', position: 'top' })
}

const getCurrentLocation = async () => {
  try {
    const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true })
    startLat.value = pos.coords.latitude
    startLng.value = pos.coords.longitude
    startAddress.value = 'Mi ubicación actual'
    if (map) {
      map.setCenter({ lat: startLat.value, lng: startLng.value })
      map.setZoom(13)
    }
  } catch {
    console.log('Location not available')
  }
}

const centerOnLocation = async () => {
  try {
    const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true })
    if (map) {
      map.setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      map.setZoom(15)
    }
  } catch {
    $q.notify({ type: 'negative', message: 'No se pudo obtener ubicación', position: 'top' })
  }
}

const toggleMapType = () => {
  mapType.value = mapType.value === 'roadmap' ? 'satellite' : 'roadmap'
  if (map) map.setMapTypeId(mapType.value)
}

const searchAddress = (val) => {
  if (searchTimeout) clearTimeout(searchTimeout)
  if (!val || val.length < 3) {
    searchSuggestions.value = []
    return
  }
  searchTimeout = setTimeout(() => searchPlaces(val), 300)
}

const searchPlaces = (query) => {
  if (!window.google) return
  const service = new window.google.maps.places.AutocompleteService()
  service.getPlacePredictions({ input: query }, (predictions, status) => {
    if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
      searchSuggestions.value = predictions.map(p => ({ description: p.description, place_id: p.place_id }))
    } else {
      searchSuggestions.value = []
    }
  })
}

const selectSearchSuggestion = async (sug) => {
  searchQuery.value = ''
  searchSuggestions.value = []
  showSearch.value = false
  
  const coords = await getPlaceCoords(sug.place_id)
  if (coords) {
    addStop({ address: sug.description, lat: coords.lat, lng: coords.lng })
  }
}

const getPlaceCoords = (placeId) => {
  return new Promise((resolve) => {
    if (!window.google) return resolve(null)
    const service = new window.google.maps.places.PlacesService(document.createElement('div'))
    service.getDetails({ placeId, fields: ['geometry'] }, (place, status) => {
      if (status === window.google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
        resolve({ lat: place.geometry.location.lat(), lng: place.geometry.location.lng() })
      } else resolve(null)
    })
  })
}

const addStop = (data) => {
  stops.value.push({
    id: stops.value.length + 1,
    address: data.address,
    name: '',
    lat: data.lat,
    lng: data.lng,
    distance: null,
    duration: null,
    eta: null,
    color: '#1976d2',
    priority: 'auto',
    type: 'delivery',
    packages: 1,
    stopDuration: 1,
    notes: '',
    completed: false
  })
  isOptimized.value = false
  updateMapBounds()
  $q.notify({ type: 'positive', message: 'Parada agregada', position: 'top' })
}

const removeStop = (index) => {
  const removed = stops.value.splice(index, 1)[0]
  lastAction.value = { type: 'delete', stop: removed, index, message: 'Parada eliminada' }
  isOptimized.value = false
  assignIds()
  updateMapBounds()
}

const editStop = (index) => {
  editingStopIndex.value = index
  editingStop.value = { ...stops.value[index] }
  showStopDialog.value = true
}

const saveStopEdits = () => {
  if (editingStopIndex.value >= 0 && editingStop.value) {
    stops.value[editingStopIndex.value] = { ...editingStop.value }
    isOptimized.value = false
  }
}

const deleteCurrentStop = () => {
  if (editingStopIndex.value >= 0) {
    removeStop(editingStopIndex.value)
  }
}

const onDragEnd = () => {
  isOptimized.value = false
  assignIds()
}

const assignIds = () => {
  stops.value.forEach((s, i) => s.id = i + 1)
}

const calcOriginalDistance = () => {
  let dist = 0
  for (let i = 0; i < stops.value.length; i++) {
    const s = stops.value[i]
    if (s.distance) dist += s.distance
  }
  return dist
}

const optimizeRoute = async () => {
  if (stops.value.length < 2) {
    $q.notify({ type: 'warning', message: 'Agrega al menos 2 paradas', position: 'top' })
    return
  }
  
  const originalDist = calcOriginalDistance() || 0
  const originalDur = totalDuration.value || 0
  
  showOptimizing.value = true
  optimizing.value = true
  
  try {
    const hasOrigin = startLat.value && startLng.value
    let origin = hasOrigin 
      ? { lat: startLat.value, lng: startLng.value }
      : (stops.value[0].lat ? { lat: stops.value[0].lat, lng: stops.value[0].lng } : stops.value[0].address)
    
    const firstPriority = stops.value.filter(s => s.priority === 'first')
    const lastPriority = stops.value.filter(s => s.priority === 'last')
    const autoStops = stops.value.filter(s => s.priority === 'auto' || !s.priority)
    
    let dest = roundTrip.value && hasOrigin ? origin : 
      (lastPriority.length > 0 
        ? { lat: lastPriority[lastPriority.length - 1].lat, lng: lastPriority[lastPriority.length - 1].lng }
        : (stops.value[stops.value.length - 1].lat 
          ? { lat: stops.value[stops.value.length - 1].lat, lng: stops.value[stops.value.length - 1].lng }
          : stops.value[stops.value.length - 1].address))
    
    const waypointStops = hasOrigin ? autoStops : autoStops.slice(1)
    const waypoints = waypointStops.map(s => ({ 
      location: s.lat && s.lng ? { lat: s.lat, lng: s.lng } : s.address, 
      stopover: true 
    }))
    
    directionsService.route({
      origin, destination: dest, waypoints, optimizeWaypoints: waypoints.length > 1,
      travelMode: window.google.maps.TravelMode.DRIVING
    }, (result, status) => {
      showOptimizing.value = false
      optimizing.value = false
      
      if (status === 'OK') {
        directionsRenderer.setDirections(result)
        
        const order = result.routes[0].waypoint_order || []
        const legs = result.routes[0].legs
        let totalDist = 0, totalDur = 0
        const reordered = []
        let time = new Date()
        
        for (const fp of firstPriority) {
          reordered.push({ ...fp })
        }
        
        if (hasOrigin) {
          for (let i = 0; i < order.length; i++) {
            const stop = { ...waypointStops[order[i]] }
            stop.distance = legs[i].distance.value / 1000
            stop.duration = legs[i].duration.value / 60
            time = new Date(time.getTime() + legs[i].duration.value * 1000)
            stop.eta = new Date(time)
            time = new Date(time.getTime() + (stop.stopDuration || 1) * 60000)
            totalDist += stop.distance
            totalDur += stop.duration
            reordered.push(stop)
          }
        } else {
          const first = { ...stops.value[0] }
          first.distance = 0
          first.duration = 0
          first.eta = new Date(time)
          reordered.push(first)
          time = new Date(time.getTime() + (first.stopDuration || 1) * 60000)
          
          for (let i = 0; i < order.length; i++) {
            const stop = { ...waypointStops[order[i]] }
            stop.distance = legs[i].distance.value / 1000
            stop.duration = legs[i].duration.value / 60
            time = new Date(time.getTime() + legs[i].duration.value * 1000)
            stop.eta = new Date(time)
            time = new Date(time.getTime() + (stop.stopDuration || 1) * 60000)
            totalDist += stop.distance
            totalDur += stop.duration
            reordered.push(stop)
          }
        }
        
        for (const lp of lastPriority) {
          const lpCopy = { ...lp }
          if (legs.length > order.length) {
            const lastLeg = legs[legs.length - 1]
            lpCopy.distance = lastLeg.distance.value / 1000
            lpCopy.duration = lastLeg.duration.value / 60
            time = new Date(time.getTime() + lastLeg.duration.value * 1000)
            lpCopy.eta = new Date(time)
            totalDist += lpCopy.distance
            totalDur += lpCopy.duration
          }
          reordered.push(lpCopy)
        }
        
        if (roundTrip.value && hasOrigin && legs.length > 0) {
          const returnLeg = legs[legs.length - 1]
          totalDist += returnLeg.distance.value / 1000
          totalDur += returnLeg.duration.value / 60
        }
        
        reordered.forEach((s, i) => s.id = i + 1)
        
        stops.value = reordered
        totalDistance.value = totalDist
        totalDuration.value = totalDur
        
        if (originalDist > totalDist) {
          savedDistance.value = originalDist - totalDist
          savedDuration.value = originalDur - totalDur
        } else {
          savedDistance.value = 0
          savedDuration.value = 0
        }
        
        isOptimized.value = true
        $q.notify({ type: 'positive', message: 'Ruta optimizada', position: 'top' })
      } else {
        $q.notify({ type: 'negative', message: 'Error: ' + status, position: 'top' })
      }
    })
  } catch {
    showOptimizing.value = false
    optimizing.value = false
    $q.notify({ type: 'negative', message: 'Error al optimizar', position: 'top' })
  }
}

const invertRoute = () => {
  stops.value = stops.value.reverse()
  assignIds()
  isOptimized.value = false
  $q.notify({ message: 'Ruta invertida', position: 'top' })
}

const reoptimize = () => {
  isOptimized.value = false
  optimizeRoute()
}

const confirmRoute = () => {
  navigationMode.value = true
  $q.notify({ type: 'positive', message: 'Ruta confirmada', position: 'top' })
}

const exitNavigation = () => {
  navigationMode.value = false
}

const toggleStopComplete = (index) => {
  const stop = stops.value[index]
  const wasCompleted = stop.completed
  stop.completed = !stop.completed
  lastAction.value = { 
    type: 'complete', 
    index, 
    wasCompleted, 
    message: stop.completed ? 'Parada completada' : 'Parada desmarcada' 
  }
  $q.notify({ 
    type: stop.completed ? 'positive' : 'info', 
    message: stop.completed ? `Parada ${stop.id} completada` : `Parada ${stop.id} desmarcada`,
    position: 'top'
  })
  centerOnNextStop()
}

const completeNextStop = () => {
  const idx = nextPendingStopIndex.value
  if (idx === -1) return
  
  const stop = stops.value[idx]
  stop.completed = true
  lastAction.value = { 
    type: 'complete', 
    index: idx, 
    wasCompleted: false, 
    message: `Parada ${stop.id} completada` 
  }
  
  const remaining = stops.value.filter(s => !s.completed).length
  if (remaining > 0) {
    $q.notify({ 
      type: 'positive', 
      message: `Parada ${stop.id} completada`, 
      caption: `${remaining} paradas restantes`,
      position: 'top'
    })
    centerOnNextStop()
  } else {
    $q.notify({ 
      type: 'positive', 
      message: 'Ruta completada',
      icon: 'celebration',
      position: 'top'
    })
  }
}

const skipNextStop = () => {
  const idx = nextPendingStopIndex.value
  if (idx === -1) return
  
  const stop = stops.value[idx]
  stop.completed = true
  stop.skipped = true
  lastAction.value = { 
    type: 'skip', 
    index: idx, 
    message: `Parada ${stop.id} omitida` 
  }
  $q.notify({ 
    type: 'warning', 
    message: `Parada ${stop.id} omitida`,
    position: 'top'
  })
  centerOnNextStop()
}

const centerOnNextStop = () => {
  const next = nextPendingStop.value
  if (next && next.lat && next.lng && map) {
    map.panTo({ lat: next.lat, lng: next.lng })
    map.setZoom(15)
  }
}

const updateMapBounds = () => {
  if (!map || !window.google) return
  const bounds = new window.google.maps.LatLngBounds()
  if (startLat.value && startLng.value) bounds.extend({ lat: startLat.value, lng: startLng.value })
  stops.value.forEach(s => { if (s.lat && s.lng) bounds.extend({ lat: s.lat, lng: s.lng }) })
  if (!bounds.isEmpty()) map.fitBounds(bounds, 50)
}

const shareRoute = async () => {
  let text = `${routeName.value || 'Mi Ruta'}\n\n`
  if (startAddress.value) text += `Inicio: ${startAddress.value}\n\n`
  stops.value.forEach((s, i) => {
    text += `${i + 1}. ${s.name || s.address}\n`
    if (s.eta) text += `   ${formatTime(s.eta)}\n`
  })
  if (totalDistance.value) text += `\nTotal: ${totalDistance.value.toFixed(1)} km - ${formatDuration(totalDuration.value)}`
  
  if (navigator.share) {
    try { await navigator.share({ title: routeName.value || 'Mi Ruta', text }) }
    catch { navigator.clipboard.writeText(text); $q.notify({ message: 'Copiado', position: 'top' }) }
  } else {
    navigator.clipboard.writeText(text)
    $q.notify({ message: 'Copiado al portapapeles', position: 'top' })
  }
}

const clearRoute = () => {
  $q.dialog({ title: 'Borrar', message: '¿Borrar todas las paradas?', cancel: true }).onOk(() => {
    stops.value = []
    isOptimized.value = false
    navigationMode.value = false
    totalDistance.value = 0
    totalDuration.value = 0
    if (directionsRenderer) directionsRenderer.setDirections({ routes: [] })
  })
}

const showAddOptions = () => { showAddDialog.value = true }

const focusSearch = () => {
  panelExpanded.value = true
  showSearch.value = true
  nextTick(() => document.querySelector('.search-input input')?.focus())
}

const addFromMap = () => {
  selectingOnMap.value = true
  panelExpanded.value = false
  $q.notify({ message: 'Toca el mapa para agregar parada', position: 'top' })
}

const undoAction = () => {
  if (lastAction.value?.type === 'delete') {
    stops.value.splice(lastAction.value.index, 0, lastAction.value.stop)
    assignIds()
  } else if (lastAction.value?.type === 'complete') {
    stops.value[lastAction.value.index].completed = lastAction.value.wasCompleted
  }
  lastAction.value = null
}

const startVoiceSearch = () => {
  if (!voiceSupported.value) return
  const SR = window.webkitSpeechRecognition || window.SpeechRecognition
  const rec = new SR()
  rec.lang = 'es-MX'
  rec.onstart = () => { isListening.value = true }
  rec.onresult = (e) => { searchQuery.value = e.results[0][0].transcript; searchAddress(searchQuery.value); showSearch.value = true }
  rec.onerror = () => { isListening.value = false }
  rec.onend = () => { isListening.value = false }
  rec.start()
}

const formatTime = (date) => {
  if (!date) return ''
  return new Date(date).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

const formatDuration = (min) => {
  if (!min) return '0 min'
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return h > 0 ? `${h}h ${m}m` : `${m} min`
}

watch(stops, () => { if (stops.value.length && !map) loadGoogleMaps() }, { deep: true })
</script>

<style scoped>
.trip-planner-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #0d1117;
}

.map-section {
  flex: 0 0 45%;
  position: relative;
}

.map-container {
  width: 100%;
  height: 100%;
}

.savings-banner {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.85);
  padding: 6px 12px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  gap: 6px;
  color: white;
  font-size: 13px;
}

.map-controls {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
}

.bottom-panel {
  flex: 1;
  background: linear-gradient(180deg, rgba(20, 24, 40, 0.95) 0%, rgba(15, 18, 30, 0.98) 100%);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 24px 24px 0 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  margin-top: -20px;
  z-index: 10;
  box-shadow: 0 -4px 30px rgba(0, 0, 0, 0.3);
}

.panel-handle {
  padding: 10px;
  display: flex;
  justify-content: center;
}

.handle-bar {
  width: 40px;
  height: 5px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}

.search-section {
  padding: 0 12px;
  position: relative;
}

.search-input {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.search-input :deep(.q-field__control) {
  border-radius: 16px;
}

.suggestions-dropdown {
  position: absolute;
  top: 100%;
  left: 12px;
  right: 12px;
  background: #252b3b;
  border-radius: 10px;
  max-height: 180px;
  overflow-y: auto;
  z-index: 100;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4);
}

.route-header {
  padding: 12px 16px 8px;
}

.stats-chips {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.stat-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(99, 102, 241, 0.15);
  color: #a5b4fc;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.route-title {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.action-row {
  display: flex;
  gap: 10px;
  padding: 0 12px 12px;
}

.action-btn {
  border-radius: 12px !important;
  font-weight: 600;
  text-transform: none;
}

.stops-section {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 8px;
}

.origin-item {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(52, 211, 153, 0.08) 100%);
  margin: 0 8px 8px;
  border-radius: 14px;
  border-left: 4px solid #10b981;
}

.stops-header {
  text-transform: uppercase;
  letter-spacing: 1px;
}

.stops-list {
  padding: 0 8px;
}

.stop-item {
  background: rgba(255, 255, 255, 0.06);
  border-radius: 14px;
  margin-bottom: 8px;
  border-left: 4px solid #6366f1;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: all 0.2s ease;
}

.stop-item:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: translateX(2px);
}

.stop-badge {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  font-size: 14px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  box-shadow: 0 2px 6px rgba(99, 102, 241, 0.4);
}

.stop-badge.completed {
  background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
  box-shadow: 0 2px 6px rgba(16, 185, 129, 0.4);
}

.stop-badge-nav {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  font-size: 20px;
  flex-shrink: 0;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.5);
}

.next-stop-card {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.1) 100%);
  border-radius: 16px;
  padding: 16px;
  border: 1px solid rgba(99, 102, 241, 0.3);
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.2);
}

.stop-time {
  color: #888;
  margin-top: 2px;
  text-align: center;
}

.empty-state {
  text-align: center;
  padding: 40px 24px;
}

.empty-state .q-icon {
  opacity: 0.5;
}

.time-big {
  font-weight: 300;
  letter-spacing: -1px;
}

.bottom-bar {
  padding: 16px 16px 24px;
  background: linear-gradient(180deg, rgba(20, 24, 40, 0.9) 0%, rgba(15, 18, 30, 1) 100%);
  border-top: 1px solid rgba(99, 102, 241, 0.2);
}

.bottom-bar .q-btn {
  border-radius: 14px;
  font-weight: 600;
  padding: 12px 20px;
  font-size: 15px;
}

.bottom-bar .q-btn--outline {
  border-width: 2px;
}

.undo-bar {
  position: fixed;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  background: #333;
  padding: 10px 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
  color: white;
  z-index: 200;
}

.drag-handle {
  cursor: grab;
}
</style>
