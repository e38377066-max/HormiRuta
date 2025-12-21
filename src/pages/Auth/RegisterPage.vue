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
          Crear cuenta
        </h1>
        <p class="text-grey-4 text-subtitle2 q-mb-none">Regístrate para comenzar</p>
      </div>

      <q-form @submit.prevent="onRegister" class="q-gutter-md">
        <q-input v-model="form.username" label="Nombre completo" filled dense dark color="cyan-4"
          input-class="text-white" class="input-pro" :rules="nameRules" lazy-rules>
          <template v-slot:prepend>
            <q-icon name="person" color="cyan-4" />
          </template>
        </q-input>

        <q-input v-model="form.email" label="Correo electrónico" type="email" filled dense dark color="cyan-4"
          input-class="text-white" class="input-pro" :rules="emailRules" lazy-rules autocomplete="email">
          <template v-slot:prepend>
            <q-icon name="mail" color="cyan-4" />
          </template>
        </q-input>

        <q-input v-model="form.phone" label="Teléfono (opcional)" filled dense dark color="cyan-4"
          input-class="text-white" class="input-pro">
          <template v-slot:prepend>
            <q-icon name="phone" color="cyan-4" />
          </template>
        </q-input>

        <q-input v-model="form.password" label="Contraseña" :type="showPassword ? 'text' : 'password'" filled dense dark
          color="cyan-4" input-class="text-white" class="input-pro" :rules="passwordRules" lazy-rules>
          <template v-slot:prepend>
            <q-icon name="lock" color="cyan-4" />
          </template>
          <template v-slot:append>
            <q-icon :name="showPassword ? 'visibility_off' : 'visibility'" color="grey-5" class="cursor-pointer"
              @click="showPassword = !showPassword" />
          </template>
        </q-input>

        <q-input v-model="form.confirmPassword" label="Confirmar contraseña" :type="showPassword ? 'text' : 'password'" filled dense dark
          color="cyan-4" input-class="text-white" class="input-pro" :rules="confirmPasswordRules" lazy-rules>
          <template v-slot:prepend>
            <q-icon name="lock" color="cyan-4" />
          </template>
        </q-input>

        <q-btn :loading="loading" :disable="loading" type="submit" label="Crear cuenta"
          class="login-btn q-mt-md full-width" color="primary" no-caps unelevated size="md">
          <template v-slot:loading>
            <q-spinner color="white" size="20px" />
          </template>
        </q-btn>

        <div class="text-center text-grey-3 q-mt-md">
          <span class="text-body2">¿Ya tienes cuenta?</span>
          <q-btn flat dense color="cyan-3" label="Inicia sesión" @click="goLogin" no-caps
            class="text-weight-medium" />
        </div>
      </q-form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router'
import { useAuthStore } from 'src/stores/auth-store'

const router = useRouter()
const $q = useQuasar()
const authStore = useAuthStore()

const form = ref({ 
  username: '', 
  email: '', 
  phone: '',
  password: '', 
  confirmPassword: '' 
})
const loading = ref(false)
const showPassword = ref(false)

const nameRules = [
  val => !!val || 'El nombre es requerido',
  val => val.length >= 2 || 'Mínimo 2 caracteres'
]

const emailRules = [
  val => !!val || 'El correo es requerido',
  val => /.+@.+\..+/.test(val) || 'Ingresa un correo válido'
]

const passwordRules = [
  val => !!val || 'La contraseña es requerida',
  val => val.length >= 6 || 'Mínimo 6 caracteres'
]

const confirmPasswordRules = [
  val => !!val || 'Confirma tu contraseña',
  val => val === form.value.password || 'Las contraseñas no coinciden'
]

async function onRegister() {
  loading.value = true
  try {
    const result = await authStore.register({
      username: form.value.username,
      email: form.value.email,
      phone: form.value.phone,
      password: form.value.password
    })
    
    if (result.success) {
      $q.notify({ 
        type: 'positive', 
        message: 'Cuenta creada exitosamente', 
        caption: `Bienvenido ${result.user.username}`, 
        position: 'top', 
        timeout: 2000 
      })
      router.push('/test')
    } else {
      $q.notify({ 
        type: 'negative', 
        message: 'Error al registrar', 
        caption: result.error, 
        position: 'top' 
      })
    }
  } catch {
    $q.notify({ 
      type: 'negative', 
      message: 'Error al registrar', 
      caption: 'Verifica tu conexión', 
      position: 'top' 
    })
  } finally {
    loading.value = false
  }
}

function goLogin() {
  router.push('/login')
}
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
}

.logo-avatar {
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 4px 20px rgba(6, 182, 212, 0.3);
}

.login-btn {
  background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);
  border-radius: 12px;
  font-weight: 600;
}

.circle {
  position: absolute;
  border-radius: 50%;
  filter: blur(120px);
  opacity: 0.4;
  z-index: 0;
}

.circle1 {
  width: 350px;
  height: 350px;
  background: #3b82f6;
  top: -100px;
  left: -120px;
}

.circle2 {
  width: 400px;
  height: 400px;
  background: #06b6d4;
  bottom: -120px;
  right: -100px;
}

.circle3 {
  width: 300px;
  height: 300px;
  background: #8b5cf6;
  top: 50%;
  right: -150px;
}
</style>
