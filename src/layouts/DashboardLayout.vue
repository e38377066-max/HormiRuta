<template>
  <q-layout view="hHh lpR fFf">
    <q-header elevated class="bg-primary">
      <q-toolbar>
        <q-btn flat dense round icon="menu" @click="leftDrawerOpen = !leftDrawerOpen" />
        <q-avatar size="32px" class="q-ml-sm bg-white">
          <q-img src="~assets/Hormiruta.png" />
        </q-avatar>
        <q-toolbar-title class="text-weight-bold q-ml-sm">
          HormiRuta
        </q-toolbar-title>
        <q-space />
        <div class="text-caption q-mr-md">{{ userEmail }}</div>
        <q-btn flat round icon="logout" @click="handleLogout">
          <q-tooltip>Cerrar sesion</q-tooltip>
        </q-btn>
      </q-toolbar>
    </q-header>

    <q-drawer v-model="leftDrawerOpen" show-if-above bordered class="bg-grey-1">
      <q-list>
        <q-item-label header class="text-grey-8">Menu Principal</q-item-label>
        
        <q-item clickable v-ripple to="/planner" exact>
          <q-item-section avatar>
            <q-icon name="map" color="primary" />
          </q-item-section>
          <q-item-section>Planificar Ruta</q-item-section>
        </q-item>

        <q-separator spaced />
        <q-item-label header class="text-grey-8">Centro de Mensajeria</q-item-label>

        <q-item clickable v-ripple to="/messaging" exact>
          <q-item-section avatar>
            <q-icon name="inbox" color="positive" />
          </q-item-section>
          <q-item-section>Ordenes</q-item-section>
        </q-item>

        <q-item clickable v-ripple to="/messaging/coverage">
          <q-item-section avatar>
            <q-icon name="location_on" color="info" />
          </q-item-section>
          <q-item-section>Zonas de Cobertura</q-item-section>
        </q-item>

        <q-item clickable v-ripple to="/messaging/settings">
          <q-item-section avatar>
            <q-icon name="settings" color="grey-7" />
          </q-item-section>
          <q-item-section>Configuracion Respond.io</q-item-section>
        </q-item>

        <template v-if="authStore.isAdmin">
          <q-separator spaced />
          <q-item-label header class="text-grey-8">Administracion</q-item-label>

          <q-item clickable v-ripple to="/admin" exact>
            <q-item-section avatar>
              <q-icon name="dashboard" color="deep-purple" />
            </q-item-section>
            <q-item-section>Panel de Admin</q-item-section>
          </q-item>

          <q-item clickable v-ripple to="/admin/users">
            <q-item-section avatar>
              <q-icon name="people" color="deep-purple" />
            </q-item-section>
            <q-item-section>Usuarios</q-item-section>
          </q-item>
        </template>

        <q-separator spaced />

        <q-item clickable v-ripple class="text-negative" @click="handleLogout">
          <q-item-section avatar>
            <q-icon name="logout" color="negative" />
          </q-item-section>
          <q-item-section>Cerrar Sesion</q-item-section>
        </q-item>
      </q-list>
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

const router = useRouter()
const authStore = useAuthStore()
const leftDrawerOpen = ref(false)

const userEmail = computed(() => authStore.user?.email || '')

const handleLogout = async () => {
  await authStore.logout()
  router.push('/auth/login')
}

onMounted(async () => {
  await authStore.fetchCurrentUser()
})
</script>
