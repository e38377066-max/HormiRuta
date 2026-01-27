<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-mb-md">
      <q-btn flat icon="arrow_back" @click="$router.back()" />
      <div class="text-h5 q-ml-md">
        Orden #{{ order?.id }}
      </div>
      <q-space />
      <q-chip
        :color="getStatusColor(order?.status)"
        text-color="white"
        size="lg"
      >
        {{ getStatusLabel(order?.status) }}
      </q-chip>
    </div>

    <div class="row q-col-gutter-md" v-if="order">
      <div class="col-12 col-md-6">
        <q-card>
          <q-card-section>
            <div class="text-h6 q-mb-md">Informacion del Cliente</div>
            
            <div class="row q-mb-sm">
              <div class="col-4 text-grey">Nombre:</div>
              <div class="col-8 text-weight-medium">{{ order.customer_name || 'No especificado' }}</div>
            </div>
            <div class="row q-mb-sm">
              <div class="col-4 text-grey">Telefono:</div>
              <div class="col-8">{{ order.customer_phone || 'No especificado' }}</div>
            </div>
            <div class="row q-mb-sm">
              <div class="col-4 text-grey">Email:</div>
              <div class="col-8">{{ order.customer_email || 'No especificado' }}</div>
            </div>
            <div class="row q-mb-sm">
              <div class="col-4 text-grey">Canal:</div>
              <div class="col-8">
                <q-chip v-if="order.channel_type" size="sm" outline>
                  {{ order.channel_type }}
                </q-chip>
                <span v-else>-</span>
              </div>
            </div>
          </q-card-section>
        </q-card>

        <q-card class="q-mt-md">
          <q-card-section>
            <div class="text-h6 q-mb-md">Direccion de Entrega</div>
            
            <div class="text-body1 q-mb-md">{{ order.address || 'Sin direccion' }}</div>
            
            <div class="row q-gutter-sm">
              <q-chip
                :color="order.validation_status === 'valid' ? 'positive' : 'negative'"
                text-color="white"
                size="sm"
              >
                {{ order.validation_status === 'valid' ? 'Con cobertura' : 'Sin cobertura' }}
              </q-chip>
              <q-chip v-if="order.zip_code" size="sm" outline>
                ZIP: {{ order.zip_code }}
              </q-chip>
              <q-chip v-if="order.address_type" size="sm" outline>
                {{ order.address_type === 'apartment' ? 'Apartamento' : 'Casa' }}
              </q-chip>
            </div>

            <div v-if="order.validation_message" class="q-mt-md text-caption text-grey">
              {{ order.validation_message }}
            </div>
          </q-card-section>
        </q-card>

        <q-card class="q-mt-md" v-if="order.notes">
          <q-card-section>
            <div class="text-h6 q-mb-md">Notas</div>
            <div>{{ order.notes }}</div>
          </q-card-section>
        </q-card>

        <q-card class="q-mt-md">
          <q-card-section>
            <div class="text-h6 q-mb-md">Acciones</div>
            
            <div class="row q-gutter-sm">
              <q-btn
                v-if="order.status === 'pending'"
                color="positive"
                icon="check"
                label="Confirmar Orden"
                @click="confirmOrder"
                :loading="actionLoading"
              />
              <q-btn
                v-if="order.status === 'confirmed' || order.status === 'in_transit'"
                color="primary"
                icon="done_all"
                label="Marcar Completada"
                @click="completeOrder"
                :loading="actionLoading"
              />
              <q-btn
                v-if="order.status !== 'completed' && order.status !== 'cancelled'"
                color="negative"
                icon="cancel"
                label="Cancelar"
                outline
                @click="showCancelDialog = true"
              />
              <q-btn
                color="secondary"
                icon="add_location"
                label="Agregar a Ruta"
                @click="addToRoute"
                :disable="order.validation_status !== 'valid'"
              />
            </div>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-6">
        <q-card class="full-height">
          <q-card-section>
            <div class="text-h6 q-mb-md">Mensajes</div>
          </q-card-section>

          <q-card-section class="q-pt-none" style="max-height: 400px; overflow-y: auto;">
            <q-list v-if="order.messages && order.messages.length > 0">
              <q-item v-for="msg in order.messages" :key="msg.id">
                <q-item-section avatar>
                  <q-avatar
                    :color="msg.direction === 'inbound' ? 'grey' : 'primary'"
                    text-color="white"
                    size="sm"
                  >
                    <q-icon :name="msg.direction === 'inbound' ? 'person' : 'smart_toy'" />
                  </q-avatar>
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ msg.content }}</q-item-label>
                  <q-item-label caption>
                    {{ formatDate(msg.created_at) }}
                    <q-chip v-if="msg.is_automated" size="xs" color="info" text-color="white">
                      Auto
                    </q-chip>
                  </q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
            <div v-else class="text-center text-grey q-pa-md">
              No hay mensajes registrados
            </div>
          </q-card-section>

          <q-separator />

          <q-card-section>
            <q-input
              v-model="newMessage"
              placeholder="Escribe un mensaje..."
              outlined
              dense
              :disable="!order.respond_contact_id"
            >
              <template v-slot:after>
                <q-btn
                  round
                  dense
                  flat
                  icon="send"
                  color="primary"
                  @click="sendMessage"
                  :loading="sendingMessage"
                  :disable="!newMessage.trim() || !order.respond_contact_id"
                />
              </template>
            </q-input>
            <div v-if="!order.respond_contact_id" class="text-caption text-grey q-mt-xs">
              Esta orden no tiene contacto de Respond.io vinculado
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <div v-else class="text-center q-pa-xl">
      <q-spinner size="xl" color="primary" />
      <div class="q-mt-md">Cargando orden...</div>
    </div>

    <q-dialog v-model="showCancelDialog" persistent>
      <q-card style="min-width: 300px">
        <q-card-section>
          <div class="text-h6">Cancelar Orden</div>
        </q-card-section>
        <q-card-section>
          <q-input
            v-model="cancelReason"
            label="Motivo de cancelacion"
            outlined
            type="textarea"
            rows="3"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Volver" v-close-popup />
          <q-btn
            color="negative"
            label="Cancelar Orden"
            @click="cancelOrder"
            :loading="actionLoading"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useMessagingStore } from 'src/stores/messaging-store'
import { useQuasar } from 'quasar'

const route = useRoute()
const $q = useQuasar()
const messagingStore = useMessagingStore()

const actionLoading = ref(false)
const sendingMessage = ref(false)
const newMessage = ref('')
const showCancelDialog = ref(false)
const cancelReason = ref('')

const order = computed(() => messagingStore.currentOrder)

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

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleString('es', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const confirmOrder = async () => {
  actionLoading.value = true
  try {
    await messagingStore.confirmOrder(order.value.id)
    await messagingStore.fetchOrder(order.value.id)
    $q.notify({ type: 'positive', message: 'Orden confirmada' })
  } catch {
    $q.notify({ type: 'negative', message: 'Error al confirmar orden' })
  } finally {
    actionLoading.value = false
  }
}

const completeOrder = async () => {
  actionLoading.value = true
  try {
    await messagingStore.completeOrder(order.value.id)
    await messagingStore.fetchOrder(order.value.id)
    $q.notify({ type: 'positive', message: 'Orden completada' })
  } catch {
    $q.notify({ type: 'negative', message: 'Error al completar orden' })
  } finally {
    actionLoading.value = false
  }
}

const cancelOrder = async () => {
  actionLoading.value = true
  try {
    await messagingStore.cancelOrder(order.value.id, cancelReason.value)
    await messagingStore.fetchOrder(order.value.id)
    showCancelDialog.value = false
    $q.notify({ type: 'info', message: 'Orden cancelada' })
  } catch {
    $q.notify({ type: 'negative', message: 'Error al cancelar orden' })
  } finally {
    actionLoading.value = false
  }
}

const sendMessage = async () => {
  if (!newMessage.value.trim()) return
  
  sendingMessage.value = true
  try {
    await messagingStore.sendMessage(order.value.id, newMessage.value)
    await messagingStore.fetchOrder(order.value.id)
    newMessage.value = ''
    $q.notify({ type: 'positive', message: 'Mensaje enviado' })
  } catch {
    $q.notify({ type: 'negative', message: 'Error al enviar mensaje' })
  } finally {
    sendingMessage.value = false
  }
}

const addToRoute = () => {
  $q.notify({ type: 'info', message: 'Funcionalidad proximamente' })
}

onMounted(async () => {
  const orderId = route.params.id
  if (orderId) {
    await messagingStore.fetchOrder(orderId)
  }
})
</script>
