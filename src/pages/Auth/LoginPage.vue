<template>
  <div class="flex flex-center bg-page relative">
    <div class="circle circle1"></div>
    <div class="circle circle2"></div>
    <div class="circle circle3"></div>

    <div class="login-card glass animate__animated animate__fadeInUp">
      <div class="text-center q-mb-lg">
        <q-avatar size="80px" class="q-mb-md logo-avatar">
          <img src="~assets/Hormiruta.png" alt="HormiRuta logo" />
        </q-avatar>
        <h1 class="text-h5 text-white text-weight-bold q-mt-sm q-mb-xs tracking-wide">
          HormiRuta
        </h1>
        <p class="text-grey-4 text-subtitle2 q-mb-none">Accede a tu cuenta para continuar</p>
      </div>

      <q-form @submit.prevent="onLogin" class="q-gutter-md">
        <q-input v-model="form.email" label="Correo electrónico" type="email" filled dense dark color="cyan-4"
          input-class="text-white" class="input-pro" :rules="emailRules" lazy-rules autocomplete="email">
          <template v-slot:prepend>
            <q-icon name="mail" color="cyan-4" />
          </template>
        </q-input>

        <q-input v-model="form.password" label="Contraseña" :type="showPassword ? 'text' : 'password'" filled dense dark
          color="cyan-4" input-class="text-white" class="input-pro" :rules="passwordRules" lazy-rules
          autocomplete="current-password">
          <template v-slot:prepend>
            <q-icon name="lock" color="cyan-4" />
          </template>
          <template v-slot:append>
            <q-icon :name="showPassword ? 'visibility_off' : 'visibility'" color="grey-5" class="cursor-pointer"
              @click="showPassword = !showPassword" />
          </template>
        </q-input>

        <div class="row items-center justify-between q-mt-sm">
          <q-checkbox v-model="rememberMe" label="Recordarme" color="cyan-4" dark dense class="text-grey-3" />
          <q-btn flat dense color="cyan-3" label="¿Olvidaste tu contraseña?" class="text-caption forgot-btn" no-caps
            @click="goForgotPassword" />
        </div>

        <q-btn :loading="loading" :disable="loading" type="submit" label="Iniciar sesión"
          class="login-btn q-mt-md full-width" color="primary" no-caps unelevated size="md">
          <template v-slot:loading>
            <q-spinner color="white" size="20px" />
          </template>
        </q-btn>

        <div class="divider q-my-md">
          <span>O continúa con</span>
        </div>

        <q-btn class="google-btn full-width q-mt-md" color="white" text-color="dark" label="Continuar con Google"
          @click="loginWithGoogle" no-caps>
          <template v-slot:prepend>
            <img src="~assets/google.png" style="width: 20px; height: 20px;" />
          </template>
        </q-btn>

        <div class="text-center text-grey-3 q-mt-md">
          <span class="text-body2">¿No tienes cuenta?</span>
          <q-btn flat dense color="cyan-3" label="Regístrate aquí" @click="goRegister" no-caps
            class="text-weight-medium" />
        </div>
      </q-form>
      <div class="row justify-center q-gutter-sm q-mt-md">
        <q-btn label="Términos & Condiciones" flat color="secondary" class="text-caption" @click="showTerms = true" />
        <q-btn label="Política de Privacidad" flat color="secondary" class="text-caption" @click="showPrivacy = true" />
      </div>


    </div>
  </div>
  <q-dialog v-model="showTerms" persistent>
    <q-card style="min-width: 300px; max-width: 90vw; max-height: 80vh" class="bg-modal">
      <q-card-section>
        <div class="text-h6">Términos & Condiciones de Hormiruta</div>
      </q-card-section>

      <q-separator />

      <q-card-section class="q-pa-none" style="overflow-y: auto; max-height: 65vh;">
        <div class="q-pa-sm text-body2">
          <p><strong>EMPRESA:</strong> HORMIRUTA (Optimizador de Rutas)</p>
          <p><strong>FECHA DE ÚLTIMA ACTUALIZACIÓN:</strong> Octubre de 2025</p>

          <h6>A. Disposiciones Generales (Aceptación y Jurisdicción)</h6>
          <p><strong>Aceptación de Términos:</strong> El acceso y uso de la aplicación móvil "Hormiruta" (en adelante,
            "la
            Aplicación" o "el Servicio") constituye la aceptación total y sin reservas de estos Términos y Condiciones
            de
            Uso. Si el Usuario no acepta los T&C, no debe utilizar el Servicio.</p>
          <p><strong>Objeto del Servicio:</strong> Hormiruta otorga al Usuario una licencia de uso limitada, no
            exclusiva,
            para la optimización de rutas de recolección y entrega, bajo los términos de la suscripción adquirida.</p>
          <p><strong>Jurisdicción y Domicilio:</strong> Estos T&C se rigen por las leyes de la República Mexicana,
            siendo
            competentes los tribunales de la Ciudad de Guadalajara, Jalisco, México, para la resolución de cualquier
            controversia.</p>
          <p><strong>Domicilio de Hormiruta:</strong> Valle de San Lazaro 1381 Fracc. Real del Valle, Tlajomulco de
            Zúñiga.</p>

          <h6>B. Uso de la Aplicación y Restricciones</h6>
          <p><strong>Restricciones de Uso:</strong> El Usuario se compromete a no realizar, ni intentar realizar, las
            siguientes acciones:</p>
          <ul>
            <li><strong>Uso Ilegal o Peligroso:</strong> Utilizar Hormiruta para planificar rutas que involucren
              actividades ilegales, el transporte de materiales peligrosos, o cualquier propósito prohibido por la
              legislación mexicana.</li>
            <li><strong>Ingeniería Inversa:</strong> Modificar, copiar, adaptar, traducir, descompilar, desensamblar, o
              intentar extraer el código fuente o los algoritmos de la Aplicación.</li>
            <li><strong>Interferencia:</strong> Interferir o perturbar la integridad o el rendimiento del Servicio.</li>
            <li><strong>Reventa o Transferencia:</strong> Vender, revender o sublicenciar la aplicación de cualquier
              manera no autorizada.</li>
            <li><strong>Propiedad Intelectual:</strong> Todos los derechos, títulos e intereses sobre la Aplicación
              (código, diseño y algoritmos de optimización) son y seguirán siendo propiedad exclusiva de Hormiruta.</li>
            <li><strong>Dependencia de Terceros:</strong> El servicio depende de datos de mapas y tráfico proporcionados
              por terceros (ej. Google Maps). Hormiruta no se hace responsable por errores o inexactitudes en la
              información suministrada por estos terceros.</li>
          </ul>

          <h6>C. Cuentas y Suscripciones (Modelos de Pago)</h6>
          <p><strong>Registro de Cuenta:</strong> El Usuario debe proporcionar información de registro veraz, completa y
            mantenerla actualizada.</p>
          <p><strong>Periodos de Prueba (Demo):</strong> Hormiruta ofrece un periodo de prueba limitado, disponible en
            una
            de las siguientes modalidades: una limitación máxima de 10 paradas por ruta o una duración de una semana (7
            días). Al exceder el límite, el acceso a la optimización será restringido hasta que se adquiera una
            suscripción.</p>
          <p><strong>Suscripciones de Pago:</strong> El acceso ilimitado requiere la activación de una suscripción de
            pago
            (Plan Individual o Plan Flotilla).</p>
          <p><strong>Plan Flotilla (Paquete):</strong> La persona o entidad que contrata es el Administrador de Flotilla
            y
            es el único responsable de gestionar y asignar los accesos y licencias (ej. el paquete de 5 vehículos) a su
            personal o conductores. El Administrador será responsable por el uso que su personal haga de las licencias
            asignadas.</p>
          <p><strong>Renovación Automática:</strong> Las suscripciones se renuevan automáticamente al final del ciclo de
            facturación, a menos que el Usuario las cancele con al menos 24 horas de antelación a la fecha de
            renovación.
          </p>
          <p><strong>Cancelación y Reembolsos:</strong> Hormiruta no ofrece reembolsos ni créditos por periodos de
            suscripción utilizados parcialmente o por la no utilización del servicio una vez iniciado el ciclo de
            facturación.</p>

          <h6>D. Responsabilidad y Limitaciones</h6>
          <p><strong>Servicio "Tal Cual" (As Is):</strong> El Usuario acepta que la aplicación se proporciona "tal cual"
            y
            "según disponibilidad". Hormiruta no garantiza que el servicio estará libre de interrupciones o errores.</p>
          <p><strong>Limitación de Responsabilidad Financiera:</strong> Hormiruta no será responsable por ningún daño
            indirecto, incidental, o consecuente, incluyendo, pero no limitado a: pérdidas de ganancias, costos de
            combustible, desgaste de vehículos o daños resultantes de errores de navegación o inexactitudes en los datos
            de tráfico.</p>
          <p><strong>Límite Máximo:</strong> La responsabilidad total y acumulada de Hormiruta hacia el Usuario no
            excederá en ningún caso el monto total pagado por el Usuario en concepto de suscripciones durante los tres
            (3)
            meses inmediatamente anteriores al evento que dio lugar a la reclamación.</p>
          <p><strong>Cumplimiento Legal del Conductor:</strong> El Usuario y sus conductores son responsables de cumplir
            con todas las leyes de tránsito y seguridad aplicables en México.</p>
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Cerrar" color="primary" v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>


  <!-- Modal Política de Privacidad -->
  <q-dialog v-model="showPrivacy" persistent>
    <q-card style="min-width: 300px; max-width: 90vw; max-height: 80vh" class="bg-modal">
      <q-card-section>
        <div class="text-h6">Aviso de Privacidad de Hormiruta</div>
      </q-card-section>

      <q-separator />

      <q-card-section class="q-pa-none" style="overflow-y: auto; max-height: 65vh;">
        <div class="q-pa-sm text-body2">
          <p><strong>EMPRESA:</strong> HORMIRUTA (Optimizador de Rutas)</p>
          <p><strong>FECHA DE ÚLTIMA ACTUALIZACIÓN:</strong> Octubre de 2025</p>

          <h6>A. Identidad y Domicilio del Responsable</h6>
          <p>Hormiruta (en adelante, "El Responsable") con domicilio en Valle de San Lazaro 1381 Fracc. Real del Valle,
            Tlajomulco de Zúñiga, es responsable del tratamiento de sus datos personales.</p>

          <h6>B. Datos Personales Recabados</h6>
          <ul>
            <li><strong>Datos de Identificación y Contacto:</strong> Nombre completo, correo electrónico, número
              telefónico.</li>
            <li><strong>Datos de Facturación y Pago:</strong> RFC, domicilio fiscal e información de pago.</li>
            <li><strong>Datos de Geolocalización:</strong> Ubicación GPS del dispositivo y direcciones de paradas
              introducidas por el Usuario.</li>
          </ul>

          <h6>C. Finalidades del Tratamiento de Datos</h6>
          <p><strong>C.1. Finalidades Primarias:</strong></p>
          <ul>
            <li>Optimización y Ejecución de Rutas: Utilizar los datos de geolocalización y paradas para calcular,
              optimizar y monitorear las rutas.</li>
            <li>Gestión del Servicio: Administrar su cuenta y suscripciones (Individual y Flotilla).</li>
            <li>Facturación y Cobro: Procesar las suscripciones.</li>
            <li>Soporte y Notificaciones: Atender solicitudes de soporte técnico y enviar comunicaciones operativas
              esenciales.</li>
          </ul>

          <p><strong>C.2. Finalidades Secundarias:</strong></p>
          <ul>
            <li>Marketing y Promoción: Envío de publicidad, promociones y ofertas sobre nuevos servicios de Hormiruta o
              de
              socios comerciales.</li>
            <li>Análisis de Mejora: Realizar análisis estadísticos internos y estudios para mejorar la calidad y el
              algoritmo de la aplicación (los datos para este fin serán anonimizados).</li>
          </ul>
          <p>Usted puede manifestar su negativa al tratamiento de sus datos personales para las Finalidades Secundarias
            enviando un correo a la dirección indicada.</p>

          <h6>D. Transferencia de Datos</h6>
          <p>Hormiruta solo transferirá sus datos personales a terceros sin su consentimiento para excepciones legales y
            para la prestación del servicio:</p>
          <ul>
            <li>Proveedores de Mapas y Geolocalización: Ej. Google Maps.</li>
            <li>Procesadores de Pago: Transferencia de datos de facturación para la gestión de cobros y pagos de las
              suscripciones.</li>
          </ul>

          <h6>E. Derechos ARCO</h6>
          <p>Usted tiene derecho a conocer, rectificar, cancelar u oponerse al uso de sus datos personales, conforme a
            la
            LFPDPPP.</p>

          <h6>F. Mecanismo para el Ejercicio de Derechos ARCO</h6>
          <p>Para ejercer sus Derechos ARCO o revocar el consentimiento, presente una solicitud por escrito a:</p>
          <p><strong>Correo Electrónico:</strong> hormirutasoporte@gmail.com</p>

          <h6>G. Cambios al Aviso de Privacidad</h6>
          <p>El presente Aviso de Privacidad puede sufrir modificaciones. Nos comprometemos a mantenerlo informado sobre
            los cambios mediante publicación en nuestro sitio web y/o notificación por correo electrónico.</p>
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Cerrar" color="primary" v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>

</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router'
import { useAuthStore } from 'src/stores/auth-store'
import { App } from '@capacitor/app'
import { api } from 'src/boot/axios'

const router = useRouter()
const $q = useQuasar()
const authStore = useAuthStore()

const form = ref({ email: '', password: '' })
const loading = ref(false)
const showPassword = ref(false)
const rememberMe = ref(false)
const showTerms = ref(false)
const showPrivacy = ref(false)

onMounted(() => {
  const remembered = localStorage.getItem('rememberedEmail')
  if (remembered) {
    form.value.email = remembered
    rememberMe.value = true
  }
  
  const urlParams = new URLSearchParams(window.location.search)
  if (urlParams.get('login') === 'success') {
    authStore.fetchCurrentUser().then(user => {
      if (user) {
        $q.notify({ type: 'positive', message: `Bienvenido ${user.username}`, position: 'top' })
        router.push('/planner')
      }
    })
  }
})

const emailRules = [
  val => !!val || 'El correo es requerido',
  val => /.+@.+\..+/.test(val) || 'Ingresa un correo válido'
]
const passwordRules = [
  val => !!val || 'La contraseña es requerida',
  val => val.length >= 6 || 'Mínimo 6 caracteres'
]

async function onLogin() {
  loading.value = true
  try {
    const result = await authStore.login(form.value.email, form.value.password)
    
    if (result.success) {
      if (rememberMe.value) {
        localStorage.setItem('rememberedEmail', form.value.email)
      } else {
        localStorage.removeItem('rememberedEmail')
      }
      $q.notify({ type: 'positive', message: 'Inicio de sesión exitoso', caption: `Bienvenido ${result.user.username}`, position: 'top', timeout: 2000 })
      router.push('/planner')
    } else {
      $q.notify({ type: 'negative', message: 'Error al iniciar sesión', caption: result.error, position: 'top' })
    }
  } catch {
    $q.notify({ type: 'negative', message: 'Error al iniciar sesión', caption: 'Verifica tu conexión', position: 'top' })
  } finally {
    loading.value = false
  }
}

function goForgotPassword() {
  $q.notify({ message: 'Recuperación de contraseña', caption: 'Te enviaremos un correo', color: 'info', position: 'top' })
}

function goRegister() {
  router.push('/register')
}

function loginWithGoogle() {
  authStore.loginWithGoogle()
}

App.addListener('appUrlOpen', async (data) => {
  if (!data.url.includes('oauth/callback')) return

  const params = new URL(data.url).hash.substr(1)
  const accessToken = new URLSearchParams(params).get('access_token')

  if (accessToken) {
    try {
      const res = await api.post('/api/auth/google/mobile', { token: accessToken })

      if (res.data.success) {
        localStorage.setItem('user', JSON.stringify(res.data.user))
        $q.notify({ type: 'positive', message: `Bienvenido ${res.data.user.username}` })
        router.push('/planner')
      }
    } catch (err) {
      console.error('Error al autenticar con backend:', err)
      $q.notify({ type: 'negative', message: 'Error al validar token con el servidor' })
    }
  }
})

</script>





<style scoped>
@import 'https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css';

.bg-page {
  background: radial-gradient(circle at 30% 30%, #0f172a, #1e293b);
  min-height: 100vh;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.bg-modal {
  background: rgb(19, 3, 58);
  color: white;
}

.login-card {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 24px;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.3),
    0 0 40px rgba(14, 165, 233, 0.15);
  padding: 2.5rem 2rem;
  width: 100%;
  max-width: 420px;
  position: relative;
  z-index: 1;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.login-card:hover {
  transform: translateY(-6px);
  box-shadow:
    0 12px 48px rgba(0, 0, 0, 0.4),
    0 0 60px rgba(59, 130, 246, 0.25);
  border-color: rgba(255, 255, 255, 0.2);
}

.logo-avatar {
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 4px 20px rgba(6, 182, 212, 0.3);
  transition: transform 0.3s ease;
}

.logo-avatar:hover {
  transform: scale(1.05);
}

.input-pro {
  /* border-radius: 12px; */
  transition: all 0.3s ease;
}

/* .input-pro :deep(.q-field__control) {
  border-radius: 12px;
} */

.input-pro:focus-within {
  transform: translateY(-2px);
}

.input-pro :deep(.q-field__control):focus-within {
  box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.3);
}

.login-btn {
  background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);
  border-radius: 12px;
  font-weight: 600;
  letter-spacing: 0.3px;
  padding: 0.75rem 1.5rem;
  box-shadow:
    0 4px 15px rgba(6, 182, 212, 0.4),
    0 2px 8px rgba(0, 0, 0, 0.2);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.login-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.5s;
}

.login-btn:hover::before {
  left: 100%;
}

.login-btn:hover {
  transform: translateY(-3px);
  box-shadow:
    0 8px 25px rgba(59, 130, 246, 0.5),
    0 4px 12px rgba(0, 0, 0, 0.3);
}

.login-btn:active {
  transform: translateY(-1px);
}

.google-btn {
  border-radius: 12px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 0.65rem 1.5rem;
  transition: all 0.3s ease;
}

.google-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.3);
}

.google-btn img {
  filter: brightness(1.1);
}

.forgot-btn {
  font-size: 0.8rem;
  padding: 0.25rem 0.5rem;
  transition: all 0.2s ease;
}

.forgot-btn:hover {
  text-decoration: underline;
}

.divider {
  display: flex;
  align-items: center;
  text-align: center;
  color: #9ca3af;
  font-size: 0.75rem;
  letter-spacing: 0.5px;
  opacity: 0.7;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid rgba(255, 255, 255, 0.15);
}

.divider:not(:empty)::before {
  margin-right: 1rem;
}

.divider:not(:empty)::after {
  margin-left: 1rem;
}

.circle {
  position: absolute;
  border-radius: 50%;
  filter: blur(120px);
  opacity: 0.4;
  z-index: 0;
  animation: float 12s ease-in-out infinite;
}

.circle1 {
  width: 350px;
  height: 350px;
  background: #3b82f6;
  top: -100px;
  left: -120px;
  animation-delay: 0s;
}

.circle2 {
  width: 400px;
  height: 400px;
  background: #06b6d4;
  bottom: -120px;
  right: -100px;
  animation-delay: -4s;
}

.circle3 {
  width: 300px;
  height: 300px;
  background: #8b5cf6;
  top: 50%;
  right: -150px;
  animation-delay: -8s;
}

@keyframes float {

  0%,
  100% {
    transform: translateY(0px) translateX(0px);
  }

  33% {
    transform: translateY(-20px) translateX(10px);
  }

  66% {
    transform: translateY(10px) translateX(-10px);
  }
}

@media (max-width: 600px) {
  .login-card {
    padding: 2rem 1.5rem;
    border-radius: 20px;
  }

  .circle1,
  .circle2,
  .circle3 {
    filter: blur(80px);
    position: fixed;
  }
}

.cursor-pointer {
  cursor: pointer;
}

* {
  -webkit-tap-highlight-color: transparent;
}
</style>
