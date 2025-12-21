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

    <q-drawer v-model="leftDrawerOpen" bordered class="bg-dark text-white">
      <div class="q-pa-md flex flex-center column">
        <q-avatar size="80px" class="bg-white">
          <q-img src="~assets/Hormiruta.png" style="width: 70px; height: 70px; object-fit: contain;" />
        </q-avatar>
        <div class="text-h6 text-center q-mt-sm">HormiRuta</div>
        <div class="text-caption text-grey-5">Planificador de Rutas</div>
      </div>

      <q-separator spaced color="grey-8" />

      <q-list dense>
        <q-item clickable v-ripple to="/planner" active-class="bg-primary text-white">
          <q-item-section avatar><q-icon name="auto_fix_high" /></q-item-section>
          <q-item-section>Planificar Ruta</q-item-section>
        </q-item>

        <q-item clickable v-ripple @click="showSavedRoutes">
          <q-item-section avatar><q-icon name="bookmark" /></q-item-section>
          <q-item-section>Mis Rutas Guardadas</q-item-section>
        </q-item>

        <q-separator spaced color="grey-8" />

        <q-item clickable v-ripple @click="showConfig">
          <q-item-section avatar><q-icon name="settings" /></q-item-section>
          <q-item-section>Configuración</q-item-section>
        </q-item>

        <q-item clickable v-ripple @click="showHelp">
          <q-item-section avatar><q-icon name="help_outline" /></q-item-section>
          <q-item-section>Guía de ayuda</q-item-section>
        </q-item>

        <q-item clickable v-ripple @click="showLocalRoutes">
          <q-item-section avatar><q-icon name="map" /></q-item-section>
          <q-item-section>Ver rutas locales</q-item-section>
        </q-item>

        <q-item clickable v-ripple @click="toggleDarkMode">
          <q-item-section avatar><q-icon name="dark_mode" /></q-item-section>
          <q-item-section>Tema Oscuro</q-item-section>
          <q-item-section side>
            <q-toggle v-model="darkMode" color="primary" @click.stop />
          </q-item-section>
        </q-item>

        <q-separator spaced color="grey-8" />

        <q-item clickable v-ripple @click="handleLogout" class="text-negative">
          <q-item-section avatar><q-icon name="logout" color="negative" /></q-item-section>
          <q-item-section>Cerrar sesión</q-item-section>
        </q-item>
      </q-list>
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useAuthStore } from 'src/stores/auth-store'

const $q = useQuasar()
const router = useRouter()
const authStore = useAuthStore()
const leftDrawerOpen = ref(false)
const darkMode = ref($q.dark.isActive)

const handleLogout = async () => {
  await authStore.logout()
  router.push('/auth/login')
}

const showSavedRoutes = () => {
  leftDrawerOpen.value = false
  $q.notify({ message: 'Mis Rutas Guardadas - Próximamente', position: 'top', icon: 'bookmark' })
}

const showConfig = () => {
  leftDrawerOpen.value = false
  $q.notify({ message: 'Configuración - Próximamente', position: 'top', icon: 'settings' })
}

const showHelp = () => {
  leftDrawerOpen.value = false
  $q.notify({ message: 'Guía de ayuda - Próximamente', position: 'top', icon: 'help_outline' })
}

const showLocalRoutes = () => {
  leftDrawerOpen.value = false
  $q.notify({ message: 'Ver rutas locales - Próximamente', position: 'top', icon: 'map' })
}

const toggleDarkMode = () => {
  darkMode.value = !darkMode.value
  $q.dark.set(darkMode.value)
}
</script>

<style scoped>
:deep(#planner-header) {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%) !important;
  box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4) !important;
}

:deep(#planner-header .q-toolbar) {
  background: transparent !important;
}

:deep(.q-drawer) {
  background: #1a1a2e !important;
}

:deep(.q-drawer .q-item) {
  color: #ffffff !important;
}

:deep(.q-drawer .q-item__section--avatar .q-icon) {
  color: #ffffff !important;
}

:deep(.q-drawer .q-item.text-negative) {
  color: #ef5350 !important;
}

:deep(.q-drawer .q-item.text-negative .q-icon) {
  color: #ef5350 !important;
}
</style>

