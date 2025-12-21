<template>
  <q-page class="saved-routes-page">
    <div class="page-header q-pa-md">
      <div class="text-h5 text-weight-bold">Mis Rutas Guardadas</div>
      <div class="text-caption text-grey">Rutas sincronizadas con tu cuenta</div>
    </div>

    <div v-if="loading" class="flex flex-center q-pa-xl">
      <q-spinner-dots size="50px" color="primary" />
    </div>

    <div v-else-if="routes.length === 0" class="empty-state q-pa-xl text-center">
      <q-icon name="bookmark_border" size="80px" color="grey-6" />
      <div class="text-h6 text-grey-6 q-mt-md">No tienes rutas guardadas</div>
      <div class="text-body2 text-grey q-mt-sm">Las rutas que guardes aparecerán aquí</div>
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

    <q-list v-else separator class="q-px-md">
      <q-item 
        v-for="route in routes" 
        :key="route.id" 
        clickable 
        v-ripple
        @click="loadRoute(route)"
        class="route-card q-my-sm"
      >
        <q-item-section avatar>
          <q-avatar color="primary" text-color="white" size="48px">
            <q-icon name="route" />
          </q-avatar>
        </q-item-section>
        <q-item-section>
          <q-item-label class="text-weight-medium">{{ route.name }}</q-item-label>
          <q-item-label caption>
            {{ route.stops_count || 0 }} paradas · {{ formatDistance(route.total_distance) }}
          </q-item-label>
          <q-item-label caption class="text-grey-6">
            {{ formatDate(route.created_at) }}
          </q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-btn flat round icon="more_vert" @click.stop="showRouteMenu(route)">
            <q-menu>
              <q-list style="min-width: 180px">
                <q-item clickable v-close-popup @click="loadRoute(route)">
                  <q-item-section avatar><q-icon name="open_in_new" /></q-item-section>
                  <q-item-section>Abrir ruta</q-item-section>
                </q-item>
                <q-item clickable v-close-popup @click="duplicateRoute(route)">
                  <q-item-section avatar><q-icon name="content_copy" /></q-item-section>
                  <q-item-section>Duplicar</q-item-section>
                </q-item>
                <q-item clickable v-close-popup @click="shareRoute(route)">
                  <q-item-section avatar><q-icon name="share" /></q-item-section>
                  <q-item-section>Compartir</q-item-section>
                </q-item>
                <q-separator />
                <q-item clickable v-close-popup @click="deleteRoute(route)" class="text-negative">
                  <q-item-section avatar><q-icon name="delete" color="negative" /></q-item-section>
                  <q-item-section>Eliminar</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </q-item-section>
      </q-item>
    </q-list>
  </q-page>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { api } from 'src/boot/axios'

const $q = useQuasar()
const router = useRouter()
const loading = ref(true)
const routes = ref([])

const fetchRoutes = async () => {
  loading.value = true
  try {
    const response = await api.get('/api/routes')
    routes.value = response.data
  } catch (error) {
    console.error('Error fetching routes:', error)
    $q.notify({ message: 'Error al cargar las rutas', type: 'negative' })
  } finally {
    loading.value = false
  }
}

const loadRoute = (route) => {
  router.push(`/planner?routeId=${route.id}`)
}

const duplicateRoute = async (route) => {
  try {
    const response = await api.post('/api/routes', {
      name: `${route.name} (copia)`,
      start_address: route.start_address,
      start_lat: route.start_lat,
      start_lng: route.start_lng
    })
    const newRoute = response.data
    
    if (route.stops && route.stops.length > 0) {
      for (const stop of route.stops) {
        await api.post(`/api/routes/${newRoute.id}/stops`, {
          address: stop.address,
          lat: stop.lat,
          lng: stop.lng,
          customer_name: stop.customer_name,
          phone: stop.phone,
          notes: stop.notes
        })
      }
    }
    
    $q.notify({ message: 'Ruta duplicada correctamente', type: 'positive', icon: 'check' })
    fetchRoutes()
  } catch (error) {
    console.error('Error duplicating route:', error)
    $q.notify({ message: 'Error al duplicar la ruta', type: 'negative' })
  }
}

const shareRoute = async (route) => {
  const stopsText = route.stops?.map((s, i) => `${i + 1}. ${s.address}`).join('\n') || ''
  const text = `Ruta: ${route.name}\n\nParadas:\n${stopsText}`
  
  if (navigator.share) {
    try {
      await navigator.share({ title: route.name, text })
    } catch (err) {
      if (err.name !== 'AbortError') {
        copyToClipboard(text)
      }
    }
  } else {
    copyToClipboard(text)
  }
}

const copyToClipboard = (text) => {
  navigator.clipboard.writeText(text)
  $q.notify({ message: 'Ruta copiada al portapapeles', type: 'positive', icon: 'content_copy' })
}

const deleteRoute = async (route) => {
  $q.dialog({
    title: 'Eliminar ruta',
    message: `¿Estás seguro de que quieres eliminar "${route.name}"?`,
    cancel: { label: 'Cancelar', flat: true },
    ok: { label: 'Eliminar', color: 'negative' },
    persistent: true
  }).onOk(async () => {
    try {
      await api.delete(`/api/routes/${route.id}`)
      $q.notify({ message: 'Ruta eliminada', type: 'positive' })
      fetchRoutes()
    } catch (error) {
      console.error('Error deleting route:', error)
      $q.notify({ message: 'Error al eliminar la ruta', type: 'negative' })
    }
  })
}

const formatDistance = (meters) => {
  if (!meters) return '0 km'
  return (meters / 1000).toFixed(1) + ' km'
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}


onMounted(() => {
  fetchRoutes()
})
</script>

<style scoped>
.saved-routes-page {
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
</style>
