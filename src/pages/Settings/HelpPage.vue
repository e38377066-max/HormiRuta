<template>
  <q-page class="help-page">
    <div class="help-header">
      <q-btn flat round dense icon="arrow_back" color="white" @click="$router.back()" />
      <span class="header-title">Ayuda y asistencia</span>
    </div>

    <div class="help-content">
      <q-list class="help-list">
        <q-item clickable v-ripple @click="showFAQ">
          <q-item-section avatar>
            <q-icon name="help_outline" color="primary" />
          </q-item-section>
          <q-item-section>
            <q-item-label>Preguntas frecuentes</q-item-label>
            <q-item-label caption>Encuentra respuestas a dudas comunes</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-icon name="chevron_right" color="grey" />
          </q-item-section>
        </q-item>

        <q-item clickable v-ripple @click="showTutorial">
          <q-item-section avatar>
            <q-icon name="play_circle_outline" color="primary" />
          </q-item-section>
          <q-item-section>
            <q-item-label>Tutorial de inicio</q-item-label>
            <q-item-label caption>Aprende a usar HormiRuta paso a paso</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-icon name="chevron_right" color="grey" />
          </q-item-section>
        </q-item>

        <q-item clickable v-ripple @click="contactSupport">
          <q-item-section avatar>
            <q-icon name="mail_outline" color="primary" />
          </q-item-section>
          <q-item-section>
            <q-item-label>Contactar soporte</q-item-label>
            <q-item-label caption>Envíanos un mensaje con tu consulta</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-icon name="chevron_right" color="grey" />
          </q-item-section>
        </q-item>

        <q-item clickable v-ripple @click="shareFeedback">
          <q-item-section avatar>
            <q-icon name="rate_review" color="primary" />
          </q-item-section>
          <q-item-section>
            <q-item-label>Compartir comentarios</q-item-label>
            <q-item-label caption>Ayúdanos a mejorar con tu opinión</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-icon name="chevron_right" color="grey" />
          </q-item-section>
        </q-item>
      </q-list>

      <div class="section-title">Guías rápidas</div>

      <q-list class="help-list">
        <q-expansion-item
          v-for="(section, index) in helpSections"
          :key="index"
          :label="section.title"
          class="expansion-item"
          expand-separator
          header-class="text-white"
        >
          <q-card class="expansion-content">
            <q-card-section>
              <div v-html="section.content" class="help-text"></div>
            </q-card-section>
          </q-card>
        </q-expansion-item>
      </q-list>
    </div>
  </q-page>
</template>

<script setup>
import { useQuasar } from 'quasar'

const $q = useQuasar()

const helpSections = [
  {
    title: '¿Cómo añadir paradas?',
    content: `
      <p><strong>Opciones para añadir paradas:</strong></p>
      <ul>
        <li>Escribe la dirección en el campo de búsqueda</li>
        <li>Usa el micrófono para búsqueda por voz</li>
        <li>Toca en el mapa para seleccionar un punto</li>
        <li>Importa desde una lista o archivo</li>
      </ul>
    `
  },
  {
    title: '¿Cómo optimizar mi ruta?',
    content: `
      <p>La optimización es automática. Añade tus paradas y el sistema calculará el mejor orden.</p>
      <p><strong>Tips:</strong></p>
      <ul>
        <li>Activa "Ida y vuelta" si necesitas regresar</li>
        <li>Arrastra las paradas para fijar el orden manualmente</li>
      </ul>
    `
  },
  {
    title: '¿Cómo iniciar la navegación?',
    content: `
      <p>Pulsa el botón "Iniciar" para comenzar. Verás:</p>
      <ul>
        <li>La siguiente parada destacada</li>
        <li>Botones para completar o saltar</li>
        <li>Opción de abrir en tu app de mapas favorita</li>
      </ul>
    `
  },
  {
    title: '¿Cómo compartir mi ruta?',
    content: `
      <p>Abre el menú (3 puntos) y selecciona "Compartir ruta". Podrás enviarla por WhatsApp, email o copiar al portapapeles.</p>
    `
  }
]

const showFAQ = () => {
  $q.dialog({
    title: 'Preguntas frecuentes',
    message: 'Próximamente: Centro de ayuda completo con todas las preguntas frecuentes.',
    ok: 'Entendido'
  })
}

const showTutorial = () => {
  $q.dialog({
    title: 'Tutorial',
    message: 'Próximamente: Tutorial interactivo paso a paso.',
    ok: 'Entendido'
  })
}

const contactSupport = () => {
  window.open('mailto:soporte@hormiruta.com?subject=Ayuda con HormiRuta', '_blank')
}

const shareFeedback = () => {
  $q.dialog({
    title: 'Compartir comentarios',
    message: '¿Qué te gustaría que mejoráramos?',
    prompt: {
      model: '',
      type: 'textarea'
    },
    cancel: true,
    persistent: true
  }).onOk((feedback) => {
    if (feedback) {
      $q.notify({ message: '¡Gracias por tus comentarios!', type: 'positive' })
    }
  })
}
</script>

<style scoped>
.help-page {
  background: #121212;
  min-height: 100vh;
  padding-top: 56px;
}

.help-header {
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

.help-content {
  padding: 16px;
}

.section-title {
  color: #4a9eff;
  font-size: 13px;
  font-weight: 500;
  padding: 24px 0 8px 0;
}

.help-list {
  background: transparent;
}

.help-list .q-item {
  padding: 12px 0;
  min-height: 64px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.help-list .q-item__label {
  color: #ffffff;
  font-size: 15px;
}

.help-list .q-item__label--caption {
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
}

.expansion-item {
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.expansion-content {
  background: rgba(255, 255, 255, 0.03);
}

.help-text {
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  line-height: 1.6;
}

.help-text ul {
  padding-left: 20px;
  margin: 8px 0;
}

.help-text li {
  margin-bottom: 4px;
}
</style>
