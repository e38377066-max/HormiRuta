<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-mb-lg">
      <q-btn flat icon="arrow_back" @click="$router.back()" />
      <div class="text-h5 q-ml-md">
        <q-icon name="admin_panel_settings" class="q-mr-sm" />
        Panel de Administracion
      </div>
    </div>

    <div class="row q-col-gutter-md q-mb-lg">
      <div class="col-6 col-md-3">
        <q-card class="bg-primary text-white">
          <q-card-section>
            <div class="text-h4">{{ stats.users?.total || 0 }}</div>
            <div class="text-subtitle2">Usuarios Totales</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-6 col-md-3">
        <q-card class="bg-positive text-white">
          <q-card-section>
            <div class="text-h4">{{ stats.users?.drivers || 0 }}</div>
            <div class="text-subtitle2">Repartidores</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-6 col-md-3">
        <q-card class="bg-info text-white">
          <q-card-section>
            <div class="text-h4">{{ stats.users?.clients || 0 }}</div>
            <div class="text-subtitle2">Clientes</div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-6 col-md-3">
        <q-card class="bg-warning text-white">
          <q-card-section>
            <div class="text-h4">{{ stats.orders || 0 }}</div>
            <div class="text-subtitle2">Ordenes</div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <div class="row q-col-gutter-md">
      <div class="col-12 col-md-6">
        <q-card>
          <q-card-section>
            <div class="text-h6">
              <q-icon name="people" class="q-mr-sm" />
              Gestion de Usuarios
            </div>
          </q-card-section>
          <q-card-section>
            <q-list>
              <q-item clickable v-ripple to="/admin/users">
                <q-item-section avatar>
                  <q-icon name="manage_accounts" color="primary" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>Ver todos los usuarios</q-item-label>
                  <q-item-label caption>Administrar roles y permisos</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-icon name="chevron_right" />
                </q-item-section>
              </q-item>
              <q-item clickable v-ripple to="/admin/users?role=driver">
                <q-item-section avatar>
                  <q-icon name="local_shipping" color="positive" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>Repartidores</q-item-label>
                  <q-item-label caption>{{ stats.users?.drivers || 0 }} activos</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-icon name="chevron_right" />
                </q-item-section>
              </q-item>
              <q-item clickable v-ripple to="/admin/users?role=client">
                <q-item-section avatar>
                  <q-icon name="person" color="info" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>Clientes</q-item-label>
                  <q-item-label caption>{{ stats.users?.clients || 0 }} registrados</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-icon name="chevron_right" />
                </q-item-section>
              </q-item>
            </q-list>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-6">
        <q-card>
          <q-card-section>
            <div class="text-h6">
              <q-icon name="settings" class="q-mr-sm" />
              Configuracion
            </div>
          </q-card-section>
          <q-card-section>
            <q-list>
              <q-item clickable v-ripple to="/messaging/coverage">
                <q-item-section avatar>
                  <q-icon name="map" color="secondary" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>Zonas de Cobertura</q-item-label>
                  <q-item-label caption>Administrar codigos postales</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-icon name="chevron_right" />
                </q-item-section>
              </q-item>
              <q-item clickable v-ripple to="/messaging/settings">
                <q-item-section avatar>
                  <q-icon name="message" color="positive" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>Integracion Respond.io</q-item-label>
                  <q-item-label caption>Configurar mensajeria</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-icon name="chevron_right" />
                </q-item-section>
              </q-item>
            </q-list>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from 'src/boot/axios'

const stats = ref({})
const loading = ref(false)

const fetchStats = async () => {
  loading.value = true
  try {
    const response = await api.get('/api/admin/stats')
    stats.value = response.data
  } catch (err) {
    console.error('Error fetching stats:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchStats()
})
</script>
