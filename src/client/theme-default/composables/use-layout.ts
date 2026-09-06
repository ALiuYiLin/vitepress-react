import { useData, useRoute } from '@10coding/vitepress-react'

import { sidebarGroupsFor, type VpHeader } from '../theme-utils'

/** 页面布局信息:home/侧栏/大纲/本地导航 */
export function useLayout() {
  const { theme, frontmatter, page } = useData()
  const route = useRoute()
  const cfg = theme as {
    sidebar?: unknown
    aside?: unknown
    outline?: unknown
    docFooter?: unknown
  }
  const fm = frontmatter as {
    layout?: string
    isHome?: boolean
    sidebar?: boolean
    aside?: boolean | 'left'
    outline?: unknown
  }
  const isHome = Boolean(fm.isHome ?? fm.layout === 'home')
  const sidebarConfig = cfg.sidebar as never
  const groups = sidebarGroupsFor(sidebarConfig, route.path)
  const hasSidebarEnabled = fm.sidebar !== false && cfg.sidebar !== false
  const hasSidebar = hasSidebarEnabled && groups.length > 0
  const headers = ((page as { headers?: VpHeader[] })?.headers ?? []) as VpHeader[]
  const hasAside =
    (fm.aside ?? cfg.aside ?? true) !== false && headers.length > 0
  const leftAside = fm.aside === 'left'
  const hasLocalNav = headers.length > 0 || hasSidebar

  return {
    isHome,
    sidebarGroups: groups,
    hasSidebar: isHome ? false : hasSidebar,
    isSidebarEnabled: isHome ? false : hasSidebar,
    hasAside: isHome ? false : hasAside,
    leftAside,
    headers,
    hasLocalNav: isHome ? false : hasLocalNav
  }
}
