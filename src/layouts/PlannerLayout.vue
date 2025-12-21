<template>
  <q-layout view="hHh lpR fFf">
    <q-header elevated id="planner-header" class="planner-header">
      <q-toolbar class="q-py-sm transparent-toolbar">
        <q-btn flat dense round icon="menu" color="white" @click="leftDrawerOpen = !leftDrawerOpen" />
        <q-avatar size="32px" class="q-ml-sm bg-white">
          <q-img src="~assets/Hormiruta.png" />
        </q-avatar>
        <q-toolbar-title class="text-white text-weight-bold q-ml-sm" style="font-size: 18px;">
          HormiRuta
        </q-toolbar-title>
        <q-btn flat round dense icon="person" color="white" />
      </q-toolbar>
    </q-header>

    <q-drawer v-model="leftDrawerOpen" bordered class="drawer-dark">
      <div class="drawer-header q-pa-md">
        <div class="flex items-center justify-end q-mb-md">
          <q-btn flat round dense icon="help_outline" color="grey-5" size="md" to="/help" @click="leftDrawerOpen = false" />
          <q-btn flat round dense icon="settings" color="grey-5" size="md" to="/settings" @click="leftDrawerOpen = false" />
        </div>
        
        <div class="flex items-center q-mb-md">
          <q-avatar size="56px" color="primary" text-color="white" class="text-h5 text-weight-bold">
            {{ userInitial }}
          </q-avatar>
          <div class="q-ml-md">
            <div class="text-subtitle1 text-weight-medium text-white">{{ userName }}</div>
            <div class="text-caption text-grey-5">{{ userEmail }}</div>
          </div>
        </div>

        <div class="plan-card q-pa-md q-mb-md">
          <div class="flex items-center">
            <q-avatar size="36px" color="primary" text-color="white">
              <q-icon name="person" size="20px" />
            </q-avatar>
            <div class="q-ml-md">
              <div class="text-subtitle2 text-primary">Plan Gratuito</div>
              <div class="text-caption text-grey-5">Uso personal</div>
            </div>
          </div>
        </div>
      </div>

      <q-separator color="grey-9" />

      <div class="routes-section q-pa-md">
        <div class="text-overline text-grey-6 q-mb-sm">Hoy</div>
        
        <q-list dense class="routes-list">
          <q-item 
            v-for="route in recentRoutes" 
            :key="route.id"
            clickable 
            v-ripple
            class="route-item q-mb-xs"
            @click="openRoute(route)"
          >
            <q-item-section side class="route-date text-grey-5">
              {{ formatRouteDate(route.created_at) }}
            </q-item-section>
            <q-item-section :class="route.isActive ? 'text-primary' : 'text-white'">
              {{ route.name }}
            </q-item-section>
            <q-item-section side>
              <q-btn flat round dense icon="more_vert" size="sm" @click.stop>
                <q-menu>
                  <q-list style="min-width: 150px">
                    <q-item clickable v-close-popup @click="openRoute(route)">
                      <q-item-section>Abrir</q-item-section>
                    </q-item>
                    <q-item clickable v-close-popup @click="deleteRoute(route)">
                      <q-item-section class="text-negative">Eliminar</q-item-section>
                    </q-item>
                  </q-list>
                </q-menu>
              </q-btn>
            </q-item-section>
          </q-item>
        </q-list>

        <div v-if="recentRoutes.length === 0" class="text-center text-grey-6 q-py-lg">
          No hay rutas recientes
        </div>
      </div>

      <q-space />

      <div class="q-pa-md">
        <q-btn 
          color="primary" 
          class="full-width create-route-btn"
          size="lg"
          unelevated
          @click="createNewRoute"
        >
          <q-icon name="add" class="q-mr-sm" />
          Crear ruta
        </q-btn>
      </div>
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from 'src/stores/auth-store'
import { api } from 'src/boot/axios'

const router = useRouter()
const authStore = useAuthStore()
const leftDrawerOpen = ref(false)
const recentRoutes = ref([])

const userName = computed(() => authStore.user?.name || authStore.user?.username || 'Usuario')
const userEmail = computed(() => authStore.user?.email || '')
const userInitial = computed(() => userName.value.charAt(0).toUpperCase())

const fetchRecentRoutes = async () => {
  try {
    const response = await api.get('/api/routes')
    recentRoutes.value = response.data.slice(0, 5)
  } catch (error) {
    console.error('Error fetching routes:', error)
  }
}

const formatRouteDate = (dateStr) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '')
}

const openRoute = (route) => {
  leftDrawerOpen.value = false
  router.push(`/planner?routeId=${route.id}`)
}

const deleteRoute = async (route) => {
  try {
    await api.delete(`/api/routes/${route.id}`)
    fetchRecentRoutes()
  } catch (error) {
    console.error('Error deleting route:', error)
  }
}

const createNewRoute = () => {
  leftDrawerOpen.value = false
  router.push('/planner')
}

onMounted(() => {
  fetchRecentRoutes()
})
</script>

<style scoped>
:deep(#planner-header) {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%) !important;
  box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4) !important;
}

:deep(#planner-header .q-toolbar) {
  background: transparent !important;
}

.drawer-dark {
  background: #121212 !important;
}

.drawer-header {
  background: #121212;
}

.plan-card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.routes-section {
  flex: 1;
  overflow-y: auto;
}

.route-item {
  border-radius: 8px;
  min-height: 44px;
}

.route-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.route-date {
  min-width: 50px;
  font-size: 12px;
}

.create-route-btn {
  border-radius: 12px;
  font-weight: 600;
  text-transform: none;
  font-size: 16px;
}
</style>
