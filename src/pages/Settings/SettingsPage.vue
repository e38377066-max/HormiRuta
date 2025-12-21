<template>
  <q-page class="settings-page">
    <div class="page-header q-pa-md">
      <div class="text-h5 text-weight-bold">Configuración</div>
      <div class="text-caption text-grey">Personaliza tu experiencia</div>
    </div>

    <q-list class="q-px-md q-pt-md">
      <q-item-label header class="text-grey-5">APARIENCIA</q-item-label>
      
      <q-item class="setting-item q-mb-sm">
        <q-item-section avatar>
          <q-icon name="dark_mode" color="primary" />
        </q-item-section>
        <q-item-section>
          <q-item-label>Tema Oscuro</q-item-label>
          <q-item-label caption>Reduce la fatiga visual en ambientes oscuros</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle v-model="darkMode" color="primary" />
        </q-item-section>
      </q-item>

      <q-item-label header class="text-grey-5 q-mt-md">NAVEGACIÓN</q-item-label>
      
      <q-item class="setting-item q-mb-sm">
        <q-item-section avatar>
          <q-icon name="navigation" color="primary" />
        </q-item-section>
        <q-item-section>
          <q-item-label>App de navegación</q-item-label>
          <q-item-label caption>Elige tu aplicación preferida para navegar</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-select
            v-model="navApp"
            :options="navOptions"
            dense
            borderless
            emit-value
            map-options
            style="min-width: 120px"
          />
        </q-item-section>
      </q-item>

      <q-item class="setting-item q-mb-sm">
        <q-item-section avatar>
          <q-icon name="speed" color="primary" />
        </q-item-section>
        <q-item-section>
          <q-item-label>Unidades de distancia</q-item-label>
          <q-item-label caption>Sistema métrico o imperial</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-select
            v-model="distanceUnit"
            :options="unitOptions"
            dense
            borderless
            emit-value
            map-options
            style="min-width: 120px"
          />
        </q-item-section>
      </q-item>

      <q-item class="setting-item q-mb-sm">
        <q-item-section avatar>
          <q-icon name="volume_up" color="primary" />
        </q-item-section>
        <q-item-section>
          <q-item-label>Instrucciones de voz</q-item-label>
          <q-item-label caption>Escucha las indicaciones mientras navegas</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle v-model="voiceEnabled" color="primary" />
        </q-item-section>
      </q-item>

      <q-item-label header class="text-grey-5 q-mt-md">OPTIMIZACIÓN</q-item-label>
      
      <q-item class="setting-item q-mb-sm">
        <q-item-section avatar>
          <q-icon name="replay" color="primary" />
        </q-item-section>
        <q-item-section>
          <q-item-label>Viaje de ida y vuelta</q-item-label>
          <q-item-label caption>Regresar al punto de partida por defecto</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle v-model="roundTripDefault" color="primary" />
        </q-item-section>
      </q-item>

      <q-item class="setting-item q-mb-sm">
        <q-item-section avatar>
          <q-icon name="schedule" color="primary" />
        </q-item-section>
        <q-item-section>
          <q-item-label>Tiempo por parada</q-item-label>
          <q-item-label caption>Tiempo estimado en cada parada</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-select
            v-model="stopDuration"
            :options="durationOptions"
            dense
            borderless
            emit-value
            map-options
            style="min-width: 100px"
          />
        </q-item-section>
      </q-item>

      <q-item-label header class="text-grey-5 q-mt-md">CUENTA</q-item-label>
      
      <q-item class="setting-item q-mb-sm" clickable v-ripple @click="showProfile">
        <q-item-section avatar>
          <q-icon name="person" color="primary" />
        </q-item-section>
        <q-item-section>
          <q-item-label>Mi perfil</q-item-label>
          <q-item-label caption>{{ userEmail }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-icon name="chevron_right" color="grey" />
        </q-item-section>
      </q-item>

      <q-item class="setting-item q-mb-sm" clickable v-ripple @click="clearLocalData">
        <q-item-section avatar>
          <q-icon name="delete_sweep" color="warning" />
        </q-item-section>
        <q-item-section>
          <q-item-label>Borrar datos locales</q-item-label>
          <q-item-label caption>Elimina rutas guardadas en el dispositivo</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-icon name="chevron_right" color="grey" />
        </q-item-section>
      </q-item>

      <q-item-label header class="text-grey-5 q-mt-md">INFORMACIÓN</q-item-label>
      
      <q-item class="setting-item q-mb-sm">
        <q-item-section avatar>
          <q-icon name="info" color="grey" />
        </q-item-section>
        <q-item-section>
          <q-item-label>Versión</q-item-label>
          <q-item-label caption>1.0.0</q-item-label>
        </q-item-section>
      </q-item>
    </q-list>

    <q-dialog v-model="showProfileDialog">
      <q-card style="min-width: 300px">
        <q-card-section>
          <div class="text-h6">Mi Perfil</div>
        </q-card-section>
        <q-card-section class="q-pt-none">
          <q-input v-model="profileName" label="Nombre" dense class="q-mb-md" />
          <q-input v-model="profileEmail" label="Email" dense disabled />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancelar" v-close-popup />
          <q-btn color="primary" label="Guardar" @click="saveProfile" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useThemeStore } from 'src/stores/theme-store'
import { useAuthStore } from 'src/stores/auth-store'

const $q = useQuasar()
const themeStore = useThemeStore()
const authStore = useAuthStore()

const darkMode = computed({
  get: () => themeStore.isDark,
  set: (val) => themeStore.setDarkMode(val)
})

const navApp = ref(localStorage.getItem('navApp') || 'google')
const distanceUnit = ref(localStorage.getItem('distanceUnit') || 'km')
const voiceEnabled = ref(JSON.parse(localStorage.getItem('voiceEnabled') || 'true'))
const roundTripDefault = ref(JSON.parse(localStorage.getItem('roundTripDefault') || 'false'))
const stopDuration = ref(parseInt(localStorage.getItem('stopDuration') || '5'))

const showProfileDialog = ref(false)
const profileName = ref('')
const profileEmail = ref('')

const userEmail = computed(() => authStore.user?.email || 'No conectado')

const navOptions = [
  { label: 'Google Maps', value: 'google' },
  { label: 'Waze', value: 'waze' },
  { label: 'Apple Maps', value: 'apple' }
]

const unitOptions = [
  { label: 'Kilómetros', value: 'km' },
  { label: 'Millas', value: 'mi' }
]

const durationOptions = [
  { label: '2 min', value: 2 },
  { label: '5 min', value: 5 },
  { label: '10 min', value: 10 },
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 }
]

watch(navApp, (val) => localStorage.setItem('navApp', val))
watch(distanceUnit, (val) => localStorage.setItem('distanceUnit', val))
watch(voiceEnabled, (val) => localStorage.setItem('voiceEnabled', JSON.stringify(val)))
watch(roundTripDefault, (val) => localStorage.setItem('roundTripDefault', JSON.stringify(val)))
watch(stopDuration, (val) => localStorage.setItem('stopDuration', val.toString()))

const showProfile = () => {
  profileName.value = authStore.user?.name || ''
  profileEmail.value = authStore.user?.email || ''
  showProfileDialog.value = true
}

const saveProfile = async () => {
  const result = await authStore.updateUser({ name: profileName.value })
  if (result.success) {
    $q.notify({ message: 'Perfil actualizado', type: 'positive' })
    showProfileDialog.value = false
  } else {
    $q.notify({ message: 'Error al actualizar el perfil', type: 'negative' })
  }
}

const clearLocalData = () => {
  $q.dialog({
    title: 'Borrar datos locales',
    message: '¿Estás seguro? Se eliminarán todas las rutas guardadas en tu dispositivo.',
    cancel: { label: 'Cancelar', flat: true },
    ok: { label: 'Borrar', color: 'negative' },
    persistent: true
  }).onOk(() => {
    localStorage.removeItem('localRoutes')
    $q.notify({ message: 'Datos locales eliminados', type: 'positive' })
  })
}

onMounted(() => {
  authStore.fetchCurrentUser()
})
</script>

<style scoped>
.settings-page {
  background: var(--q-dark-page);
  min-height: 100vh;
}

.page-header {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.setting-item {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}
</style>
