<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-mb-md">
      <q-btn flat icon="arrow_back" @click="$router.push('/admin')" />
      <div class="text-h5 q-ml-md">
        <q-icon name="people" class="q-mr-sm" />
        Usuarios
      </div>
    </div>

    <div class="row q-col-gutter-md q-mb-md">
      <div class="col-12 col-md-4">
        <q-input
          v-model="search"
          placeholder="Buscar por nombre o email..."
          outlined
          dense
          debounce="300"
          @update:model-value="fetchUsers"
        >
          <template v-slot:prepend>
            <q-icon name="search" />
          </template>
        </q-input>
      </div>
      <div class="col-12 col-md-3">
        <q-select
          v-model="roleFilter"
          :options="roleOptions"
          label="Filtrar por rol"
          outlined
          dense
          emit-value
          map-options
          clearable
          @update:model-value="fetchUsers"
        />
      </div>
    </div>

    <q-card>
      <q-table
        :rows="users"
        :columns="columns"
        row-key="id"
        :loading="loading"
        flat
        bordered
        :pagination="{ rowsPerPage: 20 }"
      >
        <template v-slot:body-cell-role="props">
          <q-td :props="props">
            <q-chip
              :color="getRoleColor(props.row.role)"
              text-color="white"
              size="sm"
            >
              {{ getRoleLabel(props.row.role) }}
            </q-chip>
          </q-td>
        </template>
        <template v-slot:body-cell-active="props">
          <q-td :props="props">
            <q-chip
              :color="props.row.active ? 'positive' : 'negative'"
              text-color="white"
              size="sm"
            >
              {{ props.row.active ? 'Activo' : 'Inactivo' }}
            </q-chip>
          </q-td>
        </template>
        <template v-slot:body-cell-actions="props">
          <q-td :props="props">
            <q-btn flat icon="edit" size="sm" @click="editUser(props.row)" />
            <q-btn
              flat
              :icon="props.row.active ? 'block' : 'check_circle'"
              size="sm"
              :color="props.row.active ? 'negative' : 'positive'"
              @click="toggleActive(props.row)"
            />
          </q-td>
        </template>
      </q-table>
    </q-card>

    <q-dialog v-model="showEditDialog" persistent>
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">Editar Usuario</div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <q-input
            v-model="editForm.username"
            label="Nombre"
            outlined
            dense
            class="q-mb-sm"
          />
          <q-input
            v-model="editForm.email"
            label="Email"
            outlined
            dense
            class="q-mb-sm"
          />
          <q-input
            v-model="editForm.phone"
            label="Telefono"
            outlined
            dense
            class="q-mb-sm"
          />
          <q-select
            v-model="editForm.role"
            :options="roleOptions"
            label="Rol"
            outlined
            dense
            emit-value
            map-options
            class="q-mb-sm"
          />
          <q-select
            v-model="editForm.subscription_type"
            :options="subscriptionOptions"
            label="Tipo de suscripcion"
            outlined
            dense
            emit-value
            map-options
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancelar" color="grey" v-close-popup />
          <q-btn
            label="Guardar"
            color="primary"
            @click="saveUser"
            :loading="saving"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useQuasar } from 'quasar'
import { api } from 'src/boot/axios'

const $q = useQuasar()
const route = useRoute()

const users = ref([])
const loading = ref(false)
const saving = ref(false)
const search = ref('')
const roleFilter = ref(null)
const showEditDialog = ref(false)
const editForm = ref({})

const roleOptions = [
  { label: 'Administrador', value: 'admin' },
  { label: 'Cliente', value: 'client' },
  { label: 'Repartidor', value: 'driver' }
]

const subscriptionOptions = [
  { label: 'Gratis', value: 'free' },
  { label: 'Basico', value: 'basic' },
  { label: 'Premium', value: 'premium' }
]

const columns = [
  { name: 'id', label: 'ID', field: 'id', align: 'left', sortable: true },
  { name: 'username', label: 'Nombre', field: 'username', align: 'left', sortable: true },
  { name: 'email', label: 'Email', field: 'email', align: 'left', sortable: true },
  { name: 'phone', label: 'Telefono', field: 'phone', align: 'left' },
  { name: 'role', label: 'Rol', field: 'role', align: 'center' },
  { name: 'active', label: 'Estado', field: 'active', align: 'center' },
  { name: 'subscription_type', label: 'Suscripcion', field: 'subscription_type', align: 'center' },
  { name: 'actions', label: 'Acciones', field: 'actions', align: 'center' }
]

const getRoleColor = (role) => {
  const colors = {
    admin: 'deep-purple',
    driver: 'positive',
    client: 'info'
  }
  return colors[role] || 'grey'
}

const getRoleLabel = (role) => {
  const labels = {
    admin: 'Admin',
    driver: 'Repartidor',
    client: 'Cliente'
  }
  return labels[role] || role
}

const fetchUsers = async () => {
  loading.value = true
  try {
    const params = {}
    if (search.value) params.search = search.value
    if (roleFilter.value) params.role = roleFilter.value

    const response = await api.get('/api/admin/users', { params })
    users.value = response.data.users
  } catch (err) {
    console.error('Error fetching users:', err)
    $q.notify({ type: 'negative', message: 'Error al cargar usuarios' })
  } finally {
    loading.value = false
  }
}

const editUser = (user) => {
  editForm.value = { ...user }
  showEditDialog.value = true
}

const saveUser = async () => {
  saving.value = true
  try {
    await api.put(`/api/admin/users/${editForm.value.id}`, editForm.value)
    $q.notify({ type: 'positive', message: 'Usuario actualizado' })
    showEditDialog.value = false
    fetchUsers()
  } catch (err) {
    $q.notify({ type: 'negative', message: err.response?.data?.error || 'Error al guardar' })
  } finally {
    saving.value = false
  }
}

const toggleActive = async (user) => {
  try {
    await api.put(`/api/admin/users/${user.id}/toggle-active`)
    $q.notify({ 
      type: 'positive', 
      message: user.active ? 'Usuario desactivado' : 'Usuario activado' 
    })
    fetchUsers()
  } catch {
    $q.notify({ type: 'negative', message: 'Error al cambiar estado' })
  }
}

onMounted(() => {
  if (route.query.role) {
    roleFilter.value = route.query.role
  }
  fetchUsers()
})
</script>
