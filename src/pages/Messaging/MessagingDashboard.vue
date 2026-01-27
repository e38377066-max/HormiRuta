<template>
  <q-page class="q-pa-md">
    <div class="text-h5 q-mb-md">
      <q-icon name="fas fa-comments" class="q-mr-sm" />
      Centro de Mensajeria
    </div>

    <div class="row q-col-gutter-md q-mb-lg">
      <div class="col-6 col-md-3">
        <q-card class="bg-primary text-white">
          <q-card-section>
            <div class="text-h4">{{ stats?.todayOrders || 0 }}</div>
            <div class="text-caption">Ordenes Hoy</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-6 col-md-3">
        <q-card class="bg-warning text-white">
          <q-card-section>
            <div class="text-h4">{{ stats?.pending || 0 }}</div>
            <div class="text-caption">Pendientes</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-6 col-md-3">
        <q-card class="bg-info text-white">
          <q-card-section>
            <div class="text-h4">{{ stats?.confirmed || 0 }}</div>
            <div class="text-caption">Confirmadas</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-6 col-md-3">
        <q-card class="bg-positive text-white">
          <q-card-section>
            <div class="text-h4">{{ stats?.completed || 0 }}</div>
            <div class="text-caption">Completadas</div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <q-card class="q-mb-md" v-if="!settings?.has_api_token">
      <q-card-section class="bg-orange-1">
        <div class="row items-center">
          <q-icon name="warning" color="orange" size="md" class="q-mr-md" />
          <div class="col">
            <div class="text-subtitle1">Configuracion Requerida</div>
            <div class="text-caption">Necesitas configurar tu API token de Respond.io para empezar a recibir ordenes.</div>
          </div>
          <q-btn color="primary" label="Configurar" @click="$router.push('/messaging/settings')" />
        </div>
      </q-card-section>
    </q-card>

    <div class="row q-col-gutter-md q-mb-md">
      <div class="col-12 col-md-4">
        <q-btn
          color="primary"
          icon="add"
          label="Nueva Orden"
          class="full-width"
          @click="showNewOrderDialog = true"
        />
      </div>
      <div class="col-12 col-md-4">
        <q-btn
          color="secondary"
          icon="map"
          label="Zonas de Cobertura"
          class="full-width"
          @click="$router.push('/messaging/coverage')"
        />
      </div>
      <div class="col-12 col-md-4">
        <q-btn
          color="accent"
          icon="settings"
          label="Configuracion"
          class="full-width"
          @click="$router.push('/messaging/settings')"
        />
      </div>
    </div>

    <q-card>
      <q-card-section>
        <div class="row items-center justify-between q-mb-md">
          <div class="text-h6">Ordenes Recientes</div>
          <q-select
            v-model="statusFilter"
            :options="statusOptions"
            label="Filtrar por estado"
            dense
            outlined
            emit-value
            map-options
            style="min-width: 150px"
          />
        </div>

        <q-list separator v-if="orders.length > 0">
          <q-item
            v-for="order in orders"
            :key="order.id"
            clickable
            @click="viewOrder(order)"
          >
            <q-item-section avatar>
              <q-avatar :color="getStatusColor(order.status)" text-color="white">
                <q-icon :name="getStatusIcon(order.status)" />
              </q-avatar>
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ order.customer_name || 'Sin nombre' }}</q-item-label>
              <q-item-label caption lines="1">{{ order.address || 'Sin direccion' }}</q-item-label>
              <q-item-label caption>
                <q-chip
                  :color="getValidationColor(order.validation_status)"
                  text-color="white"
                  size="sm"
                  dense
                >
                  {{ order.validation_status === 'valid' ? 'Cobertura OK' : 'Sin cobertura' }}
                </q-chip>
                <q-chip v-if="order.channel_type" size="sm" dense outline>
                  {{ order.channel_type }}
                </q-chip>
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-item-label caption>{{ formatDate(order.created_at) }}</q-item-label>
              <q-chip :color="getStatusColor(order.status)" text-color="white" size="sm">
                {{ getStatusLabel(order.status) }}
              </q-chip>
            </q-item-section>
          </q-item>
        </q-list>

        <div v-else class="text-center q-pa-lg text-grey">
          <q-icon name="inbox" size="xl" class="q-mb-md" />
          <div>No hay ordenes aun</div>
          <div class="text-caption">Las ordenes apareceran aqui cuando lleguen desde Respond.io</div>
        </div>
      </q-card-section>
    </q-card>

    <q-dialog v-model="showNewOrderDialog" persistent>
      <q-card style="min-width: 350px">
        <q-card-section>
          <div class="text-h6">Nueva Orden Manual</div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <q-input
            v-model="newOrder.customer_name"
            label="Nombre del cliente"
            outlined
            dense
            class="q-mb-sm"
          />
          <q-input
            v-model="newOrder.customer_phone"
            label="Telefono"
            outlined
            dense
            class="q-mb-sm"
          />
          <q-input
            v-model="newOrder.address"
            label="Direccion de entrega"
            outlined
            dense
            type="textarea"
            rows="2"
            class="q-mb-sm"
          />
          <q-input
            v-model="newOrder.notes"
            label="Notas adicionales"
            outlined
            dense
            type="textarea"
            rows="2"
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancelar" color="grey" v-close-popup />
          <q-btn
            label="Crear Orden"
            color="primary"
            @click="createOrder"
            :loading="creatingOrder"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useMessagingStore } from 'src/stores/messaging-store'
import { useQuasar } from 'quasar'

const router = useRouter()
const $q = useQuasar()
const messagingStore = useMessagingStore()

const statusFilter = ref(null)
const showNewOrderDialog = ref(false)
const creatingOrder = ref(false)
const newOrder = ref({
  customer_name: '',
  customer_phone: '',
  address: '',
  notes: ''
})

const statusOptions = [
  { label: 'Todos', value: null },
  { label: 'Pendientes', value: 'pending' },
  { label: 'Confirmadas', value: 'confirmed' },
  { label: 'En camino', value: 'in_transit' },
  { label: 'Completadas', value: 'completed' },
  { label: 'Canceladas', value: 'cancelled' }
]

const orders = computed(() => messagingStore.orders)
const stats = computed(() => messagingStore.stats)
const settings = computed(() => messagingStore.settings)

const getStatusColor = (status) => {
  const colors = {
    pending: 'warning',
    confirmed: 'info',
    in_transit: 'primary',
    completed: 'positive',
    cancelled: 'negative'
  }
  return colors[status] || 'grey'
}

const getStatusIcon = (status) => {
  const icons = {
    pending: 'schedule',
    confirmed: 'check_circle',
    in_transit: 'local_shipping',
    completed: 'done_all',
    cancelled: 'cancel'
  }
  return icons[status] || 'help'
}

const getStatusLabel = (status) => {
  const labels = {
    pending: 'Pendiente',
    confirmed: 'Confirmada',
    in_transit: 'En camino',
    completed: 'Completada',
    cancelled: 'Cancelada'
  }
  return labels[status] || status
}

const getValidationColor = (status) => {
  return status === 'valid' ? 'positive' : 'negative'
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('es', { 
    day: '2-digit', 
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const viewOrder = (order) => {
  router.push(`/messaging/orders/${order.id}`)
}

const createOrder = async () => {
  if (!newOrder.value.address) {
    $q.notify({ type: 'warning', message: 'La direccion es requerida' })
    return
  }

  creatingOrder.value = true
  try {
    await messagingStore.createOrder(newOrder.value)
    $q.notify({ type: 'positive', message: 'Orden creada exitosamente' })
    showNewOrderDialog.value = false
    newOrder.value = { customer_name: '', customer_phone: '', address: '', notes: '' }
  } catch {
    $q.notify({ type: 'negative', message: 'Error al crear la orden' })
  } finally {
    creatingOrder.value = false
  }
}

watch(statusFilter, async (newValue) => {
  await messagingStore.fetchOrders(newValue)
})

onMounted(async () => {
  await Promise.all([
    messagingStore.fetchOrders(),
    messagingStore.fetchStats(),
    messagingStore.fetchSettings()
  ])
})
</script>
