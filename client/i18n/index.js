/**
 * @fileoverview Configuración de i18next para la internacionalización de la aplicación.
 * Gestiona la carga de traducciones en español e inglés y la detección automática del idioma.
 */

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import en from './locales/en.json'
import es from './locales/es.json'

// Limpieza de claves antiguas de idioma para evitar conflictos con versiones previas
localStorage.removeItem('area862_language')
localStorage.removeItem('area862_lang')

/**
 * Inicialización de i18next con soporte para React, detección de idioma y carga de recursos.
 */
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es }
    },
    fallbackLng: 'en',
    defaultNS: 'translation',
    detection: {
      order: ['localStorage'],
      lookupLocalStorage: 'area862_ui_lang',
      caches: ['localStorage']
    },
    interpolation: {
      escapeValue: false // React ya se encarga de escapar los valores
    }
  })

export default i18n
