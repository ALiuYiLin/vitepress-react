import type { Theme } from '@10coding/vitepress-react'
import DefaultTheme from '@10coding/vitepress-react/theme'

import ApiPreference from './components/ApiPreference.vue'
import CustomLayout from './components/CustomLayout.vue'
import NavVersion from './components/NavVersion.vue'

export default {
  extends: DefaultTheme,
  Layout: CustomLayout,
  enhanceApp({ app }) {
    app.component('ApiPreference', ApiPreference)
    app.component('NavVersion', NavVersion)
  }
} satisfies Theme
