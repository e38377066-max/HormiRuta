<template>
  <q-layout view="lHh Lpr lFf" class="">

    <!-- HEADER -->
    <q-header class="bg-gradient no-shadow q-pa-sm">
      <div class="row justify-between items-center">
        <div class="row items-center q-gutter-sm">
          <q-btn flat dense round icon="menu" color="white" @click="toggleLeftDrawer" />
        </div>
        <!-- <q-btn flat dense round icon="settings" color="white" @click="showUserModal = true" /> -->
      </div>
    </q-header>

    <!-- DRAWER -->
    <q-drawer v-model="leftDrawerOpen" show-if-above bordered class="bg-dark text-white">
      <div class="q-pa-md flex flex-center column">
        <q-img src="~assets/Hormiruta.png"
          style="width: 100px; height: 100px; object-fit: contain; background: white; border-radius: 50%;" />
        <div class="text-h6 text-center q-mt-sm">HormiRuta</div>
        <div class="text-white bg-grey-8 q-pa-xs q-mt-sm rounded-borders">
          <b>{{ user.email || 'Sin correo registrado' }}</b>
        </div>
        <div class="text-caption text-grey-5 q-mt-xs">Version 1.0</div>
      </div>

      <q-separator spaced />

      <q-list dense>
        <q-item class="q-mb-md" clickable v-ripple to="/planner">
          <q-item-section avatar><q-icon name="auto_fix_high" color="primary" /></q-item-section>
          <q-item-section><b>Planificar Ruta</b></q-item-section>
        </q-item>

        <q-item class="q-mb-md" clickable v-ripple to="/routes">
          <q-item-section avatar><q-icon name="route" color="info" /></q-item-section>
          <q-item-section>Mis Rutas Guardadas</q-item-section>
        </q-item>

        <q-separator spaced />

        <q-item class="q-mb-md" clickable v-ripple @click="showUserModal = true">
          <q-item-section avatar><q-icon name="settings" /></q-item-section>
          <q-item-section>Configuracion</q-item-section>
        </q-item>

        <q-item clickable v-ripple class="q-mb-md">
          <q-item-section avatar><q-icon name="help_outline" /></q-item-section>
          <q-item-section>Guia de ayuda</q-item-section>
        </q-item>

        <q-item clickable v-ripple class="q-mb-md" @click="loadDialogRoutes(); showRoutesDialog = true">
          <q-item-section avatar>
            <q-icon name="map" />
          </q-item-section>
          <q-item-section>
            Ver rutas locales
          </q-item-section>
        </q-item>

        <q-item class="q-mb-md">
          <q-item-section avatar><q-icon :name="themeStore.isDark ? 'dark_mode' : 'light_mode'" /></q-item-section>
          <q-item-section>Tema {{ themeStore.isDark ? 'Oscuro' : 'Claro' }}</q-item-section>
          <q-item-section side>
            <q-toggle v-model="themeStore.isDark" @update:model-value="themeStore.toggleTheme()" color="primary" />
          </q-item-section>
        </q-item>

        <q-separator spaced />

        <q-item clickable v-ripple class="q-mb-md text-negative" @click="handleLogout">
          <q-item-section avatar><q-icon name="logout" color="negative" /></q-item-section>
          <q-item-section>Cerrar sesion</q-item-section>
        </q-item>

      </q-list>
    </q-drawer>
    <q-page-container>
      <q-page class="q-pa-none flex-center">
        <!-- Contenedor del mapa -->
        <div id="map" class="map-container"></div>
        <!-- Mensaje de carga -->
        <div v-if="loadingMap" class="loading-overlay column items-center justify-center">
          <q-spinner color="white" size="40px" />
          <div class="text-subtitle2 q-mt-sm">Cargando mapa...</div>
        </div>

      </q-page>
    </q-page-container>
    <!-- FOOTER -->
    <q-footer class="custom-footer no-shadow bg-gradient">
      <div class="footer-container row justify-around items-center">
        <q-btn round size="lg" color="primary" icon="keyboard_voice" class="footer-btn animate-mic"
          @click="startVoiceInput" />

        <q-btn round size="xl" color="white" class="main-btn shadow-10" @click="goHome">
          <q-img src="~assets/Hormiruta.png" style="width: 90px; height: 90px; object-fit: contain;" />
        </q-btn>
        <div class="text-center q-mt-xl">Optimizar</div>

        <q-btn round size="lg" color="positive" icon="fa-solid fa-pencil" class="footer-btn"
          @click="showAddressForm = true" />
      </div>
    </q-footer>
    <!-- BOTÓN DE EMERGENCIA FLOTANTE -->
    <div v-if="isEmergencyButtonVisible" class="emergency-btn" :style="{ top: posY + 'px', left: posX + 'px' }"
      @mousedown="startDrag" @touchstart="startDrag">
      <q-btn round size="xl" color="red" icon="fa-solid fa-phone-volume" class="shadow-10" @click="emergencyCall" />
    </div>
    <q-dialog v-model="showUserModal" persistent transition-show="scale" transition-hide="scale">
      <q-card class="user-card">
        <q-card-section class="modal-header text-white text-center">
          <div class="text-h6">Datos del Usuario</div>
        </q-card-section>
        <q-card-section>
          <q-input v-model="user.name" label="Nombre" outlined dense class="styled-input" />
          <q-input v-model="user.email" label="Correo electrónico" type="email" outlined dense
            class="styled-input q-mt-sm" />
          <q-input v-model="user.address" label="Dirección" outlined dense class="styled-input q-mt-sm" />
          <q-input v-model="user.document" label="Documento de identidad" outlined dense class="styled-input q-mt-sm" />
          <q-input v-model="user.phone" label="Telefono" outlined dense class="styled-input q-mt-sm" />
          <q-toggle v-model="isEmergencyButtonVisible" color="green" label="Botón de Emergencia"
            class="styled-input q-mt-sm" />
        </q-card-section>

        <q-card-actions align="right" class="q-pa-md">
          <q-btn flat label="Cancelar" color="grey-6" v-close-popup />
          <q-btn unelevated label="Guardar" color="primary" @click="saveUserData" />
        </q-card-actions>
      </q-card>
    </q-dialog>
    <q-dialog v-model="showAddressForm" persistent transition-show="scale" transition-hide="scale">
      <q-card class="address-card">
        <!-- HEADER -->
        <q-card-section class="modal-header text-white text-center">
          <div class="text-h6">Agregar dirección</div>
          <div class="text-caption text-blue-2">Selecciona o busca un punto en el mapa</div>
        </q-card-section>

        <!-- FORMULARIO -->
        <q-card-section class="q-gutter-md q-pa-md">
          <!-- AUTOCOMPLETE DE DIRECCIONES -->
          <q-input v-model="addressForm.address" label="Buscar dirección..." outlined dense debounce="300"
            color="primary" class="styled-input" @update:model-value="fetchSuggestions">
            <template #append>
              <q-icon name="mic" class="cursor-pointer" />
            </template>
          </q-input>

          <!-- LISTA DE SUGERENCIAS -->
          <q-list v-if="suggestions.length" bordered class="suggestion-list q-mt-sm">
            <q-item v-for="(item, index) in suggestions" :key="index" clickable v-ripple
              @click="selectSuggestion(item)">
              <q-item-section>
                <q-item-label>{{ item.description }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>

          <!-- OPCIONES ADICIONALES -->
          <q-toggle v-model="addressForm.poiOnly" label="Buscar solo puntos de interés" color="secondary"
            class="q-mt-sm" />

          <div class="row q-gutter-sm justify-between">
            <q-btn flat icon="note_add" label="Agregar nota" color="secondary"
              @click="addressForm.note = prompt('Escribe una nota:')" />
            <q-btn flat icon="phone" label="Teléfono" color="secondary"
              @click="addressForm.phone = prompt('Número de contacto:')" />
          </div>

          <q-separator spaced />

          <!-- HORARIO -->
          <div class="row justify-around text-center q-mb-sm">
            <div>
              <div class="text-caption text-grey-5">LLEGANDO ENTRE</div>
              <q-input dense outlined v-model="addressForm.startTime" placeholder="Inicio"
                class="styled-input time-input" />
            </div>
            <div>
              <div class="text-caption text-grey-5">FIN</div>
              <q-input dense outlined v-model="addressForm.endTime" placeholder="Fin" class="styled-input time-input" />
            </div>
          </div>

          <q-btn outline color="pink" icon="schedule" label="Tiempo de espera" class="q-mt-sm"
            @click="addressForm.waitTime = prompt('Minutos de espera:')" />
        </q-card-section>

        <!-- ACCIONES -->
        <q-card-actions align="around" class="q-pa-md">
          <q-btn flat color="grey-6" label="Cancelar" v-close-popup />
          <q-btn unelevated color="primary" label="Confirmar y agregar" @click="addAddressPoint" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="showRoutesDialog" persistent @show="loadDialogRoutes">
      <q-card style="min-width: 350px; max-width: 600px;" class="bg-rutes">
        <q-card-section class="modal-header text-white text-center">
          <div class="text-h6">📍 Rutas guardadas</div>
        </q-card-section>

        <q-card-section>
          <q-list bordered separator>
            <q-item v-for="(route, index) in routes" :key="index" clickable @click="navigateAndDelete(route, index)">
              <q-item-section>
                <q-item-label class="text-weight-bold">Ruta #{{ index + 1 }}</q-item-label>
                <q-item-label style="color: white;" caption>
                  {{ route[0]?.lat.toFixed(5) }}, {{ route[0]?.lng.toFixed(5) }} →
                  {{ route[route.length - 1]?.lat.toFixed(5) }}, {{ route[route.length - 1]?.lng.toFixed(5) }}
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-icon name="navigation" color="primary" />
              </q-item-section>
            </q-item>
          </q-list>

          <div v-if="routes.length === 0" class="text-grey text-center q-mt-md">
            No hay rutas guardadas.
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cerrar" color="primary" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>



  </q-layout>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { GoogleMap } from "@capacitor/google-maps";
import { SpeechRecognition } from "@capacitor-community/speech-recognition";
import { useQuasar } from "quasar";
import { Notify } from "quasar";
import { Preferences } from "@capacitor/preferences";
import { Browser } from '@capacitor/browser';
import { useAuthStore } from "src/stores/auth-store";
import { useThemeStore } from "src/stores/theme-store";

import { NativeAudio } from '@capacitor-community/native-audio';

const router = useRouter();
const authStore = useAuthStore();
const themeStore = useThemeStore();

themeStore.initTheme();

NativeAudio.preload({
  assetId: 'sound1',
  assetPath: 'login.mp3',
  audioChannelNum: 1,
  isUrl: false
}).then(() => {
  NativeAudio.play('sound1');
}).catch(error => {
  console.error('Error al cargar o reproducir el sonido:', error);
});
// import { CallNumber } from '@awesome-cordova-plugins/call-number';

const $q = useQuasar();
console.log(Capacitor.getPlatform());
// 🔔 Función centralizada de notificaciones
function notify(type, message) {
  $q.notify({
    type,
    message,
    position: "top",
  });
}

const menu = ref(false)




// eslint-disable-next-line no-unused-vars
const openPaypal = async (type) => {
  let url = ''
  if (type === 'mensual') {
    url = 'https://www.paypal.com/ncp/payment/ZXJSN4DRK8X48'
  } else if (type === 'flotilla') {
    url = 'https://www.paypal.com/ncp/payment/CCULWB3SKHNW4' // Cambia este link por el de flotilla
  }

  try {
    await Browser.open({ url })
  } catch (err) {
    console.error('Error al abrir PayPal:', err)
  }

  menu.value = false
}

const handleLogout = async () => {
  try {
    await authStore.logout()
    router.push('/auth/login')
  } catch (error) {
    console.error('Error al cerrar sesion:', error)
    router.push('/auth/login')
  }
}

const goHome = () => {
  router.push('/routes')
}

const showUserModal = ref(false);
const leftDrawerOpen = ref(false);
const suggestions = ref([]);
const showAddressForm = ref(false);
const showRoutesDialog = ref(false);
const routes = ref([]);
const isEmergencyButtonVisible = ref(false);

const toggleLeftDrawer = () => (leftDrawerOpen.value = !leftDrawerOpen.value);


const loadingMap = ref(true);
const posX = ref(20);
const posY = ref(400);
let isDragging = false;
let offsetX = 0;
let offsetY = 0;

const user = ref({
  name: "",
  email: "",
  address: "",
  document: "",
  phone: "",
});

const saveUserData = async () => {
  await Preferences.set({
    key: 'userData',
    value: JSON.stringify(user.value)
  });
  console.log("💾 Datos guardados:", user.value);

  Notify.create({
    type: "positive",
    message: "Datos del usuario guardados correctamente",
  });
  showUserModal.value = false;
};

const loadUserData = async () => {
  try {
    const { value } = await Preferences.get({ key: 'userData' });
    if (value) {
      user.value = JSON.parse(value);
    }
  } catch (err) {
    console.error("Error cargando datos usuario:", err);
  }
};

// === MAPA ===
let map;
let routePoints = ref([]);

onMounted(async () => {
  await initMap();
  await loadUserData(); // 👈 Ahora es async
  const available = await SpeechRecognition.available();
  if (available) {
    await SpeechRecognition.requestPermission();
  }
});


const saveRoutes = async (points) => {
  console.log("🛰️ Guardando rutas...", points);

  if (Capacitor.getPlatform() === "android") {
    localStorage.setItem("savedRoutes", JSON.stringify(points));
    console.log("💾 Rutas guardadas en localStorage:", localStorage.getItem("savedRoutes"));
  } else {
    await Preferences.set({
      key: "savedRoutes",
      value: JSON.stringify(points),
    });
    const { value } = await Preferences.get({ key: "savedRoutes" });
    console.log("💾 Rutas guardadas en Preferences:", value);
  }
};

// 🔄 FUNCIÓN PARA CARGAR RUTAS
const loadRoutes = async () => {
  try {
    let points = [];

    if (Capacitor.getPlatform() === "android") {
      const saved = localStorage.getItem("savedRoutes");
      if (saved) {
        points = JSON.parse(saved);
        console.log("🗺️ Ruta cargada desde localStorage:", points.length, "puntos", points);
      } else {
        console.log("⚠️ No se encontraron rutas en localStorage");
      }
    } else {
      const { value } = await Preferences.get({ key: "savedRoutes" });
      if (value) {
        points = JSON.parse(value);
        console.log("🗺️ Ruta cargada desde Preferences:", points.length, "puntos", points);
      } else {
        console.log("⚠️ No se encontraron rutas en Preferences");
      }
    }

    return points;
  } catch (err) {
    console.error("❌ Error cargando ruta:", err);
    return [];
  }
};

const loadDialogRoutes = async () => {
  const savedRoutes = await loadRoutes();

  if (Array.isArray(savedRoutes) && savedRoutes.length > 0) {
    // Si son puntos planos (no rutas)
    if (!Array.isArray(savedRoutes[0])) {
      // Convierte cada punto en una "ruta" de un solo destino
      routes.value = savedRoutes.map(point => [point]);
      console.log("📍 Convertidos", routes.value.length, "puntos en rutas individuales");
    } else {
      routes.value = savedRoutes;
      console.log("📍 Rutas cargadas correctamente:", routes.value.length);
    }
  } else {
    routes.value = [];
  }
};

const saveUpdatedRoutes = async () => {
  if (Capacitor.getPlatform() === "android") {
    localStorage.setItem("savedRoutes", JSON.stringify(routes.value));
  } else {
    await Preferences.set({
      key: "savedRoutes",
      value: JSON.stringify(routes.value),
    });
  }
};

const navigateAndDelete = async (route, index) => {
  if (!route || route.length === 0) {
    $q.notify({ type: "warning", message: "Ruta incompleta." });
    return;
  }

  const destination = route[route.length - 1]; // último punto = destino
  const lat = destination.lat;
  const lng = destination.lng;

  try {
    if (Capacitor.getPlatform() === "android") {
      // 📍 Abre directamente Google Maps en modo navegación (voz)
      const mapsUrl = `google.navigation:q=${lat},${lng}&mode=d`;
      window.location.href = mapsUrl; // abre la app de Google Maps
    } else {
      // 💻 En desarrollo web: usa la versión de navegador
      const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
      await Browser.open({ url: mapsUrl });
    }

    // 🗑️ Eliminar la ruta usada
    routes.value.splice(index, 1);
    await saveUpdatedRoutes();

    $q.notify({
      type: "positive",
      message: "Navegación iniciada y ruta eliminada.",
    });

    if (routes.value.length === 0) showRoutesDialog.value = false;
  } catch (err) {
    console.error("❌ Error al abrir Google Maps:", err);
    $q.notify({ type: "negative", message: "Error al iniciar la navegación." });
  }
};

const initMap = async () => {
  const mapElement = document.getElementById("map");
  if (!mapElement) return;

  try {
    if (Capacitor.getPlatform() === "web") {
      console.log("🌐 Iniciando mapa web...");
      // // --- WEB ---
      // if (!window.google || !window.google.maps) {
      //   const script = document.createElement("script");
      //   script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyBLqGtCFZG3-cl9oILRHE-1QOJATX-gm-4`;
      //   script.async = true;
      //   document.head.appendChild(script);
      //   await new Promise((resolve) => (script.onload = resolve));
      // }

      // map = new window.google.maps.Map(mapElement, {
      //   center: { lat: 4.711, lng: -74.0721 },
      //   zoom: 12,
      // });

      // // 👇 CARGAR RUTAS CON NUEVO MÉTODO
      // const savedRoutes = await loadRoutes();
      // if (savedRoutes.length > 0) {
      //   routePoints.value = savedRoutes;
      //   routePoints.value.forEach((point) => {
      //     new window.google.maps.Marker({
      //       position: point,
      //       map,
      //       title: "Punto guardado",
      //     });
      //   });
      //   drawPolylineWeb();
      // }

      // map.addListener("click", async (e) => { // 👈 Ahora es async
      //   const newPoint = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      //   routePoints.value.push(newPoint);
      //   new window.google.maps.Marker({
      //     position: newPoint,
      //     map,
      //     title: `Punto ${routePoints.value.length}`,
      //   });
      //   drawPolylineWeb();
      //   await saveRoutes(routePoints.value); // 👈 GUARDAR CON NUEVO MÉTODO
      //});

    } else {
      // --- ANDROID / IOS ---
      const bounds = mapElement.getBoundingClientRect();
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
      });
      const { latitude, longitude } = position.coords;

      map = await GoogleMap.create({
        id: "hormiruta-map",
        element: mapElement,
        apiKey: "AIzaSyBLqGtCFZG3-cl9oILRHE-1QOJATX-gm-4",
        config: {
          center: { lat: latitude, lng: longitude },
          zoom: 12,
          width: Math.round(bounds.width),
          height: Math.round(bounds.height),
          x: Math.round(bounds.x),
          y: Math.round(bounds.y),
        },
      });
      // 👇 CARGAR RUTAS CON NUEVO MÉTODO
      const savedRoutes = await loadRoutes();
      if (savedRoutes.length > 0) {
        // Detectar si la estructura es [puntos] o [[puntos]]
        if (Array.isArray(savedRoutes[0])) {
          // ✅ rutas con múltiples puntos
          routePoints.value = savedRoutes.flat();
        } else {
          // ✅ puntos planos
          routePoints.value = savedRoutes;
        }

        // 🟢 Agregar todos los marcadores
        for (const point of routePoints.value) {
          await map.addMarker({
            coordinate: point,
            title: "Punto guardado",
            iconUrl: "~assets/30x30.png", // tu ícono personalizado
          });
        }

        await drawPolylineNative();
      }
    }
  } catch (err) {
    console.error("Error cargando el mapa:", err);
    notify("negative", "Error al cargar el mapa");
  } finally {
    loadingMap.value = false;
  }
};


// === Agregar dirección ===
const addressForm = ref({
  address: "",
  poiOnly: false,
  note: "",
  phone: "",
  startTime: "",
  endTime: "",
  waitTime: "",
});

async function fetchSuggestions(query) {
  if (!query || query.length < 3) {
    suggestions.value = [];
    return;
  }

  const apiKey = "AIzaSyBLqGtCFZG3-cl9oILRHE-1QOJATX-gm-4";
  const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
    query
  )}&types=geocode&key=${apiKey}&language=es`;

  try {
    const response = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`);
    const data = await response.json();
    if (data.predictions) {
      suggestions.value = data.predictions;
    }
  } catch (err) {
    console.error("Error obteniendo sugerencias:", err);
  }
}

// === RECONOCIMIENTO DE VOZ ===
const startVoiceInput = async () => {
  const btn = document.querySelector('.animate-mic')
  btn.classList.add('listening')

  if (Capacitor.getPlatform() !== 'web') {
    try {
      // 🔹 Paso 1: Verificar permisos
      let permission = await SpeechRecognition.checkPermissions()
      console.log('🔍 Estado inicial:', permission)

      if (!permission || permission.speechRecognition !== 'granted') {
        console.log('🎙️ Solicitando permiso...')
        await SpeechRecognition.requestPermissions()

        permission = await SpeechRecognition.checkPermissions()
        console.log('🔁 Estado después de solicitar:', permission)

        if (!permission || permission.speechRecognition !== 'granted') {
          Notify.create({
            type: 'negative',
            message: 'Debes conceder permiso de micrófono para usar el reconocimiento de voz.'
          })
          btn.classList.remove('listening')
          return
        }
      }

      // 🔹 Paso 2: Iniciar reconocimiento
      const { matches } = await SpeechRecognition.start({
        language: 'es-ES',
        maxResults: 1,
        prompt: 'Habla ahora para ingresar una dirección',
        partialResults: false,
        popup: true
      })

      btn.classList.remove('listening')

      if (matches && matches.length > 0) {
        const voiceText = matches[0]
        console.log('🗣️ Dirección detectada:', voiceText)
        addressForm.value.address = voiceText
        await addAddressPoint()
      } else {
        Notify.create({ type: 'warning', message: 'No se detectó voz, intenta nuevamente.' })
      }
    } catch (err) {
      btn.classList.remove('listening')
      console.error('❌ Error en reconocimiento de voz nativo:', err)
      Notify.create({ type: 'negative', message: err.message || 'Error al usar el reconocimiento de voz.' })
    }
    return
  }

  // 🌐 WEB
  const SpeechRecognitionWeb = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SpeechRecognitionWeb) {
    btn.classList.remove('listening')
    Notify.create({
      type: 'negative',
      message: 'Tu navegador no soporta reconocimiento de voz.'
    })
    return
  }

  const recognition = new SpeechRecognitionWeb()
  recognition.lang = 'es-ES'
  recognition.interimResults = false
  recognition.maxAlternatives = 1
  recognition.continuous = false

  recognition.start()

  recognition.onresult = async (event) => {
    btn.classList.remove('listening')
    const voiceText = event.results[0][0].transcript
    console.log('📣 Dirección detectada (web):', voiceText)
    addressForm.value.address = voiceText
    await addAddressPoint()
  }

  recognition.onerror = (event) => {
    btn.classList.remove('listening')
    console.error('❌ Error de voz (web):', event.error)
    const errors = {
      'no-speech': 'No se detectó voz. Habla más fuerte o revisa el micrófono.',
      'audio-capture': 'No se detectó micrófono. Conéctalo o permite acceso.',
      'not-allowed': 'Permite el acceso al micrófono para usar esta función.'
    }
    Notify.create({
      type: 'negative',
      message: errors[event.error] || 'Error al reconocer la voz. Intenta nuevamente.'
    })
  }

  recognition.onend = () => {
    btn.classList.remove('listening')
  }
}

async function selectSuggestion(item) {
  addressForm.value.address = item.description;
  suggestions.value = [];
}

async function addAddressPoint() {
  if (!addressForm.value.address) {
    notify("warning", "Por favor, ingresa una dirección.");
    return;
  }

  const coords = await geocodeAddress(addressForm.value.address);
  if (!coords) {
    notify("negative", "❌ No se encontró la ubicación.");
    return;
  }

  routePoints.value.push(coords);
  await saveRoutes(routePoints.value); // 👈 GUARDAR CON NUEVO MÉTODO

  if (Capacitor.getPlatform() === "web") {
    new window.google.maps.Marker({
      position: coords,
      map,
      title: addressForm.value.address,
    });
    drawPolylineWeb();
  } else {
    await map.addMarker({
      coordinate: coords,
      title: addressForm.value.address,
      iconUrl: "~assets/30x30.png", // tu logo
    });

    await drawPolylineNative();
  }

  notify("positive", "Dirección agregada correctamente");
  showAddressForm.value = false;
  addressForm.value = {
    address: "",
    poiOnly: false,
    note: "",
    phone: "",
    startTime: "",
    endTime: "",
    waitTime: "",
  };
}

async function geocodeAddress(address) {
  const apiKey = "AIzaSyBLqGtCFZG3-cl9oILRHE-1QOJATX-gm-4";
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    console.log("🌍 Geocoding result:", data);
    if (data.results && data.results.length > 0) {
      return data.results[0].geometry.location;
    }
  } catch (err) {
    console.error("Error en geocoding:", err);
  }
  return null;
}

const drawPolylineNative = async () => {
  if (!map || routePoints.value.length < 2) return;
  try {
    await map.addPolylines([
      {
        path: routePoints.value.map((p) => ({ lat: p.lat, lng: p.lng })),
        strokeColor: "#00d4ff",
        strokeWidth: 10,
      },
    ]);

  } catch (err) {
    console.error("Error dibujando polyline nativo:", err);
  }
};

const drawPolylineWeb = () => {
  if (!map || routePoints.value.length < 2) return;
  try {
    new window.google.maps.Polyline({
      path: routePoints.value,
      geodesic: true,
      strokeColor: "#00d4ff",
      strokeOpacity: 1.0,
      strokeWeight: 4,
      map,
    });
  } catch (err) {
    console.error("Error dibujando polyline web:", err);
  }
};

// === BOTONES ===
// eslint-disable-next-line no-unused-vars
const optimizeLocalRoutes = async () => {
  const apiKey = "AIzaSyBLqGtCFZG3-cl9oILRHE-1QOJATX-gm-4";

  // 👇 CARGAR RUTAS CON NUEVO MÉTODO
  const savedRoutes = await loadRoutes();
  if (savedRoutes.length === 0) {
    notify("warning", "No hay puntos guardados en la ruta.");
    return;
  }

  const points = savedRoutes;
  if (points.length < 2) {
    notify("warning", "Debes tener al menos dos puntos para optimizar la ruta.");
    return;
  }

  const origin = points[0];
  const destination = points[points.length - 1];
  const intermediates = points.slice(1, -1).map((p) => ({
    location: { latLng: { latitude: p.lat, longitude: p.lng } },
  }));

  const body = {
    origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
    destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
    intermediates,
    travelMode: "DRIVE",
    routingPreference: "TRAFFIC_AWARE",
    computeAlternativeRoutes: false,
    optimizeWaypointOrder: true,
  };

  try {
    let data;
    if (Capacitor.getPlatform() === "web") {
      const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "routes.optimizedIntermediateWaypointIndex,routes.polyline.encodedPolyline,routes.legs,routes.distanceMeters,routes.duration,routes.routeLabels",
        },
        body: JSON.stringify(body),
      });
      data = await res.json();
    } else {
      const response = await CapacitorHttp.post({
        url: "https://routes.googleapis.com/directions/v2:computeRoutes",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "routes.optimizedIntermediateWaypointIndex,routes.polyline.encodedPolyline,routes.legs,routes.distanceMeters,routes.duration,routes.routeLabels",
        },
        data: body,
      });
      data = response.data;
    }

    console.log("🚗 Ruta optimizada:", data);

    if (!data.routes || !data.routes.length) {
      console.error("❌ Respuesta vacía o sin rutas:", data);
      notify("negative", "No se pudo calcular la ruta.");
      return;
    }

    const encodedPolyline = data.routes[0].polyline.encodedPolyline;
    const decodedPath = decodePolyline(encodedPolyline);

    if (Capacitor.getPlatform() === "web") {
      new window.google.maps.Polyline({
        path: decodedPath,
        geodesic: true,
        strokeColor: "#FF00FF",
        strokeOpacity: 1.0,
        strokeWeight: 5,
        map,
      });
    } else {
      await map.addPolylines([
        {
          path: decodedPath.map((p) => ({ lat: p.lat, lng: p.lng })),
          strokeColor: "#FF00FF",
          strokeWidth: 10,
        },
      ]);
    }

    notify("positive", "Ruta optimizada dibujada correctamente.");
  } catch (err) {
    console.error("❌ Error al optimizar la ruta:", err);
    notify("negative", "Error al optimizar la ruta.");
  }
};


function decodePolyline(encoded) {
  let points = [];
  let index = 0,
    lat = 0,
    lng = 0;

  while (index < encoded.length) {
    let b,
      shift = 0,
      result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}

const emergencyCall = async () => {
  try {
    const { value } = await Preferences.get({ key: "userData" });
    const user = value ? JSON.parse(value) : {};
    const phone = user?.phone || "123";

    if (Capacitor.getPlatform() === "android") {
      const { CallNumber } = await import('@awesome-cordova-plugins/call-number');
      await CallNumber.callNumber(phone, true);
      notify("positive", `📞 Llamando automáticamente al ${phone}...`);
    } else {
      notify("warning", "Simulación: llamada iniciada (solo disponible en APK Android)");
    }
  } catch (err) {
    console.error("❌ Error en la llamada:", err);
    notify("negative", "No se pudo realizar la llamada automática.");
  }
};

const startDrag = (e) => {
  isDragging = true;
  const touch = e.touches ? e.touches[0] : e;
  offsetX = touch.clientX - posX.value;
  offsetY = touch.clientY - posY.value;
  document.addEventListener("mousemove", onDrag);
  document.addEventListener("mouseup", stopDrag);
  document.addEventListener("touchmove", onDrag);
  document.addEventListener("touchend", stopDrag);
};

const onDrag = (e) => {
  if (!isDragging) return;
  const touch = e.touches ? e.touches[0] : e;
  posX.value = touch.clientX - offsetX;
  posY.value = touch.clientY - offsetY;
};

const stopDrag = () => {
  isDragging = false;
  document.removeEventListener("mousemove", onDrag);
  document.removeEventListener("mouseup", stopDrag);
  document.removeEventListener("touchmove", onDrag);
  document.removeEventListener("touchend", stopDrag);
};
</script>


<style scoped>
.bg-gradient {
  background: radial-gradient(circle at 30% 30%, #0f172a, #1e293b);
  color: white;
}

.animate-mic.listening {
  animation: pulse 1s infinite;
  background-color: #e91e63 !important;
  box-shadow: 0 0 20px rgba(233, 30, 99, 0.8);
}

@keyframes pulse {
  0% {
    transform: scale(1);
    box-shadow: 0 0 10px rgba(233, 30, 99, 0.5);
  }

  50% {
    transform: scale(1.15);
    box-shadow: 0 0 25px rgba(233, 30, 99, 1);
  }

  100% {
    transform: scale(1);
    box-shadow: 0 0 10px rgba(233, 30, 99, 0.5);
  }
}


#map,
.map-container {
  height: 75vh;
  width: 100%;
  z-index: 0;
}

.q-page {
  height: 60vh;
}

.custom-footer {
  bottom: 0;
  padding-bottom: 10px;
  height: 120px;
  z-index: 999;
}

.footer-container {
  background: linear-gradient(90deg, #25045a, #01414e);
  border-radius: 50px;
  width: 90%;
  max-width: 450px;
  margin: 20px auto;
  padding: 12px 15px;
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.4);
  display: flex;
  justify-content: space-around;
  align-items: center;
}

.main-btn {
  position: absolute;
  top: -15px;
  background: #111;
  color: white;
  border: 3px solid #00d4ff;
}

.emergency-btn {
  position: fixed;
  z-index: 9999;
  touch-action: none;
  cursor: grab;
}

.user-card {
  background: rgba(20, 20, 45, 0.9);
  backdrop-filter: blur(10px);
  color: white;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  width: 90%;
  max-width: 380px;
}

.modal-header {
  background: linear-gradient(90deg, #31009e, #007b9e);
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
  padding: 16px;
}

.styled-input ::v-deep(.q-field__control) {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  border: 1px solid rgba(0, 200, 255, 0.3);
}

.styled-input ::v-deep(.q-field__label) {
  color: #9ecaff;
}

.styled-input ::v-deep(input) {
  color: #fff;
}

.address-card {
  background: rgba(20, 20, 45, 0.9);
  backdrop-filter: blur(12px);
  color: white;
  border-radius: 20px;
  border: 1px solid rgba(0, 200, 255, 0.3);
  width: 90%;
  max-width: 420px;
  box-shadow: 0 5px 25px rgba(0, 200, 255, 0.2);
}

.bg-rutes {
  background: rgba(20, 20, 45, 0.9);
  color: white;
}

.modal-header {
  background: linear-gradient(90deg, #31009e, #007b9e);
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
  padding: 16px;
}

.suggestion-list {
  max-height: 160px;
  overflow-y: auto;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
}

.suggestion-list::-webkit-scrollbar {
  width: 6px;
}

.suggestion-list::-webkit-scrollbar-thumb {
  background-color: rgba(0, 200, 255, 0.3);
  border-radius: 10px;
}

.styled-input ::v-deep(.q-field__control) {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  border: 1px solid rgba(0, 200, 255, 0.3);
}

.styled-input ::v-deep(input) {
  color: #fff;
}

.time-input {
  width: 120px;
}
</style>
