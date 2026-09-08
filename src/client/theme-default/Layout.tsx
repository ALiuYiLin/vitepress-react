import { useEffect } from 'react'
import { Content, useData, useRoute } from '@10coding/vitepress-react'

import { useThemeComponent } from './composables/use-theme-component'
import { useNav } from './composables/use-nav'
import {
  useCloseSidebarOnEscape,
  useSidebarControl
} from './composables/use-sidebar'
import {
  LayoutSlotsContext,
  renderLayoutSlot,
  resolveLayoutSlots,
  type LayoutProps
} from './layout-slots'
import { VPBackdrop } from './components/VPBackdrop'
import { VPContent } from './components/VPContent'
import { VPFooter } from './components/VPFooter'
import { VPLocalNav } from './components/VPLocalNav'
import { VPNav } from './components/VPNav'
import { VPSidebar } from './components/VPSidebar'
import { VPSkipLink } from './components/VPSkipLink'
import './styles/components/Layout.scoped.css'

const cx = (...c: (string | false | undefined | null)[]) =>
  c.filter(Boolean).join(' ')

/**
 * 默认主题布局(对应 Vue Layout.vue):
 * SkipLink → 背景遮罩 → VPNav → VPLocalNav → VPSidebar → VPContent → VPFooter。
 * 侧栏开合由本组件持有;屏幕导航打开时其后内容 inert。
 *
 * 扩展点(机制 A):props 提供 Vue Layout 插槽同语义的具名 slot
 * (camelCase,如 asideOutlineBefore / navBarContentAfter),见 layout-slots.ts。
 * 扩展点(机制 B):内部子组件经 useThemeComponent 解析,可被
 * Theme.components 按名覆盖(如 components: { VPNavBar: MyNavBar })。
 */
export function Layout(props: LayoutProps = {}) {
  const { frontmatter, theme } = useData()
  const {
    isOpen: isSidebarOpen,
    open: openSidebar,
    close: closeSidebar
  } = useSidebarControl()
  const { isScreenOpen } = useNav()
  const route = useRoute()

  // 内部组合组件:注册表命中即用用户覆盖,否则用默认(下方 import 的兜底)
  const Nav = useThemeComponent('VPNav', VPNav)
  const LocalNav = useThemeComponent('VPLocalNav', VPLocalNav)
  const Sidebar = useThemeComponent('VPSidebar', VPSidebar)
  const ContentBox = useThemeComponent('VPContent', VPContent)
  const Footer = useThemeComponent('VPFooter', VPFooter)
  const Backdrop = useThemeComponent('VPBackdrop', VPBackdrop)
  const SkipLink = useThemeComponent('VPSkipLink', VPSkipLink)

  // 具名插槽:slots 表 ∪ 直传 prop(直传优先)
  const slots = resolveLayoutSlots(props)
  const layoutTop = renderLayoutSlot(slots.layoutTop)
  const layoutBottom = renderLayoutSlot(slots.layoutBottom)

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
    <LayoutSlotsContext.Provider value={slots}>
      <div
        className={cx(
          'Layout',
          fm.pageClass && fm.pageClass,
          t.gradedContainers && 'vp-graded-containers'
        )}
      >
        {layoutTop}
        <SkipLink inert={isScreenOpen} />
        <Backdrop
          className="backdrop"
          show={isSidebarOpen}
          onClick={closeSidebar}
        />
        <Nav />
        <LocalNav
          open={isSidebarOpen}
          onOpenMenu={openSidebar}
          inert={isScreenOpen}
        />
        <Sidebar open={isSidebarOpen} inert={isScreenOpen} />
        <ContentBox inert={isScreenOpen} />
        <Footer inert={isScreenOpen} />
        {layoutBottom}
      </div>
    </LayoutSlotsContext.Provider>
  )
}
