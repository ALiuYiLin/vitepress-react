// entry for SSR (static generation, node side)
import { renderToString } from 'react-dom/server'

import type { SSGContext } from '../shared'
import { createApp } from './index'

export async function render(path: string): Promise<SSGContext> {
  const { router, element } = await createApp()
  await router.go(path)
  const content = renderToString(element)
  const ctx: SSGContext = {
    content,
    vpIcons: new Set<string>(),
    teleports: {}
  }
  return ctx
}
