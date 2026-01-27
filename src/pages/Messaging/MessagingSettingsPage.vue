<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-mb-md">
      <q-btn flat icon="arrow_back" @click="$router.back()" />
      <div class="text-h5 q-ml-md">
        <q-icon name="fas fa-cog" class="q-mr-sm" />
        Configuracion de Mensajeria
      </div>
    </div>

    <div class="row q-col-gutter-md">
      <div class="col-12 col-md-6">
        <q-card>
          <q-card-section>
            <div class="text-h6 q-mb-md">Conexion con Respond.io</div>
            
            <q-input
              v-model="form.respond_api_token"
              label="API Token de Respond.io"
              outlined
              :type="showToken ? 'text' : 'password'"
              class="q-mb-md"
            >
              <template v-slot:append>
                <q-icon
                  :name="showToken ? 'visibility_off' : 'visibility'"
                  class="cursor-pointer"
                  @click="showToken = !showToken"
                />
              </template>
            </q-input>

            <div class="row q-gutter-sm q-mb-md">
              <q-btn
                color="secondary"
                label="Probar Conexion"
                @click="testConnection"
                :loading="testing"
                :disable="!form.respond_api_token"
              />
              <q-chip
                v-if="connectionStatus !== null"
                :color="connectionStatus ? 'positive' : 'negative'"
                text-color="white"
              >
                {{ connectionStatus ? 'Conectado' : 'Error de conexion' }}
              </q-chip>
            </div>

            <q-toggle
              v-model="form.is_active"
              label="Activar integracion con Respond.io"
              color="positive"
            />
          </q-card-section>
        </q-card>

        <q-card class="q-mt-md">
          <q-card-section>
            <div class="text-h6 q-mb-md">Modo de Atencion</div>
            
            <q-option-group
              v-model="form.attention_mode"
              :options="attentionModes"
              color="primary"
            />
          </q-card-section>
        </q-card>

        <q-card class="q-mt-md">
          <q-card-section>
            <div class="text-h6 q-mb-md">Automatizacion</div>
            
            <q-toggle
              v-model="form.auto_validate_addresses"
              label="Validar direcciones automaticamente"
              color="primary"
              class="q-mb-sm"
            />
            <q-toggle
              v-model="form.auto_respond_coverage"
              label="Responder automaticamente si hay cobertura"
              color="primary"
              class="q-mb-sm"
            />
            <q-toggle
              v-model="form.auto_respond_no_coverage"
              label="Responder automaticamente si NO hay cobertura"
              color="primary"
            />
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-6">
        <q-card>
          <q-card-section>
            <div class="text-h6 q-mb-md">Mensajes Automaticos</div>
            
            <q-input
              v-model="form.coverage_message"
              label="Mensaje de cobertura confirmada"
              outlined
              type="textarea"
              rows="3"
              class="q-mb-md"
            />

            <q-input
              v-model="form.no_coverage_message"
              label="Mensaje sin cobertura"
              outlined
              type="textarea"
              rows="3"
              class="q-mb-md"
            />

            <q-input
              v-model="form.order_confirmed_message"
              label="Mensaje de orden confirmada"
              outlined
              type="textarea"
              rows="3"
              class="q-mb-md"
            />

            <q-input
              v-model="form.driver_assigned_message"
              label="Mensaje de repartidor asignado"
              outlined
              type="textarea"
              rows="3"
              class="q-mb-md"
            />

            <q-input
              v-model="form.order_completed_message"
              label="Mensaje de orden completada"
              outlined
              type="textarea"
              rows="3"
            />
          </q-card-section>
        </q-card>
      </div>
    </div>

    <div class="q-mt-md">
      <q-btn
        color="primary"
        label="Guardar Configuracion"
        icon="save"
        size="lg"
        @click="saveSettings"
        :loading="saving"
      />
    </div>
  </q-page>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useMessagingStore } from 'src/stores/messaging-store'
import { useQuasar } from 'quasar'

const $q = useQuasar()
const messagingStore = useMessagingStore()

const saving = ref(false)
const testing = ref(false)
const showToken = ref(false)
const connectionStatus = ref(null)

const form = ref({
  respond_api_token: '',
  is_active: false,
  attention_mode: 'assisted',
  auto_validate_addresses: true,
  auto_respond_coverage: true,
  auto_respond_no_coverage: true,
  coverage_message: '',
  no_coverage_message: '',
  order_confirmed_message: '',
  driver_assigned_message: '',
  order_completed_message: ''
})

const attentionModes = [
  { label: 'Automatico - Validacion y respuesta sin intervencion', value: 'automatic' },
  { label: 'Asistido - El sistema valida y el agente confirma', value: 'assisted' },
  { label: 'Manual - El agente controla todo', value: 'manual' }
]

const testConnection = async () => {
  testing.value = true
  connectionStatus.value = null
  try {
    await messagingStore.updateSettings({ respond_api_token: form.value.respond_api_token })
    const result = await messagingStore.testConnection()
    connectionStatus.value = result.success
    if (result.success) {
      $q.notify({ type: 'positive', message: 'Conexion exitosa con Respond.io' })
    } else {
      $q.notify({ type: 'negative', message: result.error || 'Error de conexion' })
    }
  } catch {
    connectionStatus.value = false
    $q.notify({ type: 'negative', message: 'Error al probar conexion' })
  } finally {
    testing.value = false
  }
}

const saveSettings = async () => {
  saving.value = true
  try {
    await messagingStore.updateSettings(form.value)
    $q.notify({ type: 'positive', message: 'Configuracion guardada exitosamente' })
  } catch {
    $q.notify({ type: 'negative', message: 'Error al guardar configuracion' })
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  try {
    const settings = await messagingStore.fetchSettings()
    if (settings) {
      form.value = {
        respond_api_token: '',
        is_active: settings.is_active || false,
        attention_mode: settings.attention_mode || 'assisted',
        auto_validate_addresses: settings.auto_validate_addresses !== false,
        auto_respond_coverage: settings.auto_respond_coverage !== false,
        auto_respond_no_coverage: settings.auto_respond_no_coverage !== false,
        coverage_message: settings.coverage_message || '',
        no_coverage_message: settings.no_coverage_message || '',
        order_confirmed_message: settings.order_confirmed_message || '',
        driver_assigned_message: settings.driver_assigned_message || '',
        order_completed_message: settings.order_completed_message || ''
      }
    }
  } catch (err) {
    console.error('Error loading settings:', err)
  }
})
</script>
