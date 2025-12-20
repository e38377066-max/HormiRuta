<template>
  <div class="splash-page flex flex-center column relative overflow-hidden">
    <div class="circle circle1"></div>
    <div class="circle circle2"></div>

    <div class="animate__animated animate__fadeInDown text-center">
      <img src="~assets/Hormiruta.png" alt="logo" class="splash-logo" />
    </div>

    <div class="animate__animated animate__fadeInUp q-mt-md text-white text-h5 text-weight-bold">
      HormiRuta
    </div>

    <p class="text-grey-4 q-mt-sm animate__animated animate__fadeInUp animate__delay-1s">
      Optimizando tus Rutas
    </p>
    <div class="loader-container animate__animated animate__fadeIn animate__delay-2s">
      <q-spinner color="white" size="40px" />
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

onMounted(() => {
  setTimeout(() => {
    router.push('/login')
  }, 5000)
})
</script>

<style scoped>
@import 'src/assets/css/animate.min.css';

.splash-page {
  background: radial-gradient(circle at 30% 30%, #1e1e2e, #0f172a);
  min-height: 100vh;
  color: white;
}

.splash-logo {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  box-shadow: 0 0 40px rgba(59, 130, 246, 0.6);
  animation: pulseLogo 3s ease-in-out infinite;
  background-color: #fff;
}

@keyframes pulseLogo {

  0%,
  100% {
    transform: scale(1);
    box-shadow: 0 0 30px rgba(59, 130, 246, 0.5);
  }

  50% {
    transform: scale(1.05);
    box-shadow: 0 0 60px rgba(6, 182, 212, 0.7);
  }
}

.loader-container {
  margin-top: 2rem;
  animation: fadeGlow 2.5s ease-in-out infinite;
}

@keyframes fadeGlow {

  0%,
  100% {
    opacity: 0.8;
    transform: scale(1);
  }

  50% {
    opacity: 1;
    transform: scale(1.05);
  }
}

.circle {
  position: absolute;
  border-radius: 50%;
  filter: blur(100px);
  opacity: 0.6;
  z-index: 0;
  animation: move 12s ease-in-out infinite;
}

.circle1 {
  width: 300px;
  height: 300px;
  background: #3b82f6;
  top: -80px;
  left: -60px;
}

.circle2 {
  width: 350px;
  height: 350px;
  background: #06b6d4;
  bottom: -100px;
  right: -60px;
}

@keyframes move {

  0%,
  100% {
    transform: translateY(0px);
  }

  50% {
    transform: translateY(-20px);
  }
}
</style>
