<template>
  <q-page class="local-routes-page">
    <div class="page-header q-pa-md">
      <div class="text-h5 text-weight-bold">Rutas Locales</div>
      <div class="text-caption text-grey">Rutas guardadas en tu dispositivo</div>
    </div>

    <div v-if="localRoutes.length === 0" class="empty-state q-pa-xl text-center">
      <q-icon name="smartphone" size="80px" color="grey-6" />
      <div class="text-h6 text-grey-6 q-mt-md">No hay rutas locales</div>
      <div class="text-body2 text-grey q-mt-sm">
        Las rutas que crees se guardarán automáticamente aquí para acceso sin conexión
      </div>
      <q-btn 
        color="primary" 
        label="Crear nueva ruta" 
        icon="add" 
        class="q-mt-lg"
        rounded
        unelevated
        to="/planner"
      />
    </div>

    <q-list v-else separator class="q-px-md q-pt-md">
      <q-item 
        v-for="(route, index) in localRoutes" 
        :key="index" 
        clickable 
        v-ripple
        @click="loadLocalRoute(route)"
        class="route-card q-my-sm"
      >
        <q-item-section avatar>
          <q-avatar color="secondary" text-color="white" size="48px">
            <q-icon name="offline_pin" />
          </q-avatar>
        </q-item-section>
        <q-item-section>
          <q-item-label class="text-weight-medium">{{ route.name || 'Ruta sin nombre' }}</q-item-label>
          <q-item-label caption>
            {{ route.stops?.length || 0 }} paradas · {{ formatDistance(route.totalDistance) }}
          </q-item-label>
          <q-item-label caption class="text-grey-6">
            <q-icon name="schedule" size="12px" class="q-mr-xs" />
            {{ formatDate(route.savedAt) }}
          </q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-btn flat round icon="more_vert" @click.stop>
            <q-menu>
              <q-list style="min-width: 180px">
                <q-item clickable v-close-popup @click="loadLocalRoute(route)">
                  <q-item-section avatar><q-icon name="open_in_new" /></q-item-section>
                  <q-item-section>Abrir ruta</q-item-section>
                </q-item>
                <q-item clickable v-close-popup @click="syncToCloud(route)">
                  <q-item-section avatar><q-icon name="cloud_upload" /></q-item-section>
                  <q-item-section>Sincronizar a la nube</q-item-section>
                </q-item>
                <q-item clickable v-close-popup @click="exportRoute(route)">
                  <q-item-section avatar><q-icon name="file_download" /></q-item-section>
                  <q-item-section>Exportar</q-item-section>
                </q-item>
                <q-separator />
                <q-item clickable v-close-popup @click="deleteLocalRoute(index)" class="text-negative">
                  <q-item-section avatar><q-icon name="delete" color="negative" /></q-item-section>
                  <q-item-section>Eliminar</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </q-item-section>
      </q-item>
    </q-list>

    <div v-if="localRoutes.length > 0" class="q-pa-md">
      <q-card class="storage-info">
        <q-card-section>
          <div class="flex items-center justify-between">
            <div>
              <div class="text-subtitle2 text-grey-5">Almacenamiento local</div>
              <div class="text-body2">{{ localRoutes.length }} rutas guardadas</div>
            </div>
            <q-btn 
              flat 
              color="negative" 
              label="Borrar todo" 
              icon="delete_sweep"
              @click="clearAllLocal"
            />
          </div>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { api } from 'src/boot/axios'

const $q = useQuasar()
const router = useRouter()
const localRoutes = ref([])

const loadLocalRoutes = () => {
  try {
    const stored = localStorage.getItem('localRoutes')
    if (stored) {
      localRoutes.value = JSON.parse(stored)
    }
  } catch (error) {
    console.error('Error loading local routes:', error)
    localRoutes.value = []
  }
}

const saveLocalRoutes = () => {
  localStorage.setItem('localRoutes', JSON.stringify(localRoutes.value))
}

const loadLocalRoute = (route) => {
  localStorage.setItem('currentLocalRoute', JSON.stringify(route))
  router.push('/planner?local=true')
}

const syncToCloud = async (route) => {
  try {
    $q.loading.show({ message: 'Sincronizando...' })
    
    const response = await api.post('/api/routes', {
      name: route.name || 'Ruta importada',
      start_address: route.startAddress || '',
      start_lat: route.startLat || null,
      start_lng: route.startLng || null
    })
    
    const newRoute = response.data
    
    if (route.stops && route.stops.length > 0) {
      for (const stop of route.stops) {
        await api.post(`/api/routes/${newRoute.id}/stops`, {
          address: stop.address,
          lat: stop.lat,
          lng: stop.lng,
          customer_name: stop.name || '',
          notes: stop.notes || ''
        })
      }
    }
    
    $q.loading.hide()
    $q.notify({ 
      message: 'Ruta sincronizada correctamente', 
      type: 'positive',
      icon: 'cloud_done'
    })
  } catch (error) {
    $q.loading.hide()
    console.error('Error syncing route:', error)
    $q.notify({ message: 'Error al sincronizar la ruta', type: 'negative' })
  }
}

const exportRoute = (route) => {
  const stopsText = route.stops?.map((s, i) => `${i + 1}. ${s.address}`).join('\n') || ''
  const text = `Ruta: ${route.name || 'Sin nombre'}\n\nParadas:\n${stopsText}`
  
  if (navigator.share) {
    navigator.share({ title: route.name || 'Mi Ruta', text })
      .catch(() => copyToClipboard(text))
  } else {
    copyToClipboard(text)
  }
}

const copyToClipboard = (text) => {
  navigator.clipboard.writeText(text)
  $q.notify({ message: 'Ruta copiada al portapapeles', type: 'positive', icon: 'content_copy' })
}

const deleteLocalRoute = (index) => {
  $q.dialog({
    title: 'Eliminar ruta local',
    message: '¿Estás seguro de que quieres eliminar esta ruta?',
    cancel: { label: 'Cancelar', flat: true },
    ok: { label: 'Eliminar', color: 'negative' },
    persistent: true
  }).onOk(() => {
    localRoutes.value.splice(index, 1)
    saveLocalRoutes()
    $q.notify({ message: 'Ruta eliminada', type: 'positive' })
  })
}

const clearAllLocal = () => {
  $q.dialog({
    title: 'Borrar todas las rutas locales',
    message: '¿Estás seguro? Esta acción no se puede deshacer.',
    cancel: { label: 'Cancelar', flat: true },
    ok: { label: 'Borrar todo', color: 'negative' },
    persistent: true
  }).onOk(() => {
    localRoutes.value = []
    saveLocalRoutes()
    $q.notify({ message: 'Todas las rutas locales eliminadas', type: 'positive' })
  })
}

const formatDistance = (meters) => {
  if (!meters) return '0 km'
  return (meters / 1000).toFixed(1) + ' km'
}

const formatDate = (dateStr) => {
  if (!dateStr) return 'Fecha desconocida'
  const date = new Date(dateStr)
  return date.toLocaleDateString('es-ES', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

onMounted(() => {
  loadLocalRoutes()
})
</script>

<style scoped>
.local-routes-page {
  background: var(--q-dark-page);
  min-height: 100vh;
}

.page-header {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.route-card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.empty-state {
  margin-top: 60px;
}

.storage-info {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}
</style>
