import { defineStore } from 'pinia'
import { Dark } from 'quasar'

export const useThemeStore = defineStore('theme', {
  state: () => ({
    isDark: JSON.parse(localStorage.getItem('darkMode') || 'true')
  }),

  actions: {
    initTheme() {
      Dark.set(this.isDark)
    },

    toggleTheme() {
      this.isDark = !this.isDark
      Dark.set(this.isDark)
      localStorage.setItem('darkMode', JSON.stringify(this.isDark))
    },

    setDarkMode(value) {
      this.isDark = value
      Dark.set(this.isDark)
      localStorage.setItem('darkMode', JSON.stringify(this.isDark))
    }
  }
})
