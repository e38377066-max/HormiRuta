<template>
  <q-page class="q-pa-md bg-dark">
    <q-header class="bg-gradient">
      <q-toolbar>
        <q-btn flat round icon="arrow_back" @click="$router.back()" />
        <q-toolbar-title>Historial de Rutas</q-toolbar-title>
      </q-toolbar>
    </q-header>

    <div v-if="loading" class="flex flex-center q-pa-xl">
      <q-spinner color="primary" size="40px" />
    </div>

    <div v-else-if="history.length === 0" class="text-center q-pa-xl text-grey">
      <q-icon name="history" size="64px" class="q-mb-md" />
      <div class="text-h6">Sin historial</div>
      <div class="text-caption">Las rutas completadas apareceran aqui</div>
    </div>

    <q-list v-else class="q-gutter-sm">
      <q-card v-for="item in history" :key="item.id" class="history-card" @click="showDetails(item)">
        <q-card-section>
          <div class="row items-center justify-between">
            <div>
              <div class="text-subtitle1 text-white">{{ item.route_name || 'Ruta sin nombre' }}</div>
              <div class="text-caption text-grey">
                {{ item.completed_stops }}/{{ item.total_stops }} entregas completadas
              </div>
            </div>
            <div class="text-right">
              <div class="text-caption text-grey">{{ formatDate(item.completed_at) }}</div>
              <div v-if="item.total_distance" class="text-caption text-primary">
                {{ item.total_distance.toFixed(1) }} km
              </div>
            </div>
          </div>

          <q-linear-progress :value="item.completed_stops / item.total_stops" color="positive" class="q-mt-sm"
            track-color="grey-8" rounded />

          <div v-if="item.failed_stops > 0" class="text-caption text-negative q-mt-xs">
            {{ item.failed_stops }} entregas fallidas
          </div>
        </q-card-section>
      </q-card>
    </q-list>

    <q-dialog v-model="showDetailDialog">
      <q-card class="dialog-card" style="min-width: 350px;">
        <q-card-section class="modal-header text-white">
          <div class="text-h6">{{ selectedHistory?.route_name || 'Detalles' }}</div>
        </q-card-section>

        <q-card-section v-if="selectedHistory">
          <div class="q-gutter-sm">
            <div class="row justify-between">
              <span class="text-grey">Fecha:</span>
              <span class="text-white">{{ formatFullDate(selectedHistory.completed_at) }}</span>
            </div>
            <div class="row justify-between">
              <span class="text-grey">Total paradas:</span>
              <span class="text-white">{{ selectedHistory.total_stops }}</span>
            </div>
            <div class="row justify-between">
              <span class="text-grey">Completadas:</span>
              <span class="text-positive">{{ selectedHistory.completed_stops }}</span>
            </div>
            <div v-if="selectedHistory.failed_stops > 0" class="row justify-between">
              <span class="text-grey">Fallidas:</span>
              <span class="text-negative">{{ selectedHistory.failed_stops }}</span>
            </div>
            <div v-if="selectedHistory.total_distance" class="row justify-between">
              <span class="text-grey">Distancia:</span>
              <span class="text-white">{{ selectedHistory.total_distance.toFixed(1) }} km</span>
            </div>
            <div v-if="selectedHistory.total_duration" class="row justify-between">
              <span class="text-grey">Duracion:</span>
              <span class="text-white">{{ formatDuration(selectedHistory.total_duration) }}</span>
            </div>
          </div>

          <q-separator class="q-my-md" dark />

          <div v-if="selectedHistory.route_data?.stops" class="text-subtitle2 text-white q-mb-sm">
            Paradas ({{ selectedHistory.route_data.stops.length }})
          </div>

          <q-list v-if="selectedHistory.route_data?.stops" dense class="stops-list">
            <q-item v-for="(stop, i) in selectedHistory.route_data.stops" :key="i" class="stop-item-mini">
              <q-item-section avatar>
                <q-icon :name="stop.status === 'completed' ? 'check_circle' : 'cancel'"
                  :color="stop.status === 'completed' ? 'positive' : 'negative'" />
              </q-item-section>
              <q-item-section>
                <q-item-label class="text-white text-caption">{{ stop.address }}</q-item-label>
                <q-item-label v-if="stop.recipient_name" caption>
                  Recibio: {{ stop.recipient_name }}
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>

        <q-card-actions align="right" class="q-pa-md">
          <q-btn flat label="Cerrar" color="grey" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouteStore } from 'src/stores/route-store'

const routeStore = useRouteStore()

const loading = computed(() => routeStore.loading)
const history = computed(() => routeStore.history)

const showDetailDialog = ref(false)
const selectedHistory = ref(null)

onMounted(() => {
  routeStore.fetchHistory()
})

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

function formatFullDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('es', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatDuration(minutes) {
  if (!minutes) return '0 min'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours}h ${mins}m`
}

function showDetails(item) {
  selectedHistory.value = item
  showDetailDialog.value = true
}
</script>

<style scoped>
.bg-gradient {
  background: linear-gradient(90deg, #0f172a, #1e293b);
}

.history-card {
  background: rgba(30, 41, 59, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.history-card:hover {
  border-color: rgba(0, 200, 255, 0.3);
}

.dialog-card {
  background: rgba(20, 20, 45, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-header {
  background: linear-gradient(90deg, #31009e, #007b9e);
}

.stops-list {
  max-height: 300px;
  overflow-y: auto;
}

.stop-item-mini {
  background: rgba(30, 41, 59, 0.5);
  border-radius: 8px;
  margin-bottom: 4px;
  min-height: 40px;
}
</style>
