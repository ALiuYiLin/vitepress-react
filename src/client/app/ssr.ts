// entry for SSR (static generation, node side)
import { renderToString } from 'react-dom/server'

import type { SSGContext } from '../shared'
import { createApp } from './index'

export async function render(path: string): Promise<SSGContext> {
  // 收集器必须在渲染前建好并注入组件树,否则 useIcon() 登记不到任何东西
  // (build 就不会生成 vp-icons.css,图标在产物里只剩空 mask)
  const vpIcons = new Set<string>()
  const { router, element } = await createApp({ ssrIcons: vpIcons })
  await router.go(path)
  const content = renderToString(element)
  const ctx: SSGContext = {
    content,
    vpIcons,
    teleports: {}
  }
  return ctx
}
