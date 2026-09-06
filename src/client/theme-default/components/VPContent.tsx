import type { ReactNode } from 'react'
import { useData } from '@10coding/vitepress-react'

import { useLayout } from '../composables/use-layout'
import '../styles/components/VPContent.scoped.css'
import { NotFound } from '../NotFound'
import { VPPage } from './VPPage'
import { VPHome } from './VPHome'
import { VPDoc } from './VPDoc'

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ')

/** 页面主体容器(按 layout 选择渲染 Notfound/Page/Home/Doc) */
export function VPContent({ inert }: { inert?: boolean }) {
  const { page, frontmatter } = useData()
  const { hasSidebar, isHome } = useLayout()
  const layout = (frontmatter as { layout?: string })?.layout
  const isNotFound = Boolean((page as { isNotFound?: boolean })?.isNotFound)

  let body: ReactNode
  if (isNotFound) body = <NotFound />
  else if (layout === 'page') body = <VPPage />
  else if (layout === 'home') body = <VPHome />
  else body = <VPDoc />

  return (
    <div
      id="VPContent"
      className={cx(
        'content',
        'VPContent',
        hasSidebar && 'hasSidebar',
        hasSidebar && 'has-sidebar',
        isHome && 'isHome',
        isHome && 'is-home'
      )}
      {...({ inert: inert || undefined } as Record<string, unknown>)}
    >
      {body}
    </div>
  )
}
