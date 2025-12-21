<template>
  <q-layout view="hHh lpR fFf">
    <q-header class="bg-dark">
      <q-toolbar>
        <q-btn flat dense round icon="menu" color="white" @click="leftDrawerOpen = !leftDrawerOpen" />
        <q-toolbar-title class="text-white">HormiRuta</q-toolbar-title>
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

        <q-item clickable v-ripple to="/routes">
          <q-item-section avatar><q-icon name="folder" /></q-item-section>
          <q-item-section>Mis Rutas</q-item-section>
        </q-item>

        <q-item clickable v-ripple to="/history">
          <q-item-section avatar><q-icon name="history" /></q-item-section>
          <q-item-section>Historial</q-item-section>
        </q-item>

        <q-separator spaced color="grey-8" />

        <q-item clickable v-ripple @click="handleLogout" class="text-negative">
          <q-item-section avatar><q-icon name="logout" color="negative" /></q-item-section>
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
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from 'src/stores/auth-store'

const router = useRouter()
const authStore = useAuthStore()
const leftDrawerOpen = ref(false)

const handleLogout = async () => {
  await authStore.logout()
  router.push('/auth/login')
}
</script>
