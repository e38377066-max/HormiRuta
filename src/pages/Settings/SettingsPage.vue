<template>
  <q-page class="settings-page">
    <div class="settings-header">
      <q-btn flat round dense icon="arrow_back" color="white" @click="$router.back()" />
      <span class="header-title">Configuración</span>
    </div>

    <div class="settings-content">
      <div class="section-title">Preferencias de ruta</div>
      
      <q-list class="settings-list">
        <q-item clickable v-ripple @click="showNavAppDialog = true">
          <q-item-section>
            <q-item-label>App de navegación</q-item-label>
            <q-item-label caption>{{ navAppLabel }}</q-item-label>
          </q-item-section>
        </q-item>

        <q-item clickable v-ripple @click="showStopSideDialog = true">
          <q-item-section>
            <q-item-label>Lado de la parada</q-item-label>
            <q-item-label caption>{{ stopSideLabel }}</q-item-label>
          </q-item-section>
        </q-item>

        <q-item clickable v-ripple @click="showStopTimeDialog = true">
          <q-item-section>
            <q-item-label>Tiempo promedio en parada</q-item-label>
            <q-item-label caption>{{ stopDuration }} min</q-item-label>
          </q-item-section>
        </q-item>

        <q-item clickable v-ripple @click="showVehicleDialog = true">
          <q-item-section>
            <q-item-label>Tipo de vehículo</q-item-label>
            <q-item-label caption>{{ vehicleLabel }}</q-item-label>
          </q-item-section>
        </q-item>

        <q-item>
          <q-item-section>
            <q-item-label>Evitar peajes</q-item-label>
            <q-item-label caption>Ahorra costes evitando las autopistas de peaje</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-toggle v-model="avoidTolls" color="primary" />
          </q-item-section>
        </q-item>

        <q-item clickable v-ripple @click="showStopIdDialog = true">
          <q-item-section>
            <q-item-label>ID de parada</q-item-label>
            <q-item-label caption>{{ stopIdLabel }}</q-item-label>
          </q-item-section>
        </q-item>

        <q-item>
          <q-item-section>
            <q-item-label>Burbuja en el modo de navegación</q-item-label>
            <q-item-label caption>Ver la información de entrega mientras navegas</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-toggle v-model="showBubble" color="primary" />
          </q-item-section>
        </q-item>
      </q-list>

      <div class="section-title">Preferencias generales</div>
      
      <q-list class="settings-list">
        <q-item clickable v-ripple @click="showThemeDialog = true">
          <q-item-section>
            <q-item-label>Tema</q-item-label>
            <q-item-label caption>{{ themeLabel }}</q-item-label>
          </q-item-section>
        </q-item>
      </q-list>

      <div class="section-title">Información</div>
      
      <q-list class="settings-list">
        <q-item clickable v-ripple @click="showLicenses">
          <q-item-section>
            <q-item-label>Licencias</q-item-label>
          </q-item-section>
        </q-item>

        <q-item clickable v-ripple @click="showTerms">
          <q-item-section>
            <q-item-label>Términos de uso</q-item-label>
          </q-item-section>
        </q-item>

        <q-item clickable v-ripple @click="showPrivacy">
          <q-item-section>
            <q-item-label>Política de privacidad</q-item-label>
          </q-item-section>
        </q-item>

        <q-item>
          <q-item-section>
            <q-item-label>Versión</q-item-label>
            <q-item-label caption>HormiRuta-v1.0.0</q-item-label>
          </q-item-section>
        </q-item>
      </q-list>

      <q-list class="settings-list q-mt-md">
        <q-item clickable v-ripple @click="handleLogout" class="logout-item">
          <q-item-section>
            <q-item-label class="text-primary">Cerrar sesión</q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </div>

    <q-dialog v-model="showNavAppDialog">
      <q-card class="dialog-card">
        <q-card-section class="text-h6">App de navegación</q-card-section>
        <q-list>
          <q-item v-for="opt in navAppOptions" :key="opt.value" clickable v-close-popup @click="navApp = opt.value">
            <q-item-section avatar>
              <q-radio v-model="navApp" :val="opt.value" color="primary" />
            </q-item-section>
            <q-item-section>{{ opt.label }}</q-item-section>
          </q-item>
        </q-list>
      </q-card>
    </q-dialog>

    <q-dialog v-model="showStopSideDialog">
      <q-card class="dialog-card">
        <q-card-section class="text-h6">Lado de la parada</q-card-section>
        <q-list>
          <q-item v-for="opt in stopSideOptions" :key="opt.value" clickable v-close-popup @click="stopSide = opt.value">
            <q-item-section avatar>
              <q-radio v-model="stopSide" :val="opt.value" color="primary" />
            </q-item-section>
            <q-item-section>{{ opt.label }}</q-item-section>
          </q-item>
        </q-list>
      </q-card>
    </q-dialog>

    <q-dialog v-model="showStopTimeDialog">
      <q-card class="dialog-card">
        <q-card-section class="text-h6">Tiempo promedio en parada</q-card-section>
        <q-list>
          <q-item v-for="opt in stopTimeOptions" :key="opt" clickable v-close-popup @click="stopDuration = opt">
            <q-item-section avatar>
              <q-radio v-model="stopDuration" :val="opt" color="primary" />
            </q-item-section>
            <q-item-section>{{ opt }} min</q-item-section>
          </q-item>
        </q-list>
      </q-card>
    </q-dialog>

    <q-dialog v-model="showVehicleDialog">
      <q-card class="dialog-card">
        <q-card-section class="text-h6">Tipo de vehículo</q-card-section>
        <q-list>
          <q-item v-for="opt in vehicleOptions" :key="opt.value" clickable v-close-popup @click="vehicleType = opt.value">
            <q-item-section avatar>
              <q-radio v-model="vehicleType" :val="opt.value" color="primary" />
            </q-item-section>
            <q-item-section>{{ opt.label }}</q-item-section>
          </q-item>
        </q-list>
      </q-card>
    </q-dialog>

    <q-dialog v-model="showStopIdDialog">
      <q-card class="dialog-card">
        <q-card-section class="text-h6">ID de parada</q-card-section>
        <q-list>
          <q-item v-for="opt in stopIdOptions" :key="opt.value" clickable v-close-popup @click="stopIdStyle = opt.value">
            <q-item-section avatar>
              <q-radio v-model="stopIdStyle" :val="opt.value" color="primary" />
            </q-item-section>
            <q-item-section>{{ opt.label }}</q-item-section>
          </q-item>
        </q-list>
      </q-card>
    </q-dialog>

    <q-dialog v-model="showThemeDialog">
      <q-card class="dialog-card">
        <q-card-section class="text-h6">Tema</q-card-section>
        <q-list>
          <q-item v-for="opt in themeOptions" :key="opt.value" clickable v-close-popup @click="setTheme(opt.value)">
            <q-item-section avatar>
              <q-radio v-model="themeMode" :val="opt.value" color="primary" />
            </q-item-section>
            <q-item-section>{{ opt.label }}</q-item-section>
          </q-item>
        </q-list>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useThemeStore } from 'src/stores/theme-store'
import { useAuthStore } from 'src/stores/auth-store'

const $q = useQuasar()
const router = useRouter()
const themeStore = useThemeStore()
const authStore = useAuthStore()

const navApp = ref(localStorage.getItem('navApp') || 'google')
const stopSide = ref(localStorage.getItem('stopSide') || 'any')
const stopDuration = ref(parseInt(localStorage.getItem('stopDuration') || '1'))
const vehicleType = ref(localStorage.getItem('vehicleType') || 'car')
const avoidTolls = ref(JSON.parse(localStorage.getItem('avoidTolls') || 'false'))
const stopIdStyle = ref(localStorage.getItem('stopIdStyle') || 'classic')
const showBubble = ref(JSON.parse(localStorage.getItem('showBubble') || 'true'))
const themeMode = ref(localStorage.getItem('themeMode') || 'auto')

const showNavAppDialog = ref(false)
const showStopSideDialog = ref(false)
const showStopTimeDialog = ref(false)
const showVehicleDialog = ref(false)
const showStopIdDialog = ref(false)
const showThemeDialog = ref(false)

const navAppOptions = [
  { label: 'Navegación de HormiRuta', value: 'hormiruta' },
  { label: 'Google Maps', value: 'google' },
  { label: 'Waze', value: 'waze' },
  { label: 'Apple Maps', value: 'apple' }
]

const stopSideOptions = [
  { label: 'Cualquier lado del vehículo', value: 'any' },
  { label: 'Lado derecho', value: 'right' },
  { label: 'Lado izquierdo', value: 'left' }
]

const stopTimeOptions = [1, 2, 3, 5, 10, 15, 30]

const vehicleOptions = [
  { label: 'Coche', value: 'car' },
  { label: 'Moto', value: 'motorcycle' },
  { label: 'Bicicleta', value: 'bicycle' },
  { label: 'Camión', value: 'truck' },
  { label: 'A pie', value: 'walking' }
]

const stopIdOptions = [
  { label: 'Clásico y Por orden de ruta', value: 'classic' },
  { label: 'Solo número de orden', value: 'order' },
  { label: 'Personalizado', value: 'custom' }
]

const themeOptions = [
  { label: 'Automático (puesta/salida del sol)', value: 'auto' },
  { label: 'Oscuro', value: 'dark' },
  { label: 'Claro', value: 'light' }
]

const navAppLabel = computed(() => navAppOptions.find(o => o.value === navApp.value)?.label || '')
const stopSideLabel = computed(() => stopSideOptions.find(o => o.value === stopSide.value)?.label || '')
const vehicleLabel = computed(() => vehicleOptions.find(o => o.value === vehicleType.value)?.label || '')
const stopIdLabel = computed(() => stopIdOptions.find(o => o.value === stopIdStyle.value)?.label || '')
const themeLabel = computed(() => themeOptions.find(o => o.value === themeMode.value)?.label || '')

watch(navApp, (val) => localStorage.setItem('navApp', val))
watch(stopSide, (val) => localStorage.setItem('stopSide', val))
watch(stopDuration, (val) => localStorage.setItem('stopDuration', val.toString()))
watch(vehicleType, (val) => localStorage.setItem('vehicleType', val))
watch(avoidTolls, (val) => localStorage.setItem('avoidTolls', JSON.stringify(val)))
watch(stopIdStyle, (val) => localStorage.setItem('stopIdStyle', val))
watch(showBubble, (val) => localStorage.setItem('showBubble', JSON.stringify(val)))

const setTheme = (mode) => {
  themeMode.value = mode
  localStorage.setItem('themeMode', mode)
  if (mode === 'dark') {
    themeStore.setDarkMode(true)
  } else if (mode === 'light') {
    themeStore.setDarkMode(false)
  } else {
    const hour = new Date().getHours()
    themeStore.setDarkMode(hour < 6 || hour >= 18)
  }
}

const showLicenses = () => {
  $q.dialog({ title: 'Licencias', message: 'Licencias de código abierto utilizadas en HormiRuta.' })
}

const showTerms = () => {
  $q.dialog({ title: 'Términos de uso', message: 'Al usar HormiRuta aceptas nuestros términos y condiciones de servicio.' })
}

const showPrivacy = () => {
  $q.dialog({ title: 'Política de privacidad', message: 'Tu privacidad es importante. No compartimos tus datos con terceros.' })
}

const handleLogout = async () => {
  await authStore.logout()
  router.push('/auth/login')
}

onMounted(() => {
  authStore.fetchCurrentUser()
})
</script>

<style scoped>
.settings-page {
  background: #121212;
  min-height: 100vh;
  padding-top: 56px;
}

.settings-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 56px;
  background: #121212;
  display: flex;
  align-items: center;
  padding: 0 8px;
  z-index: 100;
}

.header-title {
  color: white;
  font-size: 18px;
  font-weight: 500;
  margin-left: 16px;
}

.settings-content {
  padding: 16px;
}

.section-title {
  color: #4a9eff;
  font-size: 13px;
  font-weight: 500;
  padding: 16px 0 8px 0;
  text-transform: none;
}

.settings-list {
  background: transparent;
}

.settings-list .q-item {
  padding: 12px 0;
  min-height: 56px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.settings-list .q-item__label {
  color: #ffffff;
  font-size: 15px;
}

.settings-list .q-item__label--caption {
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
  margin-top: 2px;
}

.logout-item .q-item__label {
  color: #4a9eff !important;
}

.dialog-card {
  background: #1e1e1e;
  min-width: 280px;
}

.dialog-card .q-item {
  color: white;
}
</style>
