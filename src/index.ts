import { App as VueApp, Plugin } from 'vue'
import BookFlip from './components/BookFlip.vue'
import BookFlipPage from './components/BookFlipPage.vue'

export { BookFlip, BookFlipPage }

export default {
  install(app: VueApp) {
    app.component('BookFlip', BookFlip)
    app.component('BookFlipPage', BookFlipPage)
  }
} as Plugin
