import type { ComponentType, ReactNode } from 'react'

import type { Awaitable, SiteData } from '../shared'
import type { Router } from './router'

export interface EnhanceAppContext {
  /**
   * The router instance (SPA navigation etc).
   */
  router: Router
  /**
   * The site data.
   */
  siteData: SiteData
  /**
   * Register extra components usable by markdown-generated pages
   * (future-proof; unused in the M0 skeleton).
   */
  registerComponent?: (name: string, component: ComponentType) => void
}

export interface Theme {
  Layout?: ComponentType<{ children?: ReactNode }>
  enhanceApp?: (ctx: EnhanceAppContext) => Awaitable<void>
  extends?: Theme

  /**
   * Runs on the client inside the root component's effect (SSR-safe body:
   * guard DOM access). With `extends`, setups run base-first.
   */
  setup?: () => void

  /**
   * @deprecated Render not found page by checking `useData().page.isNotFound` in Layout instead.
   */
  NotFound?: ComponentType
}
