<template>
  <q-page class="help-page">
    <div class="page-header q-pa-md">
      <div class="text-h5 text-weight-bold">Guía de Ayuda</div>
      <div class="text-caption text-grey">Aprende a usar HormiRuta</div>
    </div>

    <q-list class="q-px-md q-pt-md">
      <q-expansion-item
        v-for="(section, index) in helpSections"
        :key="index"
        :icon="section.icon"
        :label="section.title"
        class="help-section q-mb-sm"
        expand-separator
        header-class="text-weight-medium"
      >
        <q-card class="help-content">
          <q-card-section>
            <div v-html="section.content"></div>
          </q-card-section>
        </q-card>
      </q-expansion-item>
    </q-list>

    <div class="q-pa-md">
      <q-card class="contact-card">
        <q-card-section class="text-center">
          <q-icon name="support_agent" size="48px" color="primary" />
          <div class="text-h6 q-mt-sm">¿Necesitas más ayuda?</div>
          <div class="text-body2 text-grey q-mt-xs">
            Contáctanos y te ayudaremos con cualquier duda
          </div>
          <q-btn 
            color="primary" 
            label="Contactar soporte" 
            icon="mail"
            class="q-mt-md"
            rounded
            unelevated
            @click="contactSupport"
          />
        </q-card-section>
      </q-card>
    </div>

    <div class="q-pa-md">
      <q-card class="tips-card">
        <q-card-section>
          <div class="text-subtitle1 text-weight-bold q-mb-md">
            <q-icon name="lightbulb" color="warning" class="q-mr-sm" />
            Consejos rápidos
          </div>
          <q-list dense>
            <q-item v-for="(tip, i) in quickTips" :key="i" class="q-px-none">
              <q-item-section avatar>
                <q-icon name="check_circle" color="positive" size="20px" />
              </q-item-section>
              <q-item-section>
                <q-item-label class="text-body2">{{ tip }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<script setup>

const helpSections = [
  {
    icon: 'add_location',
    title: '¿Cómo añadir paradas?',
    content: `
      <p><strong>Hay varias formas de añadir paradas:</strong></p>
      <ol>
        <li><strong>Escribir dirección:</strong> Pulsa en el campo de búsqueda y escribe la dirección. Selecciona de las sugerencias.</li>
        <li><strong>Búsqueda por voz:</strong> Pulsa el icono del micrófono y di la dirección.</li>
        <li><strong>Tocar en el mapa:</strong> Mantén pulsado en cualquier punto del mapa para añadir una parada.</li>
        <li><strong>Importar lista:</strong> Usa el menú (3 puntos) y selecciona "Importar hoja de cálculo" para pegar múltiples direcciones.</li>
      </ol>
    `
  },
  {
    icon: 'route',
    title: '¿Cómo optimizar mi ruta?',
    content: `
      <p>La optimización automática encuentra el orden más eficiente para tus paradas:</p>
      <ol>
        <li>Añade todas tus paradas a la ruta</li>
        <li>El sistema calculará automáticamente el mejor orden</li>
        <li>Verás el tiempo y distancia ahorrados en la parte superior</li>
      </ol>
      <p><strong>Opciones adicionales:</strong></p>
      <ul>
        <li>Activa "Viaje ida y vuelta" si necesitas regresar al inicio</li>
        <li>Arrastra las paradas para fijar manualmente el orden</li>
      </ul>
    `
  },
  {
    icon: 'navigation',
    title: '¿Cómo iniciar la navegación?',
    content: `
      <p>Una vez tengas tus paradas configuradas:</p>
      <ol>
        <li>Pulsa el botón "Iniciar" en la pantalla principal</li>
        <li>Se mostrará la primera parada con indicaciones</li>
        <li>Usa los botones "Completar" o "Saltar" según avances</li>
        <li>Pulsa "Navegar" para abrir la ruta en tu app de mapas</li>
      </ol>
    `
  },
  {
    icon: 'share',
    title: '¿Cómo compartir mi ruta?',
    content: `
      <p>Puedes compartir tu ruta de varias formas:</p>
      <ol>
        <li>Abre el menú (3 puntos) junto al buscador</li>
        <li>Selecciona "Compartir ruta"</li>
        <li>Elige la app donde quieres compartir (WhatsApp, email, etc.)</li>
      </ol>
      <p>También puedes "Copiar paradas" para pegar la lista en cualquier app.</p>
    `
  },
  {
    icon: 'bookmark',
    title: '¿Cómo guardar rutas?',
    content: `
      <p>Tus rutas se guardan automáticamente en tu cuenta:</p>
      <ul>
        <li>Cada ruta que crees se sincroniza con tu perfil</li>
        <li>Accede a "Mis Rutas Guardadas" desde el menú lateral</li>
        <li>Puedes duplicar, compartir o eliminar rutas guardadas</li>
      </ul>
      <p><strong>Rutas locales:</strong> También se guardan copias en tu dispositivo para acceso sin conexión.</p>
    `
  },
  {
    icon: 'drag_indicator',
    title: '¿Cómo reordenar paradas?',
    content: `
      <p>Puedes reorganizar las paradas manualmente:</p>
      <ol>
        <li>Mantén pulsado el icono de arrastrar (≡) a la izquierda de cada parada</li>
        <li>Arrastra la parada a la posición deseada</li>
        <li>Suelta para confirmar el nuevo orden</li>
      </ol>
      <p>El sistema recalculará automáticamente el tiempo y distancia total.</p>
    `
  }
]

const quickTips = [
  'Usa la búsqueda por voz para añadir paradas más rápido',
  'Activa el tema oscuro para ahorrar batería en pantallas OLED',
  'Exporta tus rutas antes de borrar datos locales',
  'Mantén pulsado el mapa para añadir paradas sin escribir',
  'Sincroniza tus rutas iniciando sesión con Google'
]

const contactSupport = () => {
  window.open('mailto:soporte@hormiruta.com?subject=Ayuda con HormiRuta', '_blank')
}
</script>

<style scoped>
.help-page {
  background: var(--q-dark-page);
  min-height: 100vh;
}

.page-header {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.help-section {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
}

.help-content {
  background: rgba(255, 255, 255, 0.02);
}

.help-content p, .help-content li {
  line-height: 1.6;
  margin-bottom: 8px;
}

.contact-card, .tips-card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}
</style>
