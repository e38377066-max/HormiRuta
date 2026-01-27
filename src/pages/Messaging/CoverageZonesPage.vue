<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-mb-md">
      <q-btn flat icon="arrow_back" @click="$router.back()" />
      <div class="text-h5 q-ml-md">
        <q-icon name="fas fa-map-marker-alt" class="q-mr-sm" />
        Zonas de Cobertura
      </div>
    </div>

    <div class="row q-col-gutter-md q-mb-md">
      <div class="col-12 col-md-6">
        <q-btn
          color="primary"
          icon="add"
          label="Agregar ZIP Code"
          @click="showAddDialog = true"
        />
        <q-btn
          color="secondary"
          icon="playlist_add"
          label="Agregar Multiples"
          class="q-ml-sm"
          @click="showBulkDialog = true"
        />
      </div>
      <div class="col-12 col-md-6">
        <q-input
          v-model="searchQuery"
          placeholder="Buscar por ZIP code..."
          outlined
          dense
        >
          <template v-slot:prepend>
            <q-icon name="search" />
          </template>
        </q-input>
      </div>
    </div>

    <q-card>
      <q-table
        :rows="filteredZones"
        :columns="columns"
        row-key="id"
        :loading="loading"
        flat
        bordered
      >
        <template v-slot:body-cell-is_active="props">
          <q-td :props="props">
            <q-toggle
              :model-value="props.row.is_active"
              color="positive"
              @update:model-value="toggleZone(props.row)"
            />
          </q-td>
        </template>
        <template v-slot:body-cell-actions="props">
          <q-td :props="props">
            <q-btn flat icon="edit" size="sm" @click="editZone(props.row)" />
            <q-btn flat icon="delete" size="sm" color="negative" @click="confirmDelete(props.row)" />
          </q-td>
        </template>
      </q-table>
    </q-card>

    <q-dialog v-model="showAddDialog" persistent>
      <q-card style="min-width: 350px">
        <q-card-section>
          <div class="text-h6">{{ editingZone ? 'Editar Zona' : 'Nueva Zona de Cobertura' }}</div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <q-input
            v-model="zoneForm.zip_code"
            label="Codigo Postal (ZIP)"
            outlined
            dense
            class="q-mb-sm"
            :disable="!!editingZone"
          />
          <q-input
            v-model="zoneForm.zone_name"
            label="Nombre de la zona"
            outlined
            dense
            class="q-mb-sm"
          />
          <q-input
            v-model="zoneForm.city"
            label="Ciudad"
            outlined
            dense
            class="q-mb-sm"
          />
          <q-input
            v-model="zoneForm.state"
            label="Estado"
            outlined
            dense
            class="q-mb-sm"
          />
          <q-input
            v-model.number="zoneForm.delivery_fee"
            label="Costo de envio"
            type="number"
            outlined
            dense
            class="q-mb-sm"
            prefix="$"
          />
          <q-input
            v-model.number="zoneForm.estimated_delivery_time"
            label="Tiempo estimado (minutos)"
            type="number"
            outlined
            dense
            class="q-mb-sm"
          />
          <q-input
            v-model="zoneForm.notes"
            label="Notas"
            outlined
            dense
            type="textarea"
            rows="2"
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancelar" color="grey" v-close-popup @click="resetForm" />
          <q-btn
            :label="editingZone ? 'Guardar' : 'Crear'"
            color="primary"
            @click="saveZone"
            :loading="saving"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="showBulkDialog" persistent>
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">Agregar Multiples ZIP Codes</div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <q-input
            v-model="bulkZipCodes"
            label="ZIP Codes (uno por linea o separados por coma)"
            outlined
            type="textarea"
            rows="6"
            hint="Ejemplo: 33101, 33102, 33103"
          />
          <q-input
            v-model="bulkZoneName"
            label="Nombre de la zona (opcional)"
            outlined
            dense
            class="q-mt-sm"
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancelar" color="grey" v-close-popup />
          <q-btn
            label="Agregar"
            color="primary"
            @click="addBulkZones"
            :loading="saving"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useMessagingStore } from 'src/stores/messaging-store'
import { useQuasar } from 'quasar'

const $q = useQuasar()
const messagingStore = useMessagingStore()

const loading = ref(false)
const saving = ref(false)
const searchQuery = ref('')
const showAddDialog = ref(false)
const showBulkDialog = ref(false)
const editingZone = ref(null)
const bulkZipCodes = ref('')
const bulkZoneName = ref('')

const zoneForm = ref({
  zip_code: '',
  zone_name: '',
  city: '',
  state: '',
  delivery_fee: null,
  estimated_delivery_time: null,
  notes: ''
})

const columns = [
  { name: 'zip_code', label: 'ZIP Code', field: 'zip_code', align: 'left', sortable: true },
  { name: 'zone_name', label: 'Zona', field: 'zone_name', align: 'left' },
  { name: 'city', label: 'Ciudad', field: 'city', align: 'left' },
  { name: 'state', label: 'Estado', field: 'state', align: 'left' },
  { name: 'delivery_fee', label: 'Costo', field: 'delivery_fee', align: 'right', format: (val) => val ? `$${val}` : '-' },
  { name: 'is_active', label: 'Activo', field: 'is_active', align: 'center' },
  { name: 'actions', label: 'Acciones', field: 'actions', align: 'center' }
]

const zones = computed(() => messagingStore.coverageZones)

const filteredZones = computed(() => {
  if (!searchQuery.value) return zones.value
  const query = searchQuery.value.toLowerCase()
  return zones.value.filter(z => 
    z.zip_code.includes(query) ||
    (z.zone_name && z.zone_name.toLowerCase().includes(query)) ||
    (z.city && z.city.toLowerCase().includes(query))
  )
})

const resetForm = () => {
  editingZone.value = null
  zoneForm.value = {
    zip_code: '',
    zone_name: '',
    city: '',
    state: '',
    delivery_fee: null,
    estimated_delivery_time: null,
    notes: ''
  }
}

const editZone = (zone) => {
  editingZone.value = zone
  zoneForm.value = { ...zone }
  showAddDialog.value = true
}

const saveZone = async () => {
  if (!zoneForm.value.zip_code && !editingZone.value) {
    $q.notify({ type: 'warning', message: 'El ZIP code es requerido' })
    return
  }

  saving.value = true
  try {
    if (editingZone.value) {
      await messagingStore.updateCoverageZone(editingZone.value.id, zoneForm.value)
      $q.notify({ type: 'positive', message: 'Zona actualizada' })
    } else {
      await messagingStore.createCoverageZone(zoneForm.value)
      $q.notify({ type: 'positive', message: 'Zona creada' })
    }
    showAddDialog.value = false
    resetForm()
  } catch (err) {
    $q.notify({ type: 'negative', message: err.response?.data?.error || 'Error al guardar' })
  } finally {
    saving.value = false
  }
}

const toggleZone = async (zone) => {
  try {
    await messagingStore.updateCoverageZone(zone.id, { is_active: !zone.is_active })
  } catch {
    $q.notify({ type: 'negative', message: 'Error al actualizar' })
  }
}

const confirmDelete = (zone) => {
  $q.dialog({
    title: 'Eliminar Zona',
    message: `Estas seguro de eliminar el ZIP code ${zone.zip_code}?`,
    cancel: true,
    persistent: true
  }).onOk(async () => {
    try {
      await messagingStore.deleteCoverageZone(zone.id)
      $q.notify({ type: 'positive', message: 'Zona eliminada' })
    } catch {
      $q.notify({ type: 'negative', message: 'Error al eliminar' })
    }
  })
}

const addBulkZones = async () => {
  if (!bulkZipCodes.value.trim()) {
    $q.notify({ type: 'warning', message: 'Ingresa al menos un ZIP code' })
    return
  }

  const zipCodes = bulkZipCodes.value
    .split(/[,\n]/)
    .map(z => z.trim())
    .filter(z => z.length > 0)

  if (zipCodes.length === 0) {
    $q.notify({ type: 'warning', message: 'No se encontraron ZIP codes validos' })
    return
  }

  saving.value = true
  try {
    const result = await messagingStore.createCoverageZonesBulk({
      zip_codes: zipCodes,
      zone_name: bulkZoneName.value || null
    })
    $q.notify({ 
      type: 'positive', 
      message: `${result.created} zonas creadas, ${result.skipped} omitidas (ya existian)` 
    })
    showBulkDialog.value = false
    bulkZipCodes.value = ''
    bulkZoneName.value = ''
  } catch {
    $q.notify({ type: 'negative', message: 'Error al crear zonas' })
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  loading.value = true
  try {
    await messagingStore.fetchCoverageZones()
  } finally {
    loading.value = false
  }
})
</script>
