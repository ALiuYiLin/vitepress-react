import { useState } from 'react'
import { Content, useData } from 'vitepress'

import { TopNav } from './TopNav'
import { SidebarList } from './Sidebar'
import { AsideOutline } from './AsideOutline'
import { Footer, PrevNext } from './layout-parts'

/**
 * 参考默认主题 Layout(React 版;对上游 default theme 的结构近似,
 * 视觉自由——迁移 D6)。组件按需订阅 useData() 快照。
 */
export default function Layout() {
  const data = useData()
  const [menuOpen, setMenuOpen] = useState(false)

  const page = data.page
  const frontmatter = (page.frontmatter ?? {}) as {
    sidebar?: boolean
    aside?: boolean | 'left'
    outline?: false | { level?: number | number[] | 'deep' }
    layout?: string
  }
  const cfg = data.theme as {
    aside?: boolean | 'left'
    outline?: unknown
    footer?: unknown
    sidebar?: unknown
  }

  const is404 = page.isNotFound === true

  // 大纲:取 h2/h3(h1 是页面主标题;上限按 level 过滤,默认展示到 h3)
  const outlineLevels = new Set<number>([2, 3])
  const headers = page.headers.filter((h) => outlineLevels.has(h.level))
  const showAside =
    !is404 &&
    headers.length >= 2 &&
    cfg.aside !== false &&
    cfg.outline !== false &&
    frontmatter.aside !== false &&
    frontmatter.outline !== false
  const showSidebar = !is404 && frontmatter.sidebar !== false

  return (
    <div className="vp-layout">
      <TopNav onMenu={() => setMenuOpen(true)} />

      {menuOpen ? (
        <>
          <div className="vp-drawer-backdrop" onClick={() => setMenuOpen(false)} />
          <div className="vp-drawer" role="dialog" aria-label="Navigation">
            <SidebarList />
          </div>
        </>
      ) : null}

      <div className="vp-shell">
        {showSidebar ? (
          <aside className="vp-sidebar" aria-label="Sidebar">
            <SidebarList />
          </aside>
        ) : null}
        <div className={`vp-main${showAside ? ' has-aside' : ''}`}>
          <div className="vp-doc-container">
            <Content />
            {!is404 ? <PrevNext /> : null}
          </div>
          {showAside ? <AsideOutline headers={headers} /> : null}
        </div>
      </div>

      <Footer />
    </div>
  )
}
