import type { Theme } from '@10coding/vitepress-react'
import DefaultTheme from '@10coding/vitepress-react/theme'

import CustomLayout from './components/CustomLayout.vue'

export default {
  extends: DefaultTheme,
  Layout: CustomLayout
} satisfies Theme
