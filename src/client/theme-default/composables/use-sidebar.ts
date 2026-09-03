import { useCallback, useEffect, useState } from 'react'
import { useRoute } from 'vitepress'

import { flattenSidebarItems, normalizePath, type VpSidebarItem } from '../theme-utils'

/** 侧栏抽屉开合(桌面 sticky / 移动抽屉) */
export function useSidebarControl() {
  const [isOpen, setOpen] = useState(false)
  return {
    isOpen,
    open: () => setOpen(true),
    close: () => setOpen(false),
    toggle: () => setOpen((v) => !v)
  }
}

/** Esc 关闭侧栏 */
export function useCloseSidebarOnEscape(close: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])
}

function itemHasActive(item: VpSidebarItem, current: string): boolean {
  return flattenSidebarItems([{ items: item.items ?? [] }]).some(
    (l) => normalizePath(l.link) === current
  )
}

/** 单个侧栏项的控制:折叠/展开、激活态、自动展开含当前页的祖先 */
export function useSidebarItemControl(item: VpSidebarItem) {
  const route = useRoute()
  const current = normalizePath(route.path)
  const normalized = normalizePath(item.link ?? '')
  const isLink = Boolean(item.link)
  const isCurrentLink = isLink && normalized === current
  const isActiveLink =
    isLink &&
    (isCurrentLink ||
      (normalized !== '/' && current.startsWith(normalized + '/')))
  const hasChildren = Boolean(item.items?.length)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (hasChildren && itemHasActive(item, current)) setCollapsed(false)
  }, [current, hasChildren, item])

  return {
    collapsed,
    collapsible: hasChildren,
    isLink,
    isActiveLink,
    isCurrentLink,
    hasActiveLink: itemHasActive(item, current),
    hasChildren,
    toggleCollapsed: useCallback(() => setCollapsed((v) => !v), [])
  }
}
