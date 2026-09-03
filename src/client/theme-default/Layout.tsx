import { useEffect } from 'react'
import { Content, useData, useRoute } from 'vitepress'

import { useNav } from './composables/use-nav'
import { useCloseSidebarOnEscape, useSidebarControl } from './composables/use-sidebar'
import { VPBackdrop } from './components/VPBackdrop'
import { VPContent } from './components/VPContent'
import { VPFooter } from './components/VPFooter'
import { VPLocalNav } from './components/VPLocalNav'
import { VPNav } from './components/VPNav'
import { VPSidebar } from './components/VPSidebar'
import { VPSkipLink } from './components/VPSkipLink'
import './layout.module.css'

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ')

/**
 * 默认主题布局(对应 Vue Layout.vue):
 * SkipLink → 背景遮罩 → VPNav → VPLocalNav → VPSidebar → VPContent → VPFooter。
 * 侧栏开合由本组件持有;屏幕导航打开时其后内容 inert。
 */
export function Layout() {
  const { frontmatter, theme } = useData()
  const {
    isOpen: isSidebarOpen,
    open: openSidebar,
    close: closeSidebar
  } = useSidebarControl()
  const { isScreenOpen } = useNav()
  const route = useRoute()

  // 关闭侧栏:Esc / 路由变化 / 视口升至桌面(≥60rem)
  useCloseSidebarOnEscape(closeSidebar)
  useEffect(() => {
    closeSidebar()
  }, [route.path, closeSidebar])
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 60rem)')
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) closeSidebar()
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [closeSidebar])

  const fm = frontmatter as {
    layout?: string | false
    pageClass?: string
  }
  const t = theme as { gradedContainers?: boolean }

  // frontmatter.layout === false → 不渲染任何外壳,直接输出内容
  if (fm.layout === false) return <Content />

  return (
    <div
      className={cx(
        'Layout',
        fm.pageClass && fm.pageClass,
        t.gradedContainers && 'vp-graded-containers'
      )}
    >
      <VPSkipLink inert={isScreenOpen} />
      <VPBackdrop className="backdrop" show={isSidebarOpen} onClick={closeSidebar} />
      <VPNav />
      <VPLocalNav open={isSidebarOpen} onOpenMenu={openSidebar} inert={isScreenOpen} />
      <VPSidebar open={isSidebarOpen} inert={isScreenOpen} />
      <VPContent inert={isScreenOpen} />
      <VPFooter inert={isScreenOpen} />
    </div>
  )
}
