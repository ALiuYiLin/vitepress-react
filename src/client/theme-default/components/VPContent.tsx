import type { ReactNode } from 'react'
import { useData } from 'vitepress'

import { useLayout } from '../composables/use-layout'
import { NotFound } from '../NotFound'
import { VPPage } from './VPPage'
import { VPHome } from './vp-home'
import { VPDoc } from './VPDoc'
import s from './VPContent.module.css'

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ')

/** 页面主体容器(按 layout 选择渲染 Notfound/Page/Home/Doc) */
export function VPContent() {
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
        s.content,
        'VPContent',
        hasSidebar && s.hasSidebar,
        hasSidebar && 'has-sidebar',
        isHome && s.isHome,
        isHome && 'is-home'
      )}
    >
      {body}
    </div>
  )
}
