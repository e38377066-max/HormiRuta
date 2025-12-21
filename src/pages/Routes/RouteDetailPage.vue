<template>
  <q-page class="bg-dark">
    <q-header class="bg-gradient">
      <q-toolbar>
        <q-btn flat round icon="arrow_back" @click="$router.back()" />
        <q-toolbar-title>{{ route?.name || 'Ruta' }}</q-toolbar-title>
        <q-btn flat round icon="more_vert">
          <q-menu>
            <q-list>
              <q-item clickable v-close-popup @click="showImportDialog = true">
                <q-item-section avatar><q-icon name="upload_file" /></q-item-section>
                <q-item-section>Importar paradas</q-item-section>
              </q-item>
              <q-item clickable v-close-popup @click="deleteRoute">
                <q-item-section avatar><q-icon name="delete" color="negative" /></q-item-section>
                <q-item-section class="text-negative">Eliminar ruta</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </q-toolbar>
    </q-header>

    <div v-if="loading" class="flex flex-center q-pa-xl">
      <q-spinner color="primary" size="40px" />
    </div>

    <div v-else-if="route" class="q-pa-md">
      <div v-if="route.is_optimized && route.total_distance" class="stats-bar q-mb-md">
        <div class="stat-item">
          <q-icon name="straighten" />
          <span>{{ route.total_distance.toFixed(1) }} km</span>
        </div>
        <div class="stat-item">
          <q-icon name="schedule" />
          <span>{{ formatDuration(route.total_duration) }}</span>
        </div>
        <div class="stat-item">
          <q-icon name="place" />
          <span>{{ route.stops_count }} paradas</span>
        </div>
      </div>

      <div class="row q-gutter-sm q-mb-md">
        <q-btn v-if="!route.is_optimized && route.stops?.length >= 2" color="primary" icon="auto_fix_high"
          label="Optimizar" @click="optimizeRoute" :loading="optimizing" class="col" />
        <q-btn v-if="route.status === 'draft' && route.is_optimized" color="positive" icon="play_arrow"
          label="Iniciar ruta" @click="startRoute" class="col" />
        <q-btn v-if="route.status === 'in_progress'" color="info" icon="navigation" label="Navegar"
          @click="openNavigation" class="col" />
      </div>

      <div class="text-subtitle2 text-white q-mb-sm">
        Paradas ({{ route.stops?.length || 0 }})
        <q-btn flat round size="sm" icon="add" color="primary" @click="showAddStopDialog = true" />
      </div>

      <div v-if="!route.stops?.length" class="text-center q-pa-xl text-grey">
        <q-icon name="add_location" size="64px" class="q-mb-md" />
        <div class="text-h6">Sin paradas</div>
        <div class="text-caption q-mb-md">Agrega paradas a tu ruta</div>
        <q-btn color="primary" icon="add" label="Agregar parada" @click="showAddStopDialog = true" />
      </div>

      <q-list v-else class="stops-list">
        <q-item v-for="(stop, index) in sortedStops" :key="stop.id" class="stop-item"
          :class="{ completed: stop.status === 'completed', failed: stop.status === 'failed' }">
          <q-item-section avatar>
            <div class="stop-number" :class="stop.status">{{ index + 1 }}</div>
          </q-item-section>

          <q-item-section>
            <q-item-label class="text-white">{{ stop.address }}</q-item-label>
            <q-item-label caption class="text-grey-5">
              <span v-if="stop.customer_name">{{ stop.customer_name }}</span>
              <span v-if="stop.eta"> - ETA: {{ formatTime(stop.eta) }}</span>
            </q-item-label>
            <q-item-label v-if="stop.time_window_start" caption class="text-warning">
              <q-icon name="schedule" size="xs" />
              {{ stop.time_window_start }} - {{ stop.time_window_end }}
            </q-item-label>
          </q-item-section>

          <q-item-section side>
            <div class="row q-gutter-xs">
              <q-btn v-if="stop.status === 'pending' && route.status === 'in_progress'" flat round size="sm"
                icon="check_circle" color="positive" @click="completeStop(stop)" />
              <q-btn v-if="stop.status === 'pending' && route.status === 'in_progress'" flat round size="sm"
                icon="cancel" color="negative" @click="failStop(stop)" />
              <q-btn flat round size="sm" icon="navigation" color="info" @click="navigateToStop(stop)" />
              <q-btn flat round size="sm" icon="more_vert">
                <q-menu>
                  <q-list>
                    <q-item clickable v-close-popup @click="editStop(stop)">
                      <q-item-section>Editar</q-item-section>
                    </q-item>
                    <q-item clickable v-close-popup @click="deleteStop(stop.id)">
                      <q-item-section class="text-negative">Eliminar</q-item-section>
                    </q-item>
                  </q-list>
                </q-menu>
              </q-btn>
            </div>
          </q-item-section>
        </q-item>
      </q-list>

      <q-btn v-if="route.status === 'in_progress' && allStopsCompleted" color="positive" icon="flag" class="full-width q-mt-md"
        label="Finalizar ruta" @click="completeRoute" />
    </div>

    <q-dialog v-model="showAddStopDialog" persistent>
      <q-card class="dialog-card">
        <q-card-section class="modal-header text-white">
          <div class="text-h6">{{ editingStop ? 'Editar Parada' : 'Nueva Parada' }}</div>
        </q-card-section>

        <q-card-section class="q-gutter-sm">
          <q-input v-model="stopForm.address" label="Direccion" outlined dense dark @update:model-value="searchAddress">
            <template #append>
              <q-icon name="mic" class="cursor-pointer" @click="voiceInput" />
            </template>
          </q-input>

          <q-list v-if="addressSuggestions.length" bordered class="suggestion-list">
            <q-item v-for="(sug, i) in addressSuggestions" :key="i" clickable @click="selectSuggestion(sug)">
              <q-item-section>{{ sug.description }}</q-item-section>
            </q-item>
          </q-list>

          <q-input v-model="stopForm.customer_name" label="Nombre del cliente" outlined dense dark />
          <q-input v-model="stopForm.phone" label="Telefono" outlined dense dark />
          <q-input v-model="stopForm.note" label="Nota" outlined dense dark type="textarea" rows="2" />

          <div class="row q-gutter-sm">
            <q-input v-model="stopForm.time_window_start" label="Hora inicio" outlined dense dark class="col" mask="##:##"
              placeholder="09:00" />
            <q-input v-model="stopForm.time_window_end" label="Hora fin" outlined dense dark class="col" mask="##:##"
              placeholder="17:00" />
          </div>

          <q-select v-model="stopForm.priority" label="Prioridad" outlined dense dark :options="priorityOptions"
            emit-value map-options />

          <q-input v-model="stopForm.package_location" label="Ubicacion del paquete" outlined dense dark
            placeholder="Ej: Estante A3" />
        </q-card-section>

        <q-card-actions align="right" class="q-pa-md">
          <q-btn flat label="Cancelar" color="grey" v-close-popup @click="resetStopForm" />
          <q-btn unelevated :label="editingStop ? 'Guardar' : 'Agregar'" color="primary" @click="saveStop"
            :loading="savingStop" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="showImportDialog" persistent>
      <q-card class="dialog-card" style="min-width: 350px;">
        <q-card-section class="modal-header text-white">
          <div class="text-h6">Importar Paradas</div>
        </q-card-section>

        <q-card-section>
          <q-tabs v-model="importTab" class="text-white">
            <q-tab name="text" label="Texto" />
            <q-tab name="csv" label="CSV" />
          </q-tabs>

          <q-tab-panels v-model="importTab" class="bg-transparent q-mt-md">
            <q-tab-panel name="text" class="q-pa-none">
              <q-input v-model="importText" type="textarea" rows="6" outlined dense dark
                placeholder="Pega las direcciones aqui (una por linea)" />
            </q-tab-panel>
            <q-tab-panel name="csv" class="q-pa-none">
              <q-input v-model="importCSV" type="textarea" rows="6" outlined dense dark
                placeholder="Pega el contenido CSV aqui..." />
              <div class="text-caption text-grey q-mt-sm">
                Columnas: address, lat, lng, customer_name, phone, note, priority
              </div>
            </q-tab-panel>
          </q-tab-panels>
        </q-card-section>

        <q-card-actions align="right" class="q-pa-md">
          <q-btn flat label="Cancelar" color="grey" v-close-popup />
          <q-btn unelevated label="Importar" color="primary" @click="importStops" :loading="importing" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="showPODDialog" persistent>
      <q-card class="dialog-card">
        <q-card-section class="modal-header text-white">
          <div class="text-h6">Prueba de Entrega</div>
        </q-card-section>

        <q-card-section class="q-gutter-md">
          <q-input v-model="podForm.recipient_name" label="Nombre de quien recibe" outlined dense dark />
          <q-input v-model="podForm.delivery_notes" label="Notas de entrega" outlined dense dark type="textarea"
            rows="2" />
          <q-btn color="secondary" icon="camera_alt" label="Tomar foto" @click="takePhoto" class="full-width" />
          <div v-if="podForm.photo_url" class="text-positive">
            <q-icon name="check" /> Foto capturada
          </div>
        </q-card-section>

        <q-card-actions align="right" class="q-pa-md">
          <q-btn flat label="Cancelar" color="grey" v-close-popup />
          <q-btn unelevated label="Confirmar entrega" color="positive" @click="confirmDelivery" :loading="completing" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="showFailDialog" persistent>
      <q-card class="dialog-card">
        <q-card-section class="modal-header text-white">
          <div class="text-h6">Entrega Fallida</div>
        </q-card-section>

        <q-card-section class="q-gutter-md">
          <q-select v-model="failReason" label="Razon" outlined dense dark :options="failReasons" />
          <q-input v-model="failNotes" label="Notas adicionales" outlined dense dark type="textarea" rows="2" />
        </q-card-section>

        <q-card-actions align="right" class="q-pa-md">
          <q-btn flat label="Cancelar" color="grey" v-close-popup />
          <q-btn unelevated label="Confirmar" color="negative" @click="confirmFail" :loading="completing" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import { useRouteStore } from 'src/stores/route-store'

const vueRoute = useRoute()
const router = useRouter()
const $q = useQuasar()
const routeStore = useRouteStore()

const loading = computed(() => routeStore.loading)
const route = computed(() => routeStore.currentRoute)

const sortedStops = computed(() => {
  if (!route.value?.stops) return []
  return [...route.value.stops].sort((a, b) => a.order - b.order)
})

const allStopsCompleted = computed(() => {
  if (!route.value?.stops?.length) return false
  return route.value.stops.every(s => s.status === 'completed' || s.status === 'failed')
})

const showAddStopDialog = ref(false)
const showImportDialog = ref(false)
const showPODDialog = ref(false)
const showFailDialog = ref(false)
const optimizing = ref(false)
const savingStop = ref(false)
const importing = ref(false)
const completing = ref(false)
const editingStop = ref(null)
const currentStop = ref(null)

const importTab = ref('text')
const importText = ref('')
const importCSV = ref('')

const addressSuggestions = ref([])

const stopForm = ref({
  address: '',
  lat: 0,
  lng: 0,
  customer_name: '',
  phone: '',
  note: '',
  time_window_start: '',
  time_window_end: '',
  priority: 0,
  package_location: ''
})

const podForm = ref({
  recipient_name: '',
  delivery_notes: '',
  photo_url: ''
})

const failReason = ref('')
const failNotes = ref('')

const priorityOptions = [
  { label: 'Normal', value: 0 },
  { label: 'Alta', value: 1 },
  { label: 'Urgente', value: 2 }
]

const failReasons = [
  'Cliente ausente',
  'Direccion incorrecta',
  'Rechazado por cliente',
  'Paquete danado',
  'Acceso restringido',
  'Otro'
]

onMounted(() => {
  const routeId = vueRoute.params.id
  if (routeId) {
    routeStore.fetchRoute(routeId)
  }
})

watch(() => vueRoute.params.id, (newId) => {
  if (newId) {
    routeStore.fetchRoute(newId)
  }
})

function formatDuration(minutes) {
  if (!minutes) return '0 min'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours}h ${mins}m`
}

function formatTime(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleTimeString('es', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

async function optimizeRoute() {
  optimizing.value = true
  try {
    const result = await routeStore.optimizeRoute(route.value.id)
    $q.notify({
      type: 'positive',
      message: `Ruta optimizada: ${result.total_distance_km.toFixed(1)} km, ${formatDuration(result.total_duration_min)}`
    })
  } catch {
    $q.notify({ type: 'negative', message: 'Error al optimizar ruta' })
  } finally {
    optimizing.value = false
  }
}

async function startRoute() {
  try {
    await routeStore.startRoute(route.value.id)
    $q.notify({ type: 'positive', message: 'Ruta iniciada' })
  } catch {
    $q.notify({ type: 'negative', message: 'Error al iniciar ruta' })
  }
}

async function completeRoute() {
  try {
    await routeStore.completeRoute(route.value.id)
    $q.notify({ type: 'positive', message: 'Ruta completada' })
    router.push('/routes')
  } catch {
    $q.notify({ type: 'negative', message: 'Error al completar ruta' })
  }
}

async function deleteRoute() {
  $q.dialog({
    title: 'Eliminar ruta',
    message: 'Esta accion no se puede deshacer',
    cancel: true,
    persistent: true
  }).onOk(async () => {
    try {
      await routeStore.deleteRoute(route.value.id)
      router.push('/routes')
    } catch {
      $q.notify({ type: 'negative', message: 'Error al eliminar ruta' })
    }
  })
}

async function searchAddress(query) {
  if (!query || query.length < 3) {
    addressSuggestions.value = []
    return
  }

  try {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY || ''
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&types=geocode&key=${apiKey}&language=es`
    const response = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`)
    const data = await response.json()
    addressSuggestions.value = data.predictions || []
  } catch (error) {
    console.error('Error searching address:', error)
  }
}

function selectSuggestion(suggestion) {
  stopForm.value.address = suggestion.description
  addressSuggestions.value = []
}

function voiceInput() {
  $q.notify({ type: 'info', message: 'Entrada de voz solo disponible en app movil' })
}

function editStop(stop) {
  editingStop.value = stop
  stopForm.value = {
    address: stop.address,
    lat: stop.lat,
    lng: stop.lng,
    customer_name: stop.customer_name || '',
    phone: stop.phone || '',
    note: stop.note || '',
    time_window_start: stop.time_window_start || '',
    time_window_end: stop.time_window_end || '',
    priority: stop.priority || 0,
    package_location: stop.package_location || ''
  }
  showAddStopDialog.value = true
}

function resetStopForm() {
  editingStop.value = null
  stopForm.value = {
    address: '',
    lat: 0,
    lng: 0,
    customer_name: '',
    phone: '',
    note: '',
    time_window_start: '',
    time_window_end: '',
    priority: 0,
    package_location: ''
  }
  addressSuggestions.value = []
}

async function saveStop() {
  if (!stopForm.value.address) {
    $q.notify({ type: 'warning', message: 'La direccion es requerida' })
    return
  }

  savingStop.value = true
  try {
    if (editingStop.value) {
      await routeStore.updateStop(editingStop.value.id, stopForm.value)
      $q.notify({ type: 'positive', message: 'Parada actualizada' })
    } else {
      await routeStore.addStop(route.value.id, stopForm.value)
      $q.notify({ type: 'positive', message: 'Parada agregada' })
    }
    showAddStopDialog.value = false
    resetStopForm()
  } catch {
    $q.notify({ type: 'negative', message: 'Error al guardar parada' })
  } finally {
    savingStop.value = false
  }
}

async function deleteStop(stopId) {
  $q.dialog({
    title: 'Eliminar parada',
    message: 'Esta accion no se puede deshacer',
    cancel: true
  }).onOk(async () => {
    try {
      await routeStore.deleteStop(stopId)
      $q.notify({ type: 'positive', message: 'Parada eliminada' })
    } catch {
      $q.notify({ type: 'negative', message: 'Error al eliminar parada' })
    }
  })
}

async function importStops() {
  importing.value = true
  try {
    let result
    if (importTab.value === 'text') {
      result = await routeStore.importText(route.value.id, importText.value)
    } else {
      result = await routeStore.importCSV(route.value.id, importCSV.value)
    }
    $q.notify({ type: 'positive', message: `${result.imported_count} paradas importadas` })
    showImportDialog.value = false
    importText.value = ''
    importCSV.value = ''
  } catch {
    $q.notify({ type: 'negative', message: 'Error al importar paradas' })
  } finally {
    importing.value = false
  }
}

function completeStop(stop) {
  currentStop.value = stop
  podForm.value = { recipient_name: '', delivery_notes: '', photo_url: '' }
  showPODDialog.value = true
}

function failStop(stop) {
  currentStop.value = stop
  failReason.value = ''
  failNotes.value = ''
  showFailDialog.value = true
}

function takePhoto() {
  $q.notify({ type: 'info', message: 'Camara solo disponible en app movil' })
}

async function confirmDelivery() {
  completing.value = true
  try {
    await routeStore.completeStop(currentStop.value.id, podForm.value)
    $q.notify({ type: 'positive', message: 'Entrega confirmada' })
    showPODDialog.value = false
  } catch {
    $q.notify({ type: 'negative', message: 'Error al confirmar entrega' })
  } finally {
    completing.value = false
  }
}

async function confirmFail() {
  completing.value = true
  try {
    await routeStore.failStop(currentStop.value.id, failReason.value, { delivery_notes: failNotes.value })
    $q.notify({ type: 'warning', message: 'Entrega marcada como fallida' })
    showFailDialog.value = false
  } catch {
    $q.notify({ type: 'negative', message: 'Error al marcar entrega fallida' })
  } finally {
    completing.value = false
  }
}

async function navigateToStop(stop) {
  const lat = stop.lat
  const lng = stop.lng

  if (Capacitor.getPlatform() === 'android') {
    window.location.href = `google.navigation:q=${lat},${lng}&mode=d`
  } else {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`
    await Browser.open({ url })
  }
}

async function openNavigation() {
  const pendingStops = sortedStops.value.filter(s => s.status === 'pending')
  if (pendingStops.length === 0) {
    $q.notify({ type: 'warning', message: 'No hay paradas pendientes' })
    return
  }
  navigateToStop(pendingStops[0])
}
</script>

<style scoped>
.bg-gradient {
  background: linear-gradient(90deg, #0f172a, #1e293b);
}

.stats-bar {
  display: flex;
  justify-content: space-around;
  background: rgba(30, 41, 59, 0.8);
  border-radius: 12px;
  padding: 12px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 8px;
  color: white;
}

.stops-list {
  background: transparent;
}

.stop-item {
  background: rgba(30, 41, 59, 0.8);
  border-radius: 12px;
  margin-bottom: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.stop-item.completed {
  opacity: 0.6;
  border-color: rgba(0, 255, 0, 0.3);
}

.stop-item.failed {
  opacity: 0.6;
  border-color: rgba(255, 0, 0, 0.3);
}

.stop-number {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea, #764ba2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
}

.stop-number.completed {
  background: #4caf50;
}

.stop-number.failed {
  background: #f44336;
}

.dialog-card {
  background: rgba(20, 20, 45, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  min-width: 320px;
}

.modal-header {
  background: linear-gradient(90deg, #31009e, #007b9e);
}

.suggestion-list {
  max-height: 150px;
  overflow-y: auto;
  background: rgba(30, 41, 59, 0.9);
  border-radius: 8px;
}
</style>
