import { App as VueApp, Plugin } from 'vue'
import BookFlip from './components/BookFlip.vue'

export { BookFlip }

export default {
  install(app: VueApp) {
    app.component('BookFlip', BookFlip)
  }
} as Plugin
