<template>
  <q-page class="q-pa-md bg-dark">
    <div class="row items-center justify-between q-mb-md">
      <div class="text-h5 text-white">Mis Rutas</div>
      <q-btn color="primary" icon="add" label="Nueva Ruta" @click="showNewRouteDialog = true" />
    </div>

    <q-tabs v-model="tab" class="text-white q-mb-md" active-color="primary" indicator-color="primary">
      <q-tab name="active" label="Activas" />
      <q-tab name="completed" label="Completadas" />
    </q-tabs>

    <q-tab-panels v-model="tab" animated class="bg-transparent">
      <q-tab-panel name="active" class="q-pa-none">
        <div v-if="loading" class="flex flex-center q-pa-xl">
          <q-spinner color="primary" size="40px" />
        </div>

        <div v-else-if="activeRoutes.length === 0" class="text-center q-pa-xl text-grey">
          <q-icon name="route" size="64px" class="q-mb-md" />
          <div class="text-h6">No tienes rutas activas</div>
          <div class="text-caption">Crea una nueva ruta para comenzar</div>
        </div>

        <q-list v-else class="q-gutter-sm">
          <q-card v-for="route in activeRoutes" :key="route.id" class="route-card" @click="goToRoute(route.id)">
            <q-card-section>
              <div class="row items-center justify-between">
                <div>
                  <div class="text-subtitle1 text-white">{{ route.name || 'Sin nombre' }}</div>
                  <div class="text-caption text-grey">{{ route.stops_count }} paradas</div>
                </div>
                <div class="text-right">
                  <q-badge :color="getStatusColor(route.status)" :label="getStatusLabel(route.status)" />
                  <div v-if="route.is_optimized" class="text-caption text-positive q-mt-xs">
                    <q-icon name="check_circle" size="xs" /> Optimizada
                  </div>
                </div>
              </div>
              <div v-if="route.total_distance" class="row q-mt-sm text-caption text-grey-5">
                <div class="q-mr-md">
                  <q-icon name="straighten" size="xs" /> {{ route.total_distance.toFixed(1) }} km
                </div>
                <div>
                  <q-icon name="schedule" size="xs" /> {{ formatDuration(route.total_duration) }}
                </div>
              </div>
            </q-card-section>
          </q-card>
        </q-list>
      </q-tab-panel>

      <q-tab-panel name="completed" class="q-pa-none">
        <div v-if="completedRoutes.length === 0" class="text-center q-pa-xl text-grey">
          <q-icon name="history" size="64px" class="q-mb-md" />
          <div class="text-h6">No hay rutas completadas</div>
        </div>

        <q-list v-else class="q-gutter-sm">
          <q-card v-for="route in completedRoutes" :key="route.id" class="route-card completed">
            <q-card-section>
              <div class="row items-center justify-between">
                <div>
                  <div class="text-subtitle1 text-white">{{ route.name || 'Sin nombre' }}</div>
                  <div class="text-caption text-grey">
                    {{ route.completed_stops }}/{{ route.stops_count }} completadas
                  </div>
                </div>
                <div class="text-right text-caption text-grey">
                  {{ formatDate(route.completed_at) }}
                </div>
              </div>
            </q-card-section>
          </q-card>
        </q-list>
      </q-tab-panel>
    </q-tab-panels>

    <q-dialog v-model="showNewRouteDialog" persistent>
      <q-card class="dialog-card">
        <q-card-section class="modal-header text-white">
          <div class="text-h6">Nueva Ruta</div>
        </q-card-section>

        <q-card-section class="q-gutter-md">
          <q-input v-model="newRoute.name" label="Nombre de la ruta" outlined dense dark />
          <q-input v-model="newRoute.start_address" label="Punto de inicio (opcional)" outlined dense dark />
          <q-toggle v-model="newRoute.return_to_start" label="Regresar al inicio" color="primary" dark />
        </q-card-section>

        <q-card-actions align="right" class="q-pa-md">
          <q-btn flat label="Cancelar" color="grey" v-close-popup />
          <q-btn unelevated label="Crear" color="primary" @click="createRoute" :loading="creating" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useRouteStore } from 'src/stores/route-store'

const router = useRouter()
const $q = useQuasar()
const routeStore = useRouteStore()

const tab = ref('active')
const showNewRouteDialog = ref(false)
const creating = ref(false)

const newRoute = ref({
  name: '',
  start_address: '',
  return_to_start: false
})

const loading = computed(() => routeStore.loading)
const activeRoutes = computed(() => routeStore.activeRoutes)
const completedRoutes = computed(() => routeStore.completedRoutes)

onMounted(() => {
  routeStore.fetchRoutes()
})

function getStatusColor(status) {
  const colors = {
    draft: 'grey',
    pending: 'warning',
    in_progress: 'info',
    completed: 'positive'
  }
  return colors[status] || 'grey'
}

function getStatusLabel(status) {
  const labels = {
    draft: 'Borrador',
    pending: 'Pendiente',
    in_progress: 'En progreso',
    completed: 'Completada'
  }
  return labels[status] || status
}

function formatDuration(minutes) {
  if (!minutes) return '0 min'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours}h ${mins}m`
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('es', {
    day: 'numeric',
    month: 'short'
  })
}

function goToRoute(routeId) {
  router.push(`/routes/${routeId}`)
}

async function createRoute() {
  creating.value = true
  try {
    const route = await routeStore.createRoute(newRoute.value)
    showNewRouteDialog.value = false
    newRoute.value = { name: '', start_address: '', return_to_start: false }
    router.push(`/routes/${route.id}`)
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: error.response?.data?.error || 'Error al crear ruta'
    })
  } finally {
    creating.value = false
  }
}
</script>

<style scoped>
.route-card {
  background: rgba(30, 41, 59, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.route-card:hover {
  border-color: rgba(0, 200, 255, 0.3);
  transform: translateY(-2px);
}

.route-card.completed {
  opacity: 0.7;
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
</style>
