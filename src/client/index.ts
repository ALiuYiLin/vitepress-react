// exports in this file are exposed to themes and md files via 'vitepress'
// so the user can do `import { useData, useRoute } from 'vitepress'`

// types
export type { Router, Route } from './app/router'
export type { EnhanceAppContext, Theme } from './app/theme'
export type { VitePressData } from './shared'

// components
import { ClientOnly } from './app/components/ClientOnly'
import { Content } from './app/components/Content'

// composables / data access
export { useData, useRoute, useRouter } from './app/data'

// utilities
export {
  _escapeHtml,
  inBrowser,
  onContentUpdated,
  withBase
} from './app/utils'

// components
export { ClientOnly, Content }
